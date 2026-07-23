import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { PushNotifications } from "@capacitor/push-notifications";
import { ref, serverTimestamp, set, update } from "firebase/database";
import { db } from "../firebase";
import { getCanonicalBranchId } from "./branchUtils";

const NOTIFICATION_CHANNELS = [
  {
    id: "pedidos_nuevos_v2",
    name: "Pedidos nuevos",
    description: "Pedidos nuevos que deben prepararse",
  },
  {
    id: "producto_en_camino_v2",
    name: "Producto en camino",
    description: "Producto enviado que debe recibirse",
  },
];
const DEFAULT_CHANNEL_ID = NOTIFICATION_CHANNELS[0].id;
let activeDeviceKey = "";
let listenerHandles = [];

async function createNotificationChannels() {
  await Promise.all(
    NOTIFICATION_CHANNELS.map((channel) =>
      PushNotifications.createChannel({
        ...channel,
        importance: 5,
        visibility: 1,
        vibration: true,
        sound: "default",
      }),
    ),
  );
}

export function isNativeAndroidApp() {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
}

async function getDeviceKey(token) {
  const bytes = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function saveDeviceToken(token, branch) {
  activeDeviceKey = await getDeviceKey(token);
  await set(ref(db, `notificaciones_dispositivos/${activeDeviceKey}`), {
    token,
    sucursal: getCanonicalBranchId(branch),
    plataforma: "android",
    activo: true,
    actualizadoEn: serverTimestamp(),
  });
}

async function showForegroundNotification(notification) {
  const data = notification?.data || {};
  const title = notification?.title || data.title || "CSM Pedidos";
  const body = notification?.body || data.body || "Hay una novedad en pedidos internos.";

  await LocalNotifications.schedule({
    notifications: [
      {
        id: Math.max(1, Date.now() % 2147483647),
        title,
        body,
        channelId: data.channelId || DEFAULT_CHANNEL_ID,
        schedule: { at: new Date(Date.now() + 250) },
        extra: data,
      },
    ],
  });
}

export async function showMobileOperationalNotification(alert) {
  if (!isNativeAndroidApp() || !alert) return;

  let permission = await LocalNotifications.checkPermissions();
  if (permission.display === "prompt") {
    permission = await LocalNotifications.requestPermissions();
  }
  if (permission.display !== "granted") return;

  await createNotificationChannels();
  const channelId = alert.status === "ENVIADO"
    ? "producto_en_camino_v2"
    : "pedidos_nuevos_v2";

  await LocalNotifications.schedule({
    notifications: [
      {
        id: Math.max(1, Date.now() % 2147483647),
        title: alert.title,
        body: `${alert.body} | ${alert.productSummary}`,
        channelId,
        schedule: { at: new Date(Date.now() + 150) },
        extra: {
          ...alert,
          channelId,
        },
      },
    ],
  });
}

function getNotificationData(event) {
  return event?.notification?.data || event?.notification?.extra || event?.data || event?.extra || {};
}

export async function stopMobileNotificationListeners() {
  const handles = listenerHandles;
  listenerHandles = [];
  await Promise.allSettled(handles.map((handle) => handle?.remove?.()));
}

export async function deactivateMobileNotifications() {
  if (!activeDeviceKey || !isNativeAndroidApp()) return;

  await update(ref(db, `notificaciones_dispositivos/${activeDeviceKey}`), {
    activo: false,
    actualizadoEn: serverTimestamp(),
  });
  activeDeviceKey = "";
}

export async function initializeMobileNotifications(branch, onNavigate) {
  if (!isNativeAndroidApp()) return () => {};

  await stopMobileNotificationListeners();
  await createNotificationChannels();

  let pushPermission = await PushNotifications.checkPermissions();
  if (pushPermission.receive === "prompt") {
    pushPermission = await PushNotifications.requestPermissions();
  }
  if (pushPermission.receive !== "granted") return () => {};

  let localPermission = await LocalNotifications.checkPermissions();
  if (localPermission.display === "prompt") {
    localPermission = await LocalNotifications.requestPermissions();
  }

  const handles = await Promise.all([
    PushNotifications.addListener("registration", ({ value }) => {
      saveDeviceToken(value, branch).catch((error) => {
        console.error("No se pudo registrar el telefono para notificaciones:", error);
      });
    }),
    PushNotifications.addListener("registrationError", (error) => {
      console.error("Firebase no pudo registrar las notificaciones Android:", error);
    }),
    PushNotifications.addListener("pushNotificationReceived", (notification) => {
      if (localPermission.display === "granted") {
        showForegroundNotification(notification).catch((error) => {
          console.error("No se pudo mostrar la notificacion Android:", error);
        });
      }
    }),
    PushNotifications.addListener("pushNotificationActionPerformed", (event) => {
      const data = getNotificationData(event);
      if (data.view) onNavigate?.(data.view, data);
    }),
    LocalNotifications.addListener("localNotificationActionPerformed", (event) => {
      const data = getNotificationData(event);
      if (data.view) onNavigate?.(data.view, data);
    }),
  ]);

  listenerHandles = handles;
  await PushNotifications.register();

  return stopMobileNotificationListeners;
}
