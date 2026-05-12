import { formatOrderNumber, getPedidoCreationTimestamp } from "@/lib/orderUtils";

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

function getPhysicalSender(pedido) {
  return pedido?.sucursalDestino || pedido?.sucursalCreadora || "";
}

function getPhysicalReceiver(pedido) {
  return pedido?.sucursalOrigen || "";
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

function getRealQuantity(item, pedido) {
  const baseValue = isPedidoVacuna(pedido) ? item?.pesoReal || item?.cantidad : item?.pesoReal || item?.cantidad;
  const parsed = Number.parseFloat(baseValue || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getRealText(item, pedido) {
  const quantity = getRealQuantity(item, pedido);
  return quantity > 0 ? `${quantity.toFixed(2)} ${item?.unidad || "lb"}` : "Pendiente";
}

function getOrderTotals(pedido) {
  const items = Array.isArray(pedido?.items) ? pedido.items : [];

  return items.reduce(
    (acc, item) => {
      const realQuantity = getRealQuantity(item, pedido);
      return {
        totalReal: Number((acc.totalReal + realQuantity).toFixed(2)),
        itemsCount: acc.itemsCount + 1,
      };
    },
    { totalReal: 0, itemsCount: 0 },
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
    isSentByUser: sender === user,
    isReceivedByUser: receiver === user,
    itemsCount: totals.itemsCount,
    totalReal: totals.totalReal,
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
          pedidos: new Set(),
          sucursales: new Set(),
        });
      }

      const row = rowsMap.get(key);
      row.cantidad += getRealQuantity(item, pedido);
      row.pedidos.add(formatOrderNumber(pedido));
      row.sucursales.add(pedido.isSentByUser ? pedido.receiver : pedido.sender);
    });
  });

  return Array.from(rowsMap.values())
    .map((row) => ({
      ...row,
      cantidad: Number(row.cantidad.toFixed(2)),
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
  getPhysicalSender,
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
