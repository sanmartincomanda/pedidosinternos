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

El instalador queda en `release/CSM-Pedidos-1.0.0-Setup.exe`.
