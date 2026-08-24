"use client";

import React, { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";
import { Capacitor } from "@capacitor/core";
import { IS_HANDHELD } from "@/lib/deviceProfile";
import ProviderPurchaseHistory from "./ProviderPurchaseHistory";
import TouchNumericInput from "./TouchNumericInput";
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
const CATALOG_RESULT_LIMIT = IS_HANDHELD ? 8 : 80;
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

  return (
    <div className="app-modal z-[110] px-4" role="dialog" aria-modal="true">
      <div className="app-modal-panel w-full max-w-lg p-5 sm:p-6">
        <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Conexion local</div>
        <h2 className="mt-1 text-xl font-black text-slate-950">Servidor SICAR</h2>
        <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
          En la web usa la direccion HTTPS privada de Tailscale. En la app instalada tambien puedes usar la IP local del servidor.
        </p>
        <label className="app-label mt-5">Direccion</label>
        <input
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          className="app-input"
          placeholder="https://servidor.tailnet.ts.net:8445"
          autoCapitalize="none"
          autoCorrect="off"
        />
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
    setArticleCatalog(Array.isArray(catalog.articles) ? catalog.articles : []);
    setCatalogUpdatedAt(catalog.updatedAt || "");
  };

  const synchronizeCatalog = async ({ showMessage = false } = {}) => {
    setCatalogSyncing(true);
    try {
      const result = await getSicarOfflineCatalog();
      const catalog = {
        updatedAt: result.generatedAt || new Date().toISOString(),
        suppliers: result.suppliers || [],
        articles: result.articles || [],
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
      return;
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
      setView("history");
      setMessage(null);
    } catch (error) {
      setMessage({ type: "error", text: `No se pudo guardar la recepcion local: ${error.message}` });
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

  if (view === "history") {
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

  return (
    <div className={`provider-form-shell min-w-0 max-w-full space-y-4 overflow-x-clip ${IS_HANDHELD ? "handheld-form handheld-provider-form" : ""}`}>
      <section className="handheld-provider-hero min-w-0 max-w-full overflow-hidden rounded-[1.7rem] border border-[#3f6212] bg-[radial-gradient(circle_at_88%_8%,rgba(118,185,0,0.3),transparent_20rem),linear-gradient(135deg,#0b1408_0%,#17250e_58%,#223914_100%)] p-5 text-white shadow-[0_24px_60px_-38px_rgba(20,40,8,0.9)] sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex h-16 w-28 shrink-0 items-center justify-center rounded-2xl bg-white px-3 shadow-lg sm:h-20 sm:w-36">
              <div
                role="img"
                aria-label="Carnes San Martin"
                className="h-full w-full bg-contain bg-center bg-no-repeat"
                style={{ backgroundImage: 'url("./csm-logo.svg")' }}
              />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-black uppercase tracking-[0.22em] text-lime-300">Proveedores externos</div>
              <h2 className="mt-1 text-2xl font-black sm:text-3xl">Recibir mercaderia</h2>
              <p className="mt-1 max-w-2xl text-sm font-semibold text-slate-300">Factura de compra e inventario SICAR.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setView("history")}
              className="flex min-h-11 items-center gap-2 rounded-xl bg-[#76b900] px-4 text-sm font-black text-[#101807]"
            >
              {Icons.invoice}
              Historial
              {drafts.length > 0 ? <span className="rounded-full bg-amber-300 px-2 py-0.5 text-[10px] text-amber-950">{drafts.length}</span> : null}
            </button>
            <button
              type="button"
              onClick={() => setConnectionDialog(true)}
              className="flex min-h-11 items-center gap-2 rounded-xl border border-lime-300/25 bg-white/10 px-4 text-sm font-black text-white"
            >
              {Icons.settings}
              SICAR
            </button>
          </div>
        </div>
        {editingDraftId ? (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-amber-300/40 bg-amber-300/10 px-4 py-3">
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.14em] text-amber-300">Recepcion en espera</div>
              <div className="mt-0.5 text-sm font-black text-white">Editando antes de enviarla a SICAR</div>
            </div>
            <button type="button" onClick={() => resetForm()} className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-xs font-black text-white">
              Cancelar edicion
            </button>
          </div>
        ) : null}
        <div className="handheld-provider-status mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/7 p-4">
            <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Sucursal</div>
            <div className="mt-1 font-black">{user}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/7 p-4">
            <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Fecha</div>
            <div className="mt-1 font-black">{purchaseDate}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/7 p-4">
            <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Conexion local</div>
            <div className={`mt-1 font-black ${connection === "online" ? "text-emerald-300" : connection === "checking" ? "text-amber-300" : "text-rose-300"}`}>
              {catalogSyncing ? "Actualizando catalogo..." : connection === "online" ? "SICAR disponible" : connection === "checking" ? "Verificando..." : "Sin conexion"}
            </div>
            {articleCatalog.length > 0 ? (
              <div className="mt-1 text-[10px] font-bold text-lime-200">
                {articleCatalog.length} productos y {supplierCatalog.length} proveedores disponibles sin conexion
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {connectionError ? (
        <div className={`rounded-2xl border px-4 py-3 text-sm font-bold ${articleCatalog.length > 0 ? "border-amber-200 bg-amber-50 text-amber-800" : "border-rose-200 bg-rose-50 text-rose-700"}`}>
          {connectionError}
          {articleCatalog.length > 0 ? " Puedes continuar buscando en el catalogo local y guardar Recibir sin factura." : ""}
        </div>
      ) : null}

      {message ? (
        <div className={`rounded-2xl border px-4 py-3 text-sm font-bold ${message.type === "error" ? "border-rose-200 bg-rose-50 text-rose-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
          {message.text}
        </div>
      ) : null}

      <section className={`handheld-reception-panel app-panel relative min-w-0 max-w-full overflow-visible p-4 sm:p-5 ${supplierOpen ? "z-50" : "z-20"}`}>
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
        ) : null}
        <div className={`${IS_HANDHELD && !handheldDetailsOpen ? "hidden" : ""} handheld-reception-fields grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,0.75fr)_minmax(0,0.72fr)_minmax(0,1fr)]`}>
          <div ref={supplierPickerRef} className="relative min-w-0">
            <label className="app-label">Proveedor</label>
            <div className="relative">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">{Icons.supplier}</span>
              <input
                value={supplierOpen ? supplierQuery : supplier?.nombre || supplierQuery}
                onChange={(event) => {
                  setSupplierQuery(event.target.value);
                  setSupplier(null);
                  setSupplierOpen(true);
                }}
                onFocus={() => setSupplierOpen(true)}
                className="app-input pl-12"
                placeholder="Buscar proveedor"
                disabled={supplierCatalog.length === 0}
              />
            </div>
            {supplierOpen ? (
              <div className="absolute inset-x-0 top-full z-[60] mt-2 max-h-[min(18rem,calc(100vh-10rem))] max-w-full overflow-y-auto overflow-x-hidden overscroll-contain rounded-2xl border border-slate-200 bg-white p-2 shadow-[0_24px_60px_-24px_rgba(15,23,42,0.45)]">
                {suppliers.map((row) => (
                  <button
                    key={row.pro_id}
                    type="button"
                    onClick={() => {
                      setSupplier(row);
                      setSupplierQuery("");
                      setSupplierOpen(false);
                    }}
                    className="mb-1 w-full min-w-0 break-words rounded-xl px-4 py-3 text-left text-sm font-bold text-slate-700 hover:bg-lime-50"
                  >
                    {row.nombre}
                  </button>
                ))}
                {suppliers.length === 0 ? (
                  <div className="p-4 text-center text-sm text-slate-400">
                    {supplierCatalog.length === 0 ? "Conecta una vez con SICAR para descargar proveedores" : "Sin coincidencias"}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
          <div className="min-w-0">
            <label className="app-label" htmlFor="provider-invoice-number">
              Numero de factura <span className="text-rose-600">*</span>
            </label>
            <input
              ref={invoiceNumberInputRef}
              id="provider-invoice-number"
              value={invoiceNumber}
              onChange={(event) => setInvoiceNumber(event.target.value.toUpperCase())}
              className="app-input uppercase"
              placeholder="Obligatorio para SICAR"
              maxLength={19}
              required
              aria-required="true"
            />
          </div>
          <div className="provider-purchase-date min-w-0">
            <label className="app-label" htmlFor="provider-purchase-date">
              Fecha de factura <span className="text-rose-600">*</span>
            </label>
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
            <label className="app-label">Nota</label>
            <input
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              className="app-input"
              placeholder="Opcional"
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

      {!IS_HANDHELD || handheldDetailsOpen ? (
      <section className="handheld-accounting-panel app-panel min-w-0 max-w-full border-lime-200 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-base font-black text-slate-950">Datos contables <span className="text-xs text-slate-400">Opcional</span></div>
            <div className="mt-1 text-xs font-semibold text-slate-500">No se guardan en SICAR.</div>
          </div>
          <div className="rounded-full bg-lime-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-lime-700">
            Base {formatMoney(totals.subtotal)}
          </div>
        </div>

        <div className="mt-3 grid gap-2 lg:grid-cols-[1fr_1fr_1.2fr]">
          <div className={`rounded-xl border p-2.5 ${retentionIrEnabled ? "border-lime-300 bg-lime-50" : "border-slate-200 bg-white"}`}>
            <button type="button" onClick={toggleRetentionIr} className="flex min-h-9 w-full items-center justify-between gap-2 text-left">
              <span className="text-xs font-black text-slate-800">Retencion IR 2%</span>
              <span className={`flex h-6 w-6 items-center justify-center rounded-full ${retentionIrEnabled ? "bg-[#76b900] text-[#101807]" : "bg-slate-100 text-slate-400"}`}>
                {retentionIrEnabled ? Icons.check : Icons.plus}
              </span>
            </button>
            {retentionIrEnabled ? (
              <TouchNumericInput
                value={retentionIr2}
                onValueChange={(value) => {
                  setRetentionIr2(value);
                  setRetentionIrEdited(true);
                }}
                label="Monto retencion IR 2%"
                decimals={2}
                placeholder="0.00"
                className="app-input mt-2 h-10 !min-h-10 rounded-lg text-right text-sm font-black text-lime-800"
              />
            ) : null}
          </div>

          <div className={`rounded-xl border p-2.5 ${retentionMunicipalEnabled ? "border-lime-300 bg-lime-50" : "border-slate-200 bg-white"}`}>
            <button type="button" onClick={toggleRetentionMunicipal} className="flex min-h-9 w-full items-center justify-between gap-2 text-left">
              <span className="text-xs font-black text-slate-800">Retencion municipal 1%</span>
              <span className={`flex h-6 w-6 items-center justify-center rounded-full ${retentionMunicipalEnabled ? "bg-[#76b900] text-[#101807]" : "bg-slate-100 text-slate-400"}`}>
                {retentionMunicipalEnabled ? Icons.check : Icons.plus}
              </span>
            </button>
            {retentionMunicipalEnabled ? (
              <TouchNumericInput
                value={retentionMunicipal1}
                onValueChange={(value) => {
                  setRetentionMunicipal1(value);
                  setRetentionMunicipalEdited(true);
                }}
                label="Monto retencion municipal 1%"
                decimals={2}
                placeholder="0.00"
                className="app-input mt-2 h-10 !min-h-10 rounded-lg text-right text-sm font-black text-lime-800"
              />
            ) : null}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-2.5">
            <input
              ref={invoiceSupportInputRef}
              type="file"
              accept="image/*"
              onChange={(event) => selectInvoiceSupport(event.target.files?.[0])}
              className="hidden"
            />
            <input
              ref={invoiceCameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(event) => selectInvoiceSupport(event.target.files?.[0])}
              className="hidden"
            />
            <div className="flex min-h-9 w-full items-center gap-2 text-left">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">{Icons.invoice}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-black text-slate-800">Foto de factura</span>
                <span className="block truncate text-[10px] font-semibold text-slate-400">{invoiceSupport?.name || "Agregar foto opcional"}</span>
              </span>
              <span className="text-lime-700">{invoiceSupport ? Icons.check : Icons.plus}</span>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              <button type="button" onClick={takeInvoicePhoto} disabled={cameraLoading} className="min-h-9 rounded-lg bg-[#76b900] px-2 text-[10px] font-black text-[#101807] disabled:opacity-60">
                {cameraLoading ? "Abriendo..." : "Tomar foto"}
              </button>
              <button type="button" onClick={() => invoiceSupportInputRef.current?.click()} className="min-h-9 rounded-lg border border-slate-200 bg-slate-50 px-2 text-[10px] font-black text-slate-700">
                Elegir archivo
              </button>
            </div>
            {invoiceSupport ? (
              <button
                type="button"
                onClick={() => {
                  setInvoiceSupport(null);
                  if (invoiceSupportInputRef.current) invoiceSupportInputRef.current.value = "";
                  if (invoiceCameraInputRef.current) invoiceCameraInputRef.current.value = "";
                }}
                className="mt-1 w-full text-right text-[10px] font-black uppercase tracking-wider text-rose-500"
              >
                Quitar foto
              </button>
            ) : null}
          </div>
        </div>

        {retentionTotal > 0 ? (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-white">
            <span className="text-xs font-bold text-slate-300">Retenciones {formatMoney(retentionTotal)}</span>
            <span className="text-sm font-black">Neto a pagar {formatMoney(netTotal)}</span>
          </div>
        ) : null}
      </section>
      ) : null}

      <section className={`handheld-provider-products app-panel relative min-w-0 max-w-full overflow-visible border-lime-200 p-3 sm:p-4 ${productOpen ? (IS_HANDHELD ? "handheld-provider-products-search-open z-[110]" : "z-40") : "z-10"}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-lg font-black text-slate-950">{IS_HANDHELD ? "Captura" : "Productos"} <span className="text-[#5d9100]">{totals.lines}</span></div>
            <div className="text-xs font-bold text-slate-400">{IS_HANDHELD ? "Escanea clave y agrega cantidad" : "Hasta 100 lineas"}</div>
          </div>
          <button
            type="button"
            onClick={() => {
              if (IS_HANDHELD) {
                const nextMode = handheldCaptureMode === "scan" ? "search" : "scan";
                setHandheldCaptureMode(nextMode);
                setProductOpen(nextMode === "search");
                requestAnimationFrame(() => {
                  if (nextMode === "scan") handheldScanInputRef.current?.focus();
                  else productSearchRef.current?.focus();
                });
                return;
              }
              openProductSearch();
            }}
            disabled={articleCatalog.length === 0}
            className="handheld-capture-mode inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#76b900] px-4 text-sm font-black text-[#101807] shadow-[0_14px_28px_-18px_rgba(78,124,15,0.9)] disabled:opacity-40"
          >
            {IS_HANDHELD ? (handheldCaptureMode === "scan" ? Icons.search : Icons.scan) : Icons.plus}
            {IS_HANDHELD ? (handheldCaptureMode === "scan" ? "Buscar" : "Escanear") : "Agregar producto"}
          </button>
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
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#5d9100]">{Icons.search}</span>
          <input
            ref={productSearchRef}
            value={productQuery}
            onChange={(event) => {
              setProductQuery(event.target.value);
              setProductOpen(true);
            }}
            onFocus={() => setProductOpen(true)}
            className="app-input !min-h-12 border-lime-200 bg-lime-50/40 pl-11 text-base focus:border-[#76b900]"
            placeholder="Clave o nombre del producto"
            disabled={articleCatalog.length === 0}
          />
          {productOpen ? (
            <div className="handheld-provider-product-dropdown absolute inset-x-0 top-full z-[120] mt-2 max-h-[min(360px,55vh)] max-w-full overflow-y-auto overflow-x-hidden overscroll-contain rounded-2xl border border-lime-200 bg-white p-2 shadow-[0_24px_60px_-24px_rgba(30,50,12,0.45)]">
              {products.map((product) => (
                <button
                  key={product.art_id}
                  type="button"
                  onClick={() => addProduct(product)}
                  className="mb-1 grid min-h-11 w-full min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-xl px-3 py-2 text-left hover:bg-lime-50"
                >
                  <span className="rounded-lg bg-lime-100 px-2 py-1 font-mono text-[10px] font-black text-lime-800">{product.clave}</span>
                  <span className="min-w-0 truncate text-sm font-bold text-slate-800">{product.descripcion}</span>
                  <span className="shrink-0 text-right text-xs font-black text-[#4d7c0f]" title="Precio sin IVA">{formatMoney(product.lastPurchaseNet ?? product.precioCompra)}</span>
                </button>
              ))}
              {products.length === 0 ? (
                <div className="p-5 text-center text-sm text-slate-400">
                  {articleCatalog.length === 0 ? "Conecta una vez con SICAR para descargar productos" : "Sin coincidencias"}
                </div>
              ) : null}
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

        {items.length > 0 ? (
          <div className="handheld-provider-items mt-3 overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="provider-items-header grid grid-cols-[minmax(56px,1fr)_48px_38px_64px_72px_32px] items-center gap-0.5 border-b border-slate-200 bg-slate-50 px-1.5 py-2 text-[7px] font-black uppercase tracking-[0.08em] text-slate-400 sm:grid-cols-[minmax(160px,1fr)_76px_64px_104px_110px_36px] sm:gap-2 sm:px-3 sm:text-[9px]">
              <span>Producto</span>
              <span className="text-center">Cant.</span>
              <span className="text-center">Bultos</span>
              <span className="text-center">P. sin IVA</span>
              <span className="text-right">Subtotal</span>
              <span />
            </div>
            <div className="provider-items-list max-h-[min(52vh,560px)] divide-y divide-slate-100 overflow-y-auto overscroll-contain">
              {items.map((item) => (
                <div key={item.art_id} className="provider-item-row grid min-h-12 grid-cols-[minmax(56px,1fr)_48px_38px_64px_72px_32px] items-center gap-0.5 px-1.5 py-1.5 sm:grid-cols-[minmax(160px,1fr)_76px_64px_104px_110px_36px] sm:gap-2 sm:px-3">
                  <div className="provider-item-product flex min-w-0 items-center gap-2">
                    <span className="hidden shrink-0 rounded-md bg-lime-100 px-2 py-1 font-mono text-[9px] font-black text-lime-800 md:inline">{item.clave}</span>
                    <span className="min-w-0 truncate text-xs font-black text-slate-900 sm:text-sm" title={item.descripcion}>{item.descripcion}</span>
                  </div>
                  <TouchNumericInput
                    ref={(element) => {
                      if (element) quantityRefs.current.set(Number(item.art_id), element);
                      else quantityRefs.current.delete(Number(item.art_id));
                    }}
                    value={item.quantity}
                    onValueChange={(value) => updateItem(item.art_id, "quantity", value)}
                    onConfirmValue={openProductSearch}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        openProductSearch();
                      }
                    }}
                    label={`Cantidad ${item.descripcion}`}
                    decimals={4}
                    placeholder="0"
                    className="provider-item-quantity app-input h-10 !min-h-10 rounded-lg px-1 text-center text-xs font-black sm:px-2 sm:text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => openBultos(item.art_id)}
                    className={`provider-item-bultos flex h-10 items-center justify-center gap-1 rounded-lg border px-1 text-[9px] font-black ${item.bultos?.length ? "border-lime-300 bg-lime-50 text-lime-800" : "border-slate-200 bg-white text-slate-500"}`}
                    aria-label={`Suma de bultos de ${item.descripcion}`}
                  >
                    {Icons.scale}
                    <span className="hidden sm:inline">{item.bultos?.length || "+"}</span>
                    <span className="sm:hidden">{item.bultos?.length || "+"}</span>
                  </button>
                  <TouchNumericInput
                    value={item.netUnitPrice}
                    onValueChange={(value) => updateItem(item.art_id, "netUnitPrice", value)}
                    label={`Precio sin IVA ${item.descripcion}`}
                    decimals={2}
                    placeholder="0.00"
                    className="provider-item-price app-input h-10 !min-h-10 rounded-lg px-1 text-center text-[11px] font-black text-[#4d7c0f] sm:px-2 sm:text-sm"
                  />
                  <div className="provider-item-subtotal truncate text-right text-[10px] font-black text-slate-900 sm:text-sm" title="Cantidad por precio sin IVA">
                    {formatMoney(roundMoney(Number(item.quantity || 0) * Number(item.netUnitPrice || 0)))}
                  </div>
                  <button
                    type="button"
                    onClick={() => setItems((current) => current.filter((row) => row.art_id !== item.art_id))}
                    className="provider-item-delete flex h-8 w-8 items-center justify-center rounded-lg text-rose-500 hover:bg-rose-50 sm:h-9 sm:w-9"
                    aria-label={`Quitar ${item.descripcion}`}
                  >
                    {Icons.trash}
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <button type="button" onClick={openProductSearch} className="mt-3 flex min-h-24 w-full items-center justify-center gap-3 rounded-xl border border-dashed border-lime-300 bg-lime-50/40 text-sm font-black text-lime-800">
            {Icons.plus}
            Agregar el primer producto
          </button>
        )}
      </section>

      <div className={`handheld-provider-actions fixed inset-x-0 z-40 px-3 lg:bottom-4 lg:left-auto lg:right-5 lg:w-[560px] ${IS_HANDHELD && productOpen ? "handheld-provider-actions-search-open" : ""}`}>
        <div className="rounded-[1.4rem] border border-slate-700 bg-slate-950 p-3 text-white shadow-[0_24px_60px_-28px_rgba(2,6,23,0.85)]">
          <div className="flex items-center justify-between gap-3 px-2 pb-2">
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Total factura con IVA</div>
              <div className="mt-0.5 text-xl font-black sm:text-2xl">{formatMoney(totals.gross)}</div>
            </div>
            <div className="text-right">
              {retentionTotal > 0 ? <div className="text-[10px] font-bold text-lime-300">Neto {formatMoney(netTotal)}</div> : null}
              {editingDraftId ? <div className="mt-1 text-[9px] font-black uppercase tracking-wide text-amber-300">Pendiente abierto</div> : null}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={savePendingReception}
              disabled={loading}
              className="min-h-13 rounded-2xl border border-amber-300/60 bg-amber-300/10 px-3 text-xs font-black text-amber-200 disabled:cursor-not-allowed disabled:opacity-40 sm:text-sm"
            >
              {loading ? "Guardando..." : "Recibir sin factura"}
            </button>
            <button
              type="button"
              onClick={requestPaymentMethod}
              disabled={loading || connection !== "online"}
              className="min-h-13 rounded-2xl bg-[#76b900] px-3 text-xs font-black text-[#101807] disabled:cursor-not-allowed disabled:opacity-40 sm:text-sm"
            >
              {loading ? "Validando..." : "Recibir en SICAR"}
            </button>
          </div>
        </div>
      </div>

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
              onClick={(event) => {
                if (event.target === event.currentTarget) closeBultosAndReturn();
              }}
            >
              <div className="w-full max-w-md rounded-[1.5rem] border border-lime-200 bg-white p-4 shadow-[0_30px_80px_-24px_rgba(30,50,12,0.55)] sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[10px] font-black uppercase tracking-[0.16em] text-[#5d9100]">Suma de bultos</div>
                    <h3 className="mt-1 truncate text-lg font-black text-slate-950">{activeBultoItem?.descripcion}</h3>
                  </div>
                  <button type="button" onClick={closeBultosAndReturn} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-500" aria-label="Cerrar">
                    {Icons.close}
                  </button>
                </div>

                <div className="mt-3 grid grid-cols-[1fr_auto] items-center gap-3 rounded-2xl bg-lime-50 px-4 py-3">
                  <div>
                    <div className="text-[9px] font-black uppercase tracking-[0.14em] text-lime-700">Peso total</div>
                    <div className="mt-1 font-mono text-3xl font-black text-slate-950">{formatBultoWeight(bultosTotal)}</div>
                  </div>
                  <div className="rounded-full bg-white px-3 py-2 text-xs font-black text-lime-800">{bultosTemporal.length} bultos</div>
                </div>

                <div className="mt-3 grid grid-cols-[minmax(0,1fr)_46px] gap-2">
                  <input
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
                    className="app-input !min-h-12 border-lime-200 text-center font-mono text-xl font-black"
                    placeholder="Peso"
                  />
                  <button type="button" onClick={addBulto} className="flex min-h-12 items-center justify-center rounded-xl bg-[#76b900] text-[#101807]" aria-label="Agregar peso">
                    {Icons.plus}
                  </button>
                </div>
                <div className={`mt-2 min-h-5 text-xs font-bold ${bultoError ? "text-rose-600" : "text-slate-400"}`}>
                  {bultoError || "Peso + Enter para agregar otro."}
                </div>

                {bultosTemporal.length > 0 ? (
                  <div className="mt-2 max-h-44 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200">
                    {[...bultosTemporal].reverse().map((weight, reverseIndex) => {
                      const originalIndex = bultosTemporal.length - 1 - reverseIndex;
                      return (
                        <div key={`${originalIndex}-${weight}`} className="flex min-h-10 items-center justify-between gap-3 px-3 py-1.5">
                          <span className="text-xs font-bold text-slate-400">#{originalIndex + 1}</span>
                          <span className="ml-auto font-mono text-sm font-black text-slate-900">{formatBultoWeight(weight)}</span>
                          <button
                            type="button"
                            onClick={() => setBultosTemporal((current) => current.filter((_, index) => index !== originalIndex))}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-rose-500 hover:bg-rose-50"
                            aria-label={`Quitar bulto ${originalIndex + 1}`}
                          >
                            {Icons.trash}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : null}

                <div className="mt-4 grid grid-cols-[0.8fr_1.2fr] gap-2">
                  <button type="button" onClick={closeBultosAndReturn} className="app-button app-button-secondary">Cancelar</button>
                  <button type="button" onClick={finishBultos} className="min-h-12 rounded-xl bg-[#76b900] text-sm font-black text-[#101807]">Finalizar</button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}

      {paymentPromptOpen ? (
        <div className="app-modal z-[115] px-4" role="dialog" aria-modal="true" aria-labelledby="payment-method-title">
          <div className="app-modal-panel w-full max-w-xl p-5 sm:p-6">
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-lime-700">Antes de terminar</div>
            <h2 id="payment-method-title" className="mt-1 text-2xl font-black text-slate-950">Metodo de pago</h2>
            <p className="mt-2 text-sm font-semibold text-slate-500">Selecciona como debe quedar registrada la compra en SICAR.</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => openPreview("credit")}
                disabled={loading}
                className="min-h-32 rounded-[1.4rem] border-2 border-lime-200 bg-lime-50 p-5 text-left text-lime-950 transition hover:border-lime-500 hover:bg-lime-100 disabled:opacity-50"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#76b900] text-[#101807]">{Icons.credit}</span>
                <span className="mt-4 block text-lg font-black">Credito</span>
                <span className="mt-1 block text-xs font-bold leading-5 text-lime-700">Genera la cuenta por pagar al proveedor.</span>
              </button>
              <button
                type="button"
                onClick={() => openPreview("other")}
                disabled={loading}
                className="min-h-32 rounded-[1.4rem] border-2 border-slate-200 bg-slate-50 p-5 text-left text-slate-950 transition hover:border-slate-500 hover:bg-slate-100 disabled:opacity-50"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-800 text-white">{Icons.otherPayment}</span>
                <span className="mt-4 block text-lg font-black">Otro medio de pago</span>
                <span className="mt-1 block text-xs font-bold leading-5 text-slate-500">Conserva la clasificacion actual de SICAR.</span>
              </button>
            </div>
            <button
              type="button"
              onClick={() => setPaymentPromptOpen(false)}
              disabled={loading}
              className="app-button app-button-secondary mt-4 w-full"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : null}

      {preview ? (
        <div className="app-modal z-[110] px-4" role="dialog" aria-modal="true">
          <div className="app-modal-panel w-full max-w-xl p-5 sm:p-6">
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-lime-700">Confirmar recepcion</div>
            <h2 className="mt-1 text-2xl font-black text-slate-950">{preview.supplier?.nombre}</h2>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="text-[9px] font-black uppercase text-slate-400">Productos</div>
                <div className="mt-1 text-sm font-black sm:text-xl">{preview.summary?.lines}</div>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4 text-right">
                <div className="text-[9px] font-black uppercase text-slate-400">Subtotal sin IVA</div>
                <div className="mt-1 text-sm font-black text-slate-950 sm:text-xl">{formatMoney(preview.summary?.subtotal)}</div>
              </div>
              <div className="rounded-2xl bg-lime-50 p-4 text-right">
                <div className="text-[9px] font-black uppercase text-lime-700">Total factura</div>
                <div className="mt-1 text-sm font-black text-lime-950 sm:text-xl">{formatMoney(preview.summary?.total)}</div>
              </div>
            </div>
            {retentionTotal > 0 || invoiceSupport ? (
              <div className="mt-3 rounded-2xl border border-lime-200 bg-lime-50 p-4">
                <div className="text-[10px] font-black uppercase tracking-[0.14em] text-lime-700">Datos para contabilidad</div>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-sm font-bold text-slate-700">
                  <span>Retenciones {formatMoney(retentionTotal)}</span>
                  <span className="font-black text-slate-950">Neto {formatMoney(netTotal)}</span>
                </div>
                {invoiceSupport ? <div className="mt-1 truncate text-xs font-semibold text-lime-800">Factura: {invoiceSupport.name}</div> : null}
              </div>
            ) : null}
            <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-4">
              <div className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Metodo de pago</div>
              <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                <div className="text-base font-black text-slate-950">{preview.payment?.label}</div>
                {preview.payment?.method === "credit" ? (
                  <div className="rounded-full bg-lime-100 px-3 py-1 text-xs font-black text-lime-800">
                    Vence {preview.payment?.dueDate}
                  </div>
                ) : null}
              </div>
            </div>
            <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold leading-6 text-amber-800">
              SICAR recibira el total completo de la factura: subtotal mas IVA. Las retenciones no se envian a SICAR; se guardan solamente en el sistema contable.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => {
                  setPreview(null);
                  setPaymentMethod("");
                }}
                className="app-button app-button-secondary"
              >
                Revisar
              </button>
              <button type="button" onClick={receivePurchase} disabled={loading} className="app-button app-button-primary">
                {loading ? "Registrando..." : "Confirmar recepcion"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {receipt ? (
        <div className="app-modal z-[110] px-4" role="dialog" aria-modal="true">
          <div className="app-modal-panel w-full max-w-md p-6 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">{Icons.check}</div>
            <div className="mt-4 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700">Compra registrada</div>
            <h2 className="mt-1 text-2xl font-black text-slate-950">Folio {receipt.folio}</h2>
            <div className="mt-3 text-3xl font-black text-slate-950">{formatMoney(receipt.total)}</div>
            <div className="mt-3 rounded-full bg-slate-100 px-4 py-2 text-sm font-black text-slate-700">
              {receipt.payment?.label}
            </div>
            <p className="mt-2 text-sm font-semibold text-slate-500">Inventario actualizado en SICAR.</p>
            {receipt.accounting?.requested ? (
              <p className={`mt-3 rounded-xl px-3 py-2 text-xs font-bold ${receipt.accounting?.queued ? "bg-lime-50 text-lime-800" : "bg-amber-50 text-amber-800"}`}>
                {receipt.accounting?.queued
                  ? "Retenciones y factura preparadas para el sistema contable."
                  : `Compra registrada; complemento contable pendiente: ${receipt.accounting?.error || "vuelve a intentarlo desde el servidor."}`}
              </p>
            ) : null}
            <button type="button" onClick={() => setReceipt(null)} className="app-button app-button-primary mt-6 w-full">Cerrar</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
