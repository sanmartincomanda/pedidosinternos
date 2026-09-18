import { Capacitor, CapacitorHttp } from "@capacitor/core";
import { getOperationsFirebaseUser } from "@/lib/operationsAuth";
import {
  buildSicarApiCandidates,
  SICAR_API_DEFAULT_PORT,
  trimSicarApiEndpoint,
} from "@/lib/sicarApiEndpoints.mjs";

const API_URL_STORAGE_KEY = "csmSicarPurchaseApiUrl:v2";
const API_TOKEN_STORAGE_KEY = "csmSicarPurchaseApiToken:v2";
const LAST_WORKING_URL_STORAGE_KEY = "csmSicarPurchaseApiLastWorkingUrl:v1";
const LEGACY_API_URL_STORAGE_KEY = "csmSicarPurchaseApiUrl";
const LEGACY_API_TOKEN_STORAGE_KEY = "csmSicarPurchaseApiToken";
let activeCompany = null;

function companyKey(companyContext = activeCompany) {
  return `${companyContext?.identificador || "sin-empresa"}`.trim().toLowerCase();
}

function storageKey(prefix, companyContext = activeCompany) {
  return `${prefix}:${companyKey(companyContext)}`;
}

export function setSicarApiCompanyContext(companyContext) {
  activeCompany = companyContext || null;
}

function getSicarApiCandidates(companyContext = activeCompany) {
  if (typeof window === "undefined") return [`http://127.0.0.1:${SICAR_API_DEFAULT_PORT}`];
  const isGranada = companyKey(companyContext) === "granada";
  return buildSicarApiCandidates({
    companyKey: companyKey(companyContext),
    savedEndpoint: window.localStorage.getItem(storageKey(API_URL_STORAGE_KEY, companyContext)),
    lastWorkingEndpoint: window.localStorage.getItem(storageKey(LAST_WORKING_URL_STORAGE_KEY, companyContext)),
    legacyEndpoint: isGranada ? window.localStorage.getItem(LEGACY_API_URL_STORAGE_KEY) : "",
    nativePlatform: Capacitor.isNativePlatform(),
    pageHostname: window.location.hostname,
    pageProtocol: window.location.protocol,
  });
}

export function getDefaultSicarApiUrl(companyContext = activeCompany) {
  return getSicarApiCandidates(companyContext)[0] || "";
}

export function saveSicarApiConnection({ url, token = "", companyContext = activeCompany }) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey(API_URL_STORAGE_KEY, companyContext), trimSicarApiEndpoint(url));
  window.localStorage.setItem(storageKey(API_TOKEN_STORAGE_KEY, companyContext), `${token}`.trim());
  window.localStorage.removeItem(storageKey(LAST_WORKING_URL_STORAGE_KEY, companyContext));
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

function rememberWorkingEndpoint(url, companyContext) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    storageKey(LAST_WORKING_URL_STORAGE_KEY, companyContext),
    trimSicarApiEndpoint(url),
  );
}

function parseNativeData(data) {
  if (typeof data !== "string") return data;
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

function retryableStatus(status, message = "") {
  if ([404, 408, 425, 429, 500, 502, 503, 504].includes(Number(status))) return true;
  const normalized = `${message}`.toLowerCase();
  return Number(status) === 403 && (
    normalized.includes("empresa solicitada") ||
    normalized.includes("no corresponde a este servidor")
  );
}

function responseError(message, status) {
  const error = new Error(message);
  error.status = Number(status) || 0;
  error.retryable = retryableStatus(error.status, message);
  return error;
}

function isRetryableConnectionError(error) {
  if (error?.retryable === true) return true;
  if (error?.status) return false;
  const message = `${error?.message || ""}`.toLowerCase();
  return error?.name === "AbortError"
    || message.includes("failed to fetch")
    || message.includes("network")
    || message.includes("timeout")
    || message.includes("timed out")
    || message.includes("connect")
    || message.includes("socket")
    || message.includes("ssl");
}

async function requestEndpoint(url, path, options, headers) {
  const method = options.method || "GET";
  const isWrite = method !== "GET" && method !== "HEAD";
  const timeoutMs = isWrite ? 120000 : 15000;

  if (Capacitor.isNativePlatform()) {
    const response = await CapacitorHttp.request({
      url: `${url}${path}`,
      method,
      headers,
      data: options.body ? JSON.parse(options.body) : undefined,
      connectTimeout: 10000,
      readTimeout: timeoutMs,
    });
    const data = parseNativeData(response.data);
    if (response.status < 200 || response.status >= 300 || data?.ok === false) {
      throw responseError(data?.error || `SICAR respondio con estado ${response.status}.`, response.status);
    }
    return data;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const externalSignal = options.signal;
  const abortFromExternalSignal = () => controller.abort();
  externalSignal?.addEventListener?.("abort", abortFromExternalSignal, { once: true });
  try {
    const response = await fetch(`${url}${path}`, { ...options, headers, signal: controller.signal });
    let data = null;
    try {
      data = await response.json();
    } catch {
      data = null;
    }
    if (!response.ok || data?.ok === false) {
      throw responseError(data?.error || `SICAR respondio con estado ${response.status}.`, response.status);
    }
    return data;
  } finally {
    clearTimeout(timeout);
    externalSignal?.removeEventListener?.("abort", abortFromExternalSignal);
  }
}

export async function requestSicarApi(path, options = {}) {
  const companyContext = activeCompany;
  const { token } = getSicarApiConnection(companyContext);
  const candidates = getSicarApiCandidates(companyContext);
  const firebaseUser = getOperationsFirebaseUser();
  const idToken = firebaseUser ? await firebaseUser.getIdToken() : "";
  const headers = {
    Accept: "application/json",
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...(token ? { "X-CSM-API-Key": token } : {}),
    ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
    ...(companyContext?.identificador ? { "X-CSM-Company": companyContext.identificador } : {}),
    ...(options.headers || {}),
  };

  if (candidates.length === 0) {
    throw new Error("No hay una direccion segura configurada para el servidor SICAR.");
  }

  let lastError = null;
  for (let index = 0; index < candidates.length; index += 1) {
    const url = candidates[index];
    try {
      const data = await requestEndpoint(url, path, options, headers);
      rememberWorkingEndpoint(url, companyContext);
      return data;
    } catch (error) {
      lastError = error;
      if (!isRetryableConnectionError(error) || index === candidates.length - 1) break;
    }
  }

  if (lastError && !isRetryableConnectionError(lastError)) throw lastError;
  throw new Error(`No se pudo conectar con SICAR. Se probaron ${candidates.length} rutas disponibles automaticamente.`);
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
