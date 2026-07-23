"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import TouchNumericInput from "./TouchNumericInput";
import {
  checkSicarPurchaseApi,
  getSicarApiConnection,
  previewSicarPurchase,
  receiveSicarPurchase,
  saveSicarApiConnection,
  searchSicarArticles,
  searchSicarSuppliers,
} from "@/lib/sicarPurchaseApi";

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
};

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

function buildPurchasePayload({ supplier, invoiceNumber, comment, items, requestId, paymentMethod }) {
  return {
    requestId,
    supplierId: Number(supplier.pro_id),
    invoiceNumber: `${invoiceNumber || ""}`.trim(),
    date: localDate(),
    comment: `${comment || ""}`.trim(),
    paymentMethod,
    priceMode: "net",
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
          En el servidor Granada usa 127.0.0.1. En una tablet usa la IP local del servidor.
        </p>
        <label className="app-label mt-5">Direccion</label>
        <input
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          className="app-input"
          placeholder="http://192.168.1.137:43110"
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
            Guardar y probar
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ProveedoresExternos({ user }) {
  const [connection, setConnection] = useState("checking");
  const [connectionError, setConnectionError] = useState("");
  const [connectionDialog, setConnectionDialog] = useState(false);
  const [supplierQuery, setSupplierQuery] = useState("");
  const [suppliers, setSuppliers] = useState([]);
  const [supplier, setSupplier] = useState(null);
  const [supplierOpen, setSupplierOpen] = useState(false);
  const [productQuery, setProductQuery] = useState("");
  const [products, setProducts] = useState([]);
  const [productOpen, setProductOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [bultosArticleId, setBultosArticleId] = useState(null);
  const [bultosTemporal, setBultosTemporal] = useState([]);
  const [bultoTemporal, setBultoTemporal] = useState("");
  const [bultoError, setBultoError] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [paymentPromptOpen, setPaymentPromptOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("");
  const [preview, setPreview] = useState(null);
  const [receipt, setReceipt] = useState(null);
  const requestIdRef = useRef(globalThis.crypto?.randomUUID?.() || `purchase-${Date.now()}`);
  const productSearchRef = useRef(null);
  const quantityRefs = useRef(new Map());
  const bultoInputRef = useRef(null);

  const checkConnection = async () => {
    setConnection("checking");
    setConnectionError("");
    try {
      await checkSicarPurchaseApi();
      setConnection("online");
    } catch (error) {
      setConnection("offline");
      setConnectionError(error.message);
    }
  };

  useEffect(() => {
    checkConnection();
  }, []);

  useEffect(() => {
    if (connection !== "online") return undefined;
    const timeout = setTimeout(() => {
      searchSicarSuppliers(supplierQuery)
        .then((result) => setSuppliers(result.rows || []))
        .catch((error) => setConnectionError(error.message));
    }, 180);
    return () => clearTimeout(timeout);
  }, [connection, supplierQuery]);

  useEffect(() => {
    if (connection !== "online") return undefined;
    const timeout = setTimeout(() => {
      searchSicarArticles(productQuery, supplier?.pro_id)
        .then((result) => setProducts(result.rows || []))
        .catch((error) => setConnectionError(error.message));
    }, 180);
    return () => clearTimeout(timeout);
  }, [connection, productQuery, supplier?.pro_id]);

  const totals = useMemo(() => {
    const gross = items.reduce((sum, item) => {
      const grossUnitPrice = roundUnitPrice(
        Number(item.netUnitPrice || 0) * (1 + Number(item.taxPercent || 0) / 100),
      );
      return sum + roundMoney(Number(item.quantity || 0) * grossUnitPrice);
    }, 0);
    return { lines: items.length, gross: roundMoney(gross) };
  }, [items]);

  const addProduct = (product) => {
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
    setItems((current) => current.map((item) => (
      Number(item.art_id) === Number(bultosArticleId)
        ? { ...item, quantity: formatBultoWeight(total), bultos: finalWeights }
        : item
    )));
    closeBultos();
    openProductSearch();
  };

  const validate = () => {
    if (!supplier) return "Selecciona el proveedor.";
    if (items.length === 0) return "Agrega al menos un producto.";
    if (items.some((item) => Number(item.quantity) <= 0)) return "Completa una cantidad mayor que cero en todos los productos.";
    if (items.some((item) => Number(item.netUnitPrice) < 0 || item.netUnitPrice === "")) return "Revisa el precio sin IVA de todos los productos.";
    return "";
  };

  const requestPaymentMethod = () => {
    const validationError = validate();
    if (validationError) {
      setMessage({ type: "error", text: validationError });
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
          comment,
          items,
          requestId: requestIdRef.current,
          paymentMethod: selectedPaymentMethod,
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
    setLoading(true);
    setMessage(null);
    try {
      const result = await receiveSicarPurchase(
        buildPurchasePayload({
          supplier,
          invoiceNumber,
          comment,
          items,
          requestId: requestIdRef.current,
          paymentMethod,
        }),
      );
      setReceipt({ ...result.purchase, payment: result.payment });
      setPreview(null);
      setPaymentMethod("");
      setItems([]);
      setInvoiceNumber("");
      setComment("");
      requestIdRef.current = globalThis.crypto?.randomUUID?.() || `purchase-${Date.now()}`;
    } catch (error) {
      setMessage({ type: "error", text: error.message });
      setPreview(null);
    } finally {
      setLoading(false);
    }
  };

  const activeBultoItem = items.find((item) => Number(item.art_id) === Number(bultosArticleId));
  const bultosTotal = bultosTemporal.reduce((sum, weight) => sum + weight, 0);

  return (
    <div className="min-w-0 max-w-full space-y-4 overflow-x-clip pb-28">
      <section className="min-w-0 max-w-full overflow-hidden rounded-[1.7rem] border border-[#3f6212] bg-[radial-gradient(circle_at_88%_8%,rgba(118,185,0,0.3),transparent_20rem),linear-gradient(135deg,#0b1408_0%,#17250e_58%,#223914_100%)] p-5 text-white shadow-[0_24px_60px_-38px_rgba(20,40,8,0.9)] sm:p-6">
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
          <button
            type="button"
            onClick={() => setConnectionDialog(true)}
            className="flex min-h-11 items-center gap-2 rounded-xl border border-lime-300/25 bg-white/10 px-4 text-sm font-black text-white"
          >
            {Icons.settings}
            SICAR
          </button>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/7 p-4">
            <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Sucursal</div>
            <div className="mt-1 font-black">{user}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/7 p-4">
            <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Fecha</div>
            <div className="mt-1 font-black">{localDate()}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/7 p-4">
            <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Conexion local</div>
            <div className={`mt-1 font-black ${connection === "online" ? "text-emerald-300" : connection === "checking" ? "text-amber-300" : "text-rose-300"}`}>
              {connection === "online" ? "SICAR disponible" : connection === "checking" ? "Verificando..." : "Sin conexion"}
            </div>
          </div>
        </div>
      </section>

      {connectionError ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
          {connectionError}
        </div>
      ) : null}

      {message ? (
        <div className={`rounded-2xl border px-4 py-3 text-sm font-bold ${message.type === "error" ? "border-rose-200 bg-rose-50 text-rose-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
          {message.text}
        </div>
      ) : null}

      <section className={`app-panel relative min-w-0 max-w-full overflow-visible p-4 sm:p-5 ${supplierOpen ? "z-50" : "z-20"}`}>
        <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,0.8fr)_minmax(0,1fr)]">
          <div className="relative min-w-0">
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
                disabled={connection !== "online"}
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
                {suppliers.length === 0 ? <div className="p-4 text-center text-sm text-slate-400">Sin coincidencias</div> : null}
              </div>
            ) : null}
          </div>
          <div className="min-w-0">
            <label className="app-label">Factura / remision</label>
            <input
              value={invoiceNumber}
              onChange={(event) => setInvoiceNumber(event.target.value.toUpperCase())}
              className="app-input uppercase"
              placeholder="Opcional"
              maxLength={19}
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
        </div>
      </section>

      <section className={`app-panel relative min-w-0 max-w-full overflow-visible border-lime-200 p-3 sm:p-4 ${productOpen ? "z-40" : "z-10"}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-lg font-black text-slate-950">Productos <span className="text-[#5d9100]">{totals.lines}</span></div>
            <div className="text-xs font-bold text-slate-400">Hasta 100 lineas</div>
          </div>
          <button
            type="button"
            onClick={openProductSearch}
            disabled={connection !== "online"}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#76b900] px-4 text-sm font-black text-[#101807] shadow-[0_14px_28px_-18px_rgba(78,124,15,0.9)] disabled:opacity-40"
          >
            {Icons.plus}
            Agregar producto
          </button>
        </div>

        <div className="relative mt-3 min-w-0 max-w-full">
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
            disabled={connection !== "online"}
          />
          {productOpen ? (
            <div className="absolute inset-x-0 top-full z-[60] mt-2 max-h-[min(360px,55vh)] max-w-full overflow-y-auto overflow-x-hidden overscroll-contain rounded-2xl border border-lime-200 bg-white p-2 shadow-[0_24px_60px_-24px_rgba(30,50,12,0.45)]">
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
              {products.length === 0 ? <div className="p-5 text-center text-sm text-slate-400">Sin coincidencias</div> : null}
            </div>
          ) : null}
        </div>

        {items.length > 0 ? (
          <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="grid grid-cols-[minmax(70px,1fr)_62px_46px_76px_34px] items-center gap-1 border-b border-slate-200 bg-slate-50 px-2 py-2 text-[8px] font-black uppercase tracking-[0.1em] text-slate-400 sm:grid-cols-[minmax(180px,1fr)_88px_72px_120px_40px] sm:gap-2 sm:px-3 sm:text-[9px]">
              <span>Producto</span>
              <span className="text-center">Cant.</span>
              <span className="text-center">Bultos</span>
              <span className="text-center">P. sin IVA</span>
              <span />
            </div>
            <div className="max-h-[min(52vh,560px)] divide-y divide-slate-100 overflow-y-auto overscroll-contain">
              {items.map((item) => (
                <div key={item.art_id} className="grid min-h-12 grid-cols-[minmax(70px,1fr)_62px_46px_76px_34px] items-center gap-1 px-2 py-1.5 sm:grid-cols-[minmax(180px,1fr)_88px_72px_120px_40px] sm:gap-2 sm:px-3">
                  <div className="flex min-w-0 items-center gap-2">
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
                    className="app-input h-10 !min-h-10 rounded-lg px-1 text-center text-xs font-black sm:px-2 sm:text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => openBultos(item.art_id)}
                    className={`flex h-10 items-center justify-center gap-1 rounded-lg border px-1 text-[9px] font-black ${item.bultos?.length ? "border-lime-300 bg-lime-50 text-lime-800" : "border-slate-200 bg-white text-slate-500"}`}
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
                    className="app-input h-10 !min-h-10 rounded-lg px-1 text-center text-[11px] font-black text-[#4d7c0f] sm:px-2 sm:text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setItems((current) => current.filter((row) => row.art_id !== item.art_id))}
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-rose-500 hover:bg-rose-50"
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

      <div className="fixed inset-x-0 bottom-[88px] z-40 px-3 lg:bottom-4 lg:left-auto lg:right-5 lg:w-[460px]">
        <div className="rounded-[1.4rem] border border-slate-700 bg-slate-950 p-3 text-white shadow-[0_24px_60px_-28px_rgba(2,6,23,0.85)]">
          <div className="grid grid-cols-[1fr_auto] items-center gap-3">
            <div className="px-2">
              <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Total factura con IVA</div>
              <div className="mt-1 text-2xl font-black">{formatMoney(totals.gross)}</div>
            </div>
            <button
              type="button"
              onClick={requestPaymentMethod}
              disabled={loading || connection !== "online"}
              className="min-h-14 rounded-2xl bg-[#76b900] px-5 text-sm font-black text-[#101807] disabled:cursor-not-allowed disabled:opacity-40"
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
            checkConnection();
          }}
        />
      ) : null}

      {bultosArticleId !== null && typeof document !== "undefined"
        ? createPortal(
            <div
              className="app-modal z-[120] items-end px-3 pb-[calc(12px+env(safe-area-inset-bottom))] sm:items-center sm:p-4"
              onClick={(event) => {
                if (event.target === event.currentTarget) closeBultos();
              }}
            >
              <div className="w-full max-w-md rounded-[1.5rem] border border-lime-200 bg-white p-4 shadow-[0_30px_80px_-24px_rgba(30,50,12,0.55)] sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[10px] font-black uppercase tracking-[0.16em] text-[#5d9100]">Suma de bultos</div>
                    <h3 className="mt-1 truncate text-lg font-black text-slate-950">{activeBultoItem?.descripcion}</h3>
                  </div>
                  <button type="button" onClick={closeBultos} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-500" aria-label="Cerrar">
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
                  <button type="button" onClick={closeBultos} className="app-button app-button-secondary">Cancelar</button>
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
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="text-[10px] font-black uppercase text-slate-400">Productos</div>
                <div className="mt-1 text-xl font-black">{preview.summary?.lines}</div>
              </div>
              <div className="rounded-2xl bg-lime-50 p-4 text-right">
                <div className="text-[10px] font-black uppercase text-lime-700">Total con IVA</div>
                <div className="mt-1 text-xl font-black text-lime-950">{formatMoney(preview.summary?.total)}</div>
              </div>
            </div>
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
              Esta accion registra la compra y aumenta inventario. No modifica precios de venta ni la configuracion de IVA.
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
            <button type="button" onClick={() => setReceipt(null)} className="app-button app-button-primary mt-6 w-full">Cerrar</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
