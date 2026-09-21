[CmdletBinding()]
param(
    [string]$InstallDirectory = "C:\sicar-proveedores-api",
    [string]$ApiTaskName = "CSM SICAR Proveedores API",
    [string]$WatchdogTaskName = "CSM SICAR Proveedores API Watchdog",
    [string]$TailscaleTaskName = "CSM SICAR Tailscale Funnel"
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
$repairSource = Join-Path $PSScriptRoot "Repair-CsmTailscaleFunnel.ps1"
$repairInstalled = Join-Path $InstallDirectory "Repair-CsmTailscaleFunnel.ps1"
$repairLauncher = Join-Path $InstallDirectory "Run-CsmTailscaleFunnelHidden.vbs"
if (-not (Test-Path -LiteralPath $source)) {
    throw "No existe el script del watchdog junto al instalador."
}
if (-not (Test-Path -LiteralPath $repairSource)) {
    throw "No existe el reparador de Tailscale junto al instalador."
}
New-Item -ItemType Directory -Path $InstallDirectory -Force | Out-Null
Copy-Item -LiteralPath $source -Destination $installed -Force
Copy-Item -LiteralPath $repairSource -Destination $repairInstalled -Force

$repairCommand = "powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$repairInstalled`""
$repairCommandForVbs = $repairCommand.Replace('"', '""')
$repairLauncherContent = @"
Set shell = CreateObject("WScript.Shell")
command = "$repairCommandForVbs"
exitCode = shell.Run(command, 0, True)
WScript.Quit exitCode
"@
Set-Content -LiteralPath $repairLauncher -Value $repairLauncherContent -Encoding ASCII

$powershell = (Get-Command powershell.exe -ErrorAction Stop).Source
$wscript = (Get-Command wscript.exe -ErrorAction Stop).Source
$arguments = "-NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$installed`" -InstallDirectory `"$InstallDirectory`" -ApiTaskName `"$ApiTaskName`" -TailscaleTaskName `"$TailscaleTaskName`""
$action = New-ScheduledTaskAction -Execute $powershell -Argument $arguments -WorkingDirectory $InstallDirectory
$trigger = New-ScheduledTaskTrigger -AtStartup
$taskPrincipal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
$taskSettings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -Hidden `
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

$interactiveUser = [Security.Principal.WindowsIdentity]::GetCurrent().Name
$repairArguments = "`"$repairLauncher`""
$repairAction = New-ScheduledTaskAction -Execute $wscript -Argument $repairArguments -WorkingDirectory $InstallDirectory
$repairTrigger = New-ScheduledTaskTrigger -AtLogOn -User $interactiveUser
$repairPrincipal = New-ScheduledTaskPrincipal -UserId $interactiveUser -LogonType Interactive -RunLevel Highest
if (Get-ScheduledTask -TaskName $TailscaleTaskName -ErrorAction SilentlyContinue) {
    Stop-ScheduledTask -TaskName $TailscaleTaskName -ErrorAction SilentlyContinue
}
Register-ScheduledTask `
    -TaskName $TailscaleTaskName `
    -Action $repairAction `
    -Trigger $repairTrigger `
    -Principal $repairPrincipal `
    -Settings $taskSettings `
    -Description "Restaura el Funnel HTTPS de la API SICAR al iniciar sesion." `
    -Force | Out-Null
Start-ScheduledTask -TaskName $TailscaleTaskName

[pscustomobject]@{
    TaskName = $WatchdogTaskName
    State = (Get-ScheduledTask -TaskName $WatchdogTaskName).State
    ApiTaskName = $ApiTaskName
    InstalledScript = $installed
    ChecksEverySeconds = 20
    RestartsAfterFailures = 2
    TailscaleTaskName = $TailscaleTaskName
    TailscaleLauncher = $repairLauncher
} | Format-List
