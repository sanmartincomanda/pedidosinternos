import { Capacitor, CapacitorHttp } from "@capacitor/core";
import { getOperationsFirebaseUser } from "@/lib/operationsAuth";

const DEFAULT_PORT = 43110;
const API_URL_STORAGE_KEY = "csmSicarPurchaseApiUrl:v2";
const API_TOKEN_STORAGE_KEY = "csmSicarPurchaseApiToken:v2";
const LEGACY_API_URL_STORAGE_KEY = "csmSicarPurchaseApiUrl";
const LEGACY_API_TOKEN_STORAGE_KEY = "csmSicarPurchaseApiToken";
const LEGACY_LAN_API_URL = `http://192.168.1.137:${DEFAULT_PORT}`;
const COMPANY_DEFAULT_API_URLS = Object.freeze({
  granada: "https://microsoft.tail95b6f5.ts.net:8445",
  masaya: "https://servidor-masaya.tail95b6f5.ts.net",
});
let activeCompany = null;

function trimEndpoint(value = "") {
  if (value === null || value === undefined) return "";
  return `${value}`.trim().replace(/\/+$/, "");
}

function companyKey(companyContext = activeCompany) {
  return `${companyContext?.identificador || "sin-empresa"}`.trim().toLowerCase();
}

function storageKey(prefix, companyContext = activeCompany) {
  return `${prefix}:${companyKey(companyContext)}`;
}

function isInsecureSavedEndpoint(value = "") {
  return trimEndpoint(value).toLowerCase().startsWith("http://");
}

export function setSicarApiCompanyContext(companyContext) {
  activeCompany = companyContext || null;
}

export function getDefaultSicarApiUrl(companyContext = activeCompany) {
  if (typeof window === "undefined") return `http://127.0.0.1:${DEFAULT_PORT}`;

  const currentCompanyKey = companyKey(companyContext);
  const saved = trimEndpoint(window.localStorage.getItem(storageKey(API_URL_STORAGE_KEY, companyContext)));
  if (Capacitor.isNativePlatform() && saved) return saved;
  if (Capacitor.isNativePlatform() && currentCompanyKey === "granada") {
    const legacyNative = trimEndpoint(window.localStorage.getItem(LEGACY_API_URL_STORAGE_KEY));
    if (legacyNative) return legacyNative;
  }
  const companyDefault = COMPANY_DEFAULT_API_URLS[currentCompanyKey] || "";
  if (companyDefault && (!saved || saved === LEGACY_LAN_API_URL || isInsecureSavedEndpoint(saved))) return companyDefault;
  if (saved) return saved;
  if (currentCompanyKey === "granada") {
    const legacy = trimEndpoint(window.localStorage.getItem(LEGACY_API_URL_STORAGE_KEY));
    if (legacy) return legacy;
  }

  if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
    return `http://127.0.0.1:${DEFAULT_PORT}`;
  }

  return LEGACY_LAN_API_URL;
}

export function saveSicarApiConnection({ url, token = "", companyContext = activeCompany }) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey(API_URL_STORAGE_KEY, companyContext), trimEndpoint(url));
  window.localStorage.setItem(storageKey(API_TOKEN_STORAGE_KEY, companyContext), `${token}`.trim());
}

export function getSicarApiConnection(companyContext = activeCompany) {
  if (typeof window === "undefined") return { url: getDefaultSicarApiUrl(companyContext), token: "" };

  const scopedToken = `${window.localStorage.getItem(storageKey(API_TOKEN_STORAGE_KEY, companyContext)) || ""}`.trim();
  const legacyToken = companyKey(companyContext) === "granada"
    ? `${window.localStorage.getItem(LEGACY_API_TOKEN_STORAGE_KEY) || ""}`.trim()
    : "";
  return {
    url: getDefaultSicarApiUrl(companyContext),
    token: scopedToken || legacyToken,
  };
}

export async function requestSicarApi(path, options = {}) {
  const { url, token } = getSicarApiConnection();
  const firebaseUser = getOperationsFirebaseUser();
  const idToken = firebaseUser ? await firebaseUser.getIdToken() : "";
  const headers = {
    Accept: "application/json",
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...(token ? { "X-CSM-API-Key": token } : {}),
    ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
    ...(activeCompany?.identificador ? { "X-CSM-Company": activeCompany.identificador } : {}),
    ...(options.headers || {}),
  };

  try {
    if (Capacitor.isNativePlatform()) {
      const response = await CapacitorHttp.request({
        url: `${url}${path}`,
        method: options.method || "GET",
        headers,
        data: options.body ? JSON.parse(options.body) : undefined,
        connectTimeout: 8000,
        readTimeout: 30000,
      });
      const data = response.data;
      if (response.status < 200 || response.status >= 300 || data?.ok === false) {
        throw new Error(data?.error || `SICAR respondio con estado ${response.status}.`);
      }
      return data;
    }

    const response = await fetch(`${url}${path}`, { ...options, headers });
    let data = null;
    try {
      data = await response.json();
    } catch {
      data = null;
    }
    if (!response.ok || data?.ok === false) {
      throw new Error(data?.error || `SICAR respondio con estado ${response.status}.`);
    }
    return data;
  } catch (error) {
    if (error?.message && !error.message.toLowerCase().includes("failed to fetch")) throw error;
    throw new Error(`No se pudo conectar con SICAR en ${url}. Verifica que el servicio local este activo.`);
  }
}

export function checkSicarPurchaseApi() {
  return requestSicarApi("/health");
}

export function searchSicarSuppliers(query = "") {
  const params = new URLSearchParams({ q: query, limit: "40" });
  return requestSicarApi(`/catalogos/proveedores?${params.toString()}`);
}

export function searchSicarArticles(query = "", supplierId = "") {
  const params = new URLSearchParams({ q: query, limit: "40" });
  if (supplierId) params.set("pro_id", `${supplierId}`);
  return requestSicarApi(`/catalogos/articulos?${params.toString()}`);
}

export function getSicarOfflineCatalog() {
  return requestSicarApi("/catalogos/offline");
}

export function getSicarPurchaseHistory(limit = 150) {
  const params = new URLSearchParams({ limit: `${limit}` });
  return requestSicarApi(`/compras/historial?${params.toString()}`);
}

export function getSicarInventoryCatalog() {
  return requestSicarApi("/inventarios/catalogo");
}

export function getSicarInventoryHistory(limit = 100) {
  const params = new URLSearchParams({ limit: `${limit}` });
  return requestSicarApi(`/inventarios/historial?${params.toString()}`);
}

export function previewSicarInventoryAdjustment(payload) {
  return requestSicarApi("/inventarios/preview", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function applySicarInventoryAdjustment(payload) {
  return requestSicarApi("/inventarios/aplicar", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function previewSicarPurchase(payload) {
  return requestSicarApi("/compras/preview", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function receiveSicarPurchase(payload) {
  return requestSicarApi("/compras/recibir", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
