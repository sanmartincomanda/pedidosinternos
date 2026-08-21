import { inventoryAuth, inventoryDb } from "@/firebase";
import {
  browserLocalPersistence,
  onAuthStateChanged,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit as firestoreLimit,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";

const INVENTORY_PROJECT_ID = "inventario-sanmartin";
const INVENTORY_FIREBASE_BRANCH = "CARNES SAN MARTIN GRANADA";
const INVENTORY_BRANCH_ALIAS = "Granada";
const INVENTORY_SOURCE_APP = "inventario-sanmartin";
const INVENTORY_CATALOG_CACHE = "csmInventoryCatalog:v2:granada";
const INVENTORY_CATALOG_URL =
  "https://pedidosinterno-3c65d-default-rtdb.firebaseio.com/configuracion/productos.json";
const LOCKED_STATUSES = new Set(["processing", "done", "duplicate"]);

function normalizeText(value = "") {
  return `${value || ""}`.trim();
}

function normalizeBranch(value = "") {
  return normalizeText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function roundQuantity(value) {
  const numeric = Number(value || 0);
  return Math.round((numeric + Number.EPSILON) * 10000) / 10000;
}

function timestampToIso(value) {
  if (!value) return null;
  if (typeof value?.toDate === "function") return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  return typeof value === "string" ? value : null;
}

function inventoryUser() {
  return inventoryAuth.currentUser || null;
}

function requireInventoryUser() {
  const user = inventoryUser();
  if (!user) {
    throw new Error("Inicia sesión de inventario antes de enviar el levantamiento.");
  }
  return user;
}

function normalizeCatalog(items = [], source = "firebase") {
  const seen = new Set();
  return items
    .map((item, index) => {
      const clave = normalizeText(item?.sku ?? item?.clave);
      const descripcion = normalizeText(item?.nombre ?? item?.descripcion ?? item?.producto);
      if (!clave || !descripcion || seen.has(clave)) return null;
      seen.add(clave);
      const rawId = Number(item?.artId ?? item?.art_id);
      const rawExistence = Number(item?.existencia);
      return {
        art_id: Number.isFinite(rawId) && rawId > 0 ? rawId : index + 1,
        clave,
        descripcion,
        unidad: normalizeText(item?.unidad || "PZA").toUpperCase(),
        existencia: Number.isFinite(rawExistence) ? rawExistence : null,
        activo: item?.activo !== false,
        source,
      };
    })
    .filter((item) => item?.activo)
    .sort((left, right) =>
      left.descripcion.localeCompare(right.descripcion, "es", { sensitivity: "base" }),
    );
}

function readCatalogCache() {
  if (typeof window === "undefined") return null;
  try {
    const cached = JSON.parse(window.localStorage.getItem(INVENTORY_CATALOG_CACHE) || "null");
    if (!Array.isArray(cached?.articles) || !cached.articles.length) return null;
    return cached;
  } catch {
    return null;
  }
}

function saveCatalogCache(articles, source, updatedAt = null) {
  const payload = {
    articles,
    source,
    updatedAt: updatedAt || new Date().toISOString(),
    cachedAt: new Date().toISOString(),
  };
  if (typeof window !== "undefined") {
    window.localStorage.setItem(INVENTORY_CATALOG_CACHE, JSON.stringify(payload));
  }
  return payload;
}

async function readFirestoreCatalog() {
  requireInventoryUser();
  const snapshot = await getDoc(
    doc(inventoryDb, "branches", INVENTORY_FIREBASE_BRANCH, "catalogs", "root"),
  );
  if (!snapshot.exists()) throw new Error("No existe el catálogo de inventario para Granada.");
  const data = snapshot.data() || {};
  const articles = normalizeCatalog(Array.isArray(data.skus) ? data.skus : [], "inventario-sanmartin");
  if (!articles.length) throw new Error("El catálogo de inventario está vacío.");
  return saveCatalogCache(
    articles,
    data.source || "inventario-sanmartin",
    timestampToIso(data.sicarSyncAt || data.updatedAt),
  );
}

async function readPedidosCatalog() {
  const response = await fetch(INVENTORY_CATALOG_URL, { cache: "no-store" });
  if (!response.ok) throw new Error(`No se pudo leer el catálogo de respaldo (${response.status}).`);
  const payload = await response.json();
  const articles = normalizeCatalog(
    Array.isArray(payload) ? payload : Object.values(payload || {}),
    "pedidos-internos",
  );
  if (!articles.length) throw new Error("El catálogo de respaldo está vacío.");
  return saveCatalogCache(articles, "pedidos-internos");
}

function normalizeRequest(snapshot) {
  if (!snapshot?.exists()) return null;
  const data = snapshot.data() || {};
  return {
    id: snapshot.id,
    ...data,
    sessionId: data.sessionId || snapshot.id,
    requestedAt: timestampToIso(data.requestedAt),
    processingStartedAt: timestampToIso(data.processingStartedAt),
    processedAt: timestampToIso(data.processedAt),
    updatedByIntegratorAt: timestampToIso(data.updatedByIntegratorAt),
  };
}

function toFirestoreValue(value) {
  if (value === null || value === undefined) return { nullValue: null };
  if (value instanceof Date) return { timestampValue: value.toISOString() };
  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") {
    return Number.isInteger(value) ? { integerValue: `${value}` } : { doubleValue: value };
  }
  if (Array.isArray(value)) {
    return { arrayValue: { values: value.map((entry) => toFirestoreValue(entry)) } };
  }
  const fields = {};
  Object.entries(value).forEach(([key, entry]) => {
    if (entry !== undefined) fields[key] = toFirestoreValue(entry);
  });
  return { mapValue: { fields } };
}

function toFirestoreFields(value) {
  const fields = {};
  Object.entries(value).forEach(([key, entry]) => {
    if (entry !== undefined) fields[key] = toFirestoreValue(entry);
  });
  return fields;
}

function documentName(relativePath) {
  return `projects/${INVENTORY_PROJECT_ID}/databases/(default)/documents/${relativePath}`;
}

function buildInventoryDocuments(payload, authUser) {
  if (normalizeBranch(payload?.branchId) !== "granada") {
    throw new Error("Este integrador solo admite levantamientos de Granada.");
  }
  const sessionId = normalizeText(payload?.sessionId);
  const folio = normalizeText(payload?.folio).toUpperCase();
  if (!/^[A-Za-z0-9_-]{8,96}$/.test(sessionId)) {
    throw new Error("Identificador de levantamiento inválido.");
  }
  if (!/^[A-Z0-9_-]{5,40}$/.test(folio)) throw new Error("Folio de levantamiento inválido.");

  const inputItems = Array.isArray(payload?.items) ? payload.items : [];
  if (!inputItems.length || inputItems.length > 2000) {
    throw new Error("El levantamiento debe contener entre 1 y 2000 productos.");
  }
  const seen = new Set();
  const items = inputItems.map((item, index) => {
    const sku = normalizeText(item?.sku ?? item?.clave);
    const nombre = normalizeText(item?.nombre ?? item?.descripcion);
    const unidad = normalizeText(item?.unidad || "PZA").toUpperCase();
    const cantidad = roundQuantity(item?.cantidadContada ?? item?.totalLb ?? item?.cajas);
    if (!sku || !nombre) throw new Error(`Falta clave o nombre en la línea ${index + 1}.`);
    if (!Number.isFinite(cantidad) || cantidad < 0) throw new Error(`Conteo inválido en ${sku}.`);
    if (seen.has(sku)) throw new Error(`El producto ${sku} está repetido.`);
    seen.add(sku);
    const pesos = Array.isArray(item?.pesos)
      ? item.pesos.map(Number).filter((weight) => Number.isFinite(weight) && weight >= 0).map(roundQuantity)
      : [];
    const isWeight = unidad === "LB";
    return {
      sku,
      nombre,
      unidad,
      zona: normalizeText(item?.zona || payload?.zona || "Bodega principal").slice(0, 80),
      cajas: isWeight ? Math.max(0, Math.trunc(Number(item?.cajas ?? pesos.length))) : cantidad,
      totalLb: isWeight ? cantidad : null,
      pesos: isWeight ? pesos : [],
    };
  });

  const now = new Date();
  const realizadoPor = normalizeText(payload?.realizadoPor || "CSM Operaciones").slice(0, 100);
  const supervisadoPor = normalizeText(payload?.supervisadoPor || realizadoPor).slice(0, 100);
  const zones = [...new Set(items.map((item) => item.zona).filter(Boolean))];
  const zoneSummaries = zones.map((zona) => {
    const zoneItems = items.filter((item) => item.zona === zona);
    return {
      zona,
      itemCount: zoneItems.length,
      totalCajas: roundQuantity(zoneItems.reduce((sum, item) => sum + Number(item.cajas || 0), 0)),
      totalPesoLb: roundQuantity(zoneItems.reduce((sum, item) => sum + Number(item.totalLb || 0), 0)),
    };
  });
  const requestedBy = {
    type: "firebase-user",
    uid: authUser.uid,
    email: authUser.email || "",
    label: normalizeText(payload?.requestedBy?.label || authUser.email || realizadoPor).slice(0, 120),
  };
  return {
    sessionId,
    folio,
    session: {
      tipo: "levantamiento_inventario",
      branchId: INVENTORY_FIREBASE_BRANCH,
      folio,
      fecha: normalizeText(payload?.fecha),
      proveedor: normalizeText(payload?.proveedor || "Interno").slice(0, 100),
      realizadoPor,
      firmaRealizadoPor: normalizeText(payload?.firmaRealizadoPor).slice(0, 120),
      supervisadoPor,
      firmaSupervisadoPor: normalizeText(payload?.firmaSupervisadoPor).slice(0, 120),
      observaciones: normalizeText(payload?.observaciones).slice(0, 500),
      status: "capturado",
      catalogSource: "sicar",
      sourceApp: "csm-operaciones",
      itemCount: items.length,
      totalCajas: roundQuantity(items.reduce((sum, item) => sum + Number(item.cajas || 0), 0)),
      totalPesoLb: roundQuantity(items.reduce((sum, item) => sum + Number(item.totalLb || 0), 0)),
      zoneCount: zones.length,
      zones,
      zoneSummaries,
      items,
      createdAt: now,
      updatedAt: now,
      finalizedAt: now,
      createdByEmail: authUser.email || "",
    },
    trigger: {
      triggerEvent: "inventory.adjustment.requested",
      sourceApp: INVENTORY_SOURCE_APP,
      action: "create_inventory_adjustment",
      branchId: INVENTORY_BRANCH_ALIAS,
      firebaseBranchId: INVENTORY_FIREBASE_BRANCH,
      sessionId,
      folio,
      requestedBy,
      dryRun: false,
      status: "requested",
      message: "Solicitud registrada desde CSM Operaciones.",
    },
  };
}

async function commitNewInventoryDocuments(built, authUser) {
  const token = await authUser.getIdToken();
  const branchPath = `branches/${INVENTORY_FIREBASE_BRANCH}`;
  const sessionPath = `${branchPath}/levantamientosInventario/${built.sessionId}`;
  const requestPath = `${branchPath}/sicarAdjustmentRequests/${built.sessionId}`;
  const response = await fetch(
    `https://firestore.googleapis.com/v1/projects/${INVENTORY_PROJECT_ID}/databases/(default)/documents:commit`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        writes: [
          {
            update: { name: documentName(sessionPath), fields: toFirestoreFields(built.session) },
            currentDocument: { exists: false },
          },
          {
            update: { name: documentName(requestPath), fields: toFirestoreFields(built.trigger) },
            updateTransforms: [{ fieldPath: "requestedAt", setToServerValue: "REQUEST_TIME" }],
            currentDocument: { exists: false },
          },
        ],
      }),
    },
  );
  const responseBody = await response.json().catch(() => ({}));
  if (response.ok) return responseBody;
  const code = responseBody?.error?.status || "";
  if (response.status === 409 || code === "ALREADY_EXISTS") return { alreadyExists: true };
  if (response.status === 429 || code === "RESOURCE_EXHAUSTED") {
    throw new Error("Firebase agotó temporalmente su cuota de Firestore. Intenta después del reinicio diario de cuota.");
  }
  if (response.status === 403 || code === "PERMISSION_DENIED") {
    throw new Error("Tu usuario de inventario no tiene permiso para la sucursal Granada.");
  }
  throw new Error(responseBody?.error?.message || `Firestore rechazó el levantamiento (${response.status}).`);
}

export function observeInventoryAuth(callback) {
  return onAuthStateChanged(inventoryAuth, callback);
}

export function getInventoryAuthUser() {
  return inventoryUser();
}

export async function loginInventoryUser(email, password) {
  await setPersistence(inventoryAuth, browserLocalPersistence);
  const credential = await signInWithEmailAndPassword(inventoryAuth, normalizeText(email), password);
  return credential.user;
}

export function logoutInventoryUser() {
  return signOut(inventoryAuth);
}

export function checkSicarInventoryApi() {
  const user = inventoryUser();
  return Promise.resolve({
    ok: true,
    source: INVENTORY_SOURCE_APP,
    authenticated: Boolean(user),
    user: user ? { uid: user.uid, email: user.email || "" } : null,
    writes: { inventoryTriggers: Boolean(user) },
  });
}

export async function getSicarInventoryCatalog(options = {}) {
  const cached = readCatalogCache();
  if (cached && !options.force) {
    return {
      ok: true,
      branch: { id: INVENTORY_FIREBASE_BRANCH, alias: INVENTORY_BRANCH_ALIAS },
      articles: cached.articles,
      catalog: { source: cached.source, updatedAt: cached.updatedAt, cached: true },
    };
  }
  let result;
  try {
    result = await readFirestoreCatalog();
  } catch (firestoreError) {
    try {
      result = await readPedidosCatalog();
    } catch {
      if (!cached) throw firestoreError;
      result = cached;
    }
  }
  return {
    ok: true,
    branch: { id: INVENTORY_FIREBASE_BRANCH, alias: INVENTORY_BRANCH_ALIAS },
    articles: result.articles,
    catalog: { source: result.source, updatedAt: result.updatedAt, cached: result === cached },
  };
}

export async function getInventoryAdjustmentRequests(requestLimit = 80) {
  requireInventoryUser();
  const requestQuery = query(
    collection(inventoryDb, "branches", INVENTORY_FIREBASE_BRANCH, "sicarAdjustmentRequests"),
    orderBy("requestedAt", "desc"),
    firestoreLimit(Math.min(Math.max(Number(requestLimit) || 80, 1), 150)),
  );
  const snapshot = await getDocs(requestQuery);
  return { ok: true, source: INVENTORY_SOURCE_APP, rows: snapshot.docs.map(normalizeRequest) };
}

export async function getInventoryAdjustmentRequest(sessionId) {
  requireInventoryUser();
  const snapshot = await getDoc(
    doc(inventoryDb, "branches", INVENTORY_FIREBASE_BRANCH, "sicarAdjustmentRequests", sessionId),
  );
  if (!snapshot.exists()) throw new Error("No existe la solicitud de levantamiento.");
  return { ok: true, source: INVENTORY_SOURCE_APP, request: normalizeRequest(snapshot) };
}

export async function submitInventoryAdjustmentRequest(payload) {
  const user = requireInventoryUser();
  const built = buildInventoryDocuments(payload, user);
  const committed = await commitNewInventoryDocuments(built, user);
  return {
    ok: true,
    created: !committed.alreadyExists,
    alreadySubmitted: Boolean(committed.alreadyExists),
    requiresRetry: false,
    request: { ...built.trigger, requestedAt: new Date().toISOString() },
  };
}

export async function retryInventoryAdjustmentRequest(sessionId) {
  requireInventoryUser();
  const requestRef = doc(
    inventoryDb,
    "branches",
    INVENTORY_FIREBASE_BRANCH,
    "sicarAdjustmentRequests",
    sessionId,
  );
  const snapshot = await getDoc(requestRef);
  if (!snapshot.exists()) throw new Error("No existe la solicitud de levantamiento.");
  const current = normalizeRequest(snapshot);
  if (LOCKED_STATUSES.has(`${current.status || ""}`)) {
    return { ok: true, request: current, alreadySubmitted: true };
  }
  if (`${current.status || ""}` !== "error") {
    throw new Error(`La solicitud está en estado ${current.status}; no se puede reenviar.`);
  }
  await updateDoc(requestRef, {
    status: "requested",
    message: "Reintento solicitado desde CSM Operaciones.",
    lastError: null,
    resultStatus: null,
    duplicate: false,
    alreadyProcessed: false,
    requestedAt: serverTimestamp(),
  });
  return {
    ok: true,
    request: { ...current, status: "requested", message: "Reintento solicitado desde CSM Operaciones." },
  };
}

export function getSicarInventoryHistory(requestLimit = 100) {
  return getInventoryAdjustmentRequests(requestLimit);
}
