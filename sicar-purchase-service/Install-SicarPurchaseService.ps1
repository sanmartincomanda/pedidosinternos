[CmdletBinding()]
param(
    [string]$InstallDirectory = "C:\sicar-proveedores-api",
    [string]$MysqlExecutable = "C:\Program Files (x86)\SICAR-S-131AB\MySQL\MySQL Server 5.6\bin\mysql.exe",
    [string]$MysqlHost = "127.0.0.1",
    [int]$MysqlPort = 3307,
    [string]$MysqlUser = "root",
    [string]$MysqlPassword = "",
    [int]$Port = 43110,
    [string]$ApiKey = "",
    [int]$CashRegisterId = 4,
    [int]$HistoryUserId = 1,
    [switch]$EnablePurchases
)

$ErrorActionPreference = "Stop"
$taskName = "CSM SICAR Proveedores API"
$firewallRuleName = "CSM SICAR Proveedores API TCP $Port"

$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = [Security.Principal.WindowsPrincipal]::new($identity)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw "Ejecuta PowerShell como administrador para instalar el servicio."
}

if (-not (Test-Path -LiteralPath $MysqlExecutable)) {
    throw "No existe mysql.exe en: $MysqlExecutable"
}

if ([string]::IsNullOrWhiteSpace($MysqlPassword)) {
    $securePassword = Read-Host "Contrasena MySQL de SICAR" -AsSecureString
    $passwordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
    try {
        $MysqlPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPointer)
    }
    finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer)
    }
}

$nodeCommand = Get-Command node.exe -ErrorAction Stop
$nodeExecutable = $nodeCommand.Source
$sourceServer = Join-Path $PSScriptRoot "server.mjs"
if (-not (Test-Path -LiteralPath $sourceServer)) {
    throw "No existe server.mjs junto al instalador."
}

if ([string]::IsNullOrWhiteSpace($ApiKey)) {
    $ApiKey = ([Guid]::NewGuid().ToString("N") + [Guid]::NewGuid().ToString("N"))
}

New-Item -ItemType Directory -Path $InstallDirectory -Force | Out-Null
$installedServer = Join-Path $InstallDirectory "server.mjs"
$installedConfig = Join-Path $InstallDirectory "config.local.json"
Copy-Item -LiteralPath $sourceServer -Destination $installedServer -Force

$settings = [ordered]@{
    host = "0.0.0.0"
    port = $Port
    apiKey = $ApiKey
    allowPurchases = [bool]$EnablePurchases
    allowedOrigins = @("*")
    cacheSeconds = 60
    timeZone = "America/Managua"
    mysql = [ordered]@{
        executable = $MysqlExecutable
        host = $MysqlHost
        port = $MysqlPort
        user = $MysqlUser
        password = $MysqlPassword
        database = "sicar"
    }
    sicar = [ordered]@{
        cashRegisterId = $CashRegisterId
        historyUserId = $HistoryUserId
    }
}
$settings | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $installedConfig -Encoding UTF8

$configAcl = [System.Security.AccessControl.FileSecurity]::new()
$configAcl.SetAccessRuleProtection($true, $false)
$systemSid = [System.Security.Principal.SecurityIdentifier]::new("S-1-5-18")
$administratorsSid = [System.Security.Principal.SecurityIdentifier]::new("S-1-5-32-544")
$configAcl.AddAccessRule([System.Security.AccessControl.FileSystemAccessRule]::new($systemSid, [System.Security.AccessControl.FileSystemRights]::FullControl, [System.Security.AccessControl.AccessControlType]::Allow))
$configAcl.AddAccessRule([System.Security.AccessControl.FileSystemAccessRule]::new($administratorsSid, [System.Security.AccessControl.FileSystemRights]::FullControl, [System.Security.AccessControl.AccessControlType]::Allow))
Set-Acl -LiteralPath $installedConfig -AclObject $configAcl

$action = New-ScheduledTaskAction `
    -Execute $nodeExecutable `
    -Argument "`"$installedServer`" --config `"$installedConfig`"" `
    -WorkingDirectory $InstallDirectory
$trigger = New-ScheduledTaskTrigger -AtStartup
$taskPrincipal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
$taskSettings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -RestartCount 10 `
    -RestartInterval (New-TimeSpan -Minutes 1) `
    -ExecutionTimeLimit ([TimeSpan]::Zero)

if (Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue) {
    Stop-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
}
Register-ScheduledTask `
    -TaskName $taskName `
    -Action $action `
    -Trigger $trigger `
    -Principal $taskPrincipal `
    -Settings $taskSettings `
    -Description "API local aislada para recibir compras de proveedores en SICAR." `
    -Force | Out-Null

if (-not (Get-NetFirewallRule -DisplayName $firewallRuleName -ErrorAction SilentlyContinue)) {
    New-NetFirewallRule `
        -DisplayName $firewallRuleName `
        -Direction Inbound `
        -Action Allow `
        -Protocol TCP `
        -LocalPort $Port `
        -Profile Private | Out-Null
}

Start-ScheduledTask -TaskName $taskName
Start-Sleep -Seconds 2

$headers = @{ "X-CSM-API-Key" = $ApiKey }
$health = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/health" -Headers $headers -TimeoutSec 10
if (-not $health.ok) {
    throw "El servicio se instalo, pero no respondio correctamente."
}

$localIps = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object {
        $_.IPAddress -notlike "127.*" -and
        $_.IPAddress -notlike "169.254.*" -and
        $_.InterfaceAlias -notmatch "Radmin|Tailscale|Loopback"
    } |
    Select-Object -ExpandProperty IPAddress

[pscustomobject]@{
    TaskName = $taskName
    State = (Get-ScheduledTask -TaskName $taskName).State
    PurchasesEnabled = [bool]$EnablePurchases
    LocalUrl = "http://127.0.0.1:$Port"
    TabletUrls = @($localIps | ForEach-Object { "http://$($_):$Port" }) -join ", "
    ApiKey = $ApiKey
    ExistingTransferWorkersChanged = $false
} | Format-List
