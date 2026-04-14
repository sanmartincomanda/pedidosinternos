const MAX_ORDER_NUMBER = 10000000000;

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

export { MAX_ORDER_NUMBER };
