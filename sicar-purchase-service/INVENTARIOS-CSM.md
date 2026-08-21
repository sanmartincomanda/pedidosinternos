# Inventarios en CSM Operaciones

El módulo web se conecta de forma autenticada al proyecto Firebase `inventario-sanmartin`. No aplica ajustes directamente desde la app y no modifica los workers de traspasos. El servicio local conserva sus endpoints de soporte para las aplicaciones instaladas y mantenimiento.

## Flujo seguro

1. La app lee el catálogo cacheado del dispositivo. La actualización manual intenta Firestore y usa como respaldo puntual el catálogo de Pedidos Internos.
2. El operador agrega únicamente los productos contados; el borrador permanece en el dispositivo.
3. La web exige un usuario de Firebase Auth de `inventario-sanmartin` y guarda atómicamente dos documentos con el mismo `sessionId`:
   - `branches/CARNES SAN MARTIN GRANADA/levantamientosInventario/{sessionId}`
   - `branches/CARNES SAN MARTIN GRANADA/sicarAdjustmentRequests/{sessionId}`
4. El trigger se crea con `status = requested`.
5. `integrador_granada_monitor.ps1` lee el levantamiento, valida duplicados, aplica la regla `SICAR unit wins` y ejecuta el ajuste local.
6. El monitor escribe `processing`, `done`, `duplicate`, `dry-run` o `error` en el mismo trigger. La app solo consulta ese estado.

Los productos no agregados no se modifican. Un trigger existente no se reescribe si está solicitado, procesando o terminado. Un estado `error` solamente puede reenviarse mediante la acción explícita de reintento.

La escritura web utiliza la precondición `exists = false` en ambos documentos. La seguridad de Firestore continúa limitando al usuario a su sucursal. El monitor local usa la cuenta de servicio y conserva la regla `SICAR unit wins`.

## Acceso web

- Producción: `https://traspasos.sanmartinsr.com`
- Alias: `https://traspaso.sanmartinsr.com`
- Inicio de sesión: mismo correo y contraseña de la app de inventario.

Firestore puede responder `RESOURCE_EXHAUSTED` si el proyecto agota su cuota diaria. En ese caso la app conserva el borrador y no crea un documento parcial ni duplicado.

## Actualizar un servidor existente

Abrir PowerShell como administrador en la carpeta `sicar-purchase-service` y ejecutar:

```powershell
powershell -ExecutionPolicy Bypass -File .\Update-SicarPurchaseService.ps1 -EnableInventoryTriggers
```

El actualizador conserva las credenciales MySQL, la clave de la API, el puerto y el permiso de compras. Copia la cuenta de servicio a la carpeta protegida del servicio y deshabilita la ruta directa antigua de ajustes. No detiene, reemplaza ni registra tareas de traspasos ni el monitor existente.

## Instalar en una sucursal nueva

```powershell
powershell -ExecutionPolicy Bypass -File .\Install-SicarPurchaseService.ps1 `
  -MysqlExecutable "C:\RUTA\SICAR\MySQL\MySQL Server 5.6\bin\mysql.exe" `
  -MysqlHost "127.0.0.1" `
  -MysqlPort 3306 `
  -MysqlUser "root" `
  -EnablePurchases `
  -EnableInventoryTriggers `
  -InventoryFirebaseServiceAccount "C:\RUTA\inventario-sanmartin-service-account.json"
```

El instalador pide la contraseña MySQL sin mostrarla. Granada es la única sucursal mapeada actualmente. Para otra sucursal se debe ampliar primero `sicar_trigger_core.ps1` y configurar su rama real de Firestore.

## Endpoints

- `GET /health`: conexión, alias SICAR y permisos activos.
- `GET /inventarios/catalogo`: artículos activos, unidad, existencia y costos de referencia.
- `GET /inventarios/solicitudes`: historial limitado de triggers Firestore.
- `GET /inventarios/solicitud?sessionId=...`: estado exacto de una solicitud.
- `POST /inventarios/solicitar-ajuste`: escritura atómica de sesión y trigger.
- `POST /inventarios/reintentar-ajuste`: reabre únicamente un trigger en `error`.

`POST /inventarios/aplicar` pertenece al prototipo anterior y CSM Operaciones no lo utiliza.

Todas las rutas requieren `X-CSM-API-Key`, igual que el módulo de proveedores.
