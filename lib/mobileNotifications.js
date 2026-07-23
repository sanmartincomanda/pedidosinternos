import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { PushNotifications } from "@capacitor/push-notifications";
import { ref, serverTimestamp, set, update } from "firebase/database";
import { db } from "../firebase";
import { getCanonicalBranchId } from "./branchUtils";

const CHANNEL_ID = "pedidos";
let activeDeviceKey = "";
let listenerHandles = [];

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
        channelId: CHANNEL_ID,
        schedule: { at: new Date(Date.now() + 250) },
        extra: data,
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
  await PushNotifications.createChannel({
    id: CHANNEL_ID,
    name: "Pedidos internos",
    description: "Cambios de estado de pedidos y traspasos",
    importance: 5,
    visibility: 1,
    vibration: true,
  });

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
      if (data.view) onNavigate?.(data.view);
    }),
    LocalNotifications.addListener("localNotificationActionPerformed", (event) => {
      const data = getNotificationData(event);
      if (data.view) onNavigate?.(data.view);
    }),
  ]);

  listenerHandles = handles;
  await PushNotifications.register();

  return stopMobileNotificationListeners;
}
