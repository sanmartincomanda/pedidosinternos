const MAX_ORDER_NUMBER = 10000000000;
const PUSH_CHARS = "-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz";

// Orders created before this cutover stay available only in history.
export const OPERATIVE_RESET_AT_ISO = "2026-04-23T14:18:03.907-06:00";
export const OPERATIVE_RESET_AT = Date.parse(OPERATIVE_RESET_AT_ISO);

function normalizeBase(value = "") {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]/g, "")
    .toUpperCase();
}

export function getUserOrderPrefix(user = "") {
  const normalized = normalizeBase(user);
  return normalized.slice(0, 2) || "XX";
}

export function getUserCounterKey(user = "") {
  return (user || "SIN_SUCURSAL")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase() || "SIN_SUCURSAL";
}

export function buildOrderNumber(prefix, consecutivo) {
  return `${prefix}-${consecutivo}`;
}

export function extractOrderSequence(orderOrId, expectedPrefix = "") {
  const normalizedExpectedPrefix = normalizeBase(expectedPrefix).slice(0, 2);

  if (orderOrId && typeof orderOrId === "object") {
    const prefijo = normalizeBase(orderOrId.prefijoOrden || "").slice(0, 2);
    const consecutivo = Number(orderOrId.consecutivoOrden || 0);

    if (consecutivo > 0 && (!normalizedExpectedPrefix || prefijo === normalizedExpectedPrefix)) {
      return consecutivo;
    }
  }

  const value = formatOrderNumber(orderOrId);
  const match = String(value).toUpperCase().match(/^([A-Z0-9]{2})-(\d+)$/);
  if (!match) return 0;

  const [, prefijo, consecutivo] = match;
  if (normalizedExpectedPrefix && prefijo !== normalizedExpectedPrefix) {
    return 0;
  }

  return Number(consecutivo) || 0;
}

export function getHighestBranchSequence(pedidos = [], sucursal = "") {
  const prefijo = getUserOrderPrefix(sucursal);

  return pedidos.reduce((maximo, pedido) => {
    if (!pedido || pedido.sucursalOrigen !== sucursal) {
      return maximo;
    }

    return Math.max(maximo, extractOrderSequence(pedido, prefijo));
  }, 0);
}

export function formatOrderNumber(orderOrId) {
  if (!orderOrId) return "";

  if (typeof orderOrId === "string" || typeof orderOrId === "number") {
    return String(orderOrId);
  }

  if (orderOrId.numeroOrden) return String(orderOrId.numeroOrden);
  if (orderOrId.prefijoOrden && orderOrId.consecutivoOrden) {
    return buildOrderNumber(orderOrId.prefijoOrden, orderOrId.consecutivoOrden);
  }
  if (orderOrId.id) return String(orderOrId.id);

  return "";
}

export function getLocalDateString(date = new Date()) {
  const timezoneOffset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - timezoneOffset).toISOString().split("T")[0];
}

export function getFirebasePushTimestamp(pushId = "") {
  if (typeof pushId !== "string" || pushId.length < 8) return 0;

  let timestamp = 0;
  for (let index = 0; index < 8; index += 1) {
    const charIndex = PUSH_CHARS.indexOf(pushId.charAt(index));
    if (charIndex === -1) return 0;
    timestamp = timestamp * 64 + charIndex;
  }

  return timestamp;
}

export function getPedidoCreationTimestamp(pedido = null) {
  if (!pedido || typeof pedido !== "object") return 0;

  const fechaCreacion = Date.parse(pedido.fechaCreacion || "");
  if (Number.isFinite(fechaCreacion) && fechaCreacion > 0) {
    return fechaCreacion;
  }

  const firebaseCreatedAt = getFirebasePushTimestamp(pedido.firebaseId || "");
  if (firebaseCreatedAt > 0) {
    return firebaseCreatedAt;
  }

  const fallbackTimestamp = Number(pedido.timestamp || 0);
  return Number.isFinite(fallbackTimestamp) ? fallbackTimestamp : 0;
}

export function isPedidoAfterOperativeReset(pedido) {
  return getPedidoCreationTimestamp(pedido) >= OPERATIVE_RESET_AT;
}

export { MAX_ORDER_NUMBER };
