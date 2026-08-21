import { spawn } from "node:child_process";
import { createHash, createSign } from "node:crypto";
import { createServer } from "node:http";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
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
const accountingQueueDirectory = config.accounting?.queueDirectory || "C:\\SICAR\\state\\sicar-purchase-accounting";
const maxInvoiceFileBytes = 8 * 1024 * 1024;
const cache = new Map();
let purchaseQueue = Promise.resolve();
let inventoryQueue = Promise.resolve();
let firebaseAccessToken = null;
const firebaseIdentityCache = new Map();
let validatedCompany = null;

const INVENTORY_TRIGGER_EVENT = "inventory.adjustment.requested";
const INVENTORY_SOURCE_APP = "inventario-sanmartin";
const INVENTORY_TRIGGER_ACTION = "create_inventory_adjustment";
const INVENTORY_LOCKED_STATUSES = new Set(["requested", "processing", "dry-run", "done", "duplicate"]);

function base64Url(value) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function getInventoryFirebaseSettings() {
  const settings = config.inventoryFirebase || {};
  if (settings.enabled !== true) {
    throw new Error("El puente de levantamientos Firebase esta deshabilitado.");
  }
  if (!settings.projectId || !settings.serviceAccountPath || !settings.branchDocumentId || !settings.payloadBranchAlias) {
    throw new Error("Falta configurar inventario Firebase en el servicio local.");
  }
  return settings;
}

async function getFirebaseAccessToken() {
  if (firebaseAccessToken?.token && firebaseAccessToken.expiresAt > Date.now() + 60_000) {
    return firebaseAccessToken.token;
  }

  const settings = getInventoryFirebaseSettings();
  const serviceAccount = JSON.parse((await readFile(settings.serviceAccountPath, "utf8")).replace(/^\uFEFF/, ""));
  if (serviceAccount.project_id !== settings.projectId || !serviceAccount.client_email || !serviceAccount.private_key) {
    throw new Error("La cuenta de servicio no corresponde al proyecto de inventario configurado.");
  }

  const issuedAt = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = base64Url(JSON.stringify({
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/datastore",
    aud: serviceAccount.token_uri || "https://oauth2.googleapis.com/token",
    iat: issuedAt,
    exp: issuedAt + 3600,
  }));
  const unsignedToken = `${header}.${claim}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsignedToken);
  signer.end();
  const signature = signer.sign(serviceAccount.private_key)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
  const assertion = `${unsignedToken}.${signature}`;
  const tokenResponse = await fetch(serviceAccount.token_uri || "https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  const tokenBody = await tokenResponse.json();
  if (!tokenResponse.ok || !tokenBody.access_token) {
    throw new Error(tokenBody.error_description || "No se pudo autenticar el puente con Firebase.");
  }
  firebaseAccessToken = {
    token: tokenBody.access_token,
    expiresAt: Date.now() + Number(tokenBody.expires_in || 3600) * 1000,
  };
  return firebaseAccessToken.token;
}

function firestorePath(relativePath) {
  return `${relativePath}`.split("/").map((segment) => encodeURIComponent(segment)).join("/");
}

function firestoreDocumentName(relativePath) {
  const settings = getInventoryFirebaseSettings();
  return `projects/${settings.projectId}/databases/(default)/documents/${relativePath}`;
}

function toFirestoreValue(value) {
  if (value === null || value === undefined) return { nullValue: null };
  if (value instanceof Date) return { timestampValue: value.toISOString() };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(toFirestoreValue) } };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("Firestore recibio un numero invalido.");
    return Number.isInteger(value) ? { integerValue: `${value}` } : { doubleValue: value };
  }
  if (typeof value === "object") {
    return {
      mapValue: {
        fields: Object.fromEntries(
          Object.entries(value)
            .filter(([, entry]) => entry !== undefined)
            .map(([key, entry]) => [key, toFirestoreValue(entry)]),
        ),
      },
    };
  }
  return { stringValue: `${value}` };
}

function toFirestoreFields(value) {
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, entry]) => entry !== undefined)
      .map(([key, entry]) => [key, toFirestoreValue(entry)]),
  );
}

function fromFirestoreValue(value) {
  if (!value) return null;
  if ("nullValue" in value) return null;
  if ("stringValue" in value) return value.stringValue;
  if ("timestampValue" in value) return value.timestampValue;
  if ("booleanValue" in value) return Boolean(value.booleanValue);
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return Number(value.doubleValue);
  if ("arrayValue" in value) return (value.arrayValue.values || []).map(fromFirestoreValue);
  if ("mapValue" in value) return fromFirestoreFields(value.mapValue.fields || {});
  return null;
}

function fromFirestoreFields(fields = {}) {
  return Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, fromFirestoreValue(value)]));
}

async function firestoreRequest(relativeUrl, options = {}) {
  const settings = getInventoryFirebaseSettings();
  const token = await getFirebaseAccessToken();
  const response = await fetch(
    `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(settings.projectId)}/databases/(default)/documents${relativeUrl}`,
    {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(options.headers || {}),
      },
    },
  );
  if (response.status === 404) return null;
  const body = await response.json();
  if (!response.ok) {
    const error = new Error(body?.error?.message || `Firestore respondio con estado ${response.status}.`);
    error.statusCode = response.status === 409 ? 409 : 502;
    throw error;
  }
  return body;
}

async function getFirestoreDocument(relativePath) {
  const document = await firestoreRequest(`/${firestorePath(relativePath)}`);
  if (!document) return null;
  return {
    id: document.name.split("/").pop(),
    createTime: document.createTime,
    updateTime: document.updateTime,
    ...fromFirestoreFields(document.fields || {}),
  };
}

function normalizeInventorySessionId(value = "") {
  const sessionId = `${value}`.trim();
  if (!/^[A-Za-z0-9_-]{8,96}$/.test(sessionId)) throw new Error("Identificador de levantamiento invalido.");
  return sessionId;
}

function normalizeInventoryFolio(value = "") {
  const folio = `${value}`.trim().toUpperCase();
  if (!/^[A-Z0-9_-]{5,40}$/.test(folio)) throw new Error("Folio de levantamiento invalido.");
  return folio;
}

function buildInventoryFirestoreSession(payload) {
  const settings = getInventoryFirebaseSettings();
  const sessionId = normalizeInventorySessionId(payload?.sessionId);
  const folio = normalizeInventoryFolio(payload?.folio);
  const requestedBranch = `${payload?.branchId || ""}`.trim();
  if (normalizeBranchToken(requestedBranch) !== normalizeBranchToken(settings.payloadBranchAlias)) {
    throw new Error(`Este integrador solo admite la sucursal ${settings.payloadBranchAlias}.`);
  }
  const items = Array.isArray(payload?.items) ? payload.items : [];
  if (items.length < 1 || items.length > 2000) {
    throw new Error("El levantamiento debe contener entre 1 y 2000 productos.");
  }

  const seen = new Set();
  const normalizedItems = items.map((item, index) => {
    const sku = `${item?.sku || item?.clave || ""}`.trim();
    const name = `${item?.nombre || item?.descripcion || ""}`.trim();
    const unit = `${item?.unidad || "PZA"}`.trim().toUpperCase();
    const counted = roundQuantity(item?.cantidadContada ?? item?.totalLb ?? item?.cajas);
    if (!sku || !name) throw new Error(`Falta clave o nombre en la linea ${index + 1}.`);
    if (!Number.isFinite(counted) || counted < 0) throw new Error(`Conteo invalido en ${sku}.`);
    if (seen.has(sku)) throw new Error(`El producto ${sku} esta repetido.`);
    seen.add(sku);
    const weights = Array.isArray(item?.pesos)
      ? item.pesos.map(Number).filter((weight) => Number.isFinite(weight) && weight >= 0).map(roundQuantity)
      : [];
    const isWeight = unit === "LB";
    return {
      sku,
      nombre: name,
      unidad: unit,
      zona: `${item?.zona || payload?.zona || "General"}`.trim().slice(0, 80),
      cajas: isWeight ? Math.max(0, Math.trunc(Number(item?.cajas ?? weights.length))) : counted,
      totalLb: isWeight ? counted : null,
      pesos: isWeight ? weights : [],
    };
  });

  const now = new Date();
  const performedBy = `${payload?.realizadoPor || payload?.operator || "CSM Operaciones"}`.trim().slice(0, 100);
  const supervisedBy = `${payload?.supervisadoPor || performedBy}`.trim().slice(0, 100);
  const zones = [...new Set(normalizedItems.map((item) => item.zona).filter(Boolean))];
  const zoneSummaries = zones.map((zone) => {
    const zoneItems = normalizedItems.filter((item) => item.zona === zone);
    return {
      zona: zone,
      itemCount: zoneItems.length,
      totalCajas: roundQuantity(zoneItems.reduce((sum, item) => sum + Number(item.cajas || 0), 0)),
      totalPesoLb: roundQuantity(zoneItems.reduce((sum, item) => sum + Number(item.totalLb || 0), 0)),
    };
  });
  const requestedBy = {
    type: "firebase-user",
    uid: `${payload?.requestedBy?.uid || `csm-operaciones-${normalizeBranchToken(settings.payloadBranchAlias)}`}`.slice(0, 128),
    email: `${payload?.requestedBy?.email || settings.requestedByEmail || "operaciones@sanmartinsr.com"}`.slice(0, 180),
    label: `${payload?.requestedBy?.label || performedBy}`.slice(0, 120),
  };

  return {
    sessionId,
    folio,
    session: {
      tipo: "levantamiento_inventario",
      branchId: settings.branchDocumentId,
      folio,
      fecha: normalizeInventoryDate(payload?.fecha || payload?.date),
      proveedor: `${payload?.proveedor || "Interno"}`.trim().slice(0, 100),
      realizadoPor: performedBy,
      firmaRealizadoPor: `${payload?.firmaRealizadoPor || ""}`.trim().slice(0, 120),
      supervisadoPor: supervisedBy,
      firmaSupervisadoPor: `${payload?.firmaSupervisadoPor || ""}`.trim().slice(0, 120),
      observaciones: `${payload?.observaciones || payload?.notes || ""}`.trim().slice(0, 500),
      status: "capturado",
      catalogSource: "sicar",
      sourceApp: "csm-operaciones",
      itemCount: normalizedItems.length,
      totalCajas: roundQuantity(normalizedItems.reduce((sum, item) => sum + Number(item.cajas || 0), 0)),
      totalPesoLb: roundQuantity(normalizedItems.reduce((sum, item) => sum + Number(item.totalLb || 0), 0)),
      zoneCount: zones.length,
      zones,
      zoneSummaries,
      items: normalizedItems,
      createdAt: now,
      updatedAt: now,
      finalizedAt: now,
    },
    trigger: {
      triggerEvent: INVENTORY_TRIGGER_EVENT,
      sourceApp: INVENTORY_SOURCE_APP,
      action: INVENTORY_TRIGGER_ACTION,
      branchId: settings.payloadBranchAlias,
      sessionId,
      folio,
      requestedBy,
      dryRun: false,
      status: "requested",
    },
  };
}

async function submitInventoryFirestoreSession(payload) {
  const settings = getInventoryFirebaseSettings();
  const built = buildInventoryFirestoreSession(payload);
  const branchRoot = `branches/${settings.branchDocumentId}`;
  const sessionPath = `${branchRoot}/levantamientosInventario/${built.sessionId}`;
  const triggerPath = `${branchRoot}/sicarAdjustmentRequests/${built.sessionId}`;
  const existingTrigger = await getFirestoreDocument(triggerPath);
  if (existingTrigger) {
    return {
      created: false,
      alreadySubmitted: true,
      requiresRetry: `${existingTrigger.status || ""}` === "error",
      request: existingTrigger,
    };
  }

  const body = {
    writes: [
      {
        update: { name: firestoreDocumentName(sessionPath), fields: toFirestoreFields(built.session) },
        currentDocument: { exists: false },
      },
      {
        update: { name: firestoreDocumentName(triggerPath), fields: toFirestoreFields(built.trigger) },
        updateTransforms: [{ fieldPath: "requestedAt", setToServerValue: "REQUEST_TIME" }],
        currentDocument: { exists: false },
      },
    ],
  };
  await firestoreRequest(":commit", { method: "POST", body: JSON.stringify(body) });
  return {
    created: true,
    alreadySubmitted: false,
    requiresRetry: false,
    request: { ...built.trigger, requestedAt: new Date().toISOString() },
  };
}

async function retryInventoryFirestoreRequest(sessionId) {
  const settings = getInventoryFirebaseSettings();
  const normalizedId = normalizeInventorySessionId(sessionId);
  const triggerPath = `branches/${settings.branchDocumentId}/sicarAdjustmentRequests/${normalizedId}`;
  const existing = await getFirestoreDocument(triggerPath);
  if (!existing) throw new Error("No existe la solicitud de levantamiento.");
  if (`${existing.status}` !== "error") {
    const error = new Error(`La solicitud esta en estado ${existing.status}; no se puede reenviar.`);
    error.statusCode = 409;
    throw error;
  }
  const body = {
    writes: [{
      update: {
        name: firestoreDocumentName(triggerPath),
        fields: toFirestoreFields({
          status: "requested",
          message: "Reintento solicitado desde CSM Operaciones",
          lastError: null,
          resultStatus: null,
          duplicate: false,
          alreadyProcessed: false,
        }),
      },
      updateMask: {
        fieldPaths: ["status", "message", "lastError", "resultStatus", "duplicate", "alreadyProcessed"],
      },
      updateTransforms: [{ fieldPath: "requestedAt", setToServerValue: "REQUEST_TIME" }],
    }],
  };
  await firestoreRequest(":commit", { method: "POST", body: JSON.stringify(body) });
  return { ...existing, status: "requested", message: "Reintento solicitado desde CSM Operaciones", lastError: null };
}

async function getInventoryFirestoreHistory(limitValue = 80) {
  const settings = getInventoryFirebaseSettings();
  const limit = Math.min(200, Math.max(1, Math.trunc(Number(limitValue) || 80)));
  const parent = `/branches/${firestorePath(settings.branchDocumentId)}:runQuery`;
  const query = {
    structuredQuery: {
      from: [{ collectionId: "sicarAdjustmentRequests" }],
      orderBy: [{ field: { fieldPath: "requestedAt" }, direction: "DESCENDING" }],
      limit,
    },
  };
  const rows = await firestoreRequest(parent, { method: "POST", body: JSON.stringify(query) });
  return (rows || [])
    .filter((entry) => entry.document)
    .map((entry) => ({
      id: entry.document.name.split("/").pop(),
      ...fromFirestoreFields(entry.document.fields || {}),
      createTime: entry.document.createTime,
      updateTime: entry.document.updateTime,
    }));
}

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

function normalizePurchaseDate(value) {
  const today = localDateTime().slice(0, 10);
  const dateText = `${value || today}`.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateText)) {
    throw new Error("La fecha de la factura no es valida.");
  }

  const [year, month, day] = dateText.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year
    || parsed.getUTCMonth() !== month - 1
    || parsed.getUTCDate() !== day
  ) {
    throw new Error("La fecha de la factura no es valida.");
  }
  if (dateText > today) throw new Error("La fecha de la factura no puede ser futura.");
  return dateText;
}

function roundMoney(value) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
}

function roundQuantity(value) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 10000) / 10000;
}

function normalizeBranchToken(value = "") {
  const normalized = `${value}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  if (normalized.includes("nindiri")) return "nindiri";
  if (normalized.includes("granada")) return "granada";
  return normalized.replace(/[^a-z0-9]+/g, "").trim();
}

function safeFilePart(value, fallback = "archivo") {
  return `${value || ""}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80) || fallback;
}

async function readJsonIfExists(filePath) {
  try {
    return JSON.parse((await readFile(filePath, "utf8")).replace(/^\uFEFF/, ""));
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

async function atomicWrite(filePath, content) {
  const temporaryPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temporaryPath, content);
  await rename(temporaryPath, filePath);
}

async function persistInvoiceSupport(sourceRecordId, input) {
  if (!input) return null;
  const match = `${input.dataUrl || ""}`.match(/^data:(image\/(?:jpeg|png|webp));base64,([a-zA-Z0-9+/=\r\n]+)$/);
  if (!match) throw new Error("La foto de factura no tiene un formato valido.");

  const contentType = match[1];
  const buffer = Buffer.from(match[2], "base64");
  if (buffer.length === 0 || buffer.length > maxInvoiceFileBytes) {
    throw new Error("La foto de factura debe pesar entre 1 byte y 8 MB.");
  }

  const extension = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" }[contentType];
  const baseName = safeFilePart(input.fileName, `factura_${sourceRecordId}`).replace(/_(jpg|jpeg|png|webp)$/i, "");
  const filePath = path.join(accountingQueueDirectory, `compra_${safeFilePart(sourceRecordId)}_${baseName}.${extension}`);
  await atomicWrite(filePath, buffer);
  return {
    fileName: `${input.fileName || `factura.${extension}`}`.slice(0, 160),
    contentType,
    localPath: filePath,
  };
}

async function queueAccountingMetadata(payload, context, purchase) {
  const accounting = payload?.accounting || {};
  const retentionIr2 = roundMoney(accounting.retentionIr2);
  const retentionMunicipal1 = roundMoney(accounting.retentionMunicipal1);
  if (retentionIr2 < 0 || retentionMunicipal1 < 0) throw new Error("Las retenciones no pueden ser negativas.");

  const retentionTotal = roundMoney(retentionIr2 + retentionMunicipal1);
  if (retentionTotal > context.summary.subtotal) throw new Error("Las retenciones superan el subtotal de la factura.");
  const requested = retentionTotal > 0 || Boolean(accounting.invoiceSupport);
  if (!requested) return { requested: false, queued: false };

  await mkdir(accountingQueueDirectory, { recursive: true });
  const sourceRecordId = `${purchase.com_id}`;
  const metadataPath = path.join(accountingQueueDirectory, `compra_${safeFilePart(sourceRecordId)}.json`);
  const existing = await readJsonIfExists(metadataPath);
  const invoiceSupport = accounting.invoiceSupport
    ? await persistInvoiceSupport(sourceRecordId, accounting.invoiceSupport)
    : existing?.invoiceSupport || null;
  const metadata = {
    version: 1,
    source: "proveedores-app",
    sourceRecordId,
    rawId: `compra_${sourceRecordId}`,
    purchaseId: Number(purchase.com_id),
    folio: purchase.folio || "",
    supplier: context.supplier.nombre,
    invoiceNumber: context.invoiceNumber,
    date: context.date,
    total: context.summary.total,
    subtotal: context.summary.subtotal,
    retentionIr2,
    retentionMunicipal1,
    retentionTotal,
    netTotal: roundMoney(Math.max(context.summary.total - retentionTotal, 0)),
    invoiceSupport,
    uploadedSupport: existing?.uploadedSupport || null,
    capturedAt: new Date().toISOString(),
  };
  await atomicWrite(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`);
  return {
    requested: true,
    queued: true,
    retentionTotal,
    netTotal: metadata.netTotal,
    hasInvoiceSupport: Boolean(invoiceSupport),
  };
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

function cleanPurchaseComment(value = "") {
  return `${value || ""}`.replace(/^APP PROVEEDORES\s+\[CSM:[^\]]+\]\s*/i, "").trim();
}

function getPurchaseRequestId(value = "") {
  return `${value || ""}`.match(/\[CSM:([^\]]+)\]/i)?.[1] || "";
}

async function getAppPurchaseHistory(limit = 150) {
  const safeLimit = Math.min(300, Math.max(1, Math.trunc(Number(limit) || 150)));
  const purchases = await query(`
    SELECT
      c.com_id,
      c.folio,
      c.fecha,
      c.subtotal,
      c.total,
      c.status,
      c.comentario,
      c.pro_id,
      p.nombre AS supplierName,
      CASE
        WHEN EXISTS (
          SELECT 1
          FROM compratipopago ctp
          WHERE ctp.com_id = c.com_id AND ctp.tpa_id = 3
        ) THEN 'credit'
        ELSE 'other'
      END AS paymentMethod
    FROM compra c
    INNER JOIN proveedor p ON p.pro_id = c.pro_id
    WHERE c.comentario LIKE 'APP PROVEEDORES [CSM:%'
    ORDER BY c.com_id DESC
    LIMIT ${safeLimit};
  `);

  if (purchases.length === 0) return [];
  const purchaseIds = purchases.map((row) => Number(row.com_id)).filter(Number.isInteger);
  if (purchaseIds.length === 0) return [];
  const details = await query(`
    SELECT
      d.com_id,
      d.art_id,
      d.clave,
      d.descripcion,
      d.cantidad,
      d.unidad,
      d.precioSin,
      d.precioCon,
      d.importeSin,
      d.importeCon,
      d.orden
    FROM detallec d
    WHERE d.com_id IN (${purchaseIds.join(",")})
    ORDER BY d.com_id DESC, d.orden ASC;
  `);
  const detailsByPurchase = new Map();
  for (const row of details) {
    const purchaseId = Number(row.com_id);
    if (!detailsByPurchase.has(purchaseId)) detailsByPurchase.set(purchaseId, []);
    detailsByPurchase.get(purchaseId).push({
      art_id: Number(row.art_id),
      clave: row.clave || "",
      descripcion: row.descripcion || "",
      cantidad: Number(row.cantidad || 0),
      unidad: row.unidad || "",
      precioSin: Number(row.precioSin || 0),
      precioCon: Number(row.precioCon || 0),
      importeSin: Number(row.importeSin || 0),
      importeCon: Number(row.importeCon || 0),
      orden: Number(row.orden || 0),
    });
  }

  return purchases.map((row) => {
    const status = Number(row.status);
    const paymentMethod = row.paymentMethod === "credit" ? "credit" : "other";
    return {
      com_id: Number(row.com_id),
      folio: row.folio || "",
      fecha: row.fecha || "",
      subtotal: Number(row.subtotal || 0),
      taxes: roundMoney(Number(row.total || 0) - Number(row.subtotal || 0)),
      total: Number(row.total || 0),
      status,
      statusLabel: status === 1 ? "Aplicada" : status === -1 ? "Cancelada" : `Estado ${status}`,
      pro_id: Number(row.pro_id),
      supplierName: row.supplierName || "",
      paymentMethod,
      paymentLabel: paymentMethod === "credit" ? "Credito" : "Otro medio",
      comment: cleanPurchaseComment(row.comentario),
      requestId: getPurchaseRequestId(row.comentario),
      items: detailsByPurchase.get(Number(row.com_id)) || [],
    };
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
        a.precioCompra AS lastPurchaseNet,
        a.preCompraProm,
        u.nombre AS unidadCompra,
        uv.nombre AS unidadVenta,
        COALESCE(t.taxPercent, 0) AS taxPercent,
        COALESCE(
          ${selectedPrice}
          (SELECT pa.precioCompra FROM proveedorarticulo pa WHERE pa.art_id = a.art_id ORDER BY pa.fecha DESC LIMIT 1),
          ROUND(a.precioCompra * (1 + COALESCE(t.taxPercent, 0) / 100), 6)
        ) AS lastPurchaseGross
      FROM articulo a
      LEFT JOIN unidad u ON u.uni_id = a.unidadCompra
      LEFT JOIN unidad uv ON uv.uni_id = a.unidadVenta
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
      lastPurchaseNet: Number(row.lastPurchaseNet),
      preCompraProm: Number(row.preCompraProm),
      taxPercent: Number(row.taxPercent),
      lastPurchaseGross: Number(row.lastPurchaseGross),
    }));
  });
}

function normalizeInventoryRequestId(value) {
  const requestId = `${value || ""}`.trim();
  if (!/^[a-zA-Z0-9_-]{8,80}$/.test(requestId)) {
    throw new Error("El identificador del levantamiento no es valido.");
  }
  return requestId;
}

function normalizeInventoryDate(value) {
  const today = localDateTime().slice(0, 10);
  const dateText = `${value || today}`.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateText)) {
    throw new Error("La fecha del levantamiento no es valida.");
  }
  const [year, month, day] = dateText.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year
    || parsed.getUTCMonth() !== month - 1
    || parsed.getUTCDate() !== day
    || dateText > today
  ) throw new Error("La fecha del levantamiento no es valida.");
  return dateText;
}

async function getInventoryCatalog() {
  const [branchRows, articles] = await Promise.all([
    query("SELECT sucId, alias FROM nubecfg LIMIT 1;"),
    getArticles(0),
  ]);
  const branch = branchRows[0] || {};
  return {
    branch: { sucId: Number(branch.sucId || 0), alias: branch.alias || "Sucursal SICAR" },
    generatedAt: new Date().toISOString(),
    articles: articles.map((article) => ({
      art_id: Number(article.art_id),
      clave: article.clave,
      descripcion: article.descripcion,
      existencia: Number(article.existencia || 0),
      precioCompra: Number(article.precioCompra || 0),
      preCompraProm: Number(article.preCompraProm || 0),
      unidad: article.unidadVenta || article.unidadCompra || "PZA",
    })),
  };
}

async function getInventoryContext(payload, { requireBaseline = false } = {}) {
  const requestId = normalizeInventoryRequestId(payload?.requestId);
  const date = normalizeInventoryDate(payload?.date);
  const notes = `${payload?.notes || ""}`.trim().slice(0, 180);
  const operator = `${payload?.operator || ""}`.trim().slice(0, 80);
  const requestedBranch = `${payload?.branch || ""}`.trim().slice(0, 100);
  const rawItems = Array.isArray(payload?.items) ? payload.items : [];
  if (rawItems.length < 1 || rawItems.length > 2000) {
    throw new Error("El levantamiento debe contener entre 1 y 2000 productos.");
  }

  const itemsById = new Map();
  for (const rawItem of rawItems) {
    const articleId = Number(rawItem?.articleId);
    const rawCounted = Number(rawItem?.countedExistence);
    const counted = roundQuantity(rawCounted);
    const expected = Number(rawItem?.expectedExistence);
    if (!Number.isInteger(articleId) || articleId <= 0) throw new Error("Se recibio un articulo invalido.");
    if (!Number.isFinite(rawCounted) || !Number.isFinite(counted) || counted < 0) throw new Error("El conteo fisico no es valido.");
    if (requireBaseline && !Number.isFinite(expected)) throw new Error("Falta la existencia base de un articulo.");
    if (itemsById.has(articleId)) throw new Error(`El articulo ${articleId} esta repetido en el levantamiento.`);
    itemsById.set(articleId, { articleId, countedExistence: counted, expectedExistence: expected });
  }

  const articleIds = [...itemsById.keys()];
  const [rows, branchRows] = await Promise.all([
    query(`
      SELECT
        a.art_id,
        a.clave,
        a.descripcion,
        a.existencia,
        a.precioCompra,
        a.preCompraProm,
        a.precio1 AS precioVenta,
        COALESCE(u.nombre, 'PZA') AS unidad
      FROM articulo a
      LEFT JOIN unidad u ON u.uni_id = a.unidadVenta
      WHERE a.art_id IN (${articleIds.join(",")}) AND a.status = 1
      ORDER BY a.descripcion;
    `),
    query("SELECT alias FROM nubecfg LIMIT 1;"),
  ]);
  const branchName = `${branchRows[0]?.alias || ""}`.trim();
  const configuredAliases = [
    config.company?.branchId,
    config.company?.branchAlias,
    ...(config.company?.sicarAliases || []),
  ].filter(Boolean).map(normalizeBranchToken);
  if (
    !requestedBranch
    || !branchName
    || !configuredAliases.includes(normalizeBranchToken(requestedBranch))
    || !configuredAliases.includes(normalizeBranchToken(branchName))
  ) {
    throw new Error(`La sucursal solicitada no corresponde a este servidor SICAR (${branchName || "sin alias"}).`);
  }
  if (rows.length !== articleIds.length) throw new Error("Uno o mas articulos ya no estan activos en SICAR.");

  const lines = rows.map((row) => {
    const input = itemsById.get(Number(row.art_id));
    const currentExistence = roundQuantity(row.existencia);
    const difference = roundQuantity(input.countedExistence - currentExistence);
    if (requireBaseline && Math.abs(input.expectedExistence - currentExistence) > 0.0001) {
      throw new Error(`La existencia de ${row.clave} cambio en SICAR. Actualiza la vista previa.`);
    }
    return {
      articleId: Number(row.art_id),
      clave: row.clave,
      descripcion: row.descripcion,
      unidad: row.unidad || "PZA",
      currentExistence,
      countedExistence: input.countedExistence,
      difference,
      precioCompra: Number(row.precioCompra || 0),
      preCompraProm: Number(row.preCompraProm || 0),
      precioVenta: Number(row.precioVenta || 0),
      differenceCost: roundMoney(difference * Number(row.preCompraProm || 0)),
    };
  });
  const changedLines = lines.filter((line) => Math.abs(line.difference) > 0.0001);
  const summary = {
    totalLines: lines.length,
    changedLines: changedLines.length,
    positiveLines: changedLines.filter((line) => line.difference > 0).length,
    negativeLines: changedLines.filter((line) => line.difference < 0).length,
    totalDifferenceUnits: roundQuantity(changedLines.reduce((sum, line) => sum + line.difference, 0)),
    totalDifferenceCost: roundMoney(changedLines.reduce((sum, line) => sum + line.differenceCost, 0)),
  };
  return { requestId, date, notes, operator, branchName, lines, changedLines, summary };
}

function inventoryMarker(requestId) {
  return `[CSM-INVENTARIO:${requestId}]`;
}

function buildInventoryAdjustmentSql(context) {
  const historyUserId = Number(config.sicar?.historyUserId || 1);
  const marker = inventoryMarker(context.requestId);
  const comment = `APP INVENTARIO ${marker} ${context.branchName || "SUCURSAL"}${context.notes ? ` - ${context.notes}` : ""}`.slice(0, 255);
  const sql = ["SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;", "START TRANSACTION;", "SET @stale_count := 0;"];

  context.changedLines.forEach((line, index) => {
    sql.push(`SELECT existencia INTO @exist_${index} FROM articulo WHERE art_id = ${line.articleId} FOR UPDATE;`);
    sql.push(`SET @stale_count := @stale_count + IF(ABS(@exist_${index} - ${sqlNumber(line.currentExistence, 4)}) > 0.0001, 1, 0);`);
  });

  sql.push(`INSERT INTO ajusteinventario (fecha, comentario, tipo) SELECT ${sqlText(`${context.date} ${localDateTime().slice(11)}`)}, ${sqlText(comment)}, 0 FROM DUAL WHERE @stale_count = 0;`);
  sql.push("SET @ain_id := IF(@stale_count = 0, LAST_INSERT_ID(), 0);");

  context.changedLines.forEach((line, index) => {
    sql.push(`INSERT INTO ajusteinventarioarticulo (ain_id, art_id, exisAnterior, exisActual, precioCompra, preCompraProm, diferencia, importeCom, importeProm, precioVenta, importeVenta) SELECT @ain_id, ${line.articleId}, @exist_${index}, ${sqlNumber(line.countedExistence, 4)}, ${sqlNumber(line.precioCompra, 3)}, ${sqlNumber(line.preCompraProm, 3)}, ROUND(${sqlNumber(line.countedExistence, 4)} - @exist_${index}, 4), ROUND((${sqlNumber(line.countedExistence, 4)} - @exist_${index}) * ${sqlNumber(line.precioCompra, 3)}, 2), ROUND((${sqlNumber(line.countedExistence, 4)} - @exist_${index}) * ${sqlNumber(line.preCompraProm, 3)}, 2), ${sqlNumber(line.precioVenta, 6)}, ROUND((${sqlNumber(line.countedExistence, 4)} - @exist_${index}) * ${sqlNumber(line.precioVenta, 6)}, 2) FROM DUAL WHERE @stale_count = 0;`);
    sql.push(`UPDATE articulo SET existencia = ${sqlNumber(line.countedExistence, 4)} WHERE art_id = ${line.articleId} AND @stale_count = 0;`);
    sql.push(`INSERT INTO historial (movimiento, fecha, tabla, id, usu_id) SELECT 1, NOW(), 'Articulo', ${line.articleId}, ${historyUserId} FROM DUAL WHERE @stale_count = 0;`);
  });

  sql.push(`INSERT INTO historial (movimiento, fecha, tabla, id, usu_id) SELECT 0, NOW(), 'AjusteInventario', @ain_id, ${historyUserId} FROM DUAL WHERE @stale_count = 0;`);
  sql.push("COMMIT;");
  sql.push(`SELECT @ain_id AS ain_id, @stale_count AS stale_count, ${context.changedLines.length} AS changed_lines, ${sqlNumber(context.summary.totalDifferenceCost, 2)} AS difference_cost;`);
  return { sql: sql.join("\n"), marker, comment };
}

async function getInventoryHistory(limitValue = 100) {
  const limit = Math.min(300, Math.max(1, Math.trunc(Number(limitValue) || 100)));
  const rows = await query(`
    SELECT
      ai.ain_id,
      ai.fecha,
      ai.comentario,
      COUNT(aia.art_id) AS lineas,
      SUM(CASE WHEN aia.diferencia > 0 THEN 1 ELSE 0 END) AS positivas,
      SUM(CASE WHEN aia.diferencia < 0 THEN 1 ELSE 0 END) AS negativas,
      ROUND(SUM(aia.diferencia), 4) AS diferenciaUnidades,
      ROUND(SUM(aia.importeProm), 2) AS diferenciaCosto
    FROM ajusteinventario ai
    INNER JOIN ajusteinventarioarticulo aia ON aia.ain_id = ai.ain_id
    WHERE ai.comentario LIKE 'APP INVENTARIO [CSM-INVENTARIO:%'
    GROUP BY ai.ain_id, ai.fecha, ai.comentario
    ORDER BY ai.ain_id DESC
    LIMIT ${limit};
  `);
  return rows.map((row) => ({
    ...row,
    ain_id: Number(row.ain_id),
    lineas: Number(row.lineas || 0),
    positivas: Number(row.positivas || 0),
    negativas: Number(row.negativas || 0),
    diferenciaUnidades: Number(row.diferenciaUnidades || 0),
    diferenciaCosto: Number(row.diferenciaCosto || 0),
  }));
}

async function getPurchaseContext(payload) {
  const supplierId = Number(payload?.supplierId);
  if (!Number.isInteger(supplierId) || supplierId <= 0) throw new Error("Proveedor invalido.");
  const invoiceNumber = `${payload?.invoiceNumber || ""}`.trim().slice(0, 19);
  if (!invoiceNumber) throw new Error("El numero de factura es obligatorio para recibir en SICAR.");
  if (!Array.isArray(payload?.items) || payload.items.length === 0 || payload.items.length > 100) {
    throw new Error("La compra debe contener entre 1 y 100 productos.");
  }

  const requestId = `${payload.requestId || ""}`.trim();
  if (!/^[a-zA-Z0-9-]{8,64}$/.test(requestId)) throw new Error("Identificador de recepcion invalido.");

  const paymentMethod = `${payload.paymentMethod || ""}`.trim().toLowerCase();
  if (!new Set(["credit", "other"]).has(paymentMethod)) throw new Error("Selecciona Credito u Otro medio de pago.");
  const priceMode = payload?.priceMode === "net" ? "net" : "gross";

  const supplierRows = await query(`SELECT pro_id, nombre, COALESCE(diasCredito, 0) AS diasCredito FROM proveedor WHERE pro_id = ${supplierId} AND status = 1 LIMIT 1;`);
  if (supplierRows.length !== 1) throw new Error("El proveedor no existe o esta inactivo en SICAR.");

  const itemMap = new Map();
  for (const input of payload.items) {
    const articleId = Number(input.articleId);
    const quantity = Number(input.quantity);
    const enteredUnitPrice = Number(priceMode === "net" ? input.netUnitPrice : input.grossUnitPrice);
    if (!Number.isInteger(articleId) || articleId <= 0) throw new Error("Uno de los productos es invalido.");
    if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 1000000) throw new Error("Una cantidad es invalida.");
    if (!Number.isFinite(enteredUnitPrice) || enteredUnitPrice < 0 || enteredUnitPrice > 100000000) throw new Error("Un precio es invalido.");
    if (itemMap.has(articleId)) throw new Error("No se puede repetir el mismo producto en una compra.");
    itemMap.set(articleId, { articleId, quantity, enteredUnitPrice });
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
    const netUnitPrice = priceMode === "net"
      ? input.enteredUnitPrice
      : (taxRate > 0 ? input.enteredUnitPrice / (1 + taxRate / 100) : input.enteredUnitPrice);
    const grossUnitPrice = priceMode === "net"
      ? Math.round((netUnitPrice * (1 + taxRate / 100) + Number.EPSILON) * 1000000) / 1000000
      : input.enteredUnitPrice;
    const netAmount = Math.round((input.quantity * netUnitPrice + Number.EPSILON) * 100) / 100;
    const grossAmount = Math.round((input.quantity * grossUnitPrice + Number.EPSILON) * 100) / 100;
    return {
      ...article,
      articleId: input.articleId,
      quantity: input.quantity,
      order: index + 1,
      taxRate,
      netUnitPrice,
      grossUnitPrice,
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
  const purchaseDate = normalizePurchaseDate(payload?.date);
  const creditDays = Math.max(0, Math.trunc(Number(supplierRows[0].diasCredito || 0)));
  return {
    requestId,
    supplier: { pro_id: supplierId, nombre: supplierRows[0].nombre, diasCredito: creditDays },
    invoiceNumber,
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
  const purchaseDateTime = `${context.date} ${dateParts.slice(11)}`;
  const folio = context.invoiceNumber;
  const marker = `[CSM:${context.requestId}]`;
  const comment = `APP PROVEEDORES ${marker}${context.comment ? ` ${context.comment}` : ""}`.slice(0, 255);
  const historyUserId = Number(config.sicar.historyUserId || 1);
  const cashRegisterId = Number(config.sicar.cashRegisterId || 4);

  const sql = [
    "SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;",
    "START TRANSACTION;",
    `INSERT INTO compra (folio, fecha, subtotal, total, decimales, monTipoCambio, comentario, descuento, peso, subtotal0, gasto, status, pro_id, caj_id, mon_id) VALUES (${sqlText(folio)}, ${sqlText(purchaseDateTime)}, ${sqlNumber(context.summary.subtotal, 2)}, ${sqlNumber(context.summary.total, 2)}, 2, 1.000000, ${sqlText(comment)}, 0.00, ${sqlNumber(context.items.reduce((sum, item) => sum + item.quantity, 0), 4)}, ${sqlNumber(context.summary.subtotal0, 2)}, 0, 1, ${context.supplier.pro_id}, ${cashRegisterId}, 1);`,
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
  const origin = request.headers.origin || "";
  const allowedOrigins = Array.isArray(config.allowedOrigins) ? config.allowedOrigins : [];
  if (origin && (allowedOrigins.includes("*") || allowedOrigins.includes(origin))) {
    response.setHeader("Access-Control-Allow-Origin", origin);
  }
  response.setHeader("Vary", "Origin");
  response.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type, X-CSM-API-Key, X-CSM-Company");
  response.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
}

function originAllowed(request) {
  const origin = `${request.headers.origin || ""}`.trim();
  if (!origin) return true;
  const allowedOrigins = Array.isArray(config.allowedOrigins) ? config.allowedOrigins : [];
  return allowedOrigins.includes("*") || allowedOrigins.includes(origin);
}

function sendJson(response, status, payload) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  response.end(JSON.stringify(payload));
}

async function readBody(request, maximumLength = 262144) {
  let body = "";
  for await (const chunk of request) {
    body += chunk;
    if (body.length > maximumLength) throw new Error("La solicitud es demasiado grande.");
  }
  return body ? JSON.parse(body) : {};
}

function apiKeyAuthorized(request) {
  const expected = `${config.apiKey || ""}`;
  return Boolean(expected) && request.headers["x-csm-api-key"] === expected;
}

function httpError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

async function verifyFirebaseIdentity(request) {
  const settings = config.firebaseAuth || {};
  if (settings.enabled !== true) return null;
  const authorization = `${request.headers.authorization || ""}`;
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!token) throw httpError("Falta la sesion Firebase.", 401);

  const expectedCompany = `${config.company?.identifier || ""}`.trim().toLowerCase();
  const requestedCompany = `${request.headers["x-csm-company"] || ""}`.trim().toLowerCase();
  if (!expectedCompany || requestedCompany !== expectedCompany) {
    throw httpError("La empresa solicitada no corresponde a este servidor.", 403);
  }

  const cacheKey = createHash("sha256").update(`${expectedCompany}\0${token}`).digest("hex");
  const cached = firebaseIdentityCache.get(cacheKey);
  if (cached?.expiresAt > Date.now()) return cached.identity;
  if (!settings.webApiKey || !settings.projectId) throw new Error("Firebase Auth no esta configurado en el servicio.");

  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(settings.webApiKey)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken: token }),
  });
  const payload = await response.json().catch(() => ({}));
  const firebaseUser = payload?.users?.[0];
  if (!response.ok || !firebaseUser?.localId || !firebaseUser?.email) {
    throw httpError("La sesion Firebase no es valida o ya vencio.", 401);
  }
  const email = `${firebaseUser.email}`.trim().toLowerCase();
  const allowedEmails = (settings.allowedEmails || []).map((entry) => `${entry}`.trim().toLowerCase());
  const allowedUids = (settings.allowedUids || []).map((entry) => `${entry}`.trim());
  if ((allowedEmails.length && !allowedEmails.includes(email)) || (allowedUids.length && !allowedUids.includes(firebaseUser.localId))) {
    throw httpError("El usuario no esta autorizado para este servidor SICAR.", 403);
  }

  const identity = { uid: firebaseUser.localId, email };
  firebaseIdentityCache.set(cacheKey, { identity, expiresAt: Date.now() + 5 * 60 * 1000 });
  return identity;
}

async function authorizeRequest(request) {
  const mode = `${config.authMode || (config.firebaseAuth?.enabled ? "firebase-or-api-key" : "api-key")}`;
  if (mode === "api-key") return apiKeyAuthorized(request) ? { type: "api-key" } : null;
  const authorization = `${request.headers.authorization || ""}`;
  const hasBearerToken = authorization.startsWith("Bearer ") && Boolean(authorization.slice(7).trim());
  try {
    const identity = await verifyFirebaseIdentity(request);
    if (identity) return { type: "firebase", ...identity };
  } catch (error) {
    // A presented Firebase token must never fall through to API-key auth. This
    // preserves branch/email 403 responses and prevents credential confusion.
    if (mode === "firebase-only" || hasBearerToken) throw error;
  }
  return mode === "firebase-or-api-key" && apiKeyAuthorized(request) ? { type: "api-key" } : null;
}

async function validateConfiguredCompany() {
  if (validatedCompany?.expiresAt > Date.now()) return validatedCompany.value;
  const company = config.company || {};
  if (!company.identifier || !company.branchId) throw new Error("Falta fijar company.identifier y company.branchId en el servicio.");
  const rows = await query(`
    SELECT
      (SELECT sucId FROM nubecfg LIMIT 1) AS sucId,
      (SELECT alias FROM nubecfg LIMIT 1) AS alias,
      (SELECT nombre FROM empresa LIMIT 1) AS companyName,
      (SELECT ciudad FROM empresa LIMIT 1) AS companyCity;
  `);
  const actualAlias = `${rows[0]?.alias || ""}`.trim();
  const companyName = `${rows[0]?.companyName || ""}`.trim();
  const companyCity = `${rows[0]?.companyCity || ""}`.trim();
  const allowedAliases = [company.identifier, company.branchId, company.branchAlias, ...(company.sicarAliases || [])]
    .filter(Boolean)
    .map(normalizeBranchToken);
  let matchedIdentity = actualAlias;
  let identitySource = "nubecfg.alias";
  if (actualAlias) {
    if (!allowedAliases.includes(normalizeBranchToken(actualAlias))) {
      throw new Error(`El SICAR local (${actualAlias}) no corresponde a ${company.branchId}.`);
    }
  } else {
    matchedIdentity = [companyName, companyCity]
      .find((candidate) => candidate && allowedAliases.includes(normalizeBranchToken(candidate))) || "";
    identitySource = matchedIdentity === companyName ? "empresa.nombre" : "empresa.ciudad";
    if (!matchedIdentity) {
      throw new Error(`El SICAR local (sin alias; ${companyName || companyCity || "empresa desconocida"}) no corresponde a ${company.branchId}.`);
    }
  }
  const value = {
    identifier: company.identifier,
    branchId: company.branchId,
    alias: matchedIdentity,
    nubecfgAlias: actualAlias,
    identitySource,
  };
  validatedCompany = { value, expiresAt: Date.now() + 60_000 };
  return value;
}

function enqueuePurchase(operation) {
  const result = purchaseQueue.then(operation, operation);
  purchaseQueue = result.catch(() => undefined);
  return result;
}

function enqueueInventory(operation) {
  const result = inventoryQueue.then(operation, operation);
  inventoryQueue = result.catch(() => undefined);
  return result;
}

const server = createServer(async (request, response) => {
  setCors(response, request);
  if (!originAllowed(request)) {
    sendJson(response, 403, { ok: false, error: "Origen no autorizado." });
    return;
  }
  if (request.method === "OPTIONS") {
    response.writeHead(204);
    response.end();
    return;
  }
  try {
    const identity = await authorizeRequest(request);
    if (!identity) {
      sendJson(response, 401, { ok: false, error: "Sesion o clave del servicio incorrecta." });
      return;
    }
    const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
    if (request.method === "GET" && url.pathname === "/health") {
      const company = await validateConfiguredCompany();
      const rows = await query("SELECT DATABASE() AS databaseName, NOW() AS serverTime, (SELECT alias FROM nubecfg LIMIT 1) AS branchAlias;");
      const inventoryTriggerEnabled = config.inventoryFirebase?.enabled === true;
      sendJson(response, 200, {
        ok: true,
        service: "csm-sicar-operaciones",
        database: rows[0]?.databaseName,
        serverTime: rows[0]?.serverTime,
        branchAlias: company.alias,
        nubecfgAlias: rows[0]?.branchAlias || "",
        company,
        authenticatedAs: identity.type,
        writeMode: config.allowInventoryAdjustments === true
          ? "purchases-and-direct-inventory"
          : inventoryTriggerEnabled
            ? "purchases-and-inventory-trigger"
            : "purchase-only",
        writes: {
          purchases: config.allowPurchases === true,
          inventoryAdjustments: config.allowInventoryAdjustments === true,
          inventoryTriggers: inventoryTriggerEnabled,
        },
      });
      return;
    }
    if (request.method === "GET" && url.pathname === "/catalogos/proveedores") {
      await validateConfiguredCompany();
      const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") || 40)));
      const rows = filterRows(await getSuppliers(), url.searchParams.get("q") || "", limit, ["nombre", "alias", "rfc"]);
      sendJson(response, 200, { ok: true, source: "sicar-mysql", rows });
      return;
    }
    if (request.method === "GET" && url.pathname === "/catalogos/articulos") {
      await validateConfiguredCompany();
      const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") || 40)));
      const supplierId = Math.max(0, Number(url.searchParams.get("pro_id") || 0));
      const rows = filterRows(await getArticles(supplierId), url.searchParams.get("q") || "", limit, ["clave", "descripcion"]);
      sendJson(response, 200, { ok: true, source: "sicar-mysql", rows });
      return;
    }
    if (request.method === "GET" && url.pathname === "/catalogos/offline") {
      await validateConfiguredCompany();
      const [suppliers, articles] = await Promise.all([getSuppliers(), getArticles(0)]);
      sendJson(response, 200, {
        ok: true,
        source: "sicar-mysql",
        generatedAt: new Date().toISOString(),
        suppliers,
        articles,
      });
      return;
    }
    if (request.method === "GET" && url.pathname === "/inventarios/catalogo") {
      await validateConfiguredCompany();
      const catalog = await getInventoryCatalog();
      sendJson(response, 200, { ok: true, source: "sicar-mysql", ...catalog });
      return;
    }
    if (request.method === "GET" && url.pathname === "/inventarios/solicitudes") {
      const rows = await getInventoryFirestoreHistory(url.searchParams.get("limit"));
      sendJson(response, 200, { ok: true, source: "inventario-sanmartin", rows });
      return;
    }
    if (request.method === "GET" && url.pathname === "/inventarios/solicitud") {
      const settings = getInventoryFirebaseSettings();
      const sessionId = normalizeInventorySessionId(url.searchParams.get("sessionId"));
      const relativePath = `branches/${settings.branchDocumentId}/sicarAdjustmentRequests/${sessionId}`;
      const result = await getFirestoreDocument(relativePath);
      if (!result) {
        sendJson(response, 404, { ok: false, error: "No existe la solicitud de levantamiento." });
        return;
      }
      sendJson(response, 200, { ok: true, source: "inventario-sanmartin", request: result });
      return;
    }
    if (request.method === "POST" && url.pathname === "/inventarios/solicitar-ajuste") {
      const body = await readBody(request, 2 * 1024 * 1024);
      const result = await enqueueInventory(() => submitInventoryFirestoreSession(body));
      sendJson(response, result.created ? 201 : 200, {
        ok: true,
        source: "inventario-sanmartin",
        created: result.created,
        alreadySubmitted: result.alreadySubmitted,
        requiresRetry: result.requiresRetry,
        request: result.request,
      });
      return;
    }
    if (request.method === "POST" && url.pathname === "/inventarios/reintentar-ajuste") {
      const body = await readBody(request);
      const result = await enqueueInventory(() => retryInventoryFirestoreRequest(body?.sessionId));
      sendJson(response, 200, { ok: true, source: "inventario-sanmartin", request: result });
      return;
    }
    if (request.method === "GET" && url.pathname === "/inventarios/historial") {
      const rows = await getInventoryHistory(url.searchParams.get("limit"));
      sendJson(response, 200, { ok: true, source: "sicar-mysql", rows });
      return;
    }
    if (request.method === "POST" && url.pathname === "/inventarios/preview") {
      await validateConfiguredCompany();
      const context = await getInventoryContext(await readBody(request), { requireBaseline: false });
      sendJson(response, 200, { ok: true, source: "sicar-mysql", branch: context.branchName, lines: context.lines, summary: context.summary });
      return;
    }
    if (request.method === "POST" && url.pathname === "/inventarios/aplicar") {
      await validateConfiguredCompany();
      if (config.allowInventoryAdjustments !== true) throw new Error("La escritura de ajustes esta deshabilitada en la configuracion del servicio.");
      const body = await readBody(request, 2 * 1024 * 1024);
      const result = await enqueueInventory(async () => {
        const context = await getInventoryContext(body, { requireBaseline: true });
        const marker = inventoryMarker(context.requestId);
        const duplicate = await query(`SELECT ain_id, fecha, comentario FROM ajusteinventario WHERE comentario LIKE ${sqlText(`%${marker}%`)} ORDER BY ain_id DESC LIMIT 1;`);
        if (duplicate.length) {
          return { duplicate: true, adjustment: { ain_id: Number(duplicate[0].ain_id), fecha: duplicate[0].fecha }, summary: context.summary };
        }
        if (!context.changedLines.length) {
          return { duplicate: false, noChanges: true, adjustment: null, summary: context.summary };
        }
        const built = buildInventoryAdjustmentSql(context);
        const rows = parseTsv(await runMysql(built.sql));
        const applied = rows[rows.length - 1] || {};
        if (Number(applied.stale_count || 0) !== 0 || Number(applied.ain_id || 0) <= 0) {
          throw new Error("La existencia cambio durante la aplicacion. Actualiza y vuelve a revisar.");
        }
        cache.clear();
        return { duplicate: false, noChanges: false, adjustment: { ain_id: Number(applied.ain_id) }, summary: context.summary };
      });
      sendJson(response, result.duplicate || result.noChanges ? 200 : 201, { ok: true, source: "sicar-mysql", ...result });
      return;
    }
    if (request.method === "GET" && url.pathname === "/compras/historial") {
      const rows = await getAppPurchaseHistory(url.searchParams.get("limit"));
      sendJson(response, 200, { ok: true, source: "sicar-mysql", rows });
      return;
    }
    if (request.method === "POST" && url.pathname === "/compras/preview") {
      await validateConfiguredCompany();
      const context = await getPurchaseContext(await readBody(request));
      sendJson(response, 200, { ok: true, supplier: context.supplier, items: context.items, summary: context.summary, payment: context.payment });
      return;
    }
    if (request.method === "POST" && url.pathname === "/compras/recibir") {
      await validateConfiguredCompany();
      if (config.allowPurchases !== true) throw new Error("La escritura de compras esta deshabilitada en la configuracion del servicio.");
      const body = await readBody(request, 12 * 1024 * 1024);
      const result = await enqueuePurchase(async () => {
        const context = await getPurchaseContext(body);
        const { sql, folio, marker } = buildPurchaseSql(context);
        const duplicate = await query(`SELECT com_id, folio, total FROM compra WHERE comentario LIKE ${sqlText(`%${marker}%`)} ORDER BY com_id DESC LIMIT 1;`);
        if (duplicate.length > 0) {
          return { status: 200, duplicate: true, purchase: { com_id: Number(duplicate[0].com_id), folio: duplicate[0].folio, total: Number(duplicate[0].total) }, payment: context.payment, context };
        }
        const rows = parseTsv(await runMysql(sql));
        const purchase = rows[rows.length - 1];
        cache.clear();
        return { status: 201, duplicate: false, purchase: { com_id: Number(purchase.com_id), folio: purchase.folio || folio, total: Number(purchase.total) }, payment: context.payment, context };
      });
      let accounting;
      try {
        accounting = await queueAccountingMetadata(body, result.context, result.purchase);
      } catch (error) {
        console.error(new Date().toISOString(), "Complemento contable:", error.message);
        accounting = { requested: true, queued: false, error: error.message };
      }
      sendJson(response, result.status, { ok: true, duplicate: result.duplicate, purchase: result.purchase, payment: result.payment, accounting });
      return;
    }
    sendJson(response, 404, { ok: false, error: "Endpoint no encontrado." });
  } catch (error) {
    console.error(new Date().toISOString(), error.message);
    sendJson(response, Number(error.statusCode) || 400, { ok: false, error: error.message || "No se pudo procesar la solicitud." });
  }
});

server.listen(port, host, () => {
  console.log(`CSM SICAR Proveedores escuchando en http://${host}:${port}`);
});
