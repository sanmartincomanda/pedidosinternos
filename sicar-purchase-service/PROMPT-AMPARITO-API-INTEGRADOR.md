# Prompt para Codex - API e integrador SICAR Amparito

Trabaja en el servidor de CARNES AMPARITO. Antes de cambiar algo, inspecciona y respalda la instalacion existente en `C:\csm-integrador\amparito`, sus tareas programadas, logs, state y configuracion. No borres estados, no cambies contrasenas, no modifiques impuestos ni precios de venta y no afectes integradores de otras aplicaciones.

## Identidad fija

- Empresa y BranchId: `CARNES AMPARITO`
- Identificador: `amparito`
- Usuario Firebase autorizado: `carnesamparito@carnesamparito.com`
- Proyecto Firebase Auth: `inventario-sanmartin`
- Origen web permitido: `https://traspasos.sanmartinsr.com`
- Clave web Firebase: solicitarla al administrador y pasarla como `-FirebaseWebApiKey`; no escribirla en este documento ni en Git.
- Ramas Firestore existentes: exclusivamente `branches/CARNES AMPARITO`

## Objetivo

Instala una unica API local CSM SICAR que atienda dos flujos:

1. Recibir mercaderia: catalogo de proveedores/articulos, preview y compra transaccional.
2. Levantamiento de inventario: catalogo/existencias, preview y ajuste transaccional.

Usa como base la carpeta entregada `sicar-purchase-service`. No inventes otra implementacion SQL. Reutiliza `server.mjs`, `Install-SicarPurchaseService.ps1` y su idempotencia por `recepcionId/requestId`.

## Reglas obligatorias

- Detecta primero `mysql.exe`, host, puerto, usuario y schema reales. Solicita la contrasena de forma interactiva; nunca la imprimas ni la guardes en Git.
- Configura localmente:
  - `company.identifier = amparito`
  - `company.branchId = CARNES AMPARITO`
  - `company.branchAlias` y `company.sicarAliases` con el alias real encontrado en `nubecfg`.
  - `firebaseAuth.projectId = inventario-sanmartin`
  - `firebaseAuth.allowedEmails = [carnesamparito@carnesamparito.com]`
- La API debe verificar token Firebase, empresa solicitada y alias del SICAR local antes de leer o escribir.
- CORS exacto; nunca `*` en produccion.
- No confies en `branchId`, empresa, proveedor, precios, IVA, existencias ni totales enviados por el navegador. Revalidalos en MySQL.
- Compras y ajustes deben usar transacciones, bloqueo de existencias, idempotencia e historial SICAR.
- Mantener `allowPurchases=false` y `allowInventoryAdjustments=false` durante las pruebas de health, catalogo y preview.
- No actives dos escritores para el mismo documento. CSM Operaciones usara API como entrada primaria. El monitor Firestore existente debe continuar en `DryRun=true / AllowWrites=false` mientras se prueba la API; no permitas que app y monitor apliquen el mismo evento.
- No expongas MySQL ni el puerto local directamente a Internet.

## Instalacion inicial sin escrituras

Desde PowerShell Administrador, dentro del paquete:

```powershell
powershell -ExecutionPolicy Bypass -File .\Install-SicarPurchaseService.ps1 `
  -MysqlExecutable "<RUTA_REAL_MYSQL_EXE>" `
  -MysqlHost "127.0.0.1" `
  -MysqlPort <PUERTO_REAL> `
  -MysqlUser "<USUARIO_REAL>" `
  -CompanyIdentifier "amparito" `
  -CompanyBranchId "CARNES AMPARITO" `
  -CompanyBranchAlias "<ALIAS_REAL_NUBECFG>" `
  -CompanySicarAliases @("<ALIAS_REAL_NUBECFG>","CARNES AMPARITO") `
  -AllowedFirebaseEmails @("carnesamparito@carnesamparito.com") `
  -FirebaseWebApiKey "<CLAVE_WEB_FIREBASE_ENTREGADA_POR_ADMINISTRADOR>" `
  -AllowedOrigins @("https://traspasos.sanmartinsr.com", "http://localhost", "capacitor://localhost")
```

La contrasena MySQL debe pedirse en consola. No la pongas en este prompt.

## Pruebas antes de habilitar

1. Confirma tarea `CSM SICAR Proveedores API` en estado Running y arranque con SYSTEM.
2. Prueba `/health`, `/catalogos/offline` e `/inventarios/catalogo`.
3. Comprueba que el alias devuelto pertenece a Amparito.
4. Prueba token valido de Amparito.
5. Comprueba rechazo de token Masaya/Granada, empresa alterada, origen no autorizado y API key incorrecta.
6. Ejecuta `/compras/preview` con una factura ficticia sin escribir.
7. Ejecuta `/inventarios/preview` con conteos ficticios sin escribir.
8. Verifica duplicados y cambio concurrente de existencia.
9. Realiza backup de MySQL.
10. Solo con autorizacion explicita habilita ambos interruptores y ejecuta una compra y un ajuste controlados.

Para habilitar, vuelve a ejecutar el instalador con los mismos parametros y agrega:

```powershell
-EnablePurchases -EnableInventoryAdjustments
```

## Conexion web

La web HTTPS no puede llamar una URL HTTP privada. Para usar `https://traspasos.sanmartinsr.com`, configura un endpoint HTTPS empresarial, por ejemplo `https://api-amparito.sanmartinsr.com`, mediante reverse proxy o tunel administrado con certificado valido. El proxy debe apuntar a `127.0.0.1:43110`, mantener Firebase Auth y limitar trafico. Si no existe HTTPS, prueba solamente desde la app nativa PC/Android en la red local.

## Entrega

Reporta sin revelar secretos:

- Ruta y version de MySQL.
- Alias `nubecfg`.
- URL local y, si existe, URL HTTPS.
- Estado de tarea y firewall.
- Resultado de cada prueba.
- Estado final de `allowPurchases` y `allowInventoryAdjustments`.
- Confirmacion de que el agente Firestore sigue dry-run o fue deshabilitado como escritor.
- IDs SICAR de la compra y ajuste controlados, si fueron autorizados.
- Plan de reversa y rutas de backups.
