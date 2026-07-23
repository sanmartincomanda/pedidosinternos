const { getDatabase } = require("firebase-admin/database");
const { initializeApp } = require("firebase-admin/app");
const { getMessaging } = require("firebase-admin/messaging");
const { onValueWritten } = require("firebase-functions/v2/database");

initializeApp();

const STATUS_CONFIG = {
  NUEVO: {
    title: "NUEVO PEDIDO SOLICITADO",
    action: "Preparar",
    view: "cocina",
    channelId: "pedidos_nuevos_v1",
  },
  STANDBY_ENTREGA: {
    title: "NUEVO PEDIDO SOLICITADO",
    action: "Preparar",
    view: "cocina",
    channelId: "pedidos_nuevos_v1",
  },
  ENVIADO: {
    title: "PRODUCTO EN CAMINO",
    action: "Recibir",
    view: "estados",
    channelId: "producto_en_camino_v1",
  },
};

const PREPARATION_STATUSES = new Set(["NUEVO", "STANDBY_ENTREGA"]);
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
  return [];
}

function normalizeItems(items) {
  if (Array.isArray(items)) return items.filter(Boolean);
  if (!items || typeof items !== "object") return [];
  return Object.keys(items)
    .sort((left, right) => Number(left) - Number(right))
    .map((key) => items[key])
    .filter(Boolean);
}

function getProductSummary(order) {
  const items = normalizeItems(order?.items);
  const names = items
    .map((item) => `${item?.producto || item?.descripcion || item?.nombre || ""}`.trim())
    .filter(Boolean);
  const visibleNames = names.slice(0, 2).join(", ");
  const remaining = Math.max(0, names.length - 2);

  return {
    itemCount: items.length,
    productSummary: `${visibleNames}${remaining > 0 ? ` y ${remaining} mas` : ""}` || "Ver detalle del pedido",
  };
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
          channelId: payload.channelId,
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
    const sender = canonicalBranch(after.sucursalDestino);
    const receiver = canonicalBranch(after.sucursalOrigen);
    const route = `${sender || "Origen"} -> ${receiver || "Destino"}`;
    const { itemCount, productSummary } = getProductSummary(after);
    const body = `${statusConfig.action} ${orderNumber} | ${route} | ${productSummary}`;

    await sendInBatches(devices, {
      title: statusConfig.title,
      body,
      channelId: statusConfig.channelId,
      data: {
        title: statusConfig.title,
        body,
        view: statusConfig.view,
        orderId: `${event.params.pedidoId || ""}`,
        orderNumber,
        status: currentStatus,
        sender,
        receiver,
        itemCount: `${itemCount}`,
        productSummary,
        channelId: statusConfig.channelId,
      },
    });
  },
);
