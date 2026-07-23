const {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  nativeImage,
  Notification,
  shell,
  Tray,
} = require("electron");
const { createReadStream, existsSync, statSync } = require("node:fs");
const { createServer } = require("node:http");
const path = require("node:path");

const APP_ID = "com.carnessanmartin.pedidosinternos";
const APP_TITLE = "CSM Pedidos";
const STATIC_PORT = 41731;
const DEV_URL = process.env.ELECTRON_START_URL || "";
const SKIP_AUTO_LAUNCH = process.env.CSM_DESKTOP_SKIP_AUTO_LAUNCH === "1";
const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

let mainWindow = null;
let tray = null;
let staticServer = null;
let staticOrigin = "";
let isQuitting = false;

app.setAppUserModelId(APP_ID);

const singleInstanceLock = app.requestSingleInstanceLock();
if (!singleInstanceLock) {
  app.quit();
}

function getIconPath() {
  return path.join(app.getAppPath(), "app", "favicon.ico");
}

function getAutoLaunchEnabled() {
  if (!app.isPackaged || process.platform !== "win32") return false;
  return app.getLoginItemSettings().openAtLogin;
}

function setAutoLaunch(enabled) {
  if (!app.isPackaged || process.platform !== "win32") return;
  app.setLoginItemSettings({
    openAtLogin: enabled,
    openAsHidden: enabled,
    path: process.execPath,
    args: enabled ? ["--hidden"] : [],
  });
}

function sendNavigation(destination) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send("desktop:navigate", destination);
}

function showMainWindow(destination) {
  if (!mainWindow || mainWindow.isDestroyed()) return;

  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();

  if (destination) {
    if (mainWindow.webContents.isLoading()) {
      mainWindow.webContents.once("did-finish-load", () => sendNavigation(destination));
    } else {
      sendNavigation(destination);
    }
  }
}

function showDesktopNotification(payload = {}) {
  if (!Notification.isSupported()) return;

  const title = String(payload.title || "CSM Pedidos").slice(0, 90);
  const body = String(payload.body || "Hay una novedad en pedidos internos.").slice(0, 240);
  const notification = new Notification({
    title,
    body,
    icon: getIconPath(),
    silent: false,
    urgency: "critical",
    timeoutType: "never",
  });

  notification.on("click", () => showMainWindow({
    ...payload,
    view: payload.view || "estados",
  }));
  notification.show();
}

function createTray() {
  const icon = nativeImage.createFromPath(getIconPath());
  tray = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon);
  tray.setToolTip(`${APP_TITLE} - activo`);

  const buildMenu = () =>
    Menu.buildFromTemplate([
      { label: "Abrir CSM Pedidos", click: () => showMainWindow() },
      { type: "separator" },
      { label: "Realizar pedido", click: () => showMainWindow("formulario") },
      { label: "Nuevo traspaso", click: () => showMainWindow("vacuna") },
      { label: "Cocina - Preparacion", click: () => showMainWindow("cocina") },
      { label: "Recibir producto", click: () => showMainWindow("estados") },
      { label: "Historial", click: () => showMainWindow("historial") },
      { type: "separator" },
      {
        label: "Iniciar con Windows",
        type: "checkbox",
        checked: getAutoLaunchEnabled(),
        enabled: app.isPackaged,
        click: (menuItem) => {
          setAutoLaunch(menuItem.checked);
          tray.setContextMenu(buildMenu());
        },
      },
      { type: "separator" },
      {
        label: "Salir completamente",
        click: () => {
          isQuitting = true;
          app.quit();
        },
      },
    ]);

  tray.setContextMenu(buildMenu());
  tray.on("double-click", () => showMainWindow());
}

function safeStaticPath(rootDirectory, requestPath) {
  const decodedPath = decodeURIComponent(requestPath.split("?")[0]);
  const relativePath = decodedPath === "/" ? "index.html" : decodedPath.replace(/^\/+/, "");
  const candidate = path.resolve(rootDirectory, relativePath);
  const rootPath = path.resolve(rootDirectory);
  if (candidate !== rootPath && !candidate.startsWith(`${rootPath}${path.sep}`)) return null;
  return candidate;
}

async function startStaticServer() {
  const rootDirectory = path.join(app.getAppPath(), "out");
  staticServer = createServer((request, response) => {
    let filePath = safeStaticPath(rootDirectory, request.url || "/");

    if (filePath && existsSync(filePath) && statSync(filePath).isDirectory()) {
      filePath = path.join(filePath, "index.html");
    }

    if (!filePath || !existsSync(filePath)) {
      filePath = path.join(rootDirectory, "index.html");
    }

    const extension = path.extname(filePath).toLowerCase();
    response.setHeader("Content-Type", MIME_TYPES[extension] || "application/octet-stream");
    response.setHeader(
      "Cache-Control",
      filePath.includes(`${path.sep}_next${path.sep}`)
        ? "public, max-age=31536000, immutable"
        : "no-cache",
    );

    const stream = createReadStream(filePath);
    stream.on("error", () => {
      response.statusCode = 500;
      response.end("No se pudo cargar la aplicacion.");
    });
    stream.pipe(response);
  });

  await new Promise((resolve, reject) => {
    staticServer.once("error", reject);
    staticServer.listen(STATIC_PORT, "127.0.0.1", resolve);
  });

  staticOrigin = `http://127.0.0.1:${STATIC_PORT}`;
  return staticOrigin;
}

async function createMainWindow() {
  const startHidden = process.argv.includes("--hidden");
  const iconPath = getIconPath();

  mainWindow = new BrowserWindow({
    width: 1480,
    height: 920,
    minWidth: 1040,
    minHeight: 700,
    show: false,
    title: APP_TITLE,
    icon: iconPath,
    backgroundColor: "#f4f7f5",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      devTools: !app.isPackaged,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.webContents.on("will-navigate", (event, url) => {
    const allowedOrigin = DEV_URL || staticOrigin;
    if (allowedOrigin && url.startsWith(allowedOrigin)) return;
    event.preventDefault();
    if (/^https?:/i.test(url)) shell.openExternal(url);
  });

  mainWindow.on("close", (event) => {
    if (isQuitting) return;
    event.preventDefault();
    mainWindow.hide();
  });

  mainWindow.once("ready-to-show", () => {
    if (!startHidden) mainWindow.show();
  });

  await mainWindow.loadURL(DEV_URL || staticOrigin);
}

function registerIpc() {
  ipcMain.handle("desktop:get-runtime", () => ({
    isDesktop: true,
    appVersion: app.getVersion(),
    platform: process.platform,
    autoLaunch: getAutoLaunchEnabled(),
  }));

  ipcMain.on("desktop:notify", (_event, payload) => showDesktopNotification(payload));
  ipcMain.on("desktop:show", (_event, view) => showMainWindow(view));
}

if (singleInstanceLock) {
  app.on("second-instance", () => showMainWindow());

  app.whenReady().then(async () => {
    registerIpc();
    if (!DEV_URL) await startStaticServer();
    await createMainWindow();

    if (
      app.isPackaged &&
      process.platform === "win32" &&
      !SKIP_AUTO_LAUNCH &&
      !getAutoLaunchEnabled()
    ) {
      setAutoLaunch(true);
    }
    createTray();
  });

  app.on("activate", () => showMainWindow());
  app.on("before-quit", () => {
    isQuitting = true;
    if (staticServer) staticServer.close();
  });
}
