// Design-preview build only (NEXT_PUBLIC_DESIGN_PREVIEW=1). Production builds never enable it.
// Lets reviewers walk the Proveedores flow on a phone with sample data and no SICAR/Firebase writes.
export const IS_DESIGN_PREVIEW = process.env.NEXT_PUBLIC_DESIGN_PREVIEW === "1";

export const DEMO_COMPANY = Object.freeze({
  identificador: "demo-diseno",
  empresa: "CARNES SAN MARTIN (DEMO)",
  branchId: "DEMO",
  branchAlias: "Demo",
  legacyBranchId: "Demo",
  modules: Object.freeze(["proveedores"]),
  internalTransfers: false,
  demo: true,
});

const SUPPLIERS = [
  { pro_id: 1, nombre: "DISTRIBUIDORA DE CARNES DEL PACIFICO, S.A.", alias: "PACIFICO", rfc: "J0310000000001" },
  { pro_id: 2, nombre: "GRANJA AVICOLA LA ESPERANZA", alias: "LA ESPERANZA", rfc: "J0310000000002" },
  { pro_id: 3, nombre: "PORCINOS SELECTOS DE NICARAGUA", alias: "PORCINOS", rfc: "J0310000000003" },
  { pro_id: 4, nombre: "EMPAQUES Y DESECHABLES CENTROAMERICANOS DE OCCIDENTE Y NORTE, SOCIEDAD ANONIMA", alias: "EMPAQUES", rfc: "J0310000000004" },
  { pro_id: 5, nombre: "LACTEOS SAN JUAN", alias: "SAN JUAN", rfc: "J0310000000005" },
];

function article(art_id, clave, descripcion, unidad, precio, taxPercent = 0) {
  return {
    art_id,
    clave,
    descripcion,
    unidadCompra: unidad,
    unidadVenta: unidad,
    precioCompra: precio,
    lastPurchaseNet: precio,
    taxPercent,
    existencia: 0,
    factor: 1,
    receta: 0,
  };
}

// Deliberately similar names: the receiving UI must keep them distinguishable.
const ARTICLES = [
  article(92, "00092", "POSTA DE CERDO (E) (+20 LB)", "LB", 89),
  article(91, "00091", "POSTA DE CERDO (E)", "LB", 86.5),
  article(93, "00093", "POSTA DE CERDO", "LB", 84),
  article(120, "00120", "POSTA DE GALLINA", "LB", 52),
  article(121, "00121", "POSTA DE PIERNA", "LB", 61.25),
  article(122, "00122", "POSTA DE CORONA", "LB", 58.75),
  article(130, "PC-CERDO-COSTILLA-ESPECIAL-2026-001", "COSTILLA DE CERDO ESPECIAL AHUMADA CORTE AMERICANO EMPACADA AL VACIO PRESENTACION INSTITUCIONAL (+25 LB) SIN PIEL", "LB", 112.4),
  article(131, "00131", "COSTILLA DE CERDO", "LB", 96),
  article(140, "00140", "LOMO DE RES", "LB", 145),
  article(141, "00141", "LOMO DE RES (EXPORTACION)", "LB", 168.9),
  article(150, "7401234567890", "BANDEJA DESECHABLE #2 NEGRA (PAQ. 500)", "PAQ", 1850, 15),
  article(151, "7401234567891", "BANDEJA DESECHABLE #2 BLANCA (PAQ. 500)", "PAQ", 1790, 15),
  article(160, "00160", "QUESO SECO", "LB", 78),
  article(170, "00170", "PECHUGA DE POLLO SIN HUESO", "LB", 74.3),
  article(171, "00171", "PECHUGA DE POLLO CON HUESO", "LB", 58.1),
  article(180, "00180", "CHORIZO", "UND", 12),
];

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function round2(value) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
}

function summarize(payload) {
  const lines = payload.items.map((item) => {
    const article = ARTICLES.find((row) => row.art_id === Number(item.articleId));
    const net = round2(Number(item.quantity) * Number(item.netUnitPrice));
    return { net, gross: round2(net * (1 + Number(article?.taxPercent || 0) / 100)) };
  });
  const subtotal = round2(lines.reduce((sum, line) => sum + line.net, 0));
  const total = round2(lines.reduce((sum, line) => sum + line.gross, 0));
  return { lines: lines.length, subtotal, taxes: round2(total - subtotal), total };
}

function payment(method, date) {
  const due = new Date(`${date}T12:00:00`);
  due.setDate(due.getDate() + 15);
  return {
    method,
    label: method === "credit" ? "Credito" : "Otro medio de pago",
    dueDate: method === "credit" ? due.toISOString().slice(0, 10) : null,
  };
}

export const demoSicarApi = {
  async health() {
    await wait(350);
    return { ok: true, demo: true };
  },
  async offlineCatalog() {
    await wait(500);
    return { ok: true, generatedAt: new Date().toISOString(), suppliers: SUPPLIERS, articles: ARTICLES };
  },
  async history() {
    await wait(300);
    return {
      ok: true,
      rows: [
        {
          com_id: 9001,
          folio: "F-10233",
          fecha: new Date(Date.now() - 86400000).toISOString().slice(0, 19).replace("T", " "),
          subtotal: 12450,
          taxes: 0,
          total: 12450,
          status: 1,
          statusLabel: "Aplicada",
          supplierName: SUPPLIERS[2].nombre,
          paymentMethod: "credit",
          paymentLabel: "Credito",
          comment: "",
          items: [
            { clave: "00092", descripcion: "POSTA DE CERDO (E) (+20 LB)", cantidad: 100, unidad: "LB", precioSin: 89, importeCon: 8900 },
            { clave: "00093", descripcion: "POSTA DE CERDO", cantidad: 42.26, unidad: "LB", precioSin: 84, importeCon: 3550 },
          ],
        },
      ],
    };
  },
  async preview(payload) {
    await wait(450);
    return {
      ok: true,
      supplier: SUPPLIERS.find((row) => row.pro_id === Number(payload.supplierId)),
      summary: summarize(payload),
      payment: payment(payload.paymentMethod, payload.date),
    };
  },
  async receive(payload) {
    await wait(700);
    const summary = summarize(payload);
    return {
      ok: true,
      purchase: { com_id: Date.now(), folio: payload.invoiceNumber, total: summary.total },
      payment: payment(payload.paymentMethod, payload.date),
      accounting: { requested: false, queued: false },
    };
  },
};
