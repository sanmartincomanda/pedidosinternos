import { Capacitor, CapacitorHttp } from "@capacitor/core";

const DEFAULT_PORT = 43110;
const API_URL_STORAGE_KEY = "csmSicarPurchaseApiUrl";
const API_TOKEN_STORAGE_KEY = "csmSicarPurchaseApiToken";

function trimEndpoint(value = "") {
  if (value === null || value === undefined) return "";
  return `${value}`.trim().replace(/\/+$/, "");
}

export function getDefaultSicarApiUrl() {
  if (typeof window === "undefined") return `http://127.0.0.1:${DEFAULT_PORT}`;

  const saved = trimEndpoint(window.localStorage.getItem(API_URL_STORAGE_KEY));
  if (saved) return saved;

  if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
    return `http://127.0.0.1:${DEFAULT_PORT}`;
  }

  return `http://192.168.1.137:${DEFAULT_PORT}`;
}

export function saveSicarApiConnection({ url, token = "" }) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(API_URL_STORAGE_KEY, trimEndpoint(url));
  window.localStorage.setItem(API_TOKEN_STORAGE_KEY, `${token}`.trim());
}

export function getSicarApiConnection() {
  if (typeof window === "undefined") return { url: getDefaultSicarApiUrl(), token: "" };

  return {
    url: getDefaultSicarApiUrl(),
    token: `${window.localStorage.getItem(API_TOKEN_STORAGE_KEY) || ""}`.trim(),
  };
}

export async function requestSicarApi(path, options = {}) {
  const { url, token } = getSicarApiConnection();
  const headers = {
    Accept: "application/json",
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...(token ? { "X-CSM-API-Key": token } : {}),
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
