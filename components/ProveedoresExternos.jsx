"use client";

import React, { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";
import { Capacitor } from "@capacitor/core";
import { IS_HANDHELD } from "@/lib/deviceProfile";
import ProviderPurchaseHistory from "./ProviderPurchaseHistory";
import ProviderReceivingMobile from "./ProviderReceivingMobile";
import TouchNumericInput from "./TouchNumericInput";
import { articleUnit, Icon, ProductIdentity, useMediaQuery } from "./ui/csm";
import {
  checkSicarPurchaseApi,
  getSicarOfflineCatalog,
  getSicarPurchaseHistory,
  getSicarApiConnection,
  previewSicarPurchase,
  receiveSicarPurchase,
  saveSicarApiConnection,
} from "@/lib/sicarPurchaseApi";
import { loadProviderCatalog, saveProviderCatalog } from "@/lib/providerCatalogStore";
import { filterSicarOperationalArticles } from "@/lib/sicarArticleEligibility.mjs";
import {
  deleteProviderPurchaseDraft,
  listProviderPurchaseDrafts,
  saveProviderPurchaseDraft,
} from "@/lib/providerDraftStore";

const Icons = {
  search: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  ),
  supplier: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 21h18M5 21V7l7-4 7 4v14" />
      <path d="M9 9h2v2H9zM14 9h2v2h-2zM9 14h2v2H9zM14 14h2v2h-2z" />
    </svg>
  ),
  box: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="m3 7 9-4 9 4-9 4-9-4ZM3 7v10l9 4 9-4V7M12 11v10" />
    </svg>
  ),
  trash: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 6h18M8 6V4h8v2M19 6l-1 13a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  ),
  settings: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" />
    </svg>
  ),
  check: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
      <path d="m5 12 4 4L19 6" />
    </svg>
  ),
  credit: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="5" width="18" height="14" rx="3" />
      <path d="M3 10h18M7 15h4" />
    </svg>
  ),
  otherPayment: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12h8M12 8v8" />
    </svg>
  ),
  plus: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
      <path d="M12 5v14M5 12h14" />
    </svg>
  ),
  scale: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 3v4M5 7h14M7 7l-4 8h8L7 7Zm10 0-4 8h8l-4-8ZM12 7v14M8 21h8" />
    </svg>
  ),
  close: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
      <path d="m6 6 12 12M18 6 6 18" />
    </svg>
  ),
  invoice: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M6 3h9l3 3v15H6z" />
      <path d="M14 3v4h4M9 12h6M9 16h6" />
    </svg>
  ),
  scan: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 7V4h3M17 4h3v3M20 17v3h-3M7 20H4v-3" />
      <path d="M7 9v6M10 8v8M14 8v8M17 9v6" />
    </svg>
  ),
};

const CATALOG_MAX_AGE_MS = 12 * 60 * 60 * 1000;
const CATALOG_RESULT_LIMIT = IS_HANDHELD ? 8 : 24;
const HANDHELD_SCAN_BULTOS_ID = "__handheld_scan_bultos__";

function normalizeCatalogSearch(value = "") {
  return `${value}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function filterLocalCatalog(rows, query, fields) {
  const tokens = normalizeCatalogSearch(query).split(" ").filter(Boolean);
  const matches = tokens.length === 0
    ? rows
    : rows.filter((row) => {
      const searchable = normalizeCatalogSearch(fields.map((field) => row[field] || "").join(" "));
      return tokens.every((token) => searchable.includes(token));
    });
  return matches.slice(0, CATALOG_RESULT_LIMIT);
}

function catalogIsFresh(catalog) {
  const updatedAt = Date.parse(catalog?.updatedAt || "");
  return Number.isFinite(updatedAt) && Date.now() - updatedAt < CATALOG_MAX_AGE_MS;
}

const MAX_INVOICE_FILE_BYTES = 8 * 1024 * 1024;
const ALLOWED_INVOICE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function localDate() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function formatMoney(value) {
  return new Intl.NumberFormat("es-NI", {
    style: "currency",
    currency: "NIO",
    minimumFractionDigits: 2,
  }).format(Number(value || 0));
}

function roundMoney(value) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
}

function roundUnitPrice(value) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 1000000) / 1000000;
}

function parseBultoWeight(value) {
  const parsed = Number.parseFloat(`${value ?? ""}`.trim().replace(",", "."));
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.round(parsed * 10000) / 10000;
}

function formatBultoWeight(value) {
  return `${Math.round(Number(value || 0) * 10000) / 10000}`;
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(`${reader.result || ""}`);
    reader.onerror = () => reject(new Error("No se pudo leer la foto de la factura."));
    reader.readAsDataURL(file);
  });
}

function getDataUrlSize(dataUrl = "") {
  const base64 = `${dataUrl}`.split(",")[1] || "";
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
}

async function serializeInvoiceSupport(support) {
  if (!support) return null;
  if (support.dataUrl) return support;
  const file = support.file || support;
  return {
    fileName: support.name || file.name,
    name: support.name || file.name,
    contentType: support.type || file.type,
    type: support.type || file.type,
    size: support.size || file.size,
    dataUrl: await readFileAsDataUrl(file),
  };
}

function buildPurchasePayload({
  supplier,
  invoiceNumber,
  purchaseDate,
  comment,
  items,
  requestId,
  paymentMethod,
  retentionIr2,
  retentionMunicipal1,
  invoiceSupport = null,
}) {
  return {
    requestId,
    supplierId: Number(supplier.pro_id),
    invoiceNumber: `${invoiceNumber || ""}`.trim(),
    date: purchaseDate,
    comment: `${comment || ""}`.trim(),
    paymentMethod,
    priceMode: "net",
    accounting: {
      retentionIr2: roundMoney(retentionIr2),
      retentionMunicipal1: roundMoney(retentionMunicipal1),
      ...(invoiceSupport ? { invoiceSupport } : {}),
    },
    items: items.map((item) => ({
      articleId: Number(item.art_id),
      quantity: Number(item.quantity),
      netUnitPrice: Number(item.netUnitPrice),
    })),
  };
}

function ConnectionDialog({ initial, onClose, onSaved }) {
  const [url, setUrl] = useState(initial.url);
  const [token, setToken] = useState(initial.token);
  const [validationError, setValidationError] = useState("");
  const nativeConnection = Capacitor.isNativePlatform();

  return (
    <div className="app-modal z-[110] px-4" role="dialog" aria-modal="true">
      <div className="app-modal-panel w-full max-w-lg p-5 sm:p-6">
        <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Conexion local</div>
        <h2 className="mt-1 text-xl font-black text-slate-950">Servidor SICAR</h2>
        <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
          {nativeConnection
            ? "En la misma red puedes usar la IP local. Fuera de la sucursal, usa la direccion HTTPS de Tailscale."
            : "La web requiere una direccion HTTPS. Para usar una IP local HTTP, abre la aplicacion Android instalada."}
        </p>
        <label className="app-label mt-5">Direccion</label>
        <input
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          className="app-input"
          placeholder={nativeConnection ? "http://192.168.1.137:43110" : "https://servidor-sucursal.tailnet.ts.net"}
          autoCapitalize="none"
          autoCorrect="off"
        />
        {validationError ? <div className="mt-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">{validationError}</div> : null}
        <label className="app-label mt-4">Clave del servicio</label>
        <input
          type="password"
          value={token}
          onChange={(event) => setToken(event.target.value)}
          className="app-input"
          placeholder="Clave API"
        />
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <button type="button" onClick={onClose} className="app-button app-button-secondary">Cancelar</button>
          <button
            type="button"
            onClick={() => {
              const normalizedUrl = `${url || ""}`.trim();
              if (!nativeConnection && normalizedUrl.toLowerCase().startsWith("http://")) {
                setValidationError("El navegador bloquea conexiones HTTP locales. Usa la URL HTTPS de Tailscale o la app Android instalada.");
                return;
              }
              setValidationError("");
              saveSicarApiConnection({ url, token });
              onSaved();
            }}
            className="app-button app-button-primary"
          >
            Guardar y actualizar
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ProveedoresExternos({ user }) {
  // Phones get their own screen-by-screen flow; the handheld build keeps its scanner layout.
  const isPhone = useMediaQuery("(max-width: 767px)") && !IS_HANDHELD;
  const [view, setView] = useState("form");
  const [connection, setConnection] = useState("checking");
  const [connectionError, setConnectionError] = useState("");
  const [connectionDialog, setConnectionDialog] = useState(false);
  const [drafts, setDrafts] = useState([]);
  const [editingDraftId, setEditingDraftId] = useState(null);
  const [purchaseHistory, setPurchaseHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [supplierQuery, setSupplierQuery] = useState("");
  const [supplierCatalog, setSupplierCatalog] = useState([]);
  const [supplier, setSupplier] = useState(null);
  const [supplierOpen, setSupplierOpen] = useState(false);
  const [productQuery, setProductQuery] = useState("");
  const [articleCatalog, setArticleCatalog] = useState([]);
  const [catalogUpdatedAt, setCatalogUpdatedAt] = useState("");
  const [catalogSyncing, setCatalogSyncing] = useState(false);
  const [productOpen, setProductOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [bultosArticleId, setBultosArticleId] = useState(null);
  const [bultosTemporal, setBultosTemporal] = useState([]);
  const [bultoTemporal, setBultoTemporal] = useState("");
  const [bultoError, setBultoError] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(localDate);
  const [comment, setComment] = useState("");
  const [retentionIrEnabled, setRetentionIrEnabled] = useState(false);
  const [retentionMunicipalEnabled, setRetentionMunicipalEnabled] = useState(false);
  const [retentionIr2, setRetentionIr2] = useState("");
  const [retentionMunicipal1, setRetentionMunicipal1] = useState("");
  const [retentionIrEdited, setRetentionIrEdited] = useState(false);
  const [retentionMunicipalEdited, setRetentionMunicipalEdited] = useState(false);
  const [invoiceSupport, setInvoiceSupport] = useState(null);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [paymentPromptOpen, setPaymentPromptOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("");
  const [preview, setPreview] = useState(null);
  const [receipt, setReceipt] = useState(null);
  const [handheldDetailsOpen, setHandheldDetailsOpen] = useState(true);
  const [handheldCaptureMode, setHandheldCaptureMode] = useState("scan");
  const [handheldScanCode, setHandheldScanCode] = useState("");
  const [handheldScanProduct, setHandheldScanProduct] = useState(null);
  const [handheldScanQuantity, setHandheldScanQuantity] = useState("");
  const [handheldScanBultos, setHandheldScanBultos] = useState([]);
  const [handheldScanError, setHandheldScanError] = useState("");
  const requestIdRef = useRef(globalThis.crypto?.randomUUID?.() || `purchase-${Date.now()}`);
  const productSearchRef = useRef(null);
  const supplierPickerRef = useRef(null);
  const productPickerRef = useRef(null);
  const invoiceSupportInputRef = useRef(null);
  const invoiceCameraInputRef = useRef(null);
  const invoiceNumberInputRef = useRef(null);
  const quantityRefs = useRef(new Map());
  const bultoInputRef = useRef(null);
  const handheldScanInputRef = useRef(null);
  const handheldScanQuantityRef = useRef(null);

  const refreshDrafts = async () => {
    const rows = await listProviderPurchaseDrafts();
    setDrafts(rows);
    return rows;
  };

  const refreshHistory = async () => {
    setHistoryLoading(true);
    setHistoryError("");
    try {
      await refreshDrafts();
      if (connection !== "online") {
        setHistoryError("SICAR no esta conectado. Los pendientes locales siguen disponibles.");
        return;
      }
      const result = await getSicarPurchaseHistory();
      setPurchaseHistory(result.rows || []);
    } catch (error) {
      setHistoryError(error.message);
    } finally {
      setHistoryLoading(false);
    }
  };
  const refreshHistoryEvent = useEffectEvent(refreshHistory);

  const applyCatalog = (catalog) => {
    if (!catalog) return;
    setSupplierCatalog(Array.isArray(catalog.suppliers) ? catalog.suppliers : []);
    setArticleCatalog(filterSicarOperationalArticles(catalog.articles));
    setCatalogUpdatedAt(catalog.updatedAt || "");
  };

  const synchronizeCatalog = async ({ showMessage = false } = {}) => {
    setCatalogSyncing(true);
    try {
      const result = await getSicarOfflineCatalog();
      const catalog = {
        updatedAt: result.generatedAt || new Date().toISOString(),
        suppliers: result.suppliers || [],
        articles: filterSicarOperationalArticles(result.articles),
      };
      await saveProviderCatalog(catalog);
      applyCatalog(catalog);
      if (showMessage) {
        setMessage({
          type: "success",
          text: `Catalogo local actualizado: ${catalog.suppliers.length} proveedores y ${catalog.articles.length} productos.`,
        });
      }
      return catalog;
    } finally {
      setCatalogSyncing(false);
    }
  };

  const checkConnection = async ({ forceCatalog = false, cachedCatalog = null, showMessage = false } = {}) => {
    setConnection("checking");
    setConnectionError("");
    try {
      await checkSicarPurchaseApi();
      setConnection("online");
    } catch (error) {
      setConnection("offline");
      setConnectionError(error.message);
      return;
    }

    const availableCatalog = cachedCatalog || {
      updatedAt: catalogUpdatedAt,
      suppliers: supplierCatalog,
      articles: articleCatalog,
    };
    if (forceCatalog || availableCatalog.suppliers.length === 0 || availableCatalog.articles.length === 0 || !catalogIsFresh(availableCatalog)) {
      try {
        await synchronizeCatalog({ showMessage });
      } catch (error) {
        setConnectionError(`SICAR esta disponible, pero no se pudo actualizar el catalogo local: ${error.message}`);
      }
    }
  };
  const checkConnectionEvent = useEffectEvent(checkConnection);

  useEffect(() => {
    let cancelled = false;
    loadProviderCatalog()
      .then((catalog) => {
        if (cancelled) return;
        applyCatalog(catalog);
        return checkConnectionEvent({ cachedCatalog: catalog });
      })
      .catch((error) => {
        if (!cancelled) {
          setConnectionError(`No se pudo abrir el catalogo local: ${error.message}`);
          checkConnectionEvent();
        }
      });
    refreshDrafts().catch((error) => setMessage({ type: "error", text: error.message }));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (view === "history") refreshHistoryEvent();
  }, [view, connection]);

  useEffect(() => {
    const closeSearchLists = (event) => {
      if (!supplierPickerRef.current?.contains(event.target)) setSupplierOpen(false);
      if (!productPickerRef.current?.contains(event.target)) setProductOpen(false);
    };
    const closeWithEscape = (event) => {
      if (event.key === "Escape") {
        setSupplierOpen(false);
        setProductOpen(false);
      }
    };
    document.addEventListener("pointerdown", closeSearchLists);
    document.addEventListener("keydown", closeWithEscape);
    return () => {
      document.removeEventListener("pointerdown", closeSearchLists);
      document.removeEventListener("keydown", closeWithEscape);
    };
  }, []);

  const suppliers = useMemo(
    () => filterLocalCatalog(supplierCatalog, supplierQuery, ["nombre", "alias", "rfc"]),
    [supplierCatalog, supplierQuery],
  );

  const products = useMemo(
    () => filterLocalCatalog(articleCatalog, productQuery, ["clave", "descripcion"]),
    [articleCatalog, productQuery],
  );

  const totals = useMemo(() => {
    const subtotal = items.reduce(
      (sum, item) => sum + roundMoney(Number(item.quantity || 0) * Number(item.netUnitPrice || 0)),
      0,
    );
    const gross = items.reduce((sum, item) => {
      const grossUnitPrice = roundUnitPrice(
        Number(item.netUnitPrice || 0) * (1 + Number(item.taxPercent || 0) / 100),
      );
      return sum + roundMoney(Number(item.quantity || 0) * grossUnitPrice);
    }, 0);
    const roundedSubtotal = roundMoney(subtotal);
    const roundedGross = roundMoney(gross);
    return {
      lines: items.length,
      subtotal: roundedSubtotal,
      taxes: roundMoney(roundedGross - roundedSubtotal),
      gross: roundedGross,
    };
  }, [items]);

  useEffect(() => {
    if (retentionIrEnabled && !retentionIrEdited) {
      setRetentionIr2(roundMoney(totals.subtotal * 0.02).toFixed(2));
    }
  }, [retentionIrEdited, retentionIrEnabled, totals.subtotal]);

  useEffect(() => {
    if (retentionMunicipalEnabled && !retentionMunicipalEdited) {
      setRetentionMunicipal1(roundMoney(totals.subtotal * 0.01).toFixed(2));
    }
  }, [retentionMunicipalEdited, retentionMunicipalEnabled, totals.subtotal]);

  const retentionTotal = roundMoney(
    (retentionIrEnabled ? Number(retentionIr2 || 0) : 0)
      + (retentionMunicipalEnabled ? Number(retentionMunicipal1 || 0) : 0),
  );
  const netTotal = roundMoney(Math.max(totals.gross - retentionTotal, 0));

  const toggleRetentionIr = () => {
    setRetentionIrEnabled((enabled) => {
      if (enabled) {
        setRetentionIr2("");
        setRetentionIrEdited(false);
      } else {
        setRetentionIr2(roundMoney(totals.subtotal * 0.02).toFixed(2));
        setRetentionIrEdited(false);
      }
      return !enabled;
    });
  };

  const toggleRetentionMunicipal = () => {
    setRetentionMunicipalEnabled((enabled) => {
      if (enabled) {
        setRetentionMunicipal1("");
        setRetentionMunicipalEdited(false);
      } else {
        setRetentionMunicipal1(roundMoney(totals.subtotal * 0.01).toFixed(2));
        setRetentionMunicipalEdited(false);
      }
      return !enabled;
    });
  };

  const selectInvoiceSupport = (file) => {
    if (!file) return;
    const inferredType = file.type || (
      /\.png$/i.test(file.name) ? "image/png"
        : /\.webp$/i.test(file.name) ? "image/webp"
          : "image/jpeg"
    );
    if (!ALLOWED_INVOICE_TYPES.has(inferredType)) {
      setMessage({ type: "error", text: "La factura debe ser una imagen JPG, PNG o WEBP." });
      return;
    }
    if (file.size > MAX_INVOICE_FILE_BYTES) {
      setMessage({ type: "error", text: "La foto de la factura no puede superar 8 MB." });
      return;
    }
    setInvoiceSupport({
      file,
      name: file.name || `factura-${Date.now()}.jpg`,
      type: inferredType,
      size: file.size,
    });
    setMessage(null);
  };

  const takeInvoicePhoto = async () => {
    if (!Capacitor.isNativePlatform()) {
      invoiceCameraInputRef.current?.click();
      return;
    }

    setCameraLoading(true);
    setMessage(null);
    try {
      const photo = await Camera.getPhoto({
        source: CameraSource.Camera,
        resultType: CameraResultType.DataUrl,
        quality: 82,
        width: 1920,
        correctOrientation: true,
        allowEditing: false,
        saveToGallery: false,
      });
      if (!photo.dataUrl) throw new Error("La camara no devolvio una imagen.");

      const contentType = photo.format === "png" ? "image/png" : "image/jpeg";
      const extension = contentType === "image/png" ? "png" : "jpg";
      const size = getDataUrlSize(photo.dataUrl);
      if (size > MAX_INVOICE_FILE_BYTES) {
        throw new Error("La foto de la factura no puede superar 8 MB.");
      }

      const fileName = `factura-${Date.now()}.${extension}`;
      setInvoiceSupport({
        fileName,
        name: fileName,
        contentType,
        type: contentType,
        size,
        dataUrl: photo.dataUrl,
      });
      setMessage({ type: "success", text: "Foto de factura capturada." });
    } catch (error) {
      if (!/cancel/i.test(`${error?.message || error}`)) {
        setMessage({ type: "error", text: `No se pudo abrir la camara: ${error.message || error}` });
      }
    } finally {
      setCameraLoading(false);
    }
  };

  const focusHandheldScanner = () => {
    requestAnimationFrame(() => {
      handheldScanInputRef.current?.focus();
    });
  };

  const selectHandheldProduct = (product) => {
    setHandheldScanProduct(product);
    setHandheldScanQuantity("");
    setHandheldScanBultos([]);
    setHandheldScanError("");
    setProductQuery("");
    setProductOpen(false);
    requestAnimationFrame(() => handheldScanQuantityRef.current?.focus());
  };

  const findHandheldScannedProduct = (rawCode) => {
    const code = `${rawCode || ""}`.trim().replace(/\s+/g, "").toLowerCase();
    if (!code) return null;

    const exact = articleCatalog.find(
      (article) => `${article.clave || ""}`.trim().replace(/\s+/g, "").toLowerCase() === code,
    );
    if (exact) return exact;

    const numericCode = code.replace(/^0+/, "") || "0";
    const numericMatches = articleCatalog.filter((article) => {
      const articleCode = `${article.clave || ""}`.trim().replace(/\s+/g, "").toLowerCase();
      return /^\d+$/.test(articleCode) && (articleCode.replace(/^0+/, "") || "0") === numericCode;
    });
    return numericMatches.length === 1 ? numericMatches[0] : null;
  };

  const handleHandheldScan = (event, rawCode = handheldScanCode) => {
    event?.preventDefault();
    const code = `${rawCode || ""}`.trim();
    const product = findHandheldScannedProduct(code);
    if (!product) {
      setHandheldScanProduct(null);
      setHandheldScanError(code ? `No se encontro la clave ${code}.` : "Escanea o escribe una clave.");
      focusHandheldScanner();
      return;
    }
    selectHandheldProduct(product);
  };

  const addHandheldScannedProduct = (quantityValue = handheldScanQuantity) => {
    const quantity = parseBultoWeight(quantityValue);
    if (!handheldScanProduct || quantity === null) {
      setHandheldScanError("Ingresa una cantidad mayor que cero.");
      requestAnimationFrame(() => handheldScanQuantityRef.current?.focus());
      return;
    }

    setItems((current) => {
      const existing = current.find((item) => Number(item.art_id) === Number(handheldScanProduct.art_id));
      if (existing) {
        const combinedQuantity = Number(existing.quantity || 0) + quantity;
        const combinedBultos = existing.bultos?.length && handheldScanBultos.length
          ? [...existing.bultos, ...handheldScanBultos]
          : [];
        return [
          { ...existing, quantity: formatBultoWeight(combinedQuantity), bultos: combinedBultos },
          ...current.filter((item) => Number(item.art_id) !== Number(handheldScanProduct.art_id)),
        ];
      }
      return [
        {
          ...handheldScanProduct,
          quantity: formatBultoWeight(quantity),
          netUnitPrice: `${Number(handheldScanProduct.lastPurchaseNet ?? handheldScanProduct.precioCompra ?? 0).toFixed(2)}`,
          bultos: handheldScanBultos,
        },
        ...current,
      ];
    });
    setHandheldScanCode("");
    setHandheldScanProduct(null);
    setHandheldScanQuantity("");
    setHandheldScanBultos([]);
    setHandheldScanError("");
    if (handheldCaptureMode === "search") {
      setProductQuery("");
      setProductOpen(true);
      requestAnimationFrame(() => productSearchRef.current?.focus());
    } else {
      focusHandheldScanner();
    }
  };

  const addProduct = (product) => {
    if (IS_HANDHELD) {
      selectHandheldProduct(product);
      return;
    }
    setItems((current) => {
      const existing = current.find((item) => Number(item.art_id) === Number(product.art_id));
      if (existing) {
        return [existing, ...current.filter((item) => Number(item.art_id) !== Number(product.art_id))];
      }
      return [
        {
          ...product,
          quantity: "",
          netUnitPrice: `${Number(product.lastPurchaseNet ?? product.precioCompra ?? 0).toFixed(2)}`,
          bultos: [],
        },
        ...current,
      ];
    });
    setProductQuery("");
    setProductOpen(false);
    requestAnimationFrame(() => quantityRefs.current.get(Number(product.art_id))?.focus());
  };

  const updateItem = (articleId, field, value) => {
    setItems((current) =>
      current.map((item) => (
        Number(item.art_id) === Number(articleId)
          ? { ...item, [field]: value, ...(field === "quantity" ? { bultos: [] } : {}) }
          : item
      )),
    );
  };

  const openProductSearch = () => {
    if (IS_HANDHELD) setHandheldCaptureMode("search");
    setProductOpen(true);
    requestAnimationFrame(() => {
      productSearchRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      productSearchRef.current?.focus();
    });
  };

  const closeBultos = () => {
    setBultosArticleId(null);
    setBultosTemporal([]);
    setBultoTemporal("");
    setBultoError("");
  };

  const openBultos = (articleId) => {
    const item = items.find((row) => Number(row.art_id) === Number(articleId));
    const saved = Array.isArray(item?.bultos)
      ? item.bultos.map(parseBultoWeight).filter((weight) => weight !== null)
      : [];
    setBultosArticleId(Number(articleId));
    setBultosTemporal(saved);
    setBultoTemporal("");
    setBultoError("");
    setTimeout(() => bultoInputRef.current?.focus(), 80);
  };

  const openHandheldScanBultos = () => {
    setBultosArticleId(HANDHELD_SCAN_BULTOS_ID);
    setBultosTemporal(handheldScanBultos.map(parseBultoWeight).filter((weight) => weight !== null));
    setBultoTemporal("");
    setBultoError("");
    setTimeout(() => bultoInputRef.current?.focus(), 80);
  };

  const closeBultosAndReturn = () => {
    const returnToHandheldQuantity = bultosArticleId === HANDHELD_SCAN_BULTOS_ID;
    closeBultos();
    if (returnToHandheldQuantity) {
      requestAnimationFrame(() => handheldScanQuantityRef.current?.focus());
    }
  };

  const addBulto = () => {
    const weight = parseBultoWeight(bultoTemporal);
    if (weight === null) {
      setBultoError("Ingresa un peso mayor que cero.");
      bultoInputRef.current?.focus();
      return;
    }
    setBultosTemporal((current) => [...current, weight]);
    setBultoTemporal("");
    setBultoError("");
    requestAnimationFrame(() => bultoInputRef.current?.focus());
  };

  const finishBultos = () => {
    let finalWeights = bultosTemporal;
    if (`${bultoTemporal}`.trim()) {
      const lastWeight = parseBultoWeight(bultoTemporal);
      if (lastWeight === null) {
        setBultoError("Revisa el ultimo peso.");
        bultoInputRef.current?.focus();
        return;
      }
      finalWeights = [...finalWeights, lastWeight];
    }
    if (finalWeights.length === 0) {
      setBultoError("Agrega al menos un peso.");
      bultoInputRef.current?.focus();
      return;
    }
    const total = finalWeights.reduce((sum, weight) => sum + weight, 0);
    if (bultosArticleId === HANDHELD_SCAN_BULTOS_ID) {
      setHandheldScanQuantity(formatBultoWeight(total));
      setHandheldScanBultos(finalWeights);
      closeBultos();
      requestAnimationFrame(() => handheldScanQuantityRef.current?.focus());
      return;
    }
    setItems((current) => current.map((item) => (
      Number(item.art_id) === Number(bultosArticleId)
        ? { ...item, quantity: formatBultoWeight(total), bultos: finalWeights }
        : item
    )));
    closeBultos();
    openProductSearch();
  };

  const validate = ({ requireInvoice = false } = {}) => {
    if (!supplier) return "Selecciona el proveedor.";
    if (requireInvoice && !`${invoiceNumber || ""}`.trim()) return "Ingresa el numero de factura antes de recibir en SICAR.";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(purchaseDate)) return "Selecciona la fecha de la factura.";
    if (purchaseDate > localDate()) return "La fecha de la factura no puede ser futura.";
    if (items.length === 0) return "Agrega al menos un producto.";
    if (items.some((item) => Number(item.quantity) <= 0)) return "Completa una cantidad mayor que cero en todos los productos.";
    if (items.some((item) => Number(item.netUnitPrice) < 0 || item.netUnitPrice === "")) return "Revisa el precio sin IVA de todos los productos.";
    if (retentionIrEnabled && (!Number.isFinite(Number(retentionIr2)) || Number(retentionIr2) < 0)) return "Revisa la retencion IR.";
    if (retentionMunicipalEnabled && (!Number.isFinite(Number(retentionMunicipal1)) || Number(retentionMunicipal1) < 0)) return "Revisa la retencion municipal.";
    if (retentionTotal > totals.subtotal) return "Las retenciones no pueden superar el subtotal de la factura.";
    return "";
  };

  const resetForm = ({ keepSupplier = false } = {}) => {
    if (!keepSupplier) {
      setSupplier(null);
      setSupplierQuery("");
    }
    setItems([]);
    setInvoiceNumber("");
    setPurchaseDate(localDate());
    setComment("");
    setRetentionIrEnabled(false);
    setRetentionMunicipalEnabled(false);
    setRetentionIr2("");
    setRetentionMunicipal1("");
    setRetentionIrEdited(false);
    setRetentionMunicipalEdited(false);
    setInvoiceSupport(null);
    setPaymentMethod("");
    setPreview(null);
    setEditingDraftId(null);
    setHandheldDetailsOpen(!keepSupplier);
    setHandheldCaptureMode("scan");
    setHandheldScanCode("");
    setHandheldScanProduct(null);
    setHandheldScanQuantity("");
    setHandheldScanBultos([]);
    setHandheldScanError("");
    if (invoiceSupportInputRef.current) invoiceSupportInputRef.current.value = "";
    if (invoiceCameraInputRef.current) invoiceCameraInputRef.current.value = "";
    requestIdRef.current = globalThis.crypto?.randomUUID?.() || `purchase-${Date.now()}`;
  };

  const savePendingReception = async () => {
    const validationError = validate();
    if (validationError) {
      setMessage({ type: "error", text: validationError });
      if (IS_HANDHELD && !supplier) setHandheldDetailsOpen(true);
      return false;
    }

    setLoading(true);
    setMessage(null);
    try {
      const now = new Date().toISOString();
      const existing = drafts.find((row) => row.id === editingDraftId);
      const serializedSupport = await serializeInvoiceSupport(invoiceSupport);
      const draft = {
        id: editingDraftId || `provider-draft-${globalThis.crypto?.randomUUID?.() || Date.now()}`,
        requestId: requestIdRef.current,
        createdAt: existing?.createdAt || now,
        updatedAt: now,
        supplier,
        invoiceNumber: `${invoiceNumber || ""}`.trim(),
        purchaseDate,
        comment: `${comment || ""}`.trim(),
        items: items.map((item) => ({ ...item })),
        totals,
        retentionIrEnabled,
        retentionMunicipalEnabled,
        retentionIr2: retentionIrEnabled ? `${retentionIr2 || 0}` : "",
        retentionMunicipal1: retentionMunicipalEnabled ? `${retentionMunicipal1 || 0}` : "",
        invoiceSupport: serializedSupport,
      };
      await saveProviderPurchaseDraft(draft);
      await refreshDrafts();
      resetForm();
      if (!isPhone) setView("history");
      setMessage(null);
      return true;
    } catch (error) {
      setMessage({ type: "error", text: `No se pudo guardar la recepcion local: ${error.message}` });
      return false;
    } finally {
      setLoading(false);
    }
  };

  const editPendingReception = (draft) => {
    setSupplier(draft.supplier || null);
    setSupplierQuery(draft.supplier?.nombre || "");
    setItems((draft.items || []).map((item) => ({ ...item })));
    setInvoiceNumber(draft.invoiceNumber || "");
    setPurchaseDate(draft.purchaseDate || localDate());
    setComment(draft.comment || "");
    setRetentionIrEnabled(Boolean(draft.retentionIrEnabled));
    setRetentionMunicipalEnabled(Boolean(draft.retentionMunicipalEnabled));
    setRetentionIr2(`${draft.retentionIr2 || ""}`);
    setRetentionMunicipal1(`${draft.retentionMunicipal1 || ""}`);
    setRetentionIrEdited(Boolean(draft.retentionIrEnabled));
    setRetentionMunicipalEdited(Boolean(draft.retentionMunicipalEnabled));
    setInvoiceSupport(draft.invoiceSupport || null);
    setEditingDraftId(draft.id);
    setHandheldDetailsOpen(false);
    setHandheldCaptureMode("scan");
    requestIdRef.current = draft.requestId || globalThis.crypto?.randomUUID?.() || `purchase-${Date.now()}`;
    setMessage({ type: "success", text: "Recepcion local abierta. Puedes corregirla y enviarla a SICAR." });
    setView("form");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const removePendingReception = async (draft) => {
    try {
      await deleteProviderPurchaseDraft(draft.id);
      await refreshDrafts();
      if (editingDraftId === draft.id) resetForm();
    } catch (error) {
      setHistoryError(`No se pudo eliminar el pendiente: ${error.message}`);
    }
  };

  const requestPaymentMethod = () => {
    const validationError = validate({ requireInvoice: true });
    if (validationError) {
      setMessage({ type: "error", text: validationError });
      if (IS_HANDHELD && (!supplier || !`${invoiceNumber || ""}`.trim())) {
        setHandheldDetailsOpen(true);
      }
      if (!`${invoiceNumber || ""}`.trim()) {
        requestAnimationFrame(() => {
          invoiceNumberInputRef.current?.focus();
          invoiceNumberInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
        });
      }
      return;
    }

    setMessage(null);
    setPaymentPromptOpen(true);
  };

  const openPreview = async (selectedPaymentMethod) => {
    setPaymentMethod(selectedPaymentMethod);
    setPaymentPromptOpen(false);

    setLoading(true);
    setMessage(null);
    try {
      const result = await previewSicarPurchase(
        buildPurchasePayload({
          supplier,
          invoiceNumber,
          purchaseDate,
          comment,
          items,
          requestId: requestIdRef.current,
          paymentMethod: selectedPaymentMethod,
          retentionIr2: retentionIrEnabled ? retentionIr2 : 0,
          retentionMunicipal1: retentionMunicipalEnabled ? retentionMunicipal1 : 0,
        }),
      );
      setPreview(result);
    } catch (error) {
      setMessage({ type: "error", text: error.message });
    } finally {
      setLoading(false);
    }
  };

  const receivePurchase = async () => {
    const validationError = validate({ requireInvoice: true });
    if (validationError) {
      setMessage({ type: "error", text: validationError });
      setPreview(null);
      if (!`${invoiceNumber || ""}`.trim()) invoiceNumberInputRef.current?.focus();
      return;
    }

    setLoading(true);
    setMessage(null);
    try {
      const serializedSupport = await serializeInvoiceSupport(invoiceSupport);
      const invoiceSupportPayload = serializedSupport
        ? {
            fileName: serializedSupport.fileName || serializedSupport.name,
            contentType: serializedSupport.contentType || serializedSupport.type,
            dataUrl: serializedSupport.dataUrl,
          }
        : null;
      const completedDraftId = editingDraftId;
      const result = await receiveSicarPurchase(
        buildPurchasePayload({
          supplier,
          invoiceNumber,
          purchaseDate,
          comment,
          items,
          requestId: requestIdRef.current,
          paymentMethod,
          retentionIr2: retentionIrEnabled ? retentionIr2 : 0,
          retentionMunicipal1: retentionMunicipalEnabled ? retentionMunicipal1 : 0,
          invoiceSupport: invoiceSupportPayload,
        }),
      );
      let draftCleanupWarning = "";
      if (completedDraftId) {
        try {
          await deleteProviderPurchaseDraft(completedDraftId);
          await refreshDrafts();
        } catch (error) {
          draftCleanupWarning = ` La compra se registro, pero no se pudo quitar el pendiente local: ${error.message}`;
        }
      }
      setReceipt({ ...result.purchase, payment: result.payment, accounting: result.accounting });
      setPreview(null);
      resetForm({ keepSupplier: true });
      if (draftCleanupWarning) setMessage({ type: "error", text: draftCleanupWarning.trim() });
    } catch (error) {
      setMessage({ type: "error", text: error.message });
      setPreview(null);
    } finally {
      setLoading(false);
    }
  };

  const history = {
    purchases: purchaseHistory,
    loading: historyLoading,
    error: historyError,
    refresh: refreshHistory,
    onDeleteDraft: removePendingReception,
    onEditDraft: editPendingReception,
  };

  if (view === "history" && !isPhone) {
    return (
      <ProviderPurchaseHistory
        drafts={drafts}
        purchases={purchaseHistory}
        loading={historyLoading}
        error={historyError}
        onBack={() => {
          setView("form");
          setMessage(null);
        }}
        onDeleteDraft={removePendingReception}
        onEditDraft={editPendingReception}
        onRefresh={refreshHistory}
      />
    );
  }

  const activeBultoItem = bultosArticleId === HANDHELD_SCAN_BULTOS_ID
    ? handheldScanProduct
    : items.find((item) => Number(item.art_id) === Number(bultosArticleId));
  const bultosTotal = bultosTemporal.reduce((sum, weight) => sum + weight, 0);
  const clearInvoiceSupport = () => {
    setInvoiceSupport(null);
    if (invoiceSupportInputRef.current) invoiceSupportInputRef.current.value = "";
    if (invoiceCameraInputRef.current) invoiceCameraInputRef.current.value = "";
  };
  const connectionLabel = catalogSyncing
    ? "Actualizando catálogo"
    : connection === "online" ? "SICAR conectado" : connection === "checking" ? "Verificando SICAR" : "SICAR sin conexión";
  const connectionTone = catalogSyncing || connection === "checking" ? "is-warn" : connection === "online" ? "is-ok" : "is-err";
  const addedArticleIds = new Set(items.map((item) => Number(item.art_id)));

  const fileInputs = (
    <>
      <input
        ref={invoiceSupportInputRef}
        type="file"
        accept="image/*"
        onChange={(event) => selectInvoiceSupport(event.target.files?.[0])}
        className="hidden"
        aria-hidden="true"
        tabIndex={-1}
      />
      <input
        ref={invoiceCameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(event) => selectInvoiceSupport(event.target.files?.[0])}
        className="hidden"
        aria-hidden="true"
        tabIndex={-1}
      />
    </>
  );

  const dialogs = (
    <>
      {connectionDialog ? (
        <ConnectionDialog
          initial={getSicarApiConnection()}
          onClose={() => setConnectionDialog(false)}
          onSaved={() => {
            setConnectionDialog(false);
            checkConnection({ forceCatalog: true, showMessage: true });
          }}
        />
      ) : null}

      {bultosArticleId !== null && typeof document !== "undefined"
        ? createPortal(
            <div
              className="app-modal z-[120] items-end px-3 pb-[calc(12px+env(safe-area-inset-bottom))] sm:items-center sm:p-4"
              role="dialog"
              aria-modal="true"
              aria-labelledby="bultos-title"
              onClick={(event) => {
                if (event.target === event.currentTarget) closeBultosAndReturn();
              }}
            >
              <div className="app-modal-panel w-full max-w-md p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="csm-overline">Suma de bultos</div>
                    <h3 id="bultos-title" className="csm-dialog-title mt-1">{activeBultoItem?.descripcion}</h3>
                    {activeBultoItem ? (
                      <div className="mt-0.5 text-xs text-[var(--gray-600)]">
                        <span className="font-mono">{activeBultoItem.clave}</span>
                        {articleUnit(activeBultoItem) ? ` · ${articleUnit(activeBultoItem)}` : ""}
                      </div>
                    ) : null}
                  </div>
                  <button type="button" onClick={closeBultosAndReturn} className="csm-icon-btn" aria-label="Cerrar suma de bultos">
                    <Icon name="close" size={18} />
                  </button>
                </div>

                <div className="csm-bultos-total mt-3">
                  <div>
                    <div className="csm-figure-label">Peso total</div>
                    <div className="font-mono text-3xl font-bold text-[var(--ink)]">{formatBultoWeight(bultosTotal)}</div>
                  </div>
                  <span className="csm-tag is-plain">{bultosTemporal.length} bultos</span>
                </div>

                <label className="app-label mt-3" htmlFor="bulto-weight">Peso del bulto</label>
                <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                  <input
                    id="bulto-weight"
                    ref={bultoInputRef}
                    type="text"
                    inputMode="decimal"
                    enterKeyHint="next"
                    value={bultoTemporal}
                    onChange={(event) => {
                      setBultoTemporal(event.target.value);
                      setBultoError("");
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        addBulto();
                      }
                    }}
                    onFocus={(event) => event.target.select()}
                    className="app-input csm-num csm-num-lg"
                    aria-invalid={bultoError ? "true" : undefined}
                  />
                  <button type="button" onClick={addBulto} className="csm-btn csm-btn-secondary" aria-label="Agregar peso">
                    <Icon name="plus" size={18} /> Agregar
                  </button>
                </div>
                <div className={`mt-1.5 min-h-5 text-xs ${bultoError ? "font-semibold text-[var(--err)]" : "text-[var(--gray-500)]"}`} role={bultoError ? "alert" : undefined}>
                  {bultoError || "Escribe el peso y presiona Enter para agregar otro."}
                </div>

                {bultosTemporal.length > 0 ? (
                  <ol className="mt-2 max-h-44 divide-y divide-[var(--gray-150)] overflow-y-auto rounded-md border border-[var(--gray-200)]">
                    {[...bultosTemporal].reverse().map((weight, reverseIndex) => {
                      const originalIndex = bultosTemporal.length - 1 - reverseIndex;
                      return (
                        <li key={`${originalIndex}-${weight}`} className="flex min-h-10 items-center justify-between gap-3 px-3 py-1">
                          <span className="text-xs text-[var(--gray-500)]">Bulto {originalIndex + 1}</span>
                          <span className="ml-auto font-mono text-sm font-semibold">{formatBultoWeight(weight)}</span>
                          <button
                            type="button"
                            onClick={() => setBultosTemporal((current) => current.filter((_, index) => index !== originalIndex))}
                            className="csm-icon-btn is-ghost h-9 w-9 text-[var(--err)]"
                            aria-label={`Quitar bulto ${originalIndex + 1}`}
                          >
                            <Icon name="trash" size={16} />
                          </button>
                        </li>
                      );
                    })}
                  </ol>
                ) : null}

                <div className="csm-dialog-actions">
                  <button type="button" onClick={closeBultosAndReturn} className="csm-btn csm-btn-secondary">Cancelar</button>
                  <button type="button" onClick={finishBultos} className="csm-btn csm-btn-primary">Usar {formatBultoWeight(bultosTotal + (parseBultoWeight(bultoTemporal) || 0))}</button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}

      {paymentPromptOpen ? (
        <div className="app-modal z-[115] px-4" role="dialog" aria-modal="true" aria-labelledby="payment-method-title">
          <div className="app-modal-panel w-full max-w-lg p-5 sm:p-6">
            <h2 id="payment-method-title" className="csm-dialog-title">Método de pago</h2>
            <p className="mt-1 text-sm text-[var(--gray-600)]">Cómo debe quedar registrada la compra en SICAR.</p>
            <div className="mt-4 grid gap-2">
              <button type="button" onClick={() => openPreview("credit")} disabled={loading} className="csm-choice">
                <span className="csm-choice-title">Crédito</span>
                <span className="csm-choice-copy">Genera la cuenta por pagar al proveedor.</span>
              </button>
              <button type="button" onClick={() => openPreview("other")} disabled={loading} className="csm-choice">
                <span className="csm-choice-title">Otro medio de pago</span>
                <span className="csm-choice-copy">Conserva la clasificación actual de SICAR.</span>
              </button>
            </div>
            <div className="csm-dialog-actions">
              <button type="button" onClick={() => setPaymentPromptOpen(false)} disabled={loading} className="csm-btn csm-btn-secondary">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {preview ? (
        <div className="app-modal z-[110] px-4" role="dialog" aria-modal="true" aria-labelledby="preview-title">
          <div className="app-modal-panel w-full max-w-lg p-5 sm:p-6">
            <div className="csm-overline">Confirmar recepción</div>
            <h2 id="preview-title" className="csm-dialog-title mt-1">{preview.supplier?.nombre}</h2>
            <dl className="csm-totals mt-4">
              <div><dt>Factura</dt><dd>{invoiceNumber} · {purchaseDate}</dd></div>
              <div><dt>Artículos</dt><dd>{preview.summary?.lines}</dd></div>
              <div><dt>Subtotal sin IVA</dt><dd>{formatMoney(preview.summary?.subtotal)}</dd></div>
              <div className="is-strong"><dt>Total factura</dt><dd>{formatMoney(preview.summary?.total)}</dd></div>
              <div>
                <dt>Método de pago</dt>
                <dd>{preview.payment?.label}{preview.payment?.method === "credit" && preview.payment?.dueDate ? ` · vence ${preview.payment.dueDate}` : ""}</dd>
              </div>
              {retentionTotal > 0 ? (
                <>
                  <div><dt>Retenciones (contabilidad)</dt><dd>− {formatMoney(retentionTotal)}</dd></div>
                  <div><dt>Neto a pagar</dt><dd>{formatMoney(netTotal)}</dd></div>
                </>
              ) : null}
              {invoiceSupport ? <div><dt>Foto de factura</dt><dd className="break-all">{invoiceSupport.name}</dd></div> : null}
            </dl>
            <p className="csm-alert is-warn mt-4">
              SICAR recibe el total de la factura (subtotal más IVA). Las retenciones no se envían a SICAR; solo al sistema contable.
            </p>
            <div className="csm-dialog-actions">
              <button
                type="button"
                onClick={() => {
                  setPreview(null);
                  setPaymentMethod("");
                }}
                className="csm-btn csm-btn-secondary"
              >
                Volver a revisar
              </button>
              <button type="button" onClick={receivePurchase} disabled={loading} className="csm-btn csm-btn-primary">
                {loading ? "Registrando..." : "Confirmar recepción"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {receipt ? (
        <div className="app-modal z-[110] px-4" role="dialog" aria-modal="true" aria-labelledby="receipt-title">
          <div className="app-modal-panel w-full max-w-md p-5 sm:p-6">
            <span className="csm-tag is-ok">Compra registrada en SICAR</span>
            <h2 id="receipt-title" className="csm-dialog-title mt-2">Factura {receipt.folio}</h2>
            <dl className="csm-totals mt-3">
              <div className="is-strong"><dt>Total</dt><dd>{formatMoney(receipt.total)}</dd></div>
              <div><dt>Método de pago</dt><dd>{receipt.payment?.label}</dd></div>
            </dl>
            <p className="mt-3 text-sm text-[var(--gray-700)]">Inventario actualizado en SICAR.</p>
            {receipt.accounting?.requested ? (
              <p className={`csm-alert mt-3 ${receipt.accounting?.queued ? "is-ok" : "is-warn"}`}>
                {receipt.accounting?.queued
                  ? "Retenciones y factura preparadas para el sistema contable."
                  : `Compra registrada; complemento contable pendiente: ${receipt.accounting?.error || "vuelve a intentarlo desde el servidor."}`}
              </p>
            ) : null}
            <div className="csm-dialog-actions">
              <button type="button" onClick={() => setReceipt(null)} className="csm-btn csm-btn-primary">Cerrar</button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );

  if (isPhone) {
    return (
      <>
        {fileInputs}
        <ProviderReceivingMobile
          ctx={{
            user,
            connection,
            connectionError,
            catalogSyncing,
            supplierCatalog,
            articleCatalog,
            supplierQuery,
            setSupplierQuery,
            suppliers,
            supplier,
            setSupplier,
            productQuery,
            setProductQuery,
            products,
            resultLimit: CATALOG_RESULT_LIMIT,
            items,
            setItems,
            updateItem,
            addProduct,
            openBultos,
            invoiceNumber,
            setInvoiceNumber,
            purchaseDate,
            setPurchaseDate,
            maxDate: localDate(),
            comment,
            setComment,
            retentionIrEnabled,
            retentionMunicipalEnabled,
            retentionIr2,
            retentionMunicipal1,
            setRetentionIr2,
            setRetentionMunicipal1,
            setRetentionIrEdited,
            setRetentionMunicipalEdited,
            toggleRetentionIr,
            toggleRetentionMunicipal,
            invoiceSupport,
            clearInvoiceSupport,
            takeInvoicePhoto,
            chooseInvoiceFile: () => invoiceSupportInputRef.current?.click(),
            cameraLoading,
            totals,
            retentionTotal,
            netTotal,
            formatMoney,
            drafts,
            editingDraftId,
            resetForm,
            savePendingReception,
            requestPaymentMethod,
            loading,
            message,
            setMessage,
            openConnectionDialog: () => setConnectionDialog(true),
            receipt,
            history,
          }}
        />
        {dialogs}
      </>
    );
  }

  return (
    <div className={`csm-page erp-operation-module provider-operation-module provider-form-shell min-w-0 max-w-full overflow-x-clip ${IS_HANDHELD ? "handheld-form handheld-provider-form space-y-3" : ""}`}>
      {fileInputs}
      <header className="csm-page-header handheld-provider-hero">
        <div className="min-w-0">
          <h2 className="csm-page-title">Recibir mercadería</h2>
          <div className="csm-page-meta">
            <span>{user}</span>
            <span aria-hidden="true">·</span>
            <span className={`csm-tag ${connectionTone}`}>{connectionLabel}</span>
            {articleCatalog.length > 0 ? (
              <span className="hidden md:inline">Catálogo local: {articleCatalog.length} productos · {supplierCatalog.length} proveedores</span>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <button type="button" onClick={() => setView("history")} className="csm-btn csm-btn-secondary">
            <Icon name="history" size={18} />
            Recepciones
            {drafts.length > 0 ? <span className="csm-count is-warn" aria-label={`${drafts.length} en espera`}>{drafts.length}</span> : null}
          </button>
          <button type="button" onClick={() => setConnectionDialog(true)} className="csm-icon-btn" aria-label="Conexión con SICAR" title="Conexión con SICAR">
            <Icon name="settings" />
          </button>
        </div>
      </header>

      {editingDraftId ? (
        <div className="csm-alert is-warn">
          <span className="min-w-0 flex-1">Editando una recepción en espera. Complétala y envíala a SICAR.</span>
          <button type="button" onClick={() => resetForm()} className="csm-btn csm-btn-ghost csm-btn-sm">Cancelar edición</button>
        </div>
      ) : null}

      {connectionError ? (
        <div className={`csm-alert ${articleCatalog.length > 0 ? "is-warn" : "is-err"}`}>
          <span>
            {connectionError}
            {articleCatalog.length > 0 ? " Puedes continuar con el catálogo local y usar Recibir sin factura." : ""}
          </span>
        </div>
      ) : null}

      {message ? (
        <div className={`csm-alert ${message.type === "error" ? "is-err" : "is-ok"}`} role={message.type === "error" ? "alert" : "status"}>
          {message.text}
        </div>
      ) : null}

      {catalogSyncing || connection === "checking" ? (
        <div className="erp-loading-strip" role="status" aria-live="polite">
          <span className="erp-loading-spinner" aria-hidden="true" />
          <span>{catalogSyncing ? "Actualizando catálogo SICAR" : "Verificando conexión local"}</span>
          <span className="erp-loading-track" aria-hidden="true"><span /></span>
        </div>
      ) : null}

      <section className={`csm-panel erp-form-panel handheld-reception-panel app-panel relative min-w-0 max-w-full overflow-visible ${supplierOpen ? "z-50" : "z-20"}`} aria-labelledby="rcv-document-title">
        {IS_HANDHELD ? (
          <button
            type="button"
            onClick={() => setHandheldDetailsOpen((open) => !open)}
            className="handheld-reception-toggle"
          >
            <span className="min-w-0 text-left">
              <span className="block text-[8px] font-black uppercase tracking-[0.14em] text-slate-400">Datos de recepcion</span>
              <span className="block truncate text-xs font-black text-slate-900">{supplier?.nombre || "Selecciona proveedor"}</span>
            </span>
            <span className="shrink-0 text-[10px] font-black text-lime-700">{handheldDetailsOpen ? "Ocultar" : "Editar"}</span>
          </button>
        ) : (
          <h3 id="rcv-document-title" className="csm-section-title">Documento</h3>
        )}
        <div className={`${IS_HANDHELD && !handheldDetailsOpen ? "hidden" : ""} handheld-reception-fields csm-doc-grid`}>
          <div ref={supplierPickerRef} className="csm-doc-supplier relative min-w-0">
            <label className="app-label" htmlFor="rcv-supplier">Proveedor</label>
            <input
              id="rcv-supplier"
              value={supplierOpen ? supplierQuery : supplier?.nombre || supplierQuery}
              onChange={(event) => {
                setSupplierQuery(event.target.value);
                setSupplier(null);
                setSupplierOpen(true);
              }}
              onFocus={() => setSupplierOpen(true)}
              className="app-input"
              placeholder="Buscar proveedor"
              disabled={supplierCatalog.length === 0}
              role="combobox"
              aria-expanded={supplierOpen}
              aria-controls="rcv-supplier-list"
              autoComplete="off"
            />
            {supplier && !supplierOpen && `${supplier.nombre || ""}`.length > 36 ? (
              <p className="csm-hint mt-1 font-medium text-[var(--gray-700)]">{supplier.nombre}</p>
            ) : null}
            {supplierOpen ? (
              <div id="rcv-supplier-list" className="csm-dropdown" role="listbox">
                <div className="csm-dropdown-head">
                  <span>{suppliers.length} resultados</span>
                  <button type="button" onClick={() => setSupplierOpen(false)} className="csm-btn csm-btn-ghost csm-btn-sm">Cerrar</button>
                </div>
                {suppliers.map((row) => (
                  <button
                    key={row.pro_id}
                    type="button"
                    role="option"
                    aria-selected={Number(supplier?.pro_id) === Number(row.pro_id)}
                    onClick={() => {
                      setSupplier(row);
                      setSupplierQuery("");
                      setSupplierOpen(false);
                    }}
                    className="csm-dropdown-row"
                  >
                    <span className="csm-list-title">{row.nombre}</span>
                    {row.alias || row.rfc ? <span className="csm-list-meta">{[row.alias, row.rfc].filter(Boolean).join(" · ")}</span> : null}
                  </button>
                ))}
                {suppliers.length === 0 ? (
                  <div className="csm-empty">
                    {supplierCatalog.length === 0 ? "Conecta una vez con SICAR para descargar proveedores" : "Sin coincidencias"}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
          <div className="min-w-0">
            <label className="app-label" htmlFor="provider-invoice-number">
              Número de factura <span className="csm-required">obligatorio para SICAR</span>
            </label>
            <input
              ref={invoiceNumberInputRef}
              id="provider-invoice-number"
              value={invoiceNumber}
              onChange={(event) => setInvoiceNumber(event.target.value.toUpperCase())}
              className="app-input uppercase"
              maxLength={19}
              aria-required="true"
              autoComplete="off"
            />
          </div>
          <div className="provider-purchase-date min-w-0">
            <label className="app-label" htmlFor="provider-purchase-date">Fecha de factura</label>
            <input
              id="provider-purchase-date"
              type="date"
              value={purchaseDate}
              max={localDate()}
              onChange={(event) => setPurchaseDate(event.target.value)}
              className="app-input"
              required
              aria-required="true"
            />
          </div>
          <div className="min-w-0">
            <label className="app-label" htmlFor="provider-note">Nota <span className="csm-optional">opcional</span></label>
            <input
              id="provider-note"
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              className="app-input"
              maxLength={180}
            />
          </div>
          {IS_HANDHELD ? (
            <button
              type="button"
              onClick={() => {
                if (!supplier) {
                  setMessage({ type: "error", text: "Selecciona el proveedor antes de capturar productos." });
                  return;
                }
                setMessage(null);
                setHandheldDetailsOpen(false);
                setHandheldCaptureMode("scan");
                focusHandheldScanner();
              }}
              className="handheld-start-capture"
            >
              {Icons.scan}
              Capturar productos
            </button>
          ) : null}
        </div>
      </section>

      <section className={`csm-panel erp-products-panel handheld-provider-products app-panel relative min-w-0 max-w-full overflow-visible ${productOpen ? (IS_HANDHELD ? "handheld-provider-products-search-open z-[110]" : "z-40") : "z-10"}`} aria-labelledby="rcv-items-title">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 id="rcv-items-title" className="csm-section-title mb-0">
            {IS_HANDHELD ? "Captura" : "Artículos"} <span className="csm-count">{totals.lines}</span>
          </h3>
          {IS_HANDHELD ? (
            <button
              type="button"
              onClick={() => {
                const nextMode = handheldCaptureMode === "scan" ? "search" : "scan";
                setHandheldCaptureMode(nextMode);
                setProductOpen(nextMode === "search");
                requestAnimationFrame(() => {
                  if (nextMode === "scan") handheldScanInputRef.current?.focus();
                  else productSearchRef.current?.focus();
                });
              }}
              disabled={articleCatalog.length === 0}
              className="erp-primary-action handheld-capture-mode inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#76b900] px-4 text-sm font-black text-[#101807] disabled:opacity-40"
            >
              {handheldCaptureMode === "scan" ? Icons.search : Icons.scan}
              {handheldCaptureMode === "scan" ? "Buscar" : "Escanear"}
            </button>
          ) : null}
        </div>

        {IS_HANDHELD && handheldCaptureMode === "scan" ? (
          <div className="handheld-scan-workspace">
            <form onSubmit={handleHandheldScan} className="handheld-scan-form">
              <span className="handheld-scan-icon">{Icons.scan}</span>
              <input
                ref={handheldScanInputRef}
                value={handheldScanCode}
                onChange={(event) => {
                  setHandheldScanCode(event.target.value);
                  setHandheldScanError("");
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") handleHandheldScan(event, event.currentTarget.value);
                }}
                inputMode="none"
                enterKeyHint="next"
                autoCapitalize="none"
                autoCorrect="off"
                autoComplete="off"
                className="handheld-scan-input"
                placeholder="Escanear clave"
                disabled={articleCatalog.length === 0 || Boolean(handheldScanProduct)}
              />
              <button type="submit" className="handheld-scan-confirm">Leer</button>
            </form>
            {handheldScanError && !handheldScanProduct ? <div className="handheld-scan-error">{handheldScanError}</div> : null}
          </div>
        ) : null}

        {!IS_HANDHELD || handheldCaptureMode === "search" ? (
          <div ref={productPickerRef} className="relative mt-3 min-w-0 max-w-full">
            <label className="app-label" htmlFor="rcv-product-search">Agregar artículo</label>
            <div className="csm-search">
              <Icon name="search" size={18} />
              <input
                id="rcv-product-search"
                ref={productSearchRef}
                value={productQuery}
                onChange={(event) => {
                  setProductQuery(event.target.value);
                  setProductOpen(true);
                }}
                onFocus={() => setProductOpen(true)}
                className="app-input"
                placeholder="Nombre o clave del producto"
                disabled={articleCatalog.length === 0}
                role="combobox"
                aria-expanded={productOpen}
                aria-controls="rcv-product-list"
                autoComplete="off"
              />
            </div>
            {productOpen ? (
              <div id="rcv-product-list" className="csm-dropdown handheld-provider-product-dropdown" role="listbox">
                <div className="csm-dropdown-head">
                  <span>{products.length}{products.length >= CATALOG_RESULT_LIMIT ? "+" : ""} resultados</span>
                  <button type="button" onClick={() => setProductOpen(false)} className="csm-btn csm-btn-ghost csm-btn-sm">Cerrar</button>
                </div>
                {products.map((product) => (
                  <button
                    key={product.art_id}
                    type="button"
                    role="option"
                    aria-selected={addedArticleIds.has(Number(product.art_id))}
                    onClick={() => addProduct(product)}
                    className="csm-dropdown-row csm-dropdown-product"
                  >
                    <ProductIdentity article={product} size="md" />
                    <span className="csm-dropdown-aside">
                      <span className="csm-figure-value" title="Último costo sin IVA">{formatMoney(product.lastPurchaseNet ?? product.precioCompra)}</span>
                      {addedArticleIds.has(Number(product.art_id)) ? <span className="csm-tag is-ok">Agregado</span> : null}
                    </span>
                  </button>
                ))}
                {products.length === 0 ? (
                  <div className="csm-empty">
                    {articleCatalog.length === 0 ? "Conecta una vez con SICAR para descargar productos" : "Sin coincidencias"}
                  </div>
                ) : null}
                {products.length >= CATALOG_RESULT_LIMIT ? <div className="csm-hint px-3 pb-2">Hay más coincidencias. Escribe más para precisar.</div> : null}
              </div>
            ) : null}
          </div>
        ) : null}

        {IS_HANDHELD && handheldScanProduct ? (
          <div className="handheld-scan-workspace handheld-quantity-workspace">
            <div className="handheld-scanned-product">
              <div className="handheld-scanned-product-name">
                <span>{handheldScanProduct.clave}</span>
                <strong>{handheldScanProduct.descripcion}</strong>
              </div>
              <TouchNumericInput
                ref={handheldScanQuantityRef}
                value={handheldScanQuantity}
                onValueChange={(value) => {
                  setHandheldScanQuantity(value);
                  setHandheldScanBultos([]);
                }}
                onConfirmValue={addHandheldScannedProduct}
                onOpenBultos={openHandheldScanBultos}
                bultosCount={handheldScanBultos.length}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addHandheldScannedProduct();
                  }
                }}
                label={`Cantidad ${handheldScanProduct.descripcion}`}
                decimals={4}
                placeholder="Cant."
                enterKeyHint="done"
                className="handheld-scan-quantity"
              />
              <button type="button" onClick={() => addHandheldScannedProduct()} className="handheld-add-scanned">
                {Icons.plus}
                Agregar
              </button>
            </div>
            {handheldScanError ? <div className="handheld-scan-error">{handheldScanError}</div> : null}
          </div>
        ) : null}

        {items.length > 0 && IS_HANDHELD ? (
          <div className="handheld-provider-items mt-3 overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="provider-items-header grid grid-cols-[minmax(64px,1fr)_64px_32px_52px_66px_28px] items-center gap-0.5 border-b border-slate-200 bg-slate-50 px-1.5 py-2 text-[7px] font-black uppercase tracking-[0.08em] text-slate-400">
              <span>Producto</span>
              <span className="text-center">Cant.</span>
              <span className="text-center">Bultos</span>
              <span className="text-center">P. sin IVA</span>
              <span className="text-right">Subtotal</span>
              <span />
            </div>
            <div className="provider-items-list max-h-[min(52vh,560px)] divide-y divide-slate-100 overflow-y-auto overscroll-auto">
              {items.map((item) => (
                <div key={item.art_id} className="provider-item-row grid min-h-12 grid-cols-[minmax(64px,1fr)_64px_32px_52px_66px_28px] items-center gap-0.5 px-1.5 py-1.5">
                  <div className="provider-item-product flex min-w-0 items-center gap-2">
                    <span className="min-w-0 break-words text-xs font-black leading-tight text-slate-900">{item.descripcion}</span>
                  </div>
                  <TouchNumericInput
                    ref={(element) => {
                      if (element) quantityRefs.current.set(Number(item.art_id), element);
                      else quantityRefs.current.delete(Number(item.art_id));
                    }}
                    value={item.quantity}
                    onValueChange={(value) => updateItem(item.art_id, "quantity", value)}
                    onConfirmValue={openProductSearch}
                    label={`Cantidad ${item.descripcion}`}
                    decimals={4}
                    placeholder="0"
                    className="provider-item-quantity app-input h-10 !min-h-10 rounded-lg px-2 text-center text-[13px] font-black"
                  />
                  <button
                    type="button"
                    onClick={() => openBultos(item.art_id)}
                    className={`provider-item-bultos flex h-8 items-center justify-center gap-0.5 rounded-md border px-0.5 text-[8px] font-black ${item.bultos?.length ? "border-lime-300 bg-lime-50 text-lime-800" : "border-slate-200 bg-white text-slate-500"}`}
                    aria-label={`Suma de bultos de ${item.descripcion}`}
                  >
                    {Icons.scale}
                    <span>{item.bultos?.length || "+"}</span>
                  </button>
                  <TouchNumericInput
                    value={item.netUnitPrice}
                    onValueChange={(value) => updateItem(item.art_id, "netUnitPrice", value)}
                    label={`Precio sin IVA ${item.descripcion}`}
                    decimals={2}
                    placeholder="0.00"
                    className="provider-item-price app-input h-9 !min-h-9 rounded-lg px-1 text-center text-[10px] font-black text-[#4d7c0f]"
                  />
                  <div className="provider-item-subtotal truncate text-right text-[10px] font-black text-slate-900">
                    {formatMoney(roundMoney(Number(item.quantity || 0) * Number(item.netUnitPrice || 0)))}
                  </div>
                  <button
                    type="button"
                    onClick={() => setItems((current) => current.filter((row) => row.art_id !== item.art_id))}
                    className="provider-item-delete flex h-8 w-8 items-center justify-center rounded-lg text-rose-500 hover:bg-rose-50"
                    aria-label={`Quitar ${item.descripcion}`}
                  >
                    {Icons.trash}
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {items.length > 0 && !IS_HANDHELD ? (
          <div className="csm-table-wrap mt-3">
            <table className="csm-table rcv-table">
              <caption className="sr-only">Artículos de la recepción</caption>
              <colgroup>
                <col className="rcv-col-index" />
                <col className="rcv-col-product" />
                <col className="rcv-col-qty" />
                <col className="rcv-col-cost" />
                <col className="rcv-col-subtotal" />
                <col className="rcv-col-action" />
              </colgroup>
              <thead>
                <tr>
                  <th scope="col" className="is-num">#</th>
                  <th scope="col">Producto</th>
                  <th scope="col">Cantidad recibida</th>
                  <th scope="col" className="is-num">Costo s/IVA</th>
                  <th scope="col" className="is-num">Subtotal</th>
                  <th scope="col"><span className="sr-only">Acciones</span></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => {
                  const unit = articleUnit(item);
                  const hasQuantity = Number(item.quantity) > 0;
                  return (
                    <tr key={item.art_id} className={hasQuantity ? "" : "is-incomplete"}>
                      <td className="is-num text-[var(--gray-500)]">{items.length - index}</td>
                      <th scope="row" className="rcv-product-cell">
                        <ProductIdentity article={item} size="md" />
                      </th>
                      <td>
                        <div className="rcv-qty">
                          <TouchNumericInput
                            ref={(element) => {
                              if (element) quantityRefs.current.set(Number(item.art_id), element);
                              else quantityRefs.current.delete(Number(item.art_id));
                            }}
                            value={item.quantity}
                            onValueChange={(value) => updateItem(item.art_id, "quantity", value)}
                            onConfirmValue={openProductSearch}
                            onOpenBultos={() => openBultos(item.art_id)}
                            bultosCount={item.bultos?.length || 0}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                event.preventDefault();
                                openProductSearch();
                              }
                            }}
                            label={`Cantidad recibida · ${item.descripcion}`}
                            decimals={4}
                            placeholder="0"
                            className="app-input csm-num"
                          />
                          <span className="rcv-unit">{unit}</span>
                          <button
                            type="button"
                            onClick={() => openBultos(item.art_id)}
                            className={`csm-icon-btn rcv-bultos ${item.bultos?.length ? "is-set" : ""}`}
                            aria-label={`Sumar bultos de ${item.descripcion}${item.bultos?.length ? ` (${item.bultos.length} registrados)` : ""}`}
                            title="Sumar bultos"
                          >
                            <Icon name="scale" size={17} />
                            {item.bultos?.length ? <span>{item.bultos.length}</span> : null}
                          </button>
                        </div>
                        {!hasQuantity ? <div className="rcv-flag">Falta cantidad</div> : null}
                      </td>
                      <td className="is-num">
                        <TouchNumericInput
                          value={item.netUnitPrice}
                          onValueChange={(value) => updateItem(item.art_id, "netUnitPrice", value)}
                          label={`Costo sin IVA · ${item.descripcion}`}
                          decimals={2}
                          placeholder="0.00"
                          className="app-input csm-num"
                        />
                      </td>
                      <td className="is-num font-semibold">{formatMoney(roundMoney(Number(item.quantity || 0) * Number(item.netUnitPrice || 0)))}</td>
                      <td className="is-action">
                        <button
                          type="button"
                          onClick={() => setItems((current) => current.filter((row) => row.art_id !== item.art_id))}
                          className="csm-icon-btn is-ghost text-[var(--gray-500)] hover:text-[var(--err)]"
                          aria-label={`Quitar ${item.descripcion}`}
                          title="Quitar"
                        >
                          <Icon name="trash" size={18} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}

        {items.length === 0 && !IS_HANDHELD ? (
          <div className="csm-empty mt-3">Sin artículos. Busca por nombre o clave para agregar el primero.</div>
        ) : null}
      </section>

      {!IS_HANDHELD || handheldDetailsOpen ? (
        <section className="csm-panel erp-form-panel handheld-accounting-panel app-panel min-w-0 max-w-full" aria-labelledby="rcv-accounting-title">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 id="rcv-accounting-title" className="csm-section-title mb-0">
              Datos contables <span className="csm-optional">opcional · no se guardan en SICAR</span>
            </h3>
            <span className="text-sm text-[var(--gray-600)]">Base {formatMoney(totals.subtotal)}</span>
          </div>
          <div className="csm-accounting-grid mt-3">
            <div className="csm-check-row">
              <label className="csm-check">
                <input type="checkbox" checked={retentionIrEnabled} onChange={toggleRetentionIr} />
                <span>Retención IR 2%</span>
              </label>
              {retentionIrEnabled ? (
                <TouchNumericInput
                  value={retentionIr2}
                  onValueChange={(value) => {
                    setRetentionIr2(value);
                    setRetentionIrEdited(true);
                  }}
                  label="Monto retención IR 2%"
                  decimals={2}
                  placeholder="0.00"
                  className="app-input csm-num w-32"
                />
              ) : null}
            </div>
            <div className="csm-check-row">
              <label className="csm-check">
                <input type="checkbox" checked={retentionMunicipalEnabled} onChange={toggleRetentionMunicipal} />
                <span>Retención municipal 1%</span>
              </label>
              {retentionMunicipalEnabled ? (
                <TouchNumericInput
                  value={retentionMunicipal1}
                  onValueChange={(value) => {
                    setRetentionMunicipal1(value);
                    setRetentionMunicipalEdited(true);
                  }}
                  label="Monto retención municipal 1%"
                  decimals={2}
                  placeholder="0.00"
                  className="app-input csm-num w-32"
                />
              ) : null}
            </div>
            <div className="csm-check-row">
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">Foto de factura</span>
                <span className="block break-all text-xs text-[var(--gray-500)]">{invoiceSupport?.name || "Sin foto"}</span>
              </span>
              <div className="flex shrink-0 gap-1.5">
                <button type="button" onClick={takeInvoicePhoto} disabled={cameraLoading} className="csm-btn csm-btn-secondary csm-btn-sm">
                  {cameraLoading ? "Abriendo..." : "Tomar foto"}
                </button>
                <button type="button" onClick={() => invoiceSupportInputRef.current?.click()} className="csm-btn csm-btn-secondary csm-btn-sm">
                  Archivo
                </button>
                {invoiceSupport ? (
                  <button type="button" onClick={clearInvoiceSupport} className="csm-btn csm-btn-ghost csm-btn-sm text-[var(--err)]">Quitar</button>
                ) : null}
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <div className={`csm-command-bar handheld-provider-actions ${IS_HANDHELD && productOpen ? "handheld-provider-actions-search-open" : ""}`}>
        <dl className="csm-command-totals">
          <div><dt>Artículos</dt><dd>{totals.lines}</dd></div>
          <div><dt>Subtotal</dt><dd>{formatMoney(totals.subtotal)}</dd></div>
          <div className="is-strong"><dt>Total con IVA</dt><dd>{formatMoney(totals.gross)}</dd></div>
          {retentionTotal > 0 ? <div><dt>Neto a pagar</dt><dd>{formatMoney(netTotal)}</dd></div> : null}
        </dl>
        <div className="csm-command-actions">
          <button type="button" onClick={savePendingReception} disabled={loading} className="csm-btn csm-btn-secondary csm-btn-lg">
            {loading ? "Guardando..." : "Recibir sin factura"}
          </button>
          <button
            type="button"
            onClick={requestPaymentMethod}
            disabled={loading || connection !== "online"}
            className="csm-btn csm-btn-primary csm-btn-lg"
            title={connection !== "online" ? "SICAR sin conexión" : undefined}
          >
            {loading ? "Validando..." : "Recibir en SICAR"}
          </button>
        </div>
      </div>

      {dialogs}
    </div>
  );
}
