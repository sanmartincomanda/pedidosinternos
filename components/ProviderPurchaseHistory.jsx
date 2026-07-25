"use client";

import React, { useMemo, useState } from "react";

const Icons = {
  arrow: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
      <path d="m15 18-6-6 6-6" />
    </svg>
  ),
  check: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
      <path d="m5 12 4 4L19 6" />
    </svg>
  ),
  clock: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  ),
  close: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
      <path d="m6 6 12 12M18 6 6 18" />
    </svg>
  ),
  edit: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" />
    </svg>
  ),
  eye: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" />
      <circle cx="12" cy="12" r="2.5" />
    </svg>
  ),
  refresh: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20 7v5h-5M4 17v-5h5" />
      <path d="M6.1 9a7 7 0 0 1 11.8-2L20 12M4 12l2.1 5a7 7 0 0 0 11.8-2" />
    </svg>
  ),
  trash: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 6h18M8 6V4h8v2M19 6l-1 13a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    </svg>
  ),
};

function money(value) {
  return new Intl.NumberFormat("es-NI", {
    style: "currency",
    currency: "NIO",
    minimumFractionDigits: 2,
  }).format(Number(value || 0));
}

function dateTimeLabel(value) {
  if (!value) return "Sin fecha";
  const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(`${value}`)
    ? `${value}`.replace(" ", "T")
    : value;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return `${value}`;
  return new Intl.DateTimeFormat("es-NI", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function rowMatches(row, query) {
  const normalized = `${query || ""}`.trim().toLocaleLowerCase("es");
  if (!normalized) return true;
  return [
    row.supplier?.nombre,
    row.supplierName,
    row.invoiceNumber,
    row.folio,
    row.purchaseDate,
    row.fecha,
    row.comment,
    ...(row.items || []).flatMap((item) => [item.clave, item.descripcion]),
  ].some((value) => `${value || ""}`.toLocaleLowerCase("es").includes(normalized));
}

function DetailDialog({ record, onClose }) {
  if (!record) return null;
  const isDraft = record.kind === "draft";
  const supplierName = record.supplier?.nombre || record.supplierName;
  const invoiceNumber = record.invoiceNumber || record.folio || "Sin factura";
  const total = record.total ?? record.totals?.gross;

  return (
    <div className="app-modal z-[130] px-3" role="dialog" aria-modal="true">
      <div className="app-modal-panel max-h-[90vh] w-full max-w-3xl overflow-hidden">
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 p-5">
          <div className="min-w-0">
            <div className={`text-[10px] font-black uppercase tracking-[0.16em] ${isDraft ? "text-amber-600" : "text-lime-700"}`}>
              {isDraft ? "Recepcion en espera" : "Compra registrada en SICAR"}
            </div>
            <h3 className="mt-1 truncate text-xl font-black text-slate-950">{supplierName}</h3>
            <p className="mt-1 text-xs font-bold text-slate-500">{invoiceNumber} · {dateTimeLabel(record.purchaseDate || record.fecha || record.updatedAt)}</p>
          </div>
          <button type="button" onClick={onClose} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-500">
            {Icons.close}
          </button>
        </div>
        <div className="max-h-[65vh] overflow-y-auto p-4 sm:p-5">
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl bg-slate-50 p-3">
              <div className="text-[9px] font-black uppercase text-slate-400">Productos</div>
              <div className="mt-1 text-lg font-black">{record.items?.length || 0}</div>
            </div>
            <div className="rounded-xl bg-slate-50 p-3 text-right">
              <div className="text-[9px] font-black uppercase text-slate-400">Subtotal</div>
              <div className="mt-1 text-sm font-black sm:text-lg">{money(record.subtotal ?? record.totals?.subtotal)}</div>
            </div>
            <div className="rounded-xl bg-lime-50 p-3 text-right">
              <div className="text-[9px] font-black uppercase text-lime-700">Total</div>
              <div className="mt-1 text-sm font-black text-lime-950 sm:text-lg">{money(total)}</div>
            </div>
          </div>
          <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
            <div className="grid grid-cols-[minmax(0,1fr)_64px_94px_100px] gap-2 bg-slate-50 px-3 py-2 text-[9px] font-black uppercase text-slate-400">
              <span>Producto</span>
              <span className="text-right">Cant.</span>
              <span className="text-right">Precio</span>
              <span className="text-right">Importe</span>
            </div>
            <div className="divide-y divide-slate-100">
              {(record.items || []).map((item) => {
                const price = Number(item.netUnitPrice ?? item.precioSin ?? 0);
                const quantity = Number(item.quantity ?? item.cantidad ?? 0);
                return (
                  <div key={`${item.art_id}-${item.orden || item.clave}`} className="grid grid-cols-[minmax(0,1fr)_64px_94px_100px] items-center gap-2 px-3 py-2.5 text-xs">
                    <div className="min-w-0">
                      <div className="truncate font-black text-slate-900">{item.descripcion}</div>
                      <div className="mt-0.5 font-mono text-[9px] font-bold text-slate-400">{item.clave}</div>
                    </div>
                    <span className="text-right font-mono font-bold">{quantity}</span>
                    <span className="text-right font-bold text-slate-600">{money(price)}</span>
                    <span className="text-right font-black">{money(item.importeSin ?? quantity * price)}</span>
                  </div>
                );
              })}
            </div>
          </div>
          {record.comment ? <div className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600">{record.comment}</div> : null}
        </div>
      </div>
    </div>
  );
}

export default function ProviderPurchaseHistory({
  drafts = [],
  purchases = [],
  loading = false,
  error = "",
  onBack,
  onDeleteDraft,
  onEditDraft,
  onRefresh,
}) {
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState("pending");
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [draftToDelete, setDraftToDelete] = useState(null);
  const filteredDrafts = useMemo(() => drafts.filter((row) => rowMatches(row, query)), [drafts, query]);
  const filteredPurchases = useMemo(() => purchases.filter((row) => rowMatches(row, query)), [purchases, query]);

  return (
    <div className="min-w-0 max-w-full space-y-4 overflow-x-clip pb-24">
      <section className="overflow-hidden rounded-[1.7rem] border border-[#3f6212] bg-[radial-gradient(circle_at_88%_8%,rgba(118,185,0,0.28),transparent_20rem),linear-gradient(135deg,#0b1408_0%,#17250e_58%,#223914_100%)] p-5 text-white shadow-[0_24px_60px_-38px_rgba(20,40,8,0.9)] sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.22em] text-lime-300">Proveedores externos</div>
            <h2 className="mt-1 text-2xl font-black sm:text-3xl">Historial de recepciones</h2>
            <p className="mt-1 text-sm font-semibold text-slate-300">Pendientes locales y compras enviadas a SICAR.</p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={onRefresh} className="flex min-h-11 items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-4 text-sm font-black">
              {Icons.refresh}
              Actualizar
            </button>
            <button type="button" onClick={onBack} className="flex min-h-11 items-center gap-2 rounded-xl bg-[#76b900] px-4 text-sm font-black text-[#101807]">
              {Icons.arrow}
              Nueva
            </button>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button type="button" onClick={() => setActiveTab("pending")} className={`rounded-2xl border p-4 text-left ${activeTab === "pending" ? "border-amber-300 bg-amber-300/15" : "border-white/10 bg-white/5"}`}>
            <div className="text-[10px] font-black uppercase tracking-[0.14em] text-amber-300">En espera</div>
            <div className="mt-1 text-2xl font-black">{drafts.length}</div>
          </button>
          <button type="button" onClick={() => setActiveTab("sicar")} className={`rounded-2xl border p-4 text-left ${activeTab === "sicar" ? "border-lime-300 bg-lime-300/15" : "border-white/10 bg-white/5"}`}>
            <div className="text-[10px] font-black uppercase tracking-[0.14em] text-lime-300">En SICAR</div>
            <div className="mt-1 text-2xl font-black">{purchases.length}</div>
          </button>
        </div>
      </section>

      <section className="app-panel p-4 sm:p-5">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="app-input"
          placeholder="Buscar proveedor, factura, remision o producto"
        />
        {error ? <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">{error}</div> : null}

        {activeTab === "pending" ? (
          <div className="mt-4 space-y-2">
            {filteredDrafts.map((draft) => (
              <article key={draft.id} className="rounded-2xl border border-amber-200 bg-amber-50/45 p-3 sm:p-4">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">{Icons.clock}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-black text-slate-950">{draft.supplier?.nombre}</div>
                    <div className="mt-0.5 truncate text-xs font-bold text-slate-500">{draft.invoiceNumber || "Sin factura"} · {dateTimeLabel(draft.purchaseDate || draft.updatedAt)}</div>
                    <div className="mt-2 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-wide text-slate-500">
                      <span>{draft.items?.length || 0} productos</span>
                      <span>{money(draft.totals?.gross)}</span>
                    </div>
                  </div>
                  <button type="button" onClick={() => setSelectedRecord({ ...draft, kind: "draft" })} className="flex h-9 w-9 items-center justify-center rounded-lg border border-amber-200 bg-white text-amber-700" aria-label="Ver detalle">
                    {Icons.eye}
                  </button>
                </div>
                <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
                  <button type="button" onClick={() => onEditDraft(draft)} className="flex min-h-10 items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 text-sm font-black text-white">
                    {Icons.edit}
                    Editar y completar
                  </button>
                  <button type="button" onClick={() => setDraftToDelete(draft)} className="flex min-h-10 items-center justify-center rounded-xl border border-rose-200 bg-white px-3 text-rose-600" aria-label="Eliminar pendiente">
                    {Icons.trash}
                  </button>
                </div>
              </article>
            ))}
            {filteredDrafts.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 py-14 text-center text-sm font-bold text-slate-400">No hay recepciones en espera.</div>
            ) : null}
          </div>
        ) : (
          <div className="mt-4 space-y-2">
            {loading ? <div className="py-14 text-center text-sm font-bold text-slate-400">Consultando SICAR...</div> : null}
            {!loading && filteredPurchases.map((purchase) => (
              <button key={purchase.com_id} type="button" onClick={() => setSelectedRecord({ ...purchase, kind: "sicar" })} className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 text-left transition hover:border-lime-300 hover:bg-lime-50/30 sm:p-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-lime-100 text-lime-700">{Icons.check}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-black text-slate-950">{purchase.supplierName}</span>
                  <span className="mt-0.5 block truncate text-xs font-bold text-slate-500">{purchase.folio} · {dateTimeLabel(purchase.fecha)}</span>
                  <span className="mt-1 block text-[10px] font-black uppercase tracking-wide text-slate-400">{purchase.items?.length || 0} productos · {purchase.paymentLabel}</span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block text-sm font-black text-slate-950">{money(purchase.total)}</span>
                  <span className="mt-1 inline-flex rounded-full bg-lime-100 px-2 py-0.5 text-[9px] font-black uppercase text-lime-800">{purchase.statusLabel}</span>
                </span>
              </button>
            ))}
            {!loading && filteredPurchases.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 py-14 text-center text-sm font-bold text-slate-400">No se encontraron compras de la app en SICAR.</div>
            ) : null}
          </div>
        )}
      </section>
      <DetailDialog record={selectedRecord} onClose={() => setSelectedRecord(null)} />
      {draftToDelete ? (
        <div className="app-modal z-[135] px-3" role="dialog" aria-modal="true">
          <div className="app-modal-panel w-full max-w-md p-5 sm:p-6">
            <div className="text-[10px] font-black uppercase tracking-[0.16em] text-rose-600">Eliminar pendiente</div>
            <h3 className="mt-1 text-xl font-black text-slate-950">{draftToDelete.supplier?.nombre}</h3>
            <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
              Se quitara solamente de este dispositivo. No existe todavia ningun movimiento en SICAR.
            </p>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setDraftToDelete(null)} className="app-button app-button-secondary">Conservar</button>
              <button
                type="button"
                onClick={async () => {
                  await onDeleteDraft(draftToDelete);
                  setDraftToDelete(null);
                }}
                className="min-h-12 rounded-xl bg-rose-600 text-sm font-black text-white"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
