# Servicio local SICAR - Proveedores externos

Este servicio es independiente de los workers de traspasos. No lee Firebase y no modifica sus tareas programadas.

## Alcance

- Lee proveedores, articulos, unidades, impuestos y ultimo precio de compra.
- Previsualiza precios con IVA desde la configuracion vigente de SICAR.
- Registra una compra de inventario en una sola transaccion.
- Actualiza existencia, ultimo costo, costo promedio, proveedor-articulo e historial.
- No crea movimientos de caja, pagos ni creditos de proveedor.
- No cambia impuestos ni precios de venta del articulo.

La escritura requiere `allowPurchases: true`. Mantener una `apiKey` privada para los equipos de la red local.

## Instalacion en Granada

Ejecutar PowerShell como administrador:

```powershell
powershell -ExecutionPolicy Bypass -File .\Install-SicarPurchaseService.ps1 `
  -EnablePurchases
```

El instalador crea solamente la tarea `CSM SICAR Proveedores API` y una regla privada de firewall para el puerto 43110. No detiene, reemplaza ni modifica los workers de traspasos.
