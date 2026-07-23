[CmdletBinding()]
param(
    [string]$InstallDirectory = "C:\sicar-proveedores-api"
)

$ErrorActionPreference = "Stop"
$taskName = "CSM SICAR Proveedores API"

$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = [Security.Principal.WindowsPrincipal]::new($identity)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw "Ejecuta PowerShell como administrador para actualizar el servicio."
}

$sourceServer = Join-Path $PSScriptRoot "server.mjs"
$installedServer = Join-Path $InstallDirectory "server.mjs"
$installedConfig = Join-Path $InstallDirectory "config.local.json"

if (-not (Test-Path -LiteralPath $sourceServer)) {
    throw "No existe server.mjs junto al actualizador."
}
if (-not (Test-Path -LiteralPath $installedConfig)) {
    throw "No existe la configuracion instalada: $installedConfig"
}
if (-not (Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue)) {
    throw "No existe la tarea instalada: $taskName"
}

$settings = Get-Content -LiteralPath $installedConfig -Raw | ConvertFrom-Json
Stop-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1
Copy-Item -LiteralPath $sourceServer -Destination $installedServer -Force
Start-ScheduledTask -TaskName $taskName
Start-Sleep -Seconds 2

$headers = @{ "X-CSM-API-Key" = $settings.apiKey }
$health = Invoke-RestMethod -Uri "http://127.0.0.1:$($settings.port)/health" -Headers $headers -TimeoutSec 10
if (-not $health.ok) {
    throw "El servicio se actualizo, pero no respondio correctamente."
}

[pscustomobject]@{
    TaskName = $taskName
    State = (Get-ScheduledTask -TaskName $taskName).State
    PurchasesEnabled = [bool]$settings.allowPurchases
    LocalUrl = "http://127.0.0.1:$($settings.port)"
    ApiKeyPreserved = $true
    MysqlCredentialsPreserved = $true
    ExistingTransferWorkersChanged = $false
} | Format-List
