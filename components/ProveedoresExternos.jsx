"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
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

function buildPurchasePayload({ supplier, invoiceNumber, comment, items, requestId, paymentMethod }) {
  return {
    requestId,
    supplierId: Number(supplier.pro_id),
    invoiceNumber: `${invoiceNumber || ""}`.trim(),
    date: localDate(),
    comment: `${comment || ""}`.trim(),
    paymentMethod,
    items: items.map((item) => ({
      articleId: Number(item.art_id),
      quantity: Number(item.quantity),
      grossUnitPrice: Number(item.grossUnitPrice),
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
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [paymentPromptOpen, setPaymentPromptOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("");
  const [preview, setPreview] = useState(null);
  const [receipt, setReceipt] = useState(null);
  const requestIdRef = useRef(globalThis.crypto?.randomUUID?.() || `purchase-${Date.now()}`);

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
    const gross = items.reduce(
      (sum, item) => sum + Number(item.quantity || 0) * Number(item.grossUnitPrice || 0),
      0,
    );
    return { lines: items.length, gross: roundMoney(gross) };
  }, [items]);

  const addProduct = (product) => {
    setItems((current) => {
      if (current.some((item) => Number(item.art_id) === Number(product.art_id))) return current;
      return [
        ...current,
        {
          ...product,
          quantity: "",
          grossUnitPrice: `${Number(product.lastPurchaseGross || 0).toFixed(2)}`,
        },
      ];
    });
    setProductQuery("");
    setProductOpen(false);
  };

  const updateItem = (articleId, field, value) => {
    setItems((current) =>
      current.map((item) => (Number(item.art_id) === Number(articleId) ? { ...item, [field]: value } : item)),
    );
  };

  const validate = () => {
    if (!supplier) return "Selecciona el proveedor.";
    if (items.length === 0) return "Agrega al menos un producto.";
    if (items.some((item) => Number(item.quantity) <= 0)) return "Completa una cantidad mayor que cero en todos los productos.";
    if (items.some((item) => Number(item.grossUnitPrice) < 0 || item.grossUnitPrice === "")) return "Revisa el precio de compra de todos los productos.";
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

  return (
    <div className="min-w-0 max-w-full space-y-4 overflow-x-clip pb-28">
      <section className="min-w-0 max-w-full overflow-hidden rounded-[1.7rem] border border-slate-800 bg-[radial-gradient(circle_at_88%_8%,rgba(14,165,233,0.2),transparent_18rem),linear-gradient(135deg,#08111f_0%,#10233a_58%,#142f3a_100%)] p-5 text-white shadow-[0_24px_60px_-38px_rgba(2,6,23,0.85)] sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300">Modulo proveedores externos</div>
            <h2 className="mt-2 text-2xl font-black sm:text-3xl">Recibir mercaderia</h2>
            <p className="mt-2 max-w-2xl text-sm font-semibold text-slate-300">
              Proveedor, cantidades y precio final de factura. SICAR calcula el IVA configurado sin modificar el articulo.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setConnectionDialog(true)}
            className="flex min-h-12 items-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-4 text-sm font-black text-white"
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
                    className="mb-1 w-full min-w-0 break-words rounded-xl px-4 py-3 text-left text-sm font-bold text-slate-700 hover:bg-cyan-50"
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

      <section className="app-panel relative z-10 min-w-0 max-w-full p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-lg font-black text-slate-950">Productos</div>
            <div className="text-xs font-bold text-slate-400">{totals.lines} lineas agregadas</div>
          </div>
          <div className="rounded-full bg-cyan-50 px-4 py-2 text-sm font-black text-cyan-800">Precio final con IVA</div>
        </div>

        <div className="relative mt-4 min-w-0 max-w-full">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">{Icons.search}</span>
          <input
            value={productQuery}
            onChange={(event) => {
              setProductQuery(event.target.value);
              setProductOpen(true);
            }}
            onFocus={() => setProductOpen(true)}
            className="app-input min-h-14 pl-12 text-base"
            placeholder="Buscar por clave o nombre"
            disabled={connection !== "online"}
          />
          {productOpen ? (
            <div className="absolute inset-x-0 top-full z-20 mt-2 max-h-[360px] max-w-full overflow-y-auto overflow-x-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
              {products.map((product) => (
                <button
                  key={product.art_id}
                  type="button"
                  onClick={() => addProduct(product)}
                  className="mb-1 grid w-full min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl px-3 py-3 text-left hover:bg-cyan-50"
                >
                  <span className="min-w-0">
                    <span className="inline-flex max-w-full rounded-lg bg-slate-100 px-2 py-1 font-mono text-xs font-black text-slate-600">{product.clave}</span>
                    <span className="mt-1 block break-words text-sm font-bold text-slate-800">{product.descripcion}</span>
                  </span>
                  <span className="shrink-0 text-right text-sm font-black text-cyan-800">{formatMoney(product.lastPurchaseGross)}</span>
                </button>
              ))}
              {products.length === 0 ? <div className="p-5 text-center text-sm text-slate-400">Sin coincidencias</div> : null}
            </div>
          ) : null}
        </div>

        <div className="mt-4 space-y-2">
          {items.map((item, index) => {
            const lineTotal = roundMoney(Number(item.quantity || 0) * Number(item.grossUnitPrice || 0));
            return (
              <div key={item.art_id} className="grid min-w-0 max-w-full gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-3 xl:grid-cols-[42px_minmax(180px,1fr)_minmax(100px,130px)_minmax(120px,155px)_minmax(115px,135px)_48px] xl:items-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-xs font-black text-white">{String(index + 1).padStart(2, "0")}</div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-black text-slate-900">{item.descripcion}</div>
                  <div className="mt-1 flex flex-wrap gap-2 text-[11px] font-bold text-slate-500">
                    <span>{item.clave}</span>
                    <span>{item.unidadCompra}</span>
                    <span>{Number(item.taxPercent || 0) > 0 ? `IVA ${item.taxPercent}%` : "Exento"}</span>
                  </div>
                </div>
                <div>
                  <label className="app-label xl:hidden">Cantidad</label>
                  <TouchNumericInput
                    value={item.quantity}
                    onValueChange={(value) => updateItem(item.art_id, "quantity", value)}
                    label={`Cantidad ${item.descripcion}`}
                    decimals={4}
                    placeholder="Cantidad"
                    className="app-input text-center font-black"
                  />
                </div>
                <div>
                  <label className="app-label xl:hidden">Precio con IVA</label>
                  <TouchNumericInput
                    value={item.grossUnitPrice}
                    onValueChange={(value) => updateItem(item.art_id, "grossUnitPrice", value)}
                    label={`Precio final ${item.descripcion}`}
                    decimals={2}
                    placeholder="Precio"
                    className="app-input text-center font-black text-cyan-800"
                  />
                </div>
                <div className="rounded-xl bg-white px-3 py-3 text-right">
                  <div className="text-[9px] font-black uppercase tracking-[0.12em] text-slate-400">Importe</div>
                  <div className="mt-1 font-black text-slate-950">{formatMoney(lineTotal)}</div>
                </div>
                <button
                  type="button"
                  onClick={() => setItems((current) => current.filter((row) => row.art_id !== item.art_id))}
                  className="app-icon-button text-rose-600"
                  aria-label={`Quitar ${item.descripcion}`}
                >
                  {Icons.trash}
                </button>
              </div>
            );
          })}
          {items.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 px-5 py-10 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">{Icons.box}</div>
              <div className="mt-3 text-sm font-black text-slate-700">Busca y agrega los productos recibidos</div>
            </div>
          ) : null}
        </div>
      </section>

      <div className="fixed inset-x-0 bottom-[88px] z-40 px-3 lg:bottom-4 lg:left-auto lg:right-5 lg:w-[460px]">
        <div className="rounded-[1.4rem] border border-slate-700 bg-slate-950 p-3 text-white shadow-[0_24px_60px_-28px_rgba(2,6,23,0.85)]">
          <div className="grid grid-cols-[1fr_auto] items-center gap-3">
            <div className="px-2">
              <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Total factura</div>
              <div className="mt-1 text-2xl font-black">{formatMoney(totals.gross)}</div>
            </div>
            <button
              type="button"
              onClick={requestPaymentMethod}
              disabled={loading || connection !== "online"}
              className="min-h-14 rounded-2xl bg-cyan-500 px-5 text-sm font-black text-slate-950 disabled:cursor-not-allowed disabled:opacity-40"
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

      {paymentPromptOpen ? (
        <div className="app-modal z-[115] px-4" role="dialog" aria-modal="true" aria-labelledby="payment-method-title">
          <div className="app-modal-panel w-full max-w-xl p-5 sm:p-6">
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-700">Antes de terminar</div>
            <h2 id="payment-method-title" className="mt-1 text-2xl font-black text-slate-950">Metodo de pago</h2>
            <p className="mt-2 text-sm font-semibold text-slate-500">Selecciona como debe quedar registrada la compra en SICAR.</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => openPreview("credit")}
                disabled={loading}
                className="min-h-32 rounded-[1.4rem] border-2 border-cyan-200 bg-cyan-50 p-5 text-left text-cyan-950 transition hover:border-cyan-500 hover:bg-cyan-100 disabled:opacity-50"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-600 text-white">{Icons.credit}</span>
                <span className="mt-4 block text-lg font-black">Credito</span>
                <span className="mt-1 block text-xs font-bold leading-5 text-cyan-700">Genera la cuenta por pagar al proveedor.</span>
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
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-700">Confirmar recepcion</div>
            <h2 className="mt-1 text-2xl font-black text-slate-950">{preview.supplier?.nombre}</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="text-[10px] font-black uppercase text-slate-400">Productos</div>
                <div className="mt-1 text-xl font-black">{preview.summary?.lines}</div>
              </div>
              <div className="rounded-2xl bg-cyan-50 p-4 text-right">
                <div className="text-[10px] font-black uppercase text-cyan-700">Total con IVA</div>
                <div className="mt-1 text-xl font-black text-cyan-950">{formatMoney(preview.summary?.total)}</div>
              </div>
            </div>
            <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-4">
              <div className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Metodo de pago</div>
              <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                <div className="text-base font-black text-slate-950">{preview.payment?.label}</div>
                {preview.payment?.method === "credit" ? (
                  <div className="rounded-full bg-cyan-100 px-3 py-1 text-xs font-black text-cyan-800">
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
