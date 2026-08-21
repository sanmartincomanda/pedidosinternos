# Prompt para Codex - API e integrador SICAR Masaya

Trabaja en el servidor de CARNES SAN MARTIN MASAYA. Antes de cambiar algo, inspecciona y respalda el agente existente, sus tareas programadas, logs, state y configuracion. No borres estados, no cambies contrasenas, no modifiques impuestos ni precios de venta y no afectes integradores de otras aplicaciones.

## Identidad fija

- Empresa y BranchId: `CARNES SAN MARTIN MASAYA`
- Identificador: `masaya`
- Usuario Firebase autorizado: `masaya@csmmasaya.com`
- Proyecto Firebase Auth: `inventario-sanmartin`
- Origen web permitido: `https://traspasos.sanmartinsr.com`
- Clave web Firebase: solicitarla al administrador y pasarla como `-FirebaseWebApiKey`; no escribirla en este documento ni en Git.
- Ramas Firestore existentes: exclusivamente `branches/CARNES SAN MARTIN MASAYA`

## Objetivo

Instala una unica API local CSM SICAR que atienda:

1. Recibir mercaderia: catalogo, preview y compra transaccional.
2. Levantamiento de inventario: catalogo, preview y ajuste transaccional.

Usa el paquete `sicar-purchase-service`. No inventes otra implementacion SQL ni copies configuracion de Amparito o Granada.

## Reglas obligatorias

- Detecta `mysql.exe`, host, puerto, usuario, schema y alias `nubecfg` reales.
- Solicita la contrasena MySQL interactivamente; nunca la imprimas ni la subas a Git.
- Fija:
  - `company.identifier = masaya`
  - `company.branchId = CARNES SAN MARTIN MASAYA`
  - alias SICAR reales de Masaya.
  - `firebaseAuth.projectId = inventario-sanmartin`
  - `firebaseAuth.allowedEmails = [masaya@csmmasaya.com]`
- Rechaza tokens, empresas y payloads de Amparito o Granada.
- CORS exacto; nunca `*`.
- Recalcula proveedor, articulo, IVA, precio, total y existencia desde MySQL.
- Usa transacciones, idempotencia, bloqueo de existencia e historial SICAR.
- Empieza con escrituras deshabilitadas.
- La API sera entrada primaria. Cualquier monitor Firestore existente debe seguir `DryRun=true / AllowWrites=false` durante la prueba; nunca dejes dos escritores simultaneos.
- No expongas MySQL ni el puerto 43110 directamente a Internet.

## Instalacion inicial sin escrituras

```powershell
powershell -ExecutionPolicy Bypass -File .\Install-SicarPurchaseService.ps1 `
  -MysqlExecutable "<RUTA_REAL_MYSQL_EXE>" `
  -MysqlHost "127.0.0.1" `
  -MysqlPort <PUERTO_REAL> `
  -MysqlUser "<USUARIO_REAL>" `
  -CompanyIdentifier "masaya" `
  -CompanyBranchId "CARNES SAN MARTIN MASAYA" `
  -CompanyBranchAlias "<ALIAS_REAL_NUBECFG>" `
  -CompanySicarAliases @("<ALIAS_REAL_NUBECFG>","CARNES SAN MARTIN MASAYA","Masaya") `
  -AllowedFirebaseEmails @("masaya@csmmasaya.com") `
  -FirebaseWebApiKey "<CLAVE_WEB_FIREBASE_ENTREGADA_POR_ADMINISTRADOR>" `
  -AllowedOrigins @("https://traspasos.sanmartinsr.com")
```

No pongas la contrasena MySQL en la linea de comandos; deja que el instalador la solicite.

## Pruebas obligatorias

1. Tarea `CSM SICAR Proveedores API` Running bajo SYSTEM.
2. Health, catalogo de proveedores, catalogo de articulos e inventario.
3. Alias local confirmado como Masaya.
4. Token Masaya aceptado.
5. Tokens Amparito/Granada, empresa alterada y origen no autorizado rechazados.
6. Preview de compra sin escritura.
7. Preview de inventario sin escritura.
8. Prueba de duplicado y concurrencia.
9. Backup MySQL.
10. Una compra y un ajuste reales unicamente con autorizacion explicita.

Para habilitar ambos flujos, repite la instalacion con los mismos valores y agrega:

```powershell
-EnablePurchases -EnableInventoryAdjustments
```

## Conexion web

Para la web `https://traspasos.sanmartinsr.com` necesitas una URL HTTPS con certificado valido, por ejemplo `https://api-masaya.sanmartinsr.com`, que redirija internamente a `127.0.0.1:43110`. No publiques directamente el puerto local. Sin HTTPS, usa la app nativa PC/Android dentro de la red.

## Entrega

Reporta sin secretos:

- MySQL detectado y alias SICAR.
- URL local/HTTPS.
- Tarea, firewall y arranque automatico.
- Resultado de pruebas de aislamiento.
- Estado de los dos interruptores de escritura.
- Estado del monitor Firestore anterior.
- IDs de prueba autorizados.
- Backups y reversa.
