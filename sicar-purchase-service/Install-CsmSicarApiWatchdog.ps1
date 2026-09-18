[CmdletBinding()]
param(
    [string]$InstallDirectory = "C:\sicar-proveedores-api",
    [string]$ApiTaskName = "CSM SICAR Proveedores API",
    [string]$WatchdogTaskName = "CSM SICAR Proveedores API Watchdog"
)

$ErrorActionPreference = "Stop"
$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = [Security.Principal.WindowsPrincipal]::new($identity)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw "Ejecuta PowerShell como administrador para instalar el watchdog."
}
if (-not (Get-ScheduledTask -TaskName $ApiTaskName -ErrorAction SilentlyContinue)) {
    throw "No existe la tarea de la API: $ApiTaskName"
}

$source = Join-Path $PSScriptRoot "Watch-CsmSicarApi.ps1"
$installed = Join-Path $InstallDirectory "Watch-CsmSicarApi.ps1"
if (-not (Test-Path -LiteralPath $source)) {
    throw "No existe el script del watchdog junto al instalador."
}
New-Item -ItemType Directory -Path $InstallDirectory -Force | Out-Null
Copy-Item -LiteralPath $source -Destination $installed -Force

$powershell = (Get-Command powershell.exe -ErrorAction Stop).Source
$arguments = "-NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$installed`" -InstallDirectory `"$InstallDirectory`" -ApiTaskName `"$ApiTaskName`""
$action = New-ScheduledTaskAction -Execute $powershell -Argument $arguments -WorkingDirectory $InstallDirectory
$trigger = New-ScheduledTaskTrigger -AtStartup
$taskPrincipal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
$taskSettings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -RestartCount 10 `
    -RestartInterval (New-TimeSpan -Minutes 1) `
    -ExecutionTimeLimit ([TimeSpan]::Zero)

if (Get-ScheduledTask -TaskName $WatchdogTaskName -ErrorAction SilentlyContinue) {
    Stop-ScheduledTask -TaskName $WatchdogTaskName -ErrorAction SilentlyContinue
}
Register-ScheduledTask `
    -TaskName $WatchdogTaskName `
    -Action $action `
    -Trigger $trigger `
    -Principal $taskPrincipal `
    -Settings $taskSettings `
    -Description "Supervisa y recupera la API SICAR y su ruta HTTPS de Tailscale." `
    -Force | Out-Null
Start-ScheduledTask -TaskName $WatchdogTaskName

[pscustomobject]@{
    TaskName = $WatchdogTaskName
    State = (Get-ScheduledTask -TaskName $WatchdogTaskName).State
    ApiTaskName = $ApiTaskName
    InstalledScript = $installed
    ChecksEverySeconds = 20
    RestartsAfterFailures = 2
} | Format-List
