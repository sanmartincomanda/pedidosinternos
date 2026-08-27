[CmdletBinding()]
param(
    [string]$InstallDirectory = "C:\sicar-proveedores-api",
    [string]$MysqlExecutable = "C:\Program Files (x86)\SICAR-S-131AB\MySQL\MySQL Server 5.6\bin\mysql.exe",
    [string]$MysqlHost = "::1",
    [int]$MysqlPort = 3307,
    [string]$MysqlUser = "root",
    [string]$MysqlPassword = "",
    [int]$Port = 43110,
    [ValidateSet("127.0.0.1", "::1", "0.0.0.0")]
    [string]$BindHost = "127.0.0.1",
    [switch]$OpenFirewall,
    [string]$ApiKey = "",
    [int]$CashRegisterId = 4,
    [int]$HistoryUserId = 1,
    [string]$CompanyIdentifier = "granada",
    [string]$CompanyBranchId = "CARNES SAN MARTIN GRANADA",
    [string]$CompanyBranchAlias = "Granada",
    [string[]]$CompanySicarAliases = @("CARNES SAN MARTIN GRANADA"),
    [string[]]$AllowedFirebaseEmails = @("granada.inventory@sanmartinsr.com"),
    [string]$FirebaseWebApiKey = "",
    [string[]]$AllowedOrigins = @("https://traspasos.sanmartinsr.com", "http://localhost", "capacitor://localhost"),
    [string]$InventoryFirebaseServiceAccount = "C:\Users\Microsoft Windows 11\Downloads\inventario-sanmartin-firebase-adminsdk-fbsvc-0eff49b1f7.json",
    [string]$InventoryFirebaseProjectId = "inventario-sanmartin",
    [string]$InventoryFirebaseBranchDocumentId = "CARNES SAN MARTIN GRANADA",
    [string]$InventoryPayloadBranchAlias = "Granada",
    [string]$InventoryRequestedByEmail = "operaciones@sanmartinsr.com",
    [switch]$EnablePurchases,
    [switch]$EnableInventoryAdjustments,
    [switch]$EnableInventoryTriggers
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
$sourceMysqlProcess = Join-Path $PSScriptRoot "mysqlProcess.mjs"
if (-not (Test-Path -LiteralPath $sourceServer)) {
    throw "No existe server.mjs junto al instalador."
}
if (-not (Test-Path -LiteralPath $sourceMysqlProcess)) {
    throw "No existe mysqlProcess.mjs junto al instalador."
}

if ([string]::IsNullOrWhiteSpace($ApiKey)) {
    $ApiKey = ([Guid]::NewGuid().ToString("N") + [Guid]::NewGuid().ToString("N"))
}

if ([string]::IsNullOrWhiteSpace($FirebaseWebApiKey)) {
    throw "Indica -FirebaseWebApiKey con la clave web del proyecto Firebase inventario-sanmartin. No la guardes en Git."
}

New-Item -ItemType Directory -Path $InstallDirectory -Force | Out-Null
$installedServer = Join-Path $InstallDirectory "server.mjs"
$installedMysqlProcess = Join-Path $InstallDirectory "mysqlProcess.mjs"
$installedConfig = Join-Path $InstallDirectory "config.local.json"
$installedFirebaseAccount = Join-Path $InstallDirectory "inventory-firebase-service-account.json"
Copy-Item -LiteralPath $sourceServer -Destination $installedServer -Force
Copy-Item -LiteralPath $sourceMysqlProcess -Destination $installedMysqlProcess -Force

if ($EnableInventoryTriggers) {
    if (-not (Test-Path -LiteralPath $InventoryFirebaseServiceAccount)) {
        throw "No existe la cuenta de servicio Firebase: $InventoryFirebaseServiceAccount"
    }
    $firebaseAccount = Get-Content -LiteralPath $InventoryFirebaseServiceAccount -Raw | ConvertFrom-Json
    if ([string]$firebaseAccount.project_id -ne $InventoryFirebaseProjectId) {
        throw "La cuenta de servicio no corresponde al proyecto $InventoryFirebaseProjectId."
    }
    Copy-Item -LiteralPath $InventoryFirebaseServiceAccount -Destination $installedFirebaseAccount -Force
}

$settings = [ordered]@{
    host = $BindHost
    port = $Port
    apiKey = $ApiKey
    authMode = "firebase-or-api-key"
    allowPurchases = [bool]$EnablePurchases
    allowInventoryAdjustments = [bool]$EnableInventoryAdjustments
    allowedOrigins = @($AllowedOrigins)
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
    company = [ordered]@{
        identifier = $CompanyIdentifier
        branchId = $CompanyBranchId
        branchAlias = $CompanyBranchAlias
        sicarAliases = @($CompanySicarAliases)
    }
    firebaseAuth = [ordered]@{
        enabled = $true
        projectId = $InventoryFirebaseProjectId
        webApiKey = $FirebaseWebApiKey
        allowedEmails = @($AllowedFirebaseEmails)
        allowedUids = @()
    }
    inventoryFirebase = [ordered]@{
        enabled = [bool]$EnableInventoryTriggers
        projectId = $InventoryFirebaseProjectId
        serviceAccountPath = $installedFirebaseAccount
        branchDocumentId = $InventoryFirebaseBranchDocumentId
        payloadBranchAlias = $InventoryPayloadBranchAlias
        requestedByEmail = $InventoryRequestedByEmail
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
if ($EnableInventoryTriggers) {
    Set-Acl -LiteralPath $installedFirebaseAccount -AclObject $configAcl
}

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
    -Description "API local de CSM Operaciones para compras e inventarios SICAR." `
    -Force | Out-Null

if ($OpenFirewall -and -not (Get-NetFirewallRule -DisplayName $firewallRuleName -ErrorAction SilentlyContinue)) {
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
    InventoryAdjustmentsEnabled = [bool]$EnableInventoryAdjustments
    InventoryTriggersEnabled = [bool]$EnableInventoryTriggers
    LocalUrl = "http://127.0.0.1:$Port"
    TabletUrls = if ($OpenFirewall -and $BindHost -eq "0.0.0.0") { @($localIps | ForEach-Object { "http://$($_):$Port" }) -join ", " } else { "" }
    BindHost = $BindHost
    FirewallOpened = [bool]$OpenFirewall
    ApiKey = $ApiKey
    ExistingTransferWorkersChanged = $false
} | Format-List
