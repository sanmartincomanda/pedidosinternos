[CmdletBinding()]
param(
    [int]$ApiPort = 43110,
    [int]$HttpsPort = 8443,
    [string]$PublicPath = "/masaya-api"
)

$ErrorActionPreference = "Stop"
$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = [Security.Principal.WindowsPrincipal]::new($identity)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw "Ejecuta PowerShell como administrador en el servidor Masaya."
}

$tailscale = Join-Path $env:ProgramFiles "Tailscale\tailscale.exe"
if (-not (Test-Path -LiteralPath $tailscale)) {
    throw "Tailscale no esta instalado en Program Files."
}

$backendUrl = "http://127.0.0.1:$ApiPort"
$healthUrl = "$backendUrl/health"
try {
    Invoke-WebRequest -Uri $healthUrl -UseBasicParsing -TimeoutSec 10 -ErrorAction Stop | Out-Null
}
catch {
    $statusCode = if ($_.Exception.Response) { [int]$_.Exception.Response.StatusCode } else { 0 }
    if ($statusCode -notin @(401, 403)) {
        throw "La API SICAR de Masaya no responde en $healthUrl. Verifica primero su tarea local."
    }
}

& $tailscale funnel --bg --yes --https=$HttpsPort --set-path=$PublicPath $backendUrl
if ($LASTEXITCODE -ne 0) {
    throw "Tailscale no pudo publicar el Funnel de Masaya."
}

$dnsName = (& $tailscale status --json | ConvertFrom-Json).Self.DNSName.TrimEnd(".")
if ([string]::IsNullOrWhiteSpace($dnsName)) {
    throw "Tailscale no devolvio el nombre DNS del servidor."
}

$publicUrl = "https://${dnsName}:$HttpsPort$PublicPath"
[pscustomobject]@{
    Enabled = $true
    Backend = $backendUrl
    PublicUrl = $publicUrl
    HealthUrl = "$publicUrl/health"
    PersistsAfterRestart = $true
} | Format-List
