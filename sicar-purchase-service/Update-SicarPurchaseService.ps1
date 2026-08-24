[CmdletBinding()]
param(
    [string]$InstallDirectory = "C:\sicar-proveedores-api",
    [switch]$EnablePurchases,
    [switch]$EnableInventoryAdjustments,
    [switch]$EnableInventoryTriggers,
    [string]$InventoryFirebaseServiceAccount = "C:\Users\Microsoft Windows 11\Downloads\inventario-sanmartin-firebase-adminsdk-fbsvc-0eff49b1f7.json",
    [string]$InventoryFirebaseProjectId = "inventario-sanmartin",
    [string]$InventoryFirebaseBranchDocumentId = "CARNES SAN MARTIN GRANADA",
    [string]$InventoryPayloadBranchAlias = "Granada",
    [string]$InventoryRequestedByEmail = "operaciones@sanmartinsr.com",
    [string]$CompanyIdentifier = "granada",
    [string]$CompanyBranchId = "CARNES SAN MARTIN GRANADA",
    [string]$CompanyBranchAlias = "Granada",
    [string[]]$CompanySicarAliases = @("CARNES SAN MARTIN GRANADA"),
    [string[]]$AllowedFirebaseEmails = @("granada.inventory@sanmartinsr.com"),
    [string]$FirebaseWebApiKey = "",
    [string[]]$AllowedOrigins = @("https://traspasos.sanmartinsr.com", "http://localhost", "capacitor://localhost")
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
$installedFirebaseAccount = Join-Path $InstallDirectory "inventory-firebase-service-account.json"

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
$backupDirectory = Join-Path $InstallDirectory ("backups\" + (Get-Date -Format "yyyyMMdd-HHmmss"))
New-Item -ItemType Directory -Path $backupDirectory -Force | Out-Null
Copy-Item -LiteralPath $installedConfig -Destination (Join-Path $backupDirectory "config.local.json") -Force
if (Test-Path -LiteralPath $installedServer) {
    Copy-Item -LiteralPath $installedServer -Destination (Join-Path $backupDirectory "server.mjs") -Force
}
if (-not ($settings.PSObject.Properties.Name -contains "allowPurchases")) {
    $settings | Add-Member -NotePropertyName allowPurchases -NotePropertyValue $false
}
if ($PSBoundParameters.ContainsKey("EnablePurchases")) {
    $settings.allowPurchases = [bool]$EnablePurchases
}
if (-not ($settings.PSObject.Properties.Name -contains "allowInventoryAdjustments")) {
    $settings | Add-Member -NotePropertyName allowInventoryAdjustments -NotePropertyValue $false
}
if ($PSBoundParameters.ContainsKey("EnableInventoryAdjustments")) {
    $settings.allowInventoryAdjustments = [bool]$EnableInventoryAdjustments
}
if (-not ($settings.PSObject.Properties.Name -contains "authMode")) {
    $settings | Add-Member -NotePropertyName authMode -NotePropertyValue "firebase-or-api-key"
}
if (-not ($settings.PSObject.Properties.Name -contains "company")) {
    $settings | Add-Member -NotePropertyName company -NotePropertyValue ([pscustomobject]@{
        identifier = $CompanyIdentifier
        branchId = $CompanyBranchId
        branchAlias = $CompanyBranchAlias
        sicarAliases = @($CompanySicarAliases)
    })
}
if (-not ($settings.PSObject.Properties.Name -contains "firebaseAuth")) {
    if ([string]::IsNullOrWhiteSpace($FirebaseWebApiKey)) {
        throw "Indica -FirebaseWebApiKey para agregar autenticacion Firebase a esta instalacion. No la guardes en Git."
    }
    if (-not $PSBoundParameters.ContainsKey("AllowedFirebaseEmails") -or @($AllowedFirebaseEmails).Count -eq 0) {
        throw "Indica -AllowedFirebaseEmails al agregar autenticacion Firebase a esta instalacion."
    }
    $settings | Add-Member -NotePropertyName firebaseAuth -NotePropertyValue ([pscustomobject]@{
        enabled = $true
        projectId = $InventoryFirebaseProjectId
        webApiKey = $FirebaseWebApiKey
        allowedEmails = @($AllowedFirebaseEmails)
        allowedUids = @()
    })
}
else {
    $settings.firebaseAuth.enabled = $true
    $settings.firebaseAuth.projectId = $InventoryFirebaseProjectId
    if (-not [string]::IsNullOrWhiteSpace($FirebaseWebApiKey)) {
        $settings.firebaseAuth.webApiKey = $FirebaseWebApiKey
    }
    if (-not $settings.firebaseAuth.webApiKey) {
        throw "Indica -FirebaseWebApiKey para habilitar autenticacion Firebase. No la guardes en Git."
    }
    if ($PSBoundParameters.ContainsKey("AllowedFirebaseEmails")) {
        $settings.firebaseAuth.allowedEmails = @($AllowedFirebaseEmails)
    }
    elseif (-not ($settings.firebaseAuth.PSObject.Properties.Name -contains "allowedEmails") -or @($settings.firebaseAuth.allowedEmails).Count -eq 0) {
        throw "La instalacion no tiene correos Firebase autorizados; indica -AllowedFirebaseEmails."
    }
    if (-not ($settings.firebaseAuth.PSObject.Properties.Name -contains "allowedUids")) {
        $settings.firebaseAuth | Add-Member -NotePropertyName allowedUids -NotePropertyValue @()
    }
}
$settings.authMode = "firebase-or-api-key"
if ($PSBoundParameters.ContainsKey("AllowedOrigins")) {
    $settings.allowedOrigins = @($AllowedOrigins)
}
if (-not ($settings.PSObject.Properties.Name -contains "inventoryFirebase")) {
    $settings | Add-Member -NotePropertyName inventoryFirebase -NotePropertyValue ([pscustomobject]@{
        enabled = $false
        projectId = $InventoryFirebaseProjectId
        serviceAccountPath = $installedFirebaseAccount
        branchDocumentId = $InventoryFirebaseBranchDocumentId
        payloadBranchAlias = $InventoryPayloadBranchAlias
        requestedByEmail = $InventoryRequestedByEmail
    })
}
if ($EnableInventoryTriggers) {
    if (-not (Test-Path -LiteralPath $InventoryFirebaseServiceAccount)) {
        throw "No existe la cuenta de servicio Firebase: $InventoryFirebaseServiceAccount"
    }
    $firebaseAccount = Get-Content -LiteralPath $InventoryFirebaseServiceAccount -Raw | ConvertFrom-Json
    if ([string]$firebaseAccount.project_id -ne $InventoryFirebaseProjectId) {
        throw "La cuenta de servicio no corresponde al proyecto $InventoryFirebaseProjectId."
    }
    Copy-Item -LiteralPath $InventoryFirebaseServiceAccount -Destination $installedFirebaseAccount -Force
    $settings.inventoryFirebase.enabled = $true
    $settings.inventoryFirebase.projectId = $InventoryFirebaseProjectId
    $settings.inventoryFirebase.serviceAccountPath = $installedFirebaseAccount
    $settings.inventoryFirebase.branchDocumentId = $InventoryFirebaseBranchDocumentId
    $settings.inventoryFirebase.payloadBranchAlias = $InventoryPayloadBranchAlias
    $settings.inventoryFirebase.requestedByEmail = $InventoryRequestedByEmail
}
$settings | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $installedConfig -Encoding UTF8

if ($EnableInventoryTriggers) {
    $configAcl = Get-Acl -LiteralPath $installedConfig
    Set-Acl -LiteralPath $installedFirebaseAccount -AclObject $configAcl
}
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
    InventoryAdjustmentsEnabled = [bool]$settings.allowInventoryAdjustments
    InventoryTriggersEnabled = [bool]$settings.inventoryFirebase.enabled
    LocalUrl = "http://127.0.0.1:$($settings.port)"
    BackupDirectory = $backupDirectory
    ApiKeyPreserved = $true
    MysqlCredentialsPreserved = $true
    ExistingTransferWorkersChanged = $false
} | Format-List
