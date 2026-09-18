[CmdletBinding()]
param(
    [string]$InstallDirectory = "C:\sicar-proveedores-api",
    [string]$ApiTaskName = "CSM SICAR Proveedores API",
    [int]$IntervalSeconds = 20,
    [int]$FailuresBeforeRestart = 2,
    [string]$TailnetUrl = "https://microsoft.tail95b6f5.ts.net/granada-api",
    [string]$TailnetPath = "/granada-api"
)

$ErrorActionPreference = "Continue"
$configPath = Join-Path $InstallDirectory "config.local.json"
$logDirectory = Join-Path $InstallDirectory "logs"
$tailscaleCandidates = @(
    "C:\Program Files\Tailscale\tailscale.exe",
    "C:\Program Files (x86)\Tailscale\tailscale.exe"
)
$tailscale = $tailscaleCandidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
$localFailures = 0
$tailnetFailures = 0
$lastRestartAt = [datetime]::MinValue

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

function Repair-TailscaleRoute([int]$Port) {
    if (-not $tailscale) {
        Write-WatchdogLog "Tailscale no esta instalado; no se pudo reparar la ruta HTTPS."
        return
    }
    try {
        Write-WatchdogLog "Ruta Tailscale sin respuesta; publicando nuevamente $TailnetPath."
        & $tailscale serve --bg --https=443 --set-path=$TailnetPath "http://127.0.0.1:$Port" 2>&1 |
            ForEach-Object { Write-WatchdogLog "tailscale: $_" }
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

        if (Test-CsmApi $TailnetUrl $settings) {
            if ($tailnetFailures -gt 0) { Write-WatchdogLog "Ruta Tailscale recuperada." }
            $tailnetFailures = 0
        }
        else {
            $tailnetFailures += 1
            if ($tailnetFailures -ge $FailuresBeforeRestart -and (Test-CsmApi $localUrl $settings)) {
                Repair-TailscaleRoute ([int]$settings.port)
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
