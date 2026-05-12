import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
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

function formatNow() {
  return new Date().toLocaleString("es-NI", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function buildDoc(title) {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(title, 40, 42);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  doc.text(`Generado: ${formatNow()}`, 40, 60);
  return doc;
}

function addMetaRow(doc, items, startY) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);

  let currentX = 40;
  items.forEach((item) => {
    doc.text(`${item.label}:`, currentX, startY);
    doc.setFont("helvetica", "normal");
    doc.text(`${item.value || "-"}`, currentX + 42, startY);
    doc.setFont("helvetica", "bold");
    currentX += item.width;
  });
}

function addSignatureFooter(doc, startY, labels = ["Entrega", "Recibe"]) {
  const width = doc.internal.pageSize.getWidth();
  const lineWidth = 180;
  const leftX = 60;
  const rightX = width - lineWidth - 60;

  labels.forEach((label, index) => {
    const x = index === 0 ? leftX : rightX;
    doc.setDrawColor(148, 163, 184);
    doc.line(x, startY, x + lineWidth, startY);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105);
    doc.text(label, x + lineWidth / 2, startY + 14, { align: "center" });
  });
}

function saveDoc(doc, fileName) {
  doc.save(fileName.replace(/[\\/:*?"<>|]/g, "-"));
}

function buildReportSummaryLines({ user, fechaInicio, fechaFin, cantidadPedidos, totalReal }) {
  return [
    { label: "Sucursal", value: user, width: 180 },
    { label: "Desde", value: formatDateLabel(fechaInicio), width: 140 },
    { label: "Hasta", value: formatDateLabel(fechaFin), width: 140 },
    { label: "Pedidos", value: cantidadPedidos, width: 120 },
    { label: "Total", value: `${totalReal.toFixed(2)} lb`, width: 120 },
  ];
}

function buildDetailRows(pedidos, role) {
  return pedidos.flatMap((pedido) =>
    (pedido.items || []).map((item) => [
      formatOrderNumber(pedido),
      formatDateLabel(pedido.historyDate),
      role === "recibidos" ? getPhysicalSender(pedido) : getPhysicalReceiver(pedido),
      item?.clave || "",
      item?.producto || "",
      getRequestedText(pedido, item),
      getRealText(item, pedido),
      pedido.statusMeta?.label || getStatusMeta(pedido.estado).label,
    ]),
  );
}

function buildConsolidatedTableRows(pedidos) {
  return buildConsolidatedRows(pedidos).map((row) => [
    row.clave || "",
    row.producto,
    row.unidad,
    row.cantidad.toFixed(2),
    String(row.pedidos),
    row.sucursales || "-",
  ]);
}

function downloadDetailedHistoryPdf({ title, pedidos, fechaInicio, fechaFin, user, role }) {
  const doc = buildDoc(title);
  const totalReal = pedidos.reduce((sum, pedido) => sum + (pedido.totalReal || 0), 0);
  addMetaRow(
    doc,
    buildReportSummaryLines({
      user,
      fechaInicio,
      fechaFin,
      cantidadPedidos: pedidos.length,
      totalReal,
    }),
    84,
  );

  autoTable(doc, {
    startY: 104,
    head: [["Pedido", "Fecha", role === "recibidos" ? "Enviado por" : "Recibe", "Clave", "Producto", "Solicitado", "Real", "Estado"]],
    body: buildDetailRows(pedidos, role),
    styles: { fontSize: 8.5, cellPadding: 5, textColor: [15, 23, 42] },
    headStyles: { fillColor: [37, 99, 235], textColor: [255, 255, 255] },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: 36, right: 36 },
    didDrawPage: (data) => {
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text(`Pagina ${doc.getCurrentPageInfo().pageNumber}`, data.settings.margin.left, doc.internal.pageSize.getHeight() - 18);
    },
  });

  addSignatureFooter(doc, doc.lastAutoTable.finalY + 42, ["Elabora", role === "recibidos" ? "Recibe" : "Entrega"]);
  saveDoc(doc, `${title}_${fechaInicio}_${fechaFin}.pdf`);
}

function downloadConsolidatedHistoryPdf({ title, pedidos, fechaInicio, fechaFin, user }) {
  const doc = buildDoc(title);
  const totalReal = pedidos.reduce((sum, pedido) => sum + (pedido.totalReal || 0), 0);
  addMetaRow(
    doc,
    buildReportSummaryLines({
      user,
      fechaInicio,
      fechaFin,
      cantidadPedidos: pedidos.length,
      totalReal,
    }),
    84,
  );

  autoTable(doc, {
    startY: 104,
    head: [["Clave", "Producto", "Unidad", "Cantidad total", "Pedidos", "Sucursales"]],
    body: buildConsolidatedTableRows(pedidos),
    styles: { fontSize: 9, cellPadding: 5, textColor: [15, 23, 42] },
    headStyles: { fillColor: [5, 150, 105], textColor: [255, 255, 255] },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: 36, right: 36 },
  });

  addSignatureFooter(doc, doc.lastAutoTable.finalY + 42, ["Entrega", "Recibe"]);
  saveDoc(doc, `${title}_${fechaInicio}_${fechaFin}.pdf`);
}

function downloadTransferRequisitionPdf({ pedido }) {
  const doc = buildDoc("REQUISA DE TRASPASO");
  const sender = getPhysicalSender(pedido);
  const receiver = getPhysicalReceiver(pedido);

  addMetaRow(
    doc,
    [
      { label: "Pedido", value: formatOrderNumber(pedido), width: 150 },
      { label: "Fecha", value: formatDateLabel(pedido.historyDate), width: 120 },
      { label: "Estado", value: pedido.statusMeta?.label || getStatusMeta(pedido.estado).label, width: 170 },
      { label: "Tipo", value: isPedidoVacuna(pedido) ? "Vacuna" : "Traspaso", width: 140 },
    ],
    84,
  );

  addMetaRow(
    doc,
    [
      { label: "Entrega", value: sender, width: 260 },
      { label: "Recibe", value: receiver, width: 260 },
    ],
    104,
  );

  autoTable(doc, {
    startY: 128,
    head: [["Clave", "Producto", "Solicitado", "Peso real", "Nota"]],
    body: (pedido.items || []).map((item) => [
      item?.clave || "",
      item?.producto || "",
      getRequestedText(pedido, item),
      getRealText(item, pedido),
      item?.nota || "",
    ]),
    styles: { fontSize: 9, cellPadding: 5, textColor: [15, 23, 42] },
    headStyles: { fillColor: [37, 99, 235], textColor: [255, 255, 255] },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: 36, right: 36 },
  });

  const finalY = doc.lastAutoTable.finalY + 18;

  if (pedido.notaGeneral) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text("Nota general:", 40, finalY);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(71, 85, 105);
    doc.text(doc.splitTextToSize(pedido.notaGeneral, 520), 110, finalY);
  }

  addSignatureFooter(doc, Math.max(doc.lastAutoTable.finalY + 92, 680), ["Entrega", "Recibe"]);
  saveDoc(doc, `Requisa_${formatOrderNumber(pedido)}.pdf`);
}

function buildPrintableRequisitionHtml(pedido) {
  const sender = getPhysicalSender(pedido);
  const receiver = getPhysicalReceiver(pedido);
  const rows = (pedido.items || [])
    .map(
      (item) => `
        <tr>
          <td>${item?.clave || ""}</td>
          <td>${item?.producto || ""}</td>
          <td>${getRequestedText(pedido, item)}</td>
          <td>${getRealText(item, pedido)}</td>
          <td>${item?.nota || ""}</td>
        </tr>
      `,
    )
    .join("");

  return `
    <html>
      <head>
        <title>Requisa ${formatOrderNumber(pedido)}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 32px; color: #0f172a; }
          h1 { margin: 0 0 16px 0; font-size: 24px; }
          .meta { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-bottom: 18px; }
          .box { border: 1px solid #cbd5e1; border-radius: 10px; padding: 12px; }
          .label { font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700; margin-bottom: 4px; }
          .value { font-size: 14px; font-weight: 700; }
          table { width: 100%; border-collapse: collapse; margin-top: 16px; }
          th, td { border: 1px solid #cbd5e1; padding: 10px; text-align: left; font-size: 12px; }
          th { background: #dbeafe; text-transform: uppercase; font-size: 11px; }
          .note { margin-top: 16px; padding: 12px; border: 1px solid #bfdbfe; background: #eff6ff; border-radius: 10px; }
          .signatures { display: grid; grid-template-columns: repeat(2, 1fr); gap: 40px; margin-top: 80px; }
          .signature-line { border-top: 1px solid #94a3b8; padding-top: 8px; text-align: center; font-weight: 700; color: #475569; }
        </style>
      </head>
      <body>
        <h1>REQUISA DE TRASPASO</h1>
        <div class="meta">
          <div class="box"><div class="label">Pedido</div><div class="value">${formatOrderNumber(pedido)}</div></div>
          <div class="box"><div class="label">Fecha</div><div class="value">${formatDateLabel(pedido.historyDate)}</div></div>
          <div class="box"><div class="label">Entrega</div><div class="value">${sender}</div></div>
          <div class="box"><div class="label">Recibe</div><div class="value">${receiver}</div></div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Clave</th>
              <th>Producto</th>
              <th>Solicitado</th>
              <th>Peso real</th>
              <th>Nota</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        ${
          pedido.notaGeneral
            ? `<div class="note"><strong>Nota general:</strong> ${pedido.notaGeneral}</div>`
            : ""
        }
        <div class="signatures">
          <div class="signature-line">Entrega</div>
          <div class="signature-line">Recibe</div>
        </div>
      </body>
    </html>
  `;
}

function printTransferRequisition(pedido) {
  if (typeof window === "undefined") return;

  const printWindow = window.open("", "_blank", "width=900,height=1100");
  if (!printWindow) return;

  printWindow.document.open();
  printWindow.document.write(buildPrintableRequisitionHtml(pedido));
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}

export {
  downloadConsolidatedHistoryPdf,
  downloadDetailedHistoryPdf,
  downloadTransferRequisitionPdf,
  printTransferRequisition,
};
