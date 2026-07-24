# Servicio local SICAR - Proveedores externos

Este servicio es independiente de los workers de traspasos. No lee Firebase y no modifica sus tareas programadas.

## Alcance

- Lee proveedores, articulos, unidades, impuestos y ultimo precio de compra.
- Previsualiza precios con IVA desde la configuracion vigente de SICAR.
- Registra una compra de inventario en una sola transaccion.
- Actualiza existencia, ultimo costo, costo promedio, proveedor-articulo e historial.
- Consulta el historial de compras creadas por la app con su detalle de productos.
- Guarda retenciones y foto de factura en una cola local para el integrador contable.
- No crea movimientos de caja, pagos ni creditos de proveedor.
- No cambia impuestos ni precios de venta del articulo.
- No guarda retenciones ni fotos dentro de SICAR.

La escritura requiere `allowPurchases: true`. Mantener una `apiKey` privada para los equipos de la red local.

## Instalacion en Granada

Ejecutar PowerShell como administrador:

```powershell
powershell -ExecutionPolicy Bypass -File .\Install-SicarPurchaseService.ps1 `
  -EnablePurchases
```

El instalador crea solamente la tarea `CSM SICAR Proveedores API` y una regla privada de firewall para el puerto 43110. No detiene, reemplaza ni modifica los workers de traspasos.

## Complemento contable opcional

La app puede enviar `retentionIr2`, `retentionMunicipal1` y una foto JPG, PNG o WEBP de hasta 8 MB. Despues de confirmar la compra en SICAR, el servicio deja el complemento en `C:\SICAR\state\sicar-purchase-accounting`. El worker de compras contables lo une al mismo `com_id`, sube la foto a Storage y actualiza los documentos ya existentes sin crear otra compra.

## Historial y recepciones en espera

`GET /compras/historial` devuelve solamente compras identificadas con el marcador `APP PROVEEDORES [CSM:...]`. Los borradores de recepciones sin factura no pasan por este servicio: permanecen en IndexedDB dentro del dispositivo hasta que el operador los edita y confirma. Al confirmar, SICAR recibe subtotal mas IVA; las retenciones siguen fuera de SICAR.

`GET /catalogos/offline` devuelve el catalogo completo de proveedores y articulos. La app lo guarda localmente y realiza las busquedas de proveedor, clave y descripcion sin llamar al servicio por cada texto escrito.
