# Actualizacion para levantamientos grandes

Esta actualizacion corrige `spawn ENAMETOOLONG` al revisar o aplicar levantamientos con muchas lineas.

## Aplicar en el servidor de la sucursal

1. Copiar juntos estos archivos al servidor:
   - `server.mjs`
   - `mysqlProcess.mjs`
   - `Update-SicarPurchaseService.ps1`
2. Abrir PowerShell como Administrador en esa carpeta.
3. Ejecutar:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File ".\Update-SicarPurchaseService.ps1"
```

El actualizador conserva `config.local.json`, la clave API y las credenciales MySQL instaladas. Tambien crea un respaldo antes de reiniciar la tarea `CSM SICAR Proveedores API`.

No crear un levantamiento nuevo. Despues de actualizar el API, abrir el levantamiento guardado en espera y presionar `Continuar`.
