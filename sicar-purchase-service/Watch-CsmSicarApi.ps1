[CmdletBinding()]
param(
    [string]$InstallDirectory = "C:\sicar-proveedores-api",
    [string]$ApiTaskName = "CSM SICAR Proveedores API",
    [int]$IntervalSeconds = 20,
    [int]$FailuresBeforeRestart = 2,
    [int]$RemoteStartupGraceSeconds = 180,
    [int]$RemoteRepairCooldownSeconds = 300,
    [string]$TailnetUrl = "https://microsoft.tail95b6f5.ts.net:8443/granada-api",
    [string]$TailscaleTaskName = "CSM SICAR Tailscale Funnel"
)

$ErrorActionPreference = "Continue"
$configPath = Join-Path $InstallDirectory "config.local.json"
$logDirectory = Join-Path $InstallDirectory "logs"
$localFailures = 0
$tailnetFailures = 0
$lastRestartAt = [datetime]::MinValue
$lastTailnetRepairAt = [datetime]::MinValue
$startedAt = Get-Date

New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null

function Write-WatchdogLog([string]$Message) {
    $line = "{0} {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $Message
    $logPath = Join-Path $logDirectory ("watchdog-{0}.log" -f (Get-Date -Format "yyyyMMdd"))
    Add-Content -LiteralPath $logPath -Value $line -Encoding UTF8
}

function Get-ServiceSettings {
    if (-not (Test-Path -LiteralPath $configPath)) {
        throw "No existe la configuracion de la API: $configPath"
    }
    return Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json
}

function Test-CsmApi([string]$Url, $Settings) {
    try {
        $headers = @{ "X-CSM-API-Key" = [string]$Settings.apiKey }
        $result = Invoke-RestMethod -Uri ($Url.TrimEnd("/") + "/health") -Headers $headers -TimeoutSec 15
        return [bool]$result.ok
    }
    catch {
        return $false
    }
}

function Test-CsmRoute([string]$Url) {
    try {
        Invoke-WebRequest -Uri ($Url.TrimEnd("/") + "/health") -UseBasicParsing -TimeoutSec 15 | Out-Null
        return $true
    }
    catch {
        $statusCode = [int]$_.Exception.Response.StatusCode
        return $statusCode -eq 401 -or $statusCode -eq 403
    }
}

function Restart-CsmApi {
    if (((Get-Date) - $script:lastRestartAt).TotalSeconds -lt 90) {
        Write-WatchdogLog "Reinicio omitido por periodo de enfriamiento."
        return
    }
    try {
        Write-WatchdogLog "API local sin respuesta; reiniciando tarea $ApiTaskName."
        Stop-ScheduledTask -TaskName $ApiTaskName -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 2
        Start-ScheduledTask -TaskName $ApiTaskName -ErrorAction Stop
        $script:lastRestartAt = Get-Date
        Start-Sleep -Seconds 6
    }
    catch {
        Write-WatchdogLog "No se pudo reiniciar la API: $($_.Exception.Message)"
    }
}

function Repair-TailscaleRoute {
    if (((Get-Date) - $script:lastTailnetRepairAt).TotalSeconds -lt $RemoteRepairCooldownSeconds) {
        return
    }

    try {
        $repairTask = Get-ScheduledTask -TaskName $TailscaleTaskName -ErrorAction Stop
        if ([string]$repairTask.State -eq "Running") {
            return
        }

        Write-WatchdogLog "Ruta publica sin respuesta; iniciando reparacion Tailscale en segundo plano."
        Start-ScheduledTask -TaskName $TailscaleTaskName -ErrorAction Stop
        $script:lastTailnetRepairAt = Get-Date
    }
    catch {
        Write-WatchdogLog "No se pudo reparar Tailscale Serve: $($_.Exception.Message)"
    }
}

Write-WatchdogLog "Watchdog iniciado."
while ($true) {
    try {
        $settings = Get-ServiceSettings
        $localUrl = "http://127.0.0.1:$([int]$settings.port)"
        if (Test-CsmApi $localUrl $settings) {
            if ($localFailures -gt 0) { Write-WatchdogLog "API local recuperada." }
            $localFailures = 0
        }
        else {
            $localFailures += 1
            Write-WatchdogLog "Fallo local $localFailures de $FailuresBeforeRestart."
            if ($localFailures -ge $FailuresBeforeRestart) {
                Restart-CsmApi
                $localFailures = 0
            }
        }

        $remoteGraceComplete = ((Get-Date) - $startedAt).TotalSeconds -ge $RemoteStartupGraceSeconds
        if (-not $remoteGraceComplete) {
            $tailnetFailures = 0
        }
        elseif (Test-CsmRoute $TailnetUrl) {
            if ($tailnetFailures -gt 0) { Write-WatchdogLog "Ruta Tailscale recuperada." }
            $tailnetFailures = 0
        }
        else {
            $tailnetFailures += 1
            if ($tailnetFailures -ge $FailuresBeforeRestart -and (Test-CsmApi $localUrl $settings)) {
                Repair-TailscaleRoute
                $tailnetFailures = 0
            }
        }
    }
    catch {
        Write-WatchdogLog "Error del watchdog: $($_.Exception.Message)"
    }

    Get-ChildItem -LiteralPath $logDirectory -Filter "watchdog-*.log" -ErrorAction SilentlyContinue |
        Where-Object LastWriteTime -lt (Get-Date).AddDays(-14) |
        Remove-Item -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds ([Math]::Max(10, $IntervalSeconds))
}
