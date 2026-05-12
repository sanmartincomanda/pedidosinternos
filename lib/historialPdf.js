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

function buildPrintableRequisitionHtml(pedido, printerSettings = {}) {
  const sender = getPhysicalSender(pedido);
  const receiver = getPhysicalReceiver(pedido);
  const printerName = `${printerSettings?.impresoraPredeterminada || ""}`.trim();
  const itemsHtml = (pedido.items || [])
    .map(
      (item) => `
        <div class="item">
          <div class="item-top">
            <div class="item-producto">${item?.producto || ""}</div>
            <div class="item-real">${getRealText(item, pedido)}</div>
          </div>
          <div class="item-meta">Clave: ${item?.clave || "-"}</div>
          <div class="item-meta">Solicitado: ${getRequestedText(pedido, item)}</div>
          ${item?.nota ? `<div class="item-nota">Nota: ${item.nota}</div>` : ""}
        </div>
      `,
    )
    .join("");

  return `
    <html>
      <head>
        <title>Requisa ${formatOrderNumber(pedido)}</title>
        <style>
          @page { size: 80mm auto; margin: 4mm; }
          * { box-sizing: border-box; }
          html, body {
            width: 72mm;
            margin: 0;
            padding: 0;
            font-family: Arial, sans-serif;
            color: #0f172a;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          body { font-size: 11px; line-height: 1.35; }
          .ticket { width: 72mm; }
          .header {
            text-align: center;
            border-bottom: 1px dashed #94a3b8;
            padding-bottom: 8px;
            margin-bottom: 10px;
          }
          h1 {
            margin: 0;
            font-size: 15px;
            letter-spacing: 0.06em;
          }
          .sub {
            margin-top: 4px;
            font-size: 10px;
            color: #475569;
          }
          .meta {
            display: grid;
            gap: 6px;
            margin-bottom: 10px;
          }
          .box {
            border: 1px solid #cbd5e1;
            border-radius: 8px;
            padding: 7px 8px;
          }
          .label {
            font-size: 9px;
            text-transform: uppercase;
            color: #64748b;
            font-weight: 700;
            margin-bottom: 2px;
            letter-spacing: 0.04em;
          }
          .value {
            font-size: 11px;
            font-weight: 700;
            word-break: break-word;
          }
          .section-title {
            margin: 12px 0 6px 0;
            font-size: 10px;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            color: #1e3a8a;
            font-weight: 800;
          }
          .item-list {
            border-top: 1px dashed #cbd5e1;
            border-bottom: 1px dashed #cbd5e1;
          }
          .item {
            padding: 8px 0;
            border-bottom: 1px dashed #e2e8f0;
          }
          .item:last-child {
            border-bottom: none;
          }
          .item-top {
            display: flex;
            justify-content: space-between;
            gap: 8px;
            align-items: flex-start;
          }
          .item-producto {
            flex: 1;
            font-size: 11px;
            font-weight: 700;
            word-break: break-word;
          }
          .item-real {
            font-size: 11px;
            font-weight: 800;
            white-space: nowrap;
          }
          .item-meta {
            margin-top: 3px;
            font-size: 10px;
            color: #475569;
            word-break: break-word;
          }
          .item-nota {
            margin-top: 4px;
            font-size: 10px;
            color: #b45309;
            font-weight: 700;
            word-break: break-word;
          }
          .note {
            margin-top: 10px;
            padding: 8px;
            border: 1px solid #bfdbfe;
            background: #eff6ff;
            border-radius: 8px;
            font-size: 10px;
            word-break: break-word;
          }
          .signatures {
            display: grid;
            gap: 24px;
            margin-top: 26px;
          }
          .signature-block {
            padding-top: 16px;
          }
          .signature-line {
            border-top: 1px solid #94a3b8;
            padding-top: 6px;
            text-align: center;
            font-weight: 700;
            color: #475569;
            font-size: 10px;
          }
          .footer {
            margin-top: 14px;
            text-align: center;
            font-size: 9px;
            color: #94a3b8;
          }
        </style>
      </head>
      <body>
        <div class="ticket">
          <div class="header">
            <h1>REQUISA DE TRASPASO</h1>
            <div class="sub">Documento para firma fisica</div>
            ${printerName ? `<div class="sub">Impresora: ${printerName}</div>` : ""}
          </div>
          <div class="meta">
            <div class="box"><div class="label">Pedido</div><div class="value">${formatOrderNumber(pedido)}</div></div>
            <div class="box"><div class="label">Fecha</div><div class="value">${formatDateLabel(pedido.historyDate)}</div></div>
            <div class="box"><div class="label">Entrega</div><div class="value">${sender}</div></div>
            <div class="box"><div class="label">Recibe</div><div class="value">${receiver}</div></div>
            <div class="box"><div class="label">Estado</div><div class="value">${pedido.statusMeta?.label || getStatusMeta(pedido.estado).label}</div></div>
            <div class="box"><div class="label">Tipo</div><div class="value">${isPedidoVacuna(pedido) ? "Vacuna" : "Traspaso"}</div></div>
          </div>
          <div class="section-title">Detalle</div>
          <div class="item-list">${itemsHtml}</div>
        ${
          pedido.notaGeneral
            ? `<div class="note"><strong>Nota general:</strong> ${pedido.notaGeneral}</div>`
            : ""
        }
          <div class="signatures">
            <div class="signature-block"><div class="signature-line">Entrega</div></div>
            <div class="signature-block"><div class="signature-line">Recibe</div></div>
          </div>
          <div class="footer">Generado ${formatNow()}</div>
        </div>
      </body>
    </html>
  `;
}

function printTransferRequisition(pedido, printerSettings = {}) {
  if (typeof window === "undefined") return;

  const printWindow = window.open("", "_blank", "width=420,height=900");
  if (!printWindow) return;

  printWindow.document.open();
  printWindow.document.write(buildPrintableRequisitionHtml(pedido, printerSettings));
  printWindow.document.close();
  printWindow.onload = () => {
    printWindow.focus();
    printWindow.addEventListener("afterprint", () => {
      printWindow.close();
    });
    printWindow.print();
  };
}

export {
  downloadConsolidatedHistoryPdf,
  downloadDetailedHistoryPdf,
  downloadTransferRequisitionPdf,
  printTransferRequisition,
};
