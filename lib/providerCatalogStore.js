const DB_NAME = "csm-sicar-catalog-local";
const DB_VERSION = 1;
const STORE_NAME = "catalogs";
const CATALOG_KEY = "provider-purchase-catalog";
const FALLBACK_KEY = "csmProviderPurchaseCatalog";

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("No se pudo abrir el catalogo local."));
  });
}

async function withStore(mode, action) {
  const database = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, mode);
      const store = transaction.objectStore(STORE_NAME);
      const request = action(store);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("No se pudo acceder al catalogo local."));
    });
  } finally {
    database.close();
  }
}

function normalizeCatalog(catalog) {
  if (!catalog) return null;
  return {
    id: CATALOG_KEY,
    updatedAt: catalog.updatedAt || new Date().toISOString(),
    suppliers: Array.isArray(catalog.suppliers) ? catalog.suppliers : [],
    articles: Array.isArray(catalog.articles) ? catalog.articles : [],
  };
}

function readFallback() {
  try {
    return normalizeCatalog(JSON.parse(localStorage.getItem(FALLBACK_KEY) || "null"));
  } catch {
    return null;
  }
}

export async function loadProviderCatalog() {
  if (typeof window === "undefined") return null;
  if (!("indexedDB" in window)) return readFallback();
  try {
    return normalizeCatalog(await withStore("readonly", (store) => store.get(CATALOG_KEY)));
  } catch {
    return readFallback();
  }
}

export async function saveProviderCatalog(catalog) {
  if (typeof window === "undefined") return null;
  const normalized = normalizeCatalog(catalog);
  if (!("indexedDB" in window)) {
    localStorage.setItem(FALLBACK_KEY, JSON.stringify(normalized));
    return normalized;
  }
  try {
    await withStore("readwrite", (store) => store.put(normalized));
  } catch {
    localStorage.setItem(FALLBACK_KEY, JSON.stringify(normalized));
  }
  return normalized;
}
