import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const serviceDirectory = path.dirname(fileURLToPath(import.meta.url));
const configArgumentIndex = process.argv.indexOf("--config");
const configPath = configArgumentIndex >= 0
  ? path.resolve(process.argv[configArgumentIndex + 1])
  : path.join(serviceDirectory, "config.local.json");

const config = JSON.parse((await readFile(configPath, "utf8")).replace(/^\uFEFF/, ""));
const portArgumentIndex = process.argv.indexOf("--port");
const port = Number(portArgumentIndex >= 0 ? process.argv[portArgumentIndex + 1] : config.port || 43110);
const host = config.host || "0.0.0.0";
const cacheTtlMs = Math.max(10, Number(config.cacheSeconds || 60)) * 1000;
const cache = new Map();
let purchaseQueue = Promise.resolve();

function sqlText(value = "") {
  return `'${`${value}`
    .replace(/\\/g, "\\\\")
    .replace(/\0/g, "\\0")
    .replace(/'/g, "''")
    .replace(/\r/g, "\\r")
    .replace(/\n/g, "\\n")
    .replace(/\t/g, "\\t")}'`;
}

function sqlNumber(value, decimals = 6) {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error("Se recibio un valor numerico invalido.");
  return number.toFixed(decimals);
}

function localDateTime() {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: config.timeZone || "America/Managua",
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
  }).format(new Date());
}

function addDays(dateText, days) {
  const [year, month, day] = dateText.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + Math.max(0, Math.trunc(Number(days) || 0)));
  return date.toISOString().slice(0, 10);
}

function parseTsv(output) {
  const lines = output.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split("\t");
  return lines.slice(1).filter(Boolean).map((line) => {
    const values = line.split("\t");
    return Object.fromEntries(headers.map((header, index) => [header, values[index] === "NULL" ? null : values[index]]));
  });
}

function runMysql(sql) {
  return new Promise((resolve, reject) => {
    const args = [
      "--protocol=TCP",
      `--host=${config.mysql.host}`,
      `--port=${config.mysql.port}`,
      `--user=${config.mysql.user}`,
      `--database=${config.mysql.database}`,
      "--default-character-set=utf8",
      "--batch",
      "--raw",
      "--connect-timeout=8",
      "-e",
      sql,
    ];
    const child = spawn(config.mysql.executable, args, {
      windowsHide: true,
      env: { ...process.env, MYSQL_PWD: config.mysql.password },
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve(stdout);
      else reject(new Error(stderr.trim() || `mysql.exe termino con codigo ${code}.`));
    });
  });
}

async function query(sql) {
  return parseTsv(await runMysql(sql));
}

function normalizeSearch(value = "") {
  return `${value}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

function editDistance(source, target, maximum = 2) {
  if (Math.abs(source.length - target.length) > maximum) return maximum + 1;
  let previous = Array.from({ length: target.length + 1 }, (_, index) => index);
  for (let sourceIndex = 1; sourceIndex <= source.length; sourceIndex += 1) {
    const current = [sourceIndex];
    let rowMinimum = current[0];
    for (let targetIndex = 1; targetIndex <= target.length; targetIndex += 1) {
      const cost = source[sourceIndex - 1] === target[targetIndex - 1] ? 0 : 1;
      current[targetIndex] = Math.min(
        previous[targetIndex] + 1,
        current[targetIndex - 1] + 1,
        previous[targetIndex - 1] + cost,
      );
      rowMinimum = Math.min(rowMinimum, current[targetIndex]);
    }
    if (rowMinimum > maximum) return maximum + 1;
    previous = current;
  }
  return previous[target.length];
}

function searchScore(queryText, ...candidateValues) {
  const normalizedQuery = normalizeSearch(queryText);
  if (!normalizedQuery) return 0;
  const candidate = normalizeSearch(candidateValues.join(" "));
  if (candidate === normalizedQuery) return 0;
  if (candidate.startsWith(normalizedQuery)) return 1;
  if (candidate.includes(normalizedQuery)) return 2;

  const queryTokens = normalizedQuery.split(" ");
  const candidateTokens = candidate.split(" ");
  let total = 0;
  for (const queryToken of queryTokens) {
    let best = Number.POSITIVE_INFINITY;
    for (const candidateToken of candidateTokens) {
      if (candidateToken.startsWith(queryToken)) best = Math.min(best, 2);
      else if (candidateToken.includes(queryToken)) best = Math.min(best, 3);
      else if (queryToken.length >= 3 && editDistance(queryToken, candidateToken, 1) <= 1) best = Math.min(best, 4);
      else if (queryToken.length >= 4 && editDistance(queryToken, candidateToken, 2) <= 2) best = Math.min(best, 5);
    }
    if (!Number.isFinite(best)) return null;
    total += best;
  }
  return total;
}

function filterRows(rows, search, limit, fields) {
  return rows
    .map((row) => ({ row, score: searchScore(search, ...fields.map((field) => row[field])) }))
    .filter((entry) => entry.score !== null)
    .sort((left, right) => left.score - right.score || `${left.row[fields[0]]}`.localeCompare(`${right.row[fields[0]]}`))
    .slice(0, limit)
    .map((entry) => entry.row);
}

async function cached(key, loader) {
  const existing = cache.get(key);
  if (existing && Date.now() - existing.createdAt < cacheTtlMs) return existing.value;
  const value = await loader();
  cache.set(key, { createdAt: Date.now(), value });
  return value;
}

async function getSuppliers() {
  return cached("suppliers", async () => {
    const rows = await query(`
      SELECT pro_id, nombre, alias, rfc, COALESCE(diasCredito, 0) AS diasCredito
      FROM proveedor
      WHERE status = 1
      ORDER BY nombre;
    `);
    return rows.map((row) => ({ ...row, pro_id: Number(row.pro_id), diasCredito: Number(row.diasCredito || 0) }));
  });
}

async function getArticles(supplierId = 0) {
  return cached(`articles:${supplierId || 0}`, async () => {
    const supplierJoin = supplierId > 0
      ? `LEFT JOIN proveedorarticulo selected_pa ON selected_pa.art_id = a.art_id AND selected_pa.pro_id = ${supplierId}`
      : "";
    const selectedPrice = supplierId > 0 ? "selected_pa.precioCompra," : "";
    const rows = await query(`
      SELECT
        a.art_id,
        a.clave,
        a.descripcion,
        a.factor,
        a.existencia,
        a.precioCompra,
        a.preCompraProm,
        u.nombre AS unidadCompra,
        COALESCE(t.taxPercent, 0) AS taxPercent,
        COALESCE(
          ${selectedPrice}
          (SELECT pa.precioCompra FROM proveedorarticulo pa WHERE pa.art_id = a.art_id ORDER BY pa.fecha DESC LIMIT 1),
          ROUND(a.precioCompra * (1 + COALESCE(t.taxPercent, 0) / 100), 6)
        ) AS lastPurchaseGross
      FROM articulo a
      LEFT JOIN unidad u ON u.uni_id = a.unidadCompra
      LEFT JOIN (
        SELECT ai.art_id, SUM(CASE WHEN i.tras = 1 THEN i.impuesto ELSE 0 END) AS taxPercent
        FROM articuloimpuesto ai
        INNER JOIN impuesto i ON i.imp_id = ai.imp_id AND i.status = 1
        GROUP BY ai.art_id
      ) t ON t.art_id = a.art_id
      ${supplierJoin}
      WHERE a.status = 1 AND a.servicio = 0
      ORDER BY a.descripcion;
    `);
    return rows.map((row) => ({
      ...row,
      art_id: Number(row.art_id),
      factor: Number(row.factor),
      existencia: Number(row.existencia),
      precioCompra: Number(row.precioCompra),
      preCompraProm: Number(row.preCompraProm),
      taxPercent: Number(row.taxPercent),
      lastPurchaseGross: Number(row.lastPurchaseGross),
    }));
  });
}

async function getPurchaseContext(payload) {
  const supplierId = Number(payload?.supplierId);
  if (!Number.isInteger(supplierId) || supplierId <= 0) throw new Error("Proveedor invalido.");
  if (!Array.isArray(payload?.items) || payload.items.length === 0 || payload.items.length > 100) {
    throw new Error("La compra debe contener entre 1 y 100 productos.");
  }

  const requestId = `${payload.requestId || ""}`.trim();
  if (!/^[a-zA-Z0-9-]{8,64}$/.test(requestId)) throw new Error("Identificador de recepcion invalido.");

  const paymentMethod = `${payload.paymentMethod || ""}`.trim().toLowerCase();
  if (!new Set(["credit", "other"]).has(paymentMethod)) throw new Error("Selecciona Credito u Otro medio de pago.");

  const supplierRows = await query(`SELECT pro_id, nombre, COALESCE(diasCredito, 0) AS diasCredito FROM proveedor WHERE pro_id = ${supplierId} AND status = 1 LIMIT 1;`);
  if (supplierRows.length !== 1) throw new Error("El proveedor no existe o esta inactivo en SICAR.");

  const itemMap = new Map();
  for (const input of payload.items) {
    const articleId = Number(input.articleId);
    const quantity = Number(input.quantity);
    const grossUnitPrice = Number(input.grossUnitPrice);
    if (!Number.isInteger(articleId) || articleId <= 0) throw new Error("Uno de los productos es invalido.");
    if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 1000000) throw new Error("Una cantidad es invalida.");
    if (!Number.isFinite(grossUnitPrice) || grossUnitPrice < 0 || grossUnitPrice > 100000000) throw new Error("Un precio es invalido.");
    if (itemMap.has(articleId)) throw new Error("No se puede repetir el mismo producto en una compra.");
    itemMap.set(articleId, { articleId, quantity, grossUnitPrice });
  }

  const articleIds = [...itemMap.keys()].join(",");
  const rows = await query(`
    SELECT
      a.art_id, a.clave, a.descripcion, a.factor, a.receta, a.claveProdServ,
      u.nombre AS unidad, u.clave AS claveUnidad,
      ai.imp_id, i.nombre AS impuestoNombre, i.impuesto, i.tras, i.aplicarIVA, i.orden, i.tipoFactor
    FROM articulo a
    LEFT JOIN unidad u ON u.uni_id = a.unidadCompra
    LEFT JOIN articuloimpuesto ai ON ai.art_id = a.art_id
    LEFT JOIN impuesto i ON i.imp_id = ai.imp_id AND i.status = 1
    WHERE a.status = 1 AND a.servicio = 0 AND a.art_id IN (${articleIds})
    ORDER BY a.art_id, i.orden;
  `);

  const articleMap = new Map();
  for (const row of rows) {
    const articleId = Number(row.art_id);
    if (!articleMap.has(articleId)) {
      articleMap.set(articleId, {
        articleId,
        clave: row.clave,
        descripcion: row.descripcion,
        factor: Number(row.factor || 1),
        receta: Number(row.receta || 0),
        claveProdServ: row.claveProdServ,
        unidad: row.unidad || "PZA",
        claveUnidad: row.claveUnidad,
        taxes: [],
      });
    }
    if (row.imp_id && row.impuestoNombre) {
      articleMap.get(articleId).taxes.push({
        imp_id: Number(row.imp_id),
        nombre: row.impuestoNombre,
        rate: Number(row.impuesto),
        tras: Number(row.tras),
        aplicaIVA: Number(row.aplicarIVA),
        orden: Number(row.orden),
        tipoFactor: row.tipoFactor,
      });
    }
  }
  if (articleMap.size !== itemMap.size) throw new Error("Uno o mas productos ya no estan activos en SICAR.");

  const items = [...itemMap.values()].map((input, index) => {
    const article = articleMap.get(input.articleId);
    const taxRate = article.taxes.filter((tax) => tax.tras === 1).reduce((sum, tax) => sum + tax.rate, 0);
    const netUnitPrice = taxRate > 0 ? input.grossUnitPrice / (1 + taxRate / 100) : input.grossUnitPrice;
    const netAmount = Math.round((input.quantity * netUnitPrice + Number.EPSILON) * 100) / 100;
    const grossAmount = Math.round((input.quantity * input.grossUnitPrice + Number.EPSILON) * 100) / 100;
    return {
      ...article,
      ...input,
      order: index + 1,
      taxRate,
      netUnitPrice,
      netAmount,
      grossAmount,
    };
  });

  const subtotal = Math.round((items.reduce((sum, item) => sum + item.netAmount, 0) + Number.EPSILON) * 100) / 100;
  const total = Math.round((items.reduce((sum, item) => sum + item.grossAmount, 0) + Number.EPSILON) * 100) / 100;
  const subtotal0 = Math.round((items.filter((item) => item.taxRate === 0).reduce((sum, item) => sum + item.grossAmount, 0) + Number.EPSILON) * 100) / 100;
  const activeTaxes = (await query("SELECT imp_id, nombre, impuesto, tras, aplicarIVA, orden, tipoFactor FROM impuesto WHERE status = 1 ORDER BY orden, imp_id;"))
    .map((row) => ({
      imp_id: Number(row.imp_id),
      nombre: row.nombre,
      rate: Number(row.impuesto),
      tras: Number(row.tras),
      aplicaIVA: Number(row.aplicarIVA),
      orden: Number(row.orden),
      tipoFactor: row.tipoFactor,
    }));
  const purchaseDate = localDateTime().slice(0, 10);
  const creditDays = Math.max(0, Math.trunc(Number(supplierRows[0].diasCredito || 0)));
  return {
    requestId,
    supplier: { pro_id: supplierId, nombre: supplierRows[0].nombre, diasCredito: creditDays },
    invoiceNumber: `${payload.invoiceNumber || ""}`.trim().slice(0, 19),
    comment: `${payload.comment || ""}`.trim().slice(0, 180),
    date: purchaseDate,
    payment: {
      method: paymentMethod,
      label: paymentMethod === "credit" ? "Credito" : "Otro medio de pago",
      creditDays: paymentMethod === "credit" ? creditDays : null,
      dueDate: paymentMethod === "credit" ? addDays(purchaseDate, creditDays) : null,
    },
    items,
    activeTaxes,
    summary: { lines: items.length, subtotal, taxes: Math.round((total - subtotal + Number.EPSILON) * 100) / 100, total, subtotal0 },
  };
}

function buildPurchaseSql(context) {
  const dateParts = localDateTime();
  const automaticFolio = `APP-${dateParts.replace(/[-: ]/g, "").slice(2)}`.slice(0, 19);
  const folio = context.invoiceNumber || automaticFolio;
  const marker = `[CSM:${context.requestId}]`;
  const comment = `APP PROVEEDORES ${marker}${context.comment ? ` ${context.comment}` : ""}`.slice(0, 255);
  const historyUserId = Number(config.sicar.historyUserId || 1);
  const cashRegisterId = Number(config.sicar.cashRegisterId || 4);

  const sql = [
    "SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;",
    "START TRANSACTION;",
    `INSERT INTO compra (folio, fecha, subtotal, total, decimales, monTipoCambio, comentario, descuento, peso, subtotal0, gasto, status, pro_id, caj_id, mon_id) VALUES (${sqlText(folio)}, ${sqlText(dateParts)}, ${sqlNumber(context.summary.subtotal, 2)}, ${sqlNumber(context.summary.total, 2)}, 2, 1.000000, ${sqlText(comment)}, 0.00, ${sqlNumber(context.items.reduce((sum, item) => sum + item.quantity, 0), 4)}, ${sqlNumber(context.summary.subtotal0, 2)}, 0, 1, ${context.supplier.pro_id}, ${cashRegisterId}, 1);`,
    "SET @purchase_id = LAST_INSERT_ID();",
  ];

  if (context.payment.method === "credit") {
    sql.push(`INSERT INTO compratipopago (com_id, tpa_id, total, monTotal) VALUES (@purchase_id, 3, ${sqlNumber(context.summary.total, 2)}, ${sqlNumber(context.summary.total, 2)});`);
    sql.push(`INSERT INTO creditoproveedor (fechaLimite, total, comentario, status, pro_id, com_id) VALUES (${sqlText(context.payment.dueDate)}, ${sqlNumber(context.summary.total, 2)}, '', 1, ${context.supplier.pro_id}, @purchase_id);`);
  }

  sql.push(`INSERT INTO historial (movimiento, fecha, tabla, id, usu_id) VALUES (0, ${sqlText(dateParts)}, 'Compra', @purchase_id, ${historyUserId});`);

  for (const item of context.items) {
    sql.push(`INSERT INTO detallec (com_id, art_id, clave, descripcion, cantidad, factor, unidad, precioSin, precioCon, importeSin, importeCon, receta, orden, movCom, movComC, precioNorSin, precioNorCon, importeNorSin, importeNorCon, descPorcentaje, descTotal, claveProdServ, claveUnidad, sinGravar, tipo) VALUES (@purchase_id, ${item.articleId}, ${sqlText(item.clave)}, ${sqlText(item.descripcion)}, ${sqlNumber(item.quantity, 4)}, ${sqlNumber(item.factor, 3)}, ${sqlText(item.unidad)}, ${sqlNumber(item.netUnitPrice, 6)}, ${sqlNumber(item.grossUnitPrice, 6)}, ${sqlNumber(item.netAmount, 2)}, ${sqlNumber(item.grossAmount, 2)}, ${item.receta ? 1 : 0}, ${item.order}, 1, -2, ${sqlNumber(item.netUnitPrice, 6)}, ${sqlNumber(item.grossUnitPrice, 6)}, ${sqlNumber(item.netAmount, 2)}, ${sqlNumber(item.grossAmount, 2)}, 0.00, 0.00, ${item.claveProdServ ? sqlText(item.claveProdServ) : "NULL"}, ${item.claveUnidad ? sqlText(item.claveUnidad) : "NULL"}, ${item.taxRate === 0 ? 1 : 0}, 0);`);

    for (const tax of item.taxes) {
      const taxTotal = tax.tras === 1
        ? Math.round((item.grossAmount - item.netAmount + Number.EPSILON) * 1000000) / 1000000
        : 0;
      sql.push(`INSERT INTO detallecimp (com_id, art_id, imp_id, nombre, impuesto, tras, total, tipoFactor, aplicaIVA) VALUES (@purchase_id, ${item.articleId}, ${tax.imp_id}, ${sqlText(tax.nombre)}, ${sqlNumber(tax.rate, 6)}, ${tax.tras}, ${sqlNumber(taxTotal, 6)}, ${sqlText(tax.tipoFactor || "Tasa")}, ${tax.aplicaIVA});`);
    }

    const stockIncrease = item.quantity * item.factor;
    sql.push(`UPDATE articulo SET preCompraProm = CASE WHEN existencia <= 0 THEN ${sqlNumber(item.netUnitPrice, 6)} ELSE ((existencia * preCompraProm) + (${sqlNumber(stockIncrease, 4)} * ${sqlNumber(item.netUnitPrice, 6)})) / (existencia + ${sqlNumber(stockIncrease, 4)}) END, precioCompra = ${sqlNumber(item.netUnitPrice, 6)}, existencia = existencia + ${sqlNumber(stockIncrease, 4)} WHERE art_id = ${item.articleId} AND status = 1;`);
    sql.push(`INSERT INTO proveedorarticulo (pro_id, art_id, claveProveedor, precioCompra, fecha) VALUES (${context.supplier.pro_id}, ${item.articleId}, '', ${sqlNumber(item.grossUnitPrice, 6)}, ${sqlText(dateParts)}) ON DUPLICATE KEY UPDATE precioCompra = VALUES(precioCompra), fecha = VALUES(fecha);`);
    sql.push(`INSERT INTO historial (movimiento, fecha, tabla, id, usu_id) VALUES (1, ${sqlText(dateParts)}, 'Articulo', ${item.articleId}, ${historyUserId});`);
  }

  for (const tax of context.activeTaxes) {
    const taxId = tax.imp_id;
    const matchingItems = context.items.filter((item) => item.taxes.some((entry) => entry.imp_id === taxId));
    const taxedSubtotal = matchingItems.reduce((sum, item) => sum + item.netAmount, 0);
    const taxTotal = matchingItems.reduce((sum, item) => sum + (item.grossAmount - item.netAmount), 0);
    sql.push(`INSERT INTO compraimp (com_id, imp_id, total, subtotal, tras, orden, aplicaIVA) VALUES (@purchase_id, ${taxId}, ${sqlNumber(taxTotal, 2)}, ${sqlNumber(taxedSubtotal, 2)}, ${tax.tras}, ${tax.orden}, ${tax.aplicaIVA});`);
  }
  sql.push("COMMIT;");
  sql.push(`SELECT @purchase_id AS com_id, ${sqlText(folio)} AS folio, ${sqlNumber(context.summary.total, 2)} AS total;`);
  return { sql: sql.join("\n"), folio, marker };
}

function setCors(response, request) {
  const origin = request.headers.origin || "*";
  const allowedOrigins = Array.isArray(config.allowedOrigins) ? config.allowedOrigins : ["*"];
  response.setHeader("Access-Control-Allow-Origin", allowedOrigins.includes("*") || allowedOrigins.includes(origin) ? origin : allowedOrigins[0]);
  response.setHeader("Vary", "Origin");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type, X-CSM-API-Key");
  response.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
}

function sendJson(response, status, payload) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  response.end(JSON.stringify(payload));
}

async function readBody(request) {
  let body = "";
  for await (const chunk of request) {
    body += chunk;
    if (body.length > 262144) throw new Error("La solicitud es demasiado grande.");
  }
  return body ? JSON.parse(body) : {};
}

function authorized(request) {
  const expected = `${config.apiKey || ""}`;
  return !expected || request.headers["x-csm-api-key"] === expected;
}

function enqueuePurchase(operation) {
  const result = purchaseQueue.then(operation, operation);
  purchaseQueue = result.catch(() => undefined);
  return result;
}

const server = createServer(async (request, response) => {
  setCors(response, request);
  if (request.method === "OPTIONS") {
    response.writeHead(204);
    response.end();
    return;
  }
  if (!authorized(request)) {
    sendJson(response, 401, { ok: false, error: "Clave del servicio incorrecta." });
    return;
  }

  try {
    const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
    if (request.method === "GET" && url.pathname === "/health") {
      const rows = await query("SELECT DATABASE() AS databaseName, NOW() AS serverTime;");
      sendJson(response, 200, { ok: true, service: "csm-sicar-proveedores", database: rows[0]?.databaseName, serverTime: rows[0]?.serverTime, writeMode: "purchase-only" });
      return;
    }
    if (request.method === "GET" && url.pathname === "/catalogos/proveedores") {
      const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") || 40)));
      const rows = filterRows(await getSuppliers(), url.searchParams.get("q") || "", limit, ["nombre", "alias", "rfc"]);
      sendJson(response, 200, { ok: true, source: "sicar-mysql", rows });
      return;
    }
    if (request.method === "GET" && url.pathname === "/catalogos/articulos") {
      const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") || 40)));
      const supplierId = Math.max(0, Number(url.searchParams.get("pro_id") || 0));
      const rows = filterRows(await getArticles(supplierId), url.searchParams.get("q") || "", limit, ["clave", "descripcion"]);
      sendJson(response, 200, { ok: true, source: "sicar-mysql", rows });
      return;
    }
    if (request.method === "POST" && url.pathname === "/compras/preview") {
      const context = await getPurchaseContext(await readBody(request));
      sendJson(response, 200, { ok: true, supplier: context.supplier, items: context.items, summary: context.summary, payment: context.payment });
      return;
    }
    if (request.method === "POST" && url.pathname === "/compras/recibir") {
      if (config.allowPurchases !== true) throw new Error("La escritura de compras esta deshabilitada en la configuracion del servicio.");
      const body = await readBody(request);
      const result = await enqueuePurchase(async () => {
        const context = await getPurchaseContext(body);
        const { sql, folio, marker } = buildPurchaseSql(context);
        const duplicate = await query(`SELECT com_id, folio, total FROM compra WHERE comentario LIKE ${sqlText(`%${marker}%`)} ORDER BY com_id DESC LIMIT 1;`);
        if (duplicate.length > 0) {
          return { status: 200, duplicate: true, purchase: { com_id: Number(duplicate[0].com_id), folio: duplicate[0].folio, total: Number(duplicate[0].total) }, payment: context.payment };
        }
        const rows = parseTsv(await runMysql(sql));
        const purchase = rows[rows.length - 1];
        cache.clear();
        return { status: 201, duplicate: false, purchase: { com_id: Number(purchase.com_id), folio: purchase.folio || folio, total: Number(purchase.total) }, payment: context.payment };
      });
      sendJson(response, result.status, { ok: true, duplicate: result.duplicate, purchase: result.purchase, payment: result.payment });
      return;
    }
    sendJson(response, 404, { ok: false, error: "Endpoint no encontrado." });
  } catch (error) {
    console.error(new Date().toISOString(), error.message);
    sendJson(response, 400, { ok: false, error: error.message || "No se pudo procesar la solicitud." });
  }
});

server.listen(port, host, () => {
  console.log(`CSM SICAR Proveedores escuchando en http://${host}:${port}`);
});
