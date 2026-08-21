[CmdletBinding()]
param(
    [string]$InstallDirectory = "C:\sicar-proveedores-api"
)

$ErrorActionPreference = "Stop"
$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = [Security.Principal.WindowsPrincipal]::new($identity)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw "Abre PowerShell como administrador y ejecuta nuevamente este archivo."
}

$repositoryRoot = Split-Path -Parent $PSScriptRoot
$firebaseSource = Join-Path $repositoryRoot "firebase.js"
$updater = Join-Path $PSScriptRoot "Update-SicarPurchaseService.ps1"
if (-not (Test-Path -LiteralPath $firebaseSource)) {
    throw "No se encontro firebase.js en $repositoryRoot."
}
if (-not (Test-Path -LiteralPath $updater)) {
    throw "No se encontro el actualizador del servicio: $updater"
}

$source = Get-Content -LiteralPath $firebaseSource -Raw
$inventoryBlock = [regex]::Match($source, 'const inventoryFirebaseConfig = \{(?<body>[\s\S]*?)\};')
$firebaseWebApiKey = [regex]::Match($inventoryBlock.Groups['body'].Value, 'apiKey:\s*"(?<key>[^"]+)"').Groups['key'].Value
if ([string]::IsNullOrWhiteSpace($firebaseWebApiKey)) {
    throw "No se encontro la configuracion web de Firebase inventario-sanmartin."
}

& $updater `
    -InstallDirectory $InstallDirectory `
    -EnablePurchases `
    -EnableInventoryAdjustments `
    -CompanyIdentifier "granada" `
    -CompanyBranchId "CARNES SAN MARTIN GRANADA" `
    -CompanyBranchAlias "Granada" `
    -CompanySicarAliases @("CARNES SAN MARTIN GRANADA", "Carnes San Martin Granada", "Granada") `
    -AllowedFirebaseEmails @("granada.inventory@sanmartinsr.com") `
    -FirebaseWebApiKey $firebaseWebApiKey `
    -AllowedOrigins @("https://traspasos.sanmartinsr.com")
