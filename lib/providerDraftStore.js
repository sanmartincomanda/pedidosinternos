const DATABASE_NAME = "csm-operaciones-local";
const DATABASE_VERSION = 1;
const STORE_NAME = "providerPurchaseDrafts";
const FALLBACK_STORAGE_KEY = "csmProviderPurchaseDrafts";

function sortDrafts(rows = []) {
  return [...rows].sort((left, right) =>
    `${right.updatedAt || right.createdAt || ""}`.localeCompare(
      `${left.updatedAt || left.createdAt || ""}`,
    ),
  );
}

function getFallbackDrafts() {
  if (typeof window === "undefined") return [];
  try {
    return sortDrafts(JSON.parse(window.localStorage.getItem(FALLBACK_STORAGE_KEY) || "[]"));
  } catch {
    return [];
  }
}

function saveFallbackDrafts(rows) {
  window.localStorage.setItem(FALLBACK_STORAGE_KEY, JSON.stringify(sortDrafts(rows)));
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("updatedAt", "updatedAt");
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("No se pudo abrir el almacenamiento local."));
  });
}

async function runStore(mode, operation) {
  if (typeof window === "undefined") return null;
  if (!window.indexedDB) return operation(null);

  const database = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, mode);
      const store = transaction.objectStore(STORE_NAME);
      const request = operation(store);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("No se pudo actualizar el almacenamiento local."));
      transaction.onabort = () => reject(transaction.error || new Error("La operacion local fue cancelada."));
    });
  } finally {
    database.close();
  }
}

export async function listProviderPurchaseDrafts() {
  if (typeof window === "undefined") return [];
  if (!window.indexedDB) return getFallbackDrafts();
  const rows = await runStore("readonly", (store) => store.getAll());
  return sortDrafts(rows || []);
}

export async function saveProviderPurchaseDraft(draft) {
  if (typeof window === "undefined") return draft;
  if (!window.indexedDB) {
    const current = getFallbackDrafts().filter((row) => row.id !== draft.id);
    saveFallbackDrafts([draft, ...current]);
    return draft;
  }
  await runStore("readwrite", (store) => store.put(draft));
  return draft;
}

export async function deleteProviderPurchaseDraft(draftId) {
  if (typeof window === "undefined") return;
  if (!window.indexedDB) {
    saveFallbackDrafts(getFallbackDrafts().filter((row) => row.id !== draftId));
    return;
  }
  await runStore("readwrite", (store) => store.delete(draftId));
}
