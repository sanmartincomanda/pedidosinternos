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

El instalador queda en `release/CSM-Operaciones-1.1.3-Setup.exe`.

## Android

El proyecto Android usa Capacitor 7, Android API 35 y Firebase Cloud Messaging.

```powershell
npm run android:apk
```

El APK firmado de produccion queda en `android/app/build/outputs/apk/release/app-release.apk`.
La firma privada se carga desde `android-signing/keystore.properties` y no se publica en GitHub.
Las notificaciones en segundo plano dependen de la funcion `notificarCambioPedido`:

```powershell
npm run firebase:deploy:notifications
```

Firebase exige que el proyecto este en el plan Blaze para desplegar esta Cloud Function.
Sin esa funcion, la app sigue operativa pero no puede garantizar avisos cuando esta completamente cerrada.
