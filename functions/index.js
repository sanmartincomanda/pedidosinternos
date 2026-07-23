const { getDatabase } = require("firebase-admin/database");
const { initializeApp } = require("firebase-admin/app");
const { getMessaging } = require("firebase-admin/messaging");
const { onValueWritten } = require("firebase-functions/v2/database");

initializeApp();

const STATUS_CONFIG = {
  NUEVO: { title: "Nuevo pedido recibido", view: "cocina" },
  STANDBY_ENTREGA: { title: "Pedido pendiente de preparar", view: "cocina" },
  PREPARACION: { title: "Pedido en preparacion", view: "cocina" },
  LISTO: { title: "Pedido listo para enviar", view: "cocina" },
  ENVIADO: { title: "Pedido enviado", view: "estados" },
  RECIBIDO_CONFORME: { title: "Pedido recibido conforme", view: "historial" },
  ENTREGADO: { title: "Pedido entregado", view: "historial" },
  ANULADO: { title: "Pedido anulado", view: "historial" },
};

const PREPARATION_STATUSES = new Set(["NUEVO", "STANDBY_ENTREGA", "PREPARACION", "LISTO"]);
const INVALID_TOKEN_CODES = new Set([
  "messaging/invalid-registration-token",
  "messaging/registration-token-not-registered",
]);

function canonicalBranch(value = "") {
  const normalized = `${value || ""}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  if (normalized.includes("nindiri")) return "Nindiri";
  if (normalized.includes("granada")) return "Granada";
  return `${value || ""}`.trim();
}

function getTargetBranches(order, status) {
  const sender = canonicalBranch(order?.sucursalDestino);
  const receiver = canonicalBranch(order?.sucursalOrigen);

  if (PREPARATION_STATUSES.has(status)) return [sender];
  if (status === "ENVIADO") return [receiver];
  if (status === "RECIBIDO_CONFORME") return [sender];
  if (status === "ENTREGADO" || status === "ANULADO") return [sender, receiver];
  return [];
}

async function sendInBatches(devices, payload) {
  const invalidDeviceUpdates = {};

  for (let start = 0; start < devices.length; start += 500) {
    const batch = devices.slice(start, start + 500);
    const response = await getMessaging().sendEachForMulticast({
      tokens: batch.map((device) => device.token),
      notification: {
        title: payload.title,
        body: payload.body,
      },
      data: payload.data,
      android: {
        priority: "high",
        notification: {
          channelId: "pedidos",
          sound: "default",
        },
      },
    });

    response.responses.forEach((result, index) => {
      if (!result.success && INVALID_TOKEN_CODES.has(result.error?.code)) {
        invalidDeviceUpdates[batch[index].key] = null;
      }
    });
  }

  if (Object.keys(invalidDeviceUpdates).length > 0) {
    await getDatabase().ref("notificaciones_dispositivos").update(invalidDeviceUpdates);
  }
}

exports.notificarCambioPedido = onValueWritten(
  {
    ref: "/pedidos_internos/{pedidoId}",
    instance: "pedidosinterno-3c65d-default-rtdb",
    region: "us-central1",
    maxInstances: 5,
  },
  async (event) => {
    const before = event.data.before.exists() ? event.data.before.val() : null;
    const after = event.data.after.exists() ? event.data.after.val() : null;
    if (!after) return;

    const previousStatus = `${before?.estado || ""}`;
    const currentStatus = `${after?.estado || ""}`;
    const statusConfig = STATUS_CONFIG[currentStatus];
    if (!statusConfig || previousStatus === currentStatus) return;

    const targetBranches = new Set(getTargetBranches(after, currentStatus));
    if (targetBranches.size === 0) return;

    const devicesSnapshot = await getDatabase().ref("notificaciones_dispositivos").once("value");
    const devicesData = devicesSnapshot.val() || {};
    const devices = Object.entries(devicesData)
      .map(([key, value]) => ({ key, ...value }))
      .filter(
        (device) =>
          device.activo !== false &&
          device.token &&
          targetBranches.has(canonicalBranch(device.sucursal)),
      );

    if (devices.length === 0) return;

    const orderNumber = `${after.numeroOrden || event.params.pedidoId || "Pedido"}`;
    await sendInBatches(devices, {
      title: statusConfig.title,
      body: `${orderNumber} - Estado actualizado correctamente`,
      data: {
        title: statusConfig.title,
        body: `${orderNumber} - Estado actualizado correctamente`,
        view: statusConfig.view,
        orderId: `${event.params.pedidoId || ""}`,
        status: currentStatus,
      },
    });
  },
);
