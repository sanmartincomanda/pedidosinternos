# CSM Pedidos

Aplicacion de escritorio y web para pedidos y traspasos internos entre Granada y Nindiri.

## Desarrollo web

```powershell
npm install
npm run dev
```

## Aplicacion de escritorio

```powershell
npm run desktop:dev
```

La aplicacion de escritorio incluye:

- Conexion al mismo Firebase de la aplicacion web.
- Notificaciones nativas de Windows al cambiar el estado de un pedido.
- Icono en la bandeja del sistema; cerrar la ventana no detiene los avisos.
- Inicio automatico y oculto con Windows despues de instalarla.
- Accesos directos a Pedido, Traspaso, Cocina, Recibir e Historial.

## Crear instalador

```powershell
npm run desktop:build
```

El instalador queda en `release/CSM-Operaciones-1.1.10-Setup.exe`.

El modulo de proveedores conserva en IndexedDB una copia local de los proveedores y articulos de SICAR. Despues de sincronizar una vez, la busqueda y `Recibir sin factura` funcionan sin conexion, incluso tras reiniciar la app. Enviar la compra definitivamente a SICAR sigue requiriendo acceso al servicio local.

Al marcar un traspaso como enviado, las apps de Windows y Android abren el selector nativo de impresion con la misma requisa PDF en papel carta disponible desde Historial. Cancelar la impresion no cambia el estado del pedido ni deja una pantalla interna abierta.

## Android

El proyecto Android usa Capacitor 7, Android API 35 y Firebase Cloud Messaging.

```powershell
npm run android:apk
```

El APK firmado de produccion para tablet queda en `android/app/build/outputs/apk/tablet/release/app-tablet-release.apk`.
La firma privada se carga desde `android-signing/keystore.properties` y no se publica en GitHub.

### Android Hand Held

La edicion Hand Held es una aplicacion separada (`com.pedidosinternos.handheld`) y puede instalarse junto a la version de tablet. Usa una interfaz compacta y, en Proveedores SICAR, prioriza escanear clave, ingresar cantidad y continuar con el siguiente producto. La busqueda manual sigue disponible como respaldo.

```powershell
npm run android:handheld:apk
```

El APK queda en `android/app/build/outputs/apk/handheld/release/app-handheld-release.apk`.
Las notificaciones en segundo plano dependen de la funcion `notificarCambioPedido`:

```powershell
npm run firebase:deploy:notifications
```

Firebase exige que el proyecto este en el plan Blaze para desplegar esta Cloud Function.
Sin esa funcion, la app sigue operativa pero no puede garantizar avisos cuando esta completamente cerrada.
