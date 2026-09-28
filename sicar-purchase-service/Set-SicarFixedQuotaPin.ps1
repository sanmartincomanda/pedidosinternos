[CmdletBinding()]
param(
    [string]$InstallDirectory = "C:\sicar-proveedores-api",
    [string]$TaskName = "CSM SICAR Proveedores API"
)

$ErrorActionPreference = "Stop"
$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = [Security.Principal.WindowsPrincipal]::new($identity)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw "Ejecuta PowerShell como administrador para configurar el PIN de cuota fija."
}

$configPath = Join-Path $InstallDirectory "config.local.json"
if (-not (Test-Path -LiteralPath $configPath)) {
    throw "No existe la configuracion instalada: $configPath"
}

$securePin = Read-Host "PIN de cuota fija (4 a 8 digitos)" -AsSecureString
$pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePin)
try { $pin = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer) }
finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
if ($pin -notmatch '^\d{4,8}$') {
    throw "El PIN de cuota fija debe contener entre 4 y 8 digitos."
}

$salt = New-Object byte[] 16
$generator = [Security.Cryptography.RandomNumberGenerator]::Create()
try { $generator.GetBytes($salt) } finally { $generator.Dispose() }
$iterations = 120000
$deriver = [Security.Cryptography.Rfc2898DeriveBytes]::new(
    $pin,
    $salt,
    $iterations,
    [Security.Cryptography.HashAlgorithmName]::SHA256
)
try { $hash = $deriver.GetBytes(32) } finally { $deriver.Dispose() }
$pin = $null

$settings = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json
if (-not ($settings.PSObject.Properties.Name -contains "accounting")) {
    $settings | Add-Member -NotePropertyName accounting -NotePropertyValue ([pscustomobject]@{
        queueDirectory = "C:\SICAR\state\sicar-purchase-accounting"
    })
}
$fixedQuota = [pscustomobject]@{
    enabled = $true
    pinIterations = $iterations
    pinSalt = [Convert]::ToBase64String($salt)
    pinHash = [Convert]::ToBase64String($hash)
}
if ($settings.accounting.PSObject.Properties.Name -contains "fixedQuota") {
    $settings.accounting.fixedQuota = $fixedQuota
}
else {
    $settings.accounting | Add-Member -NotePropertyName fixedQuota -NotePropertyValue $fixedQuota
}

$backupDirectory = Join-Path $InstallDirectory ("backups\fixed-quota-" + (Get-Date -Format "yyyyMMdd-HHmmss"))
New-Item -ItemType Directory -Path $backupDirectory -Force | Out-Null
Copy-Item -LiteralPath $configPath -Destination (Join-Path $backupDirectory "config.local.json") -Force
$settings | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $configPath -Encoding UTF8

Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
Start-ScheduledTask -TaskName $TaskName
Start-Sleep -Seconds 3
$headers = @{ "X-CSM-API-Key" = [string]$settings.apiKey }
$health = Invoke-RestMethod -Uri "http://127.0.0.1:$($settings.port)/health" -Headers $headers -TimeoutSec 15
if (-not $health.ok -or -not $health.accounting.fixedQuotaEnabled) {
    throw "La API reinicio, pero cuota fija no quedo habilitada."
}

[pscustomobject]@{
    TaskName = $TaskName
    State = (Get-ScheduledTask -TaskName $TaskName).State
    Company = [string]$health.company.identifier
    FixedQuotaEnabled = [bool]$health.accounting.fixedQuotaEnabled
    BackupDirectory = $backupDirectory
    PinStoredAsHash = $true
} | Format-List
