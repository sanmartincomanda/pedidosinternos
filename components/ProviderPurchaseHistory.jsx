"use client";

import React, { useMemo, useState } from "react";
import { ConfirmSheet, Icon, MobileScreen } from "./ui/csm";

function money(value) {
  return new Intl.NumberFormat("es-NI", {
    style: "currency",
    currency: "NIO",
    minimumFractionDigits: 2,
  }).format(Number(value || 0));
}

function dateTimeLabel(value) {
  if (!value) return "Sin fecha";
  // Date-only values (invoice dates) must not shift a day through UTC parsing.
  if (/^\d{4}-\d{2}-\d{2}$/.test(`${value}`)) {
    return new Intl.DateTimeFormat("es-NI", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(`${value}T12:00:00`));
  }
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
    <div className="app-modal z-[130] px-3" role="dialog" aria-modal="true" aria-labelledby="purchase-detail-title">
      <div className="app-modal-panel flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden p-0">
        <div className="flex items-start justify-between gap-3 border-b border-[var(--gray-200)] p-4 sm:p-5">
          <div className="min-w-0">
            <span className={`csm-tag ${isDraft ? "is-warn" : "is-ok"}`}>{isDraft ? "En espera" : "Registrada en SICAR"}</span>
            <h3 id="purchase-detail-title" className="csm-dialog-title mt-2">{supplierName}</h3>
            <p className="mt-1 text-sm text-[var(--gray-600)]">Factura {invoiceNumber} · {dateTimeLabel(record.purchaseDate || record.fecha || record.updatedAt)}</p>
          </div>
          <button type="button" onClick={onClose} className="csm-icon-btn" aria-label="Cerrar detalle">
            <Icon name="close" size={18} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
          <dl className="csm-kv csm-kv-3">
            <div><dt>Artículos</dt><dd>{record.items?.length || 0}</dd></div>
            <div><dt>Subtotal</dt><dd>{money(record.subtotal ?? record.totals?.subtotal)}</dd></div>
            <div><dt>Total</dt><dd className="font-semibold">{money(total)}</dd></div>
          </dl>
          <table className="csm-table mt-4">
            <thead>
              <tr>
                <th>Producto</th>
                <th className="is-num">Cant.</th>
                <th className="is-num">Precio s/IVA</th>
                <th className="is-num">Importe</th>
              </tr>
            </thead>
            <tbody>
              {(record.items || []).map((item) => {
                const price = Number(item.netUnitPrice ?? item.precioSin ?? 0);
                const quantity = Number(item.quantity ?? item.cantidad ?? 0);
                const unit = item.unidadCompra || item.unidadVenta || item.unidad || "";
                return (
                  <tr key={`${item.art_id}-${item.orden || item.clave}`}>
                    <td>
                      <div className="csm-product csm-product-sm">
                        <span className="csm-product-name">{item.descripcion}</span>
                        <span className="csm-product-meta"><span className="csm-product-code">{item.clave}</span>{unit ? <span>{unit}</span> : null}</span>
                      </div>
                    </td>
                    <td className="is-num">{quantity}</td>
                    <td className="is-num">{money(price)}</td>
                    <td className="is-num font-semibold">{money(item.importeSin ?? quantity * price)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {record.comment ? <p className="csm-hint mt-4">Nota: {record.comment}</p> : null}
        </div>
      </div>
    </div>
  );
}

function HistoryBody({
  drafts,
  purchases,
  loading,
  error,
  onDeleteDraft,
  onEditDraft,
}) {
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState("pending");
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [draftToDelete, setDraftToDelete] = useState(null);
  const filteredDrafts = useMemo(() => drafts.filter((row) => rowMatches(row, query)), [drafts, query]);
  const filteredPurchases = useMemo(() => purchases.filter((row) => rowMatches(row, query)), [purchases, query]);

  return (
    <>
      <div className="csm-segmented" role="tablist" aria-label="Tipo de recepción">
        <button type="button" role="tab" aria-selected={activeTab === "pending"} onClick={() => setActiveTab("pending")} className={activeTab === "pending" ? "is-active" : ""}>
          En espera <span className="csm-count">{drafts.length}</span>
        </button>
        <button type="button" role="tab" aria-selected={activeTab === "sicar"} onClick={() => setActiveTab("sicar")} className={activeTab === "sicar" ? "is-active" : ""}>
          En SICAR <span className="csm-count">{purchases.length}</span>
        </button>
      </div>

      <label className="app-label mt-4" htmlFor="history-search">Buscar</label>
      <div className="csm-search">
        <Icon name="search" size={18} />
        <input
          id="history-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="app-input"
          placeholder="Proveedor, factura o producto"
        />
      </div>
      {error ? <div className="csm-alert is-warn mt-3">{error}</div> : null}

      {activeTab === "pending" ? (
        <ul className="csm-list mt-3" aria-label="Recepciones en espera">
          {filteredDrafts.map((draft) => (
            <li key={draft.id} className="csm-history-row">
              <button type="button" onClick={() => setSelectedRecord({ ...draft, kind: "draft" })} className="csm-history-main">
                <span className="min-w-0 flex-1">
                  <span className="csm-list-title">{draft.supplier?.nombre}</span>
                  <span className="csm-list-meta">
                    {draft.invoiceNumber ? `Fact. ${draft.invoiceNumber}` : "Sin factura"} · {dateTimeLabel(draft.purchaseDate || draft.updatedAt)} · {draft.items?.length || 0} artículos
                  </span>
                </span>
                <span className="csm-history-amount">{money(draft.totals?.gross)}</span>
              </button>
              <div className="csm-history-actions">
                <button type="button" onClick={() => onEditDraft(draft)} className="csm-btn csm-btn-secondary csm-btn-sm">Completar</button>
                <button type="button" onClick={() => setDraftToDelete(draft)} className="csm-icon-btn is-ghost text-[var(--err)]" aria-label={`Eliminar pendiente de ${draft.supplier?.nombre}`}>
                  <Icon name="trash" size={18} />
                </button>
              </div>
            </li>
          ))}
          {filteredDrafts.length === 0 ? <li className="csm-empty">No hay recepciones en espera.</li> : null}
        </ul>
      ) : (
        <ul className="csm-list mt-3" aria-label="Compras registradas en SICAR" aria-busy={loading}>
          {loading ? <li className="csm-empty">Consultando SICAR...</li> : null}
          {!loading && filteredPurchases.map((purchase) => (
            <li key={purchase.com_id}>
              <button type="button" onClick={() => setSelectedRecord({ ...purchase, kind: "sicar" })} className="csm-list-row">
                <span className="min-w-0 flex-1">
                  <span className="csm-list-title">{purchase.supplierName}</span>
                  <span className="csm-list-meta">Fact. {purchase.folio} · {dateTimeLabel(purchase.fecha)} · {purchase.items?.length || 0} artículos · {purchase.paymentLabel}</span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="csm-history-amount block">{money(purchase.total)}</span>
                  <span className={`csm-tag mt-1 ${purchase.status === 1 ? "is-ok" : "is-err"}`}>{purchase.statusLabel}</span>
                </span>
              </button>
            </li>
          ))}
          {!loading && filteredPurchases.length === 0 ? <li className="csm-empty">No se encontraron compras de la app en SICAR.</li> : null}
        </ul>
      )}

      <DetailDialog record={selectedRecord} onClose={() => setSelectedRecord(null)} />
      {draftToDelete ? (
        <ConfirmSheet
          title="¿Eliminar este pendiente?"
          onClose={() => setDraftToDelete(null)}
          actions={(
            <>
              <button type="button" onClick={() => setDraftToDelete(null)} className="csm-btn csm-btn-secondary">Conservar</button>
              <button
                type="button"
                onClick={async () => {
                  await onDeleteDraft(draftToDelete);
                  setDraftToDelete(null);
                }}
                className="csm-btn csm-btn-danger"
              >
                Eliminar
              </button>
            </>
          )}
        >
          <strong>{draftToDelete.supplier?.nombre}</strong>. Se quita solamente de este dispositivo; no existe ningún movimiento en SICAR.
        </ConfirmSheet>
      ) : null}
    </>
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
  mobile = false,
}) {
  const body = (
    <HistoryBody
      drafts={drafts}
      purchases={purchases}
      loading={loading}
      error={error}
      onDeleteDraft={onDeleteDraft}
      onEditDraft={onEditDraft}
    />
  );

  if (mobile) {
    return (
      <MobileScreen
        title="Recepciones"
        subtitle="Pendientes y compras en SICAR"
        onBack={onBack}
        backLabel="Volver a proveedores"
        actions={(
          <button type="button" onClick={onRefresh} className="csm-icon-btn is-ghost" aria-label="Actualizar">
            <Icon name="refresh" />
          </button>
        )}
      >
        {body}
      </MobileScreen>
    );
  }

  return (
    <div className="csm-page min-w-0 max-w-full">
      <header className="csm-page-header">
        <div className="min-w-0">
          <button type="button" onClick={onBack} className="csm-link mb-1 inline-flex items-center gap-1">
            <Icon name="back" size={16} /> Recibir mercadería
          </button>
          <h2 className="csm-page-title">Recepciones</h2>
          <p className="csm-page-subtitle">Pendientes en este dispositivo y compras registradas en SICAR</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={onRefresh} className="csm-btn csm-btn-secondary">
            <Icon name="refresh" size={18} /> Actualizar
          </button>
          <button type="button" onClick={onBack} className="csm-btn csm-btn-primary">Nueva recepción</button>
        </div>
      </header>
      <section className="app-panel p-4 sm:p-5">{body}</section>
    </div>
  );
}
