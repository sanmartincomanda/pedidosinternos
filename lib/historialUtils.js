import { formatOrderNumber, getPedidoCreationTimestamp } from "@/lib/orderUtils";
import { getBranchDisplayName, getCanonicalBranchId, isSameBranch } from "@/lib/branchUtils";

const STATUS_META = {
  NUEVO: { label: "Nuevo", color: "#2563eb", bg: "rgba(37, 99, 235, 0.12)" },
  STANDBY_ENTREGA: { label: "Standby", color: "#d97706", bg: "rgba(217, 119, 6, 0.12)" },
  PREPARACION: { label: "Preparacion", color: "#ea580c", bg: "rgba(234, 88, 12, 0.12)" },
  LISTO: { label: "Listo", color: "#059669", bg: "rgba(5, 150, 105, 0.12)" },
  ENVIADO: { label: "Enviado", color: "#4f46e5", bg: "rgba(79, 70, 229, 0.12)" },
  RECIBIDO_CONFORME: { label: "Recibido conforme", color: "#047857", bg: "rgba(4, 120, 87, 0.12)" },
  ENTREGADO: { label: "Entregado", color: "#047857", bg: "rgba(4, 120, 87, 0.12)" },
  ANULADO: { label: "Anulado", color: "#b91c1c", bg: "rgba(185, 28, 28, 0.12)" },
};

function normalizeText(value) {
  return `${value || ""}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function isPedidoVacuna(pedido) {
  return pedido?.tipoPedido === "VACUNA";
}

function getPhysicalSenderId(pedido) {
  return getCanonicalBranchId(pedido?.sucursalDestino || pedido?.sucursalCreadora || "");
}

function getPhysicalReceiverId(pedido) {
  return getCanonicalBranchId(pedido?.sucursalOrigen || "");
}

function getPhysicalSender(pedido) {
  return getBranchDisplayName(getPhysicalSenderId(pedido));
}

function getPhysicalReceiver(pedido) {
  return getBranchDisplayName(getPhysicalReceiverId(pedido));
}

function getHistoryDate(pedido) {
  return (
    pedido?.fechaEntrega ||
    pedido?.fechaPedido ||
    (pedido?.fechaCreacion ? `${pedido.fechaCreacion}`.slice(0, 10) : "")
  );
}

function getStatusMeta(status) {
  return STATUS_META[status] || { label: status || "Sin estado", color: "#475569", bg: "rgba(71, 85, 105, 0.12)" };
}

function formatDateLabel(dateStr) {
  if (!dateStr) return "Sin fecha";
  const [year, month, day] = `${dateStr}`.split("-");
  if (!year || !month || !day) return dateStr;
  return `${day}/${month}/${year}`;
}

function getRequestedText(pedido, item) {
  if (isPedidoVacuna(pedido)) {
    return "Envio directo";
  }

  const cantidad = `${item?.cantidad ?? ""}`.trim();
  const unidad = `${item?.unidad ?? ""}`.trim();
  return [cantidad, unidad].filter(Boolean).join(" ") || "Sin dato";
}

function parseNumericValue(value) {
  if (value === null || value === undefined || value === "") return null;

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  const normalized = `${value}`.replace(/,/g, "").trim();
  if (!normalized) return null;

  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function pickFirstNumericValue(candidates = []) {
  for (const candidate of candidates) {
    const parsed = parseNumericValue(candidate);
    if (parsed !== null) {
      return parsed;
    }
  }

  return null;
}

function getRequestedQuantity(item) {
  return parseNumericValue(item?.cantidad) || 0;
}

function getRealQuantity(item, pedido) {
  const baseValue = isPedidoVacuna(pedido) ? item?.pesoReal || item?.cantidad : item?.pesoReal || item?.cantidad;
  const parsed = Number.parseFloat(baseValue || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getEffectiveTransferQuantity(item, pedido) {
  const realQuantity = getRealQuantity(item, pedido);
  if (realQuantity > 0) {
    return realQuantity;
  }

  return getRequestedQuantity(item);
}

function getRealText(item, pedido) {
  const quantity = getRealQuantity(item, pedido);
  return quantity > 0 ? `${quantity.toFixed(2)} ${item?.unidad || "lb"}` : "Pendiente";
}

function getItemUnitCost(item, pedido) {
  return pickFirstNumericValue([
    item?.precioSin,
    item?.costoUnitario,
    item?.costoHistorico,
    item?.costoPromedio,
    item?.costo,
    item?.costos?.precioSin,
    item?.costos?.costoUnitario,
    item?.sicar?.precioSin,
    item?.sicar?.costoUnitario,
    item?.traspaso?.precioSin,
    item?.traspaso?.costoUnitario,
    pedido?.costos?.[item?.clave || ""]?.precioSin,
    pedido?.costos?.[item?.clave || ""]?.costoUnitario,
  ]);
}

function getItemLineCost(item, pedido) {
  const explicitLineCost = pickFirstNumericValue([
    item?.importeSin,
    item?.importeCosto,
    item?.subtotalCosto,
    item?.costoTotal,
    item?.importe,
    item?.costos?.importeSin,
    item?.costos?.importeCosto,
    item?.sicar?.importeSin,
    item?.traspaso?.importeSin,
    pedido?.costos?.[item?.clave || ""]?.importeSin,
    pedido?.costos?.[item?.clave || ""]?.importeCosto,
  ]);

  if (explicitLineCost !== null) {
    return Number(explicitLineCost.toFixed(2));
  }

  const unitCost = getItemUnitCost(item, pedido);
  const quantity = getEffectiveTransferQuantity(item, pedido);

  if (unitCost === null || quantity <= 0) {
    return null;
  }

  return Number((unitCost * quantity).toFixed(2));
}

function getOrderTotals(pedido) {
  const items = Array.isArray(pedido?.items) ? pedido.items : [];

  return items.reduce(
    (acc, item) => {
      const realQuantity = getRealQuantity(item, pedido);
      const lineCost = getItemLineCost(item, pedido);
      return {
        totalReal: Number((acc.totalReal + realQuantity).toFixed(2)),
        totalCost: Number((acc.totalCost + (lineCost || 0)).toFixed(2)),
        itemsCount: acc.itemsCount + 1,
        hasCosts: acc.hasCosts || lineCost !== null || getItemUnitCost(item, pedido) !== null,
      };
    },
    { totalReal: 0, totalCost: 0, itemsCount: 0, hasCosts: false },
  );
}

function matchesStatus(pedido, statusFilter) {
  return statusFilter === "todos" ? true : pedido?.estado === statusFilter;
}

function matchesSearch(pedido, searchTerm) {
  const needle = normalizeText(searchTerm);
  if (!needle) return true;

  const haystack = [
    formatOrderNumber(pedido),
    pedido?.estado,
    pedido?.notaGeneral,
    pedido?.enviadoCon,
    pedido?.preparadoPor,
    pedido?.recibidoPor,
    getPhysicalSender(pedido),
    getPhysicalReceiver(pedido),
    ...(pedido?.items || []).flatMap((item) => [item?.clave, item?.producto, item?.nota]),
  ]
    .map((value) => normalizeText(value))
    .join(" ");

  return haystack.includes(needle);
}

function sortPedidosDesc(a, b) {
  const dateCompare = getHistoryDate(b).localeCompare(getHistoryDate(a));
  if (dateCompare !== 0) {
    return dateCompare;
  }

  return getPedidoCreationTimestamp(b) - getPedidoCreationTimestamp(a);
}

function filterPedidosByDate(pedidos, fechaInicio, fechaFin) {
  return pedidos.filter((pedido) => {
    const historyDate = getHistoryDate(pedido);
    if (!historyDate) return false;
    return historyDate >= fechaInicio && historyDate <= fechaFin;
  });
}

function buildOrderDescriptor(pedido, user) {
  const sender = getPhysicalSender(pedido);
  const receiver = getPhysicalReceiver(pedido);
  const totals = getOrderTotals(pedido);

  return {
    ...pedido,
    historyDate: getHistoryDate(pedido),
    sender,
    receiver,
    isSentByUser: isSameBranch(getPhysicalSenderId(pedido), user),
    isReceivedByUser: isSameBranch(getPhysicalReceiverId(pedido), user),
    itemsCount: totals.itemsCount,
    totalReal: totals.totalReal,
    totalCost: totals.hasCosts ? totals.totalCost : null,
    hasCosts: totals.hasCosts,
    statusMeta: getStatusMeta(pedido?.estado),
  };
}

function buildConsolidatedRows(pedidos) {
  const rowsMap = new Map();

  pedidos.forEach((pedido) => {
    (pedido.items || []).forEach((item) => {
      const key = [
        item?.clave || "",
        item?.producto || "",
        item?.unidad || "lb",
      ].join("::");

      if (!rowsMap.has(key)) {
        rowsMap.set(key, {
          clave: item?.clave || "",
          producto: item?.producto || "SIN PRODUCTO",
          unidad: item?.unidad || "lb",
          cantidad: 0,
          totalCost: 0,
          hasCost: false,
          pedidos: new Set(),
          sucursales: new Set(),
        });
      }

      const row = rowsMap.get(key);
      const quantity = getEffectiveTransferQuantity(item, pedido);
      const lineCost = getItemLineCost(item, pedido);

      row.cantidad += quantity;
      row.totalCost += lineCost || 0;
      row.hasCost = row.hasCost || lineCost !== null || getItemUnitCost(item, pedido) !== null;
      row.pedidos.add(formatOrderNumber(pedido));
      row.sucursales.add(pedido.isSentByUser ? pedido.receiver : pedido.sender);
    });
  });

  return Array.from(rowsMap.values())
    .map((row) => ({
      ...row,
      cantidad: Number(row.cantidad.toFixed(2)),
      totalCost: row.hasCost ? Number(row.totalCost.toFixed(2)) : null,
      averageCost: row.hasCost && row.cantidad > 0 ? Number((row.totalCost / row.cantidad).toFixed(2)) : null,
      pedidos: row.pedidos.size,
      sucursales: Array.from(row.sucursales).filter(Boolean).sort().join(", "),
    }))
    .sort((a, b) => b.cantidad - a.cantidad || a.producto.localeCompare(b.producto));
}

function buildHistoryStats(recibidos, enviados) {
  const recibidosConfirmados = recibidos.filter((pedido) => ["RECIBIDO_CONFORME", "ENTREGADO"].includes(pedido.estado));
  const enviadosConfirmados = enviados.filter((pedido) => ["ENVIADO", "RECIBIDO_CONFORME", "ENTREGADO"].includes(pedido.estado));

  return {
    recibidos: recibidos.length,
    enviados: enviados.length,
    totalRecibido: Number(recibidosConfirmados.reduce((sum, pedido) => sum + pedido.totalReal, 0).toFixed(2)),
    totalEnviado: Number(enviadosConfirmados.reduce((sum, pedido) => sum + pedido.totalReal, 0).toFixed(2)),
    totalCostoRecibido: Number(recibidosConfirmados.reduce((sum, pedido) => sum + (pedido.totalCost || 0), 0).toFixed(2)),
    totalCostoEnviado: Number(enviadosConfirmados.reduce((sum, pedido) => sum + (pedido.totalCost || 0), 0).toFixed(2)),
  };
}

export {
  STATUS_META,
  buildConsolidatedRows,
  buildHistoryStats,
  buildOrderDescriptor,
  filterPedidosByDate,
  formatDateLabel,
  getHistoryDate,
  getPhysicalReceiver,
  getPhysicalReceiverId,
  getPhysicalSender,
  getPhysicalSenderId,
  getItemLineCost,
  getItemUnitCost,
  getRealQuantity,
  getRealText,
  getRequestedText,
  getStatusMeta,
  isPedidoVacuna,
  matchesSearch,
  matchesStatus,
  normalizeText,
  sortPedidosDesc,
};
