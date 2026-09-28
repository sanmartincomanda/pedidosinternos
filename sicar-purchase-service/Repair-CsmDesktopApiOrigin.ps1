[CmdletBinding()]
param(
    [string]$InstallDirectory = "C:\sicar-proveedores-api",
    [string]$TaskName = "CSM SICAR Proveedores API",
    [string[]]$DesktopOrigins = @(
        "http://127.0.0.1:41731",
        "http://localhost:41731"
    )
)

$ErrorActionPreference = "Stop"

$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = [Security.Principal.WindowsPrincipal]::new($identity)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw "Ejecuta PowerShell como administrador para reparar el acceso local de CSM Operaciones."
}

$configPath = Join-Path $InstallDirectory "config.local.json"
if (-not (Test-Path -LiteralPath $configPath)) {
    throw "No existe la configuracion instalada: $configPath"
}

$task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if (-not $task) {
    throw "No existe la tarea instalada: $TaskName"
}

$settings = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json
$currentOrigins = if ($settings.PSObject.Properties.Name -contains "allowedOrigins") {
    @($settings.allowedOrigins)
}
else {
    @()
}
$updatedOrigins = @(
    $currentOrigins + $DesktopOrigins |
        Where-Object { -not [string]::IsNullOrWhiteSpace($_) } |
        Select-Object -Unique
)
$changed = @($updatedOrigins).Count -ne @($currentOrigins).Count

if ($changed) {
    $backupDirectory = Join-Path $InstallDirectory ("backups\desktop-origin-" + (Get-Date -Format "yyyyMMdd-HHmmss"))
    New-Item -ItemType Directory -Path $backupDirectory -Force | Out-Null
    Copy-Item -LiteralPath $configPath -Destination (Join-Path $backupDirectory "config.local.json") -Force

    if ($settings.PSObject.Properties.Name -contains "allowedOrigins") {
        $settings.allowedOrigins = $updatedOrigins
    }
    else {
        $settings | Add-Member -NotePropertyName allowedOrigins -NotePropertyValue $updatedOrigins
    }
    $settings | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $configPath -Encoding UTF8

    Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 1
    Start-ScheduledTask -TaskName $TaskName
    Start-Sleep -Seconds 3
}

$port = [int]$settings.port
$healthHeaders = @{ "X-CSM-API-Key" = [string]$settings.apiKey }
$health = Invoke-RestMethod -Uri "http://127.0.0.1:$port/health" -Headers $healthHeaders -TimeoutSec 15
if (-not $health.ok) {
    throw "La API reinicio, pero no respondio correctamente."
}

foreach ($origin in $DesktopOrigins) {
    $response = Invoke-WebRequest -UseBasicParsing -Method Options -Uri "http://127.0.0.1:$port/health" -Headers @{
        Origin = $origin
        "Access-Control-Request-Method" = "GET"
        "Access-Control-Request-Headers" = "authorization,x-csm-company"
    } -TimeoutSec 10
    if ($response.StatusCode -ne 204 -or $response.Headers["Access-Control-Allow-Origin"] -ne $origin) {
        throw "La API no autorizo correctamente el origen $origin."
    }
}

[pscustomobject]@{
    TaskName = $TaskName
    State = (Get-ScheduledTask -TaskName $TaskName).State
    Changed = $changed
    DesktopOrigins = $DesktopOrigins -join ", "
    Health = [bool]$health.ok
    Company = [string]$health.company.identifier
    PurchasesEnabled = [bool]$health.writes.purchases
    InventoryAdjustmentsEnabled = [bool]$health.writes.inventoryAdjustments
} | Format-List
