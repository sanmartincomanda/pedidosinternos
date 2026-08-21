[CmdletBinding()]
param(
    [string]$InstallDirectory = "C:\sicar-proveedores-api",
    [string]$MysqlHost = "::1",
    [string]$ResultPath = "C:\Users\Public\csm-sicar-mysql-host-fix.json"
)

$ErrorActionPreference = "Stop"
$taskName = "CSM SICAR Proveedores API"
$configPath = Join-Path $InstallDirectory "config.local.json"
$backupPath = "$configPath.before-host-fix-$(Get-Date -Format 'yyyyMMdd-HHmmss').bak"
$configChanged = $false

function Write-ResultFile {
    param(
        [bool]$Ok,
        [string]$Message,
        [object]$Details = $null
    )

    [ordered]@{
        ok = $Ok
        message = $Message
        details = $Details
        completedAt = (Get-Date).ToString("o")
    } | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $ResultPath -Encoding UTF8
}

function Restart-PurchaseService {
    Stop-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 1
    Start-ScheduledTask -TaskName $taskName
    Start-Sleep -Seconds 3
}

try {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = [Security.Principal.WindowsPrincipal]::new($identity)
    if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
        throw "Ejecuta esta correccion desde PowerShell como administrador."
    }
    if (-not (Test-Path -LiteralPath $configPath)) {
        throw "No existe la configuracion instalada: $configPath"
    }
    if (-not (Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue)) {
        throw "No existe la tarea instalada: $taskName"
    }

    $settings = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json
    $previousHost = [string]$settings.mysql.host
    Copy-Item -LiteralPath $configPath -Destination $backupPath -Force

    $settings.mysql.host = $MysqlHost
    $settings | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $configPath -Encoding UTF8
    $configChanged = $true
    Restart-PurchaseService

    $headers = @{ "X-CSM-API-Key" = [string]$settings.apiKey }
    $health = Invoke-RestMethod -Uri "http://127.0.0.1:$($settings.port)/health" -Headers $headers -TimeoutSec 15
    $catalog = Invoke-RestMethod -Uri "http://127.0.0.1:$($settings.port)/catalogos/offline" -Headers $headers -TimeoutSec 30
    if (-not $health.ok -or -not $catalog.ok -or @($catalog.articles).Count -eq 0) {
        throw "El servicio reinicio, pero SICAR no devolvio un catalogo valido."
    }

    $details = [ordered]@{
        previousHost = $previousHost
        mysqlHost = $settings.mysql.host
        mysqlPort = $settings.mysql.port
        branchAlias = $health.branchAlias
        products = @($catalog.articles).Count
        suppliers = @($catalog.suppliers).Count
        purchasesEnabled = [bool]$health.writes.purchases
        taskState = [string](Get-ScheduledTask -TaskName $taskName).State
        backupPath = $backupPath
    }
    Write-ResultFile -Ok $true -Message "Conexion MySQL de Proveedores corregida y validada." -Details $details
}
catch {
    $failure = $_.Exception.Message
    if ($configChanged -and (Test-Path -LiteralPath $backupPath)) {
        try {
            Copy-Item -LiteralPath $backupPath -Destination $configPath -Force
            Restart-PurchaseService
        }
        catch {
            $failure = "$failure No fue posible reiniciar automaticamente la configuracion anterior: $($_.Exception.Message)"
        }
    }
    Write-ResultFile -Ok $false -Message $failure
    throw
}
