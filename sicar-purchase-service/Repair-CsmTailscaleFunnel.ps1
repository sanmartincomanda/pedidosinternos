[CmdletBinding()]
param(
    [int]$ApiPort = 43110,
    [int]$Attempts = 12,
    [int]$RetrySeconds = 10,
    [string]$LogDirectory = "C:\sicar-proveedores-api\logs"
)

$ErrorActionPreference = "Continue"
$tailscaleCandidates = @(
    "C:\Program Files\Tailscale\tailscale.exe",
    "C:\Program Files (x86)\Tailscale\tailscale.exe"
)
$tailscale = $tailscaleCandidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
New-Item -ItemType Directory -Path $LogDirectory -Force | Out-Null
$logPath = Join-Path $LogDirectory ("tailscale-funnel-{0}.log" -f (Get-Date -Format "yyyyMMdd"))

function Write-RepairLog([string]$Message) {
    Add-Content -LiteralPath $logPath -Value ("{0} {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $Message) -Encoding UTF8
}

if (-not $tailscale) {
    Write-RepairLog "Tailscale no esta instalado."
    exit 1
}

for ($attempt = 1; $attempt -le $Attempts; $attempt += 1) {
    $status = (& $tailscale status 2>&1 | Out-String)
    if ($LASTEXITCODE -eq 0 -and $status -notmatch "Logged out") {
        $output = (& $tailscale funnel --yes --bg --https=8443 --set-path=/granada-api "http://127.0.0.1:$ApiPort" 2>&1 | Out-String)
        if ($LASTEXITCODE -eq 0) {
            Write-RepairLog "Funnel Granada confirmado en intento $attempt."
            exit 0
        }
        Write-RepairLog "Intento $attempt fallo al publicar: $($output.Trim())"
    }
    else {
        Write-RepairLog "Intento ${attempt}: Tailscale todavia no ha iniciado sesion."
    }
    Start-Sleep -Seconds $RetrySeconds
}

Write-RepairLog "No se pudo confirmar el Funnel despues de $Attempts intentos."
exit 1
