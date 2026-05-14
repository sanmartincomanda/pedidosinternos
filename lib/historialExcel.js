import { getBranchDisplayName } from "@/lib/branchUtils";
import { formatOrderNumber } from "@/lib/orderUtils";
import {
  buildConsolidatedRows,
  formatDateLabel,
  getPhysicalReceiver,
  getPhysicalSender,
  getRealText,
  getRequestedText,
  getStatusMeta,
  isPedidoVacuna,
} from "@/lib/historialUtils";

function formatNowForExport() {
  return new Date().toLocaleString("es-NI", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function sanitizeFileName(fileName) {
  return `${fileName || "reporte"}`.replace(/[\\/:*?"<>|]/g, "-");
}

function buildDetailedRows(pedidos, role) {
  const counterpartLabel = role === "recibidos" ? "Enviado por" : "Recibe";

  return pedidos.flatMap((pedido) =>
    (pedido.items || []).map((item) => ({
      Pedido: formatOrderNumber(pedido),
      Fecha: formatDateLabel(pedido.historyDate),
      [counterpartLabel]: role === "recibidos" ? getPhysicalSender(pedido) : getPhysicalReceiver(pedido),
      Estado: pedido.statusMeta?.label || getStatusMeta(pedido.estado).label,
      Tipo: isPedidoVacuna(pedido) ? "Vacuna" : "Traspaso",
      Clave: item?.clave || "",
      Producto: item?.producto || "",
      Solicitado: getRequestedText(pedido, item),
      "Peso real": getRealText(item, pedido),
      "Nota especial": item?.nota || "",
      "Nota general": pedido?.notaGeneral || "",
      "Preparado por": pedido?.preparadoPor || "",
      "Enviado con": pedido?.enviadoCon || "",
      "Recibido por": pedido?.recibidoPor || "",
      "Fecha recepcion": pedido?.fechaRecepcion || "",
      "Hora recepcion": pedido?.horaRecepcion || "",
    })),
  );
}

function buildConsolidatedExportRows(pedidos) {
  return buildConsolidatedRows(pedidos).map((row) => ({
    Clave: row.clave || "",
    Producto: row.producto,
    Unidad: row.unidad,
    "Cantidad total": row.cantidad,
    Pedidos: row.pedidos,
    Sucursales: row.sucursales || "",
  }));
}

async function createWorkbookFromRows({
  title,
  user,
  fechaInicio,
  fechaFin,
  rows,
  columns,
  fileName,
  sheetName,
}) {
  const XLSX = await import("xlsx");
  const metadataRows = [
    ["Reporte", title],
    ["Sucursal", getBranchDisplayName(user)],
    ["Desde", formatDateLabel(fechaInicio)],
    ["Hasta", formatDateLabel(fechaFin)],
    ["Generado", formatNowForExport()],
    [],
  ];
  const headerRowIndex = metadataRows.length;
  const worksheet = XLSX.utils.aoa_to_sheet(metadataRows);

  XLSX.utils.sheet_add_json(worksheet, rows, {
    origin: `A${headerRowIndex + 1}`,
    skipHeader: false,
  });

  worksheet["!cols"] = columns;
  if (rows.length > 0) {
    worksheet["!autofilter"] = {
      ref: `A${headerRowIndex + 1}:${String.fromCharCode(64 + columns.length)}${headerRowIndex + 1}`,
    };
  }

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  XLSX.writeFile(workbook, `${sanitizeFileName(fileName)}.xlsx`);
}

async function downloadDetailedHistoryExcel({ title, pedidos, fechaInicio, fechaFin, user, role }) {
  const rows = buildDetailedRows(pedidos, role);

  await createWorkbookFromRows({
    title,
    user,
    fechaInicio,
    fechaFin,
    rows,
    fileName: `${title}_${fechaInicio}_${fechaFin}`,
    sheetName: role === "recibidos" ? "Recibidos" : "Enviados",
    columns: [
      { wch: 14 },
      { wch: 12 },
      { wch: 26 },
      { wch: 18 },
      { wch: 12 },
      { wch: 14 },
      { wch: 38 },
      { wch: 16 },
      { wch: 16 },
      { wch: 26 },
      { wch: 28 },
      { wch: 20 },
      { wch: 20 },
      { wch: 18 },
      { wch: 16 },
      { wch: 14 },
    ],
  });
}

async function downloadConsolidatedHistoryExcel({ title, pedidos, fechaInicio, fechaFin, user, sheetName }) {
  const rows = buildConsolidatedExportRows(pedidos);

  await createWorkbookFromRows({
    title,
    user,
    fechaInicio,
    fechaFin,
    rows,
    fileName: `${title}_${fechaInicio}_${fechaFin}`,
    sheetName,
    columns: [
      { wch: 16 },
      { wch: 40 },
      { wch: 12 },
      { wch: 16 },
      { wch: 10 },
      { wch: 32 },
    ],
  });
}

export {
  downloadConsolidatedHistoryExcel,
  downloadDetailedHistoryExcel,
};
