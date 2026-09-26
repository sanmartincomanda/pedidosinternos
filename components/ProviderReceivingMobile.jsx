"use client";

import React, { useEffect, useRef, useState } from "react";
import ProviderPurchaseHistory from "./ProviderPurchaseHistory";
import TouchNumericInput from "./TouchNumericInput";
import {
  articleUnit,
  ConfirmSheet,
  Icon,
  MobileScreen,
  ProductIdentity,
  useScreenStack,
} from "./ui/csm";

function lineSubtotal(item) {
  return Math.round((Number(item.quantity || 0) * Number(item.netUnitPrice || 0) + Number.EPSILON) * 100) / 100;
}

function formatQuantity(value) {
  const number = Number(value || 0);
  return new Intl.NumberFormat("es-NI", { minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(number);
}

function ConnectionTag({ connection, catalogSyncing }) {
  if (catalogSyncing) return <span className="csm-tag is-warn">Actualizando catálogo</span>;
  if (connection === "online") return <span className="csm-tag is-ok">SICAR conectado</span>;
  if (connection === "checking") return <span className="csm-tag is-warn">Verificando SICAR</span>;
  return <span className="csm-tag is-err">SICAR sin conexión</span>;
}

function FlowMessage({ message, onDismiss }) {
  if (!message) return null;
  return (
    <div className={`csm-alert ${message.type === "error" ? "is-err" : "is-ok"} mb-3`} role={message.type === "error" ? "alert" : "status"}>
      <span className="min-w-0 flex-1">{message.text}</span>
      {onDismiss ? (
        <button type="button" onClick={onDismiss} className="csm-icon-btn is-ghost -my-2 -mr-2 h-9 w-9" aria-label="Cerrar aviso">
          <Icon name="close" size={16} />
        </button>
      ) : null}
    </div>
  );
}

export default function ProviderReceivingMobile({ ctx }) {
  const {
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
    resultLimit,
    items,
    setItems,
    updateItem,
    addProduct,
    openBultos,
    invoiceNumber,
    setInvoiceNumber,
    purchaseDate,
    setPurchaseDate,
    maxDate,
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
    chooseInvoiceFile,
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
    openConnectionDialog,
    receipt,
    history,
  } = ctx;

  const [activeItemId, setActiveItemId] = useState(null);
  const [itemError, setItemError] = useState("");
  const [pendingSupplier, setPendingSupplier] = useState(null);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [direction, setDirection] = useState("forward");
  const searchInputRef = useRef(null);
  const previousDepth = useRef(1);

  const nav = useScreenStack("suppliers", {
    onBackRequest: () => {
      setMessage(null);
      setItemError("");
      return true;
    },
  });
  const { screen, depth, push, back, replaceTop, reset } = nav;

  useEffect(() => {
    setDirection(depth < previousDepth.current ? "back" : "forward");
    previousDepth.current = depth;
    window.scrollTo(0, 0);
  }, [depth, screen]);

  // The deep screens own the whole viewport: hide the module chrome while they are open.
  useEffect(() => {
    document.documentElement.classList.toggle("csm-flow-deep", screen !== "suppliers");
    return () => document.documentElement.classList.remove("csm-flow-deep");
  }, [screen]);

  useEffect(() => {
    if (screen === "search") requestAnimationFrame(() => searchInputRef.current?.focus());
    if (screen === "history") history.refresh();
    // history.refresh identity changes every render; only the screen change matters here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen]);

  useEffect(() => {
    if (receipt) reset("suppliers");
  }, [receipt, reset]);

  const receptionInProgress = Boolean(supplier && (items.length > 0 || `${invoiceNumber}`.trim() || editingDraftId));
  const activeItem = items.find((item) => Number(item.art_id) === Number(activeItemId)) || null;
  const missingQuantity = items.filter((item) => !(Number(item.quantity) > 0));
  const invoiceMissing = !`${invoiceNumber || ""}`.trim();

  const openItem = (articleId) => {
    setActiveItemId(Number(articleId));
    setItemError("");
    push("item");
  };

  const chooseSupplier = (row) => {
    if (receptionInProgress && Number(row.pro_id) !== Number(supplier?.pro_id) && items.length > 0) {
      setPendingSupplier(row);
      return;
    }
    setSupplier(row);
    setSupplierQuery("");
    setMessage(null);
    push("document");
  };

  const continueReception = () => {
    setMessage(null);
    push("document");
    if (items.length > 0) push("items");
  };

  const discardAndSwitch = () => {
    const next = pendingSupplier;
    resetForm();
    setPendingSupplier(null);
    if (next) {
      setSupplier(next);
      push("document");
    }
  };

  const selectProduct = (product) => {
    addProduct(product);
    setActiveItemId(Number(product.art_id));
    setItemError("");
    replaceTop("item");
  };

  const finishItem = () => {
    if (!activeItem) {
      back();
      return;
    }
    if (!(Number(activeItem.quantity) > 0)) {
      setItemError("Ingresa la cantidad recibida.");
      return;
    }
    if (activeItem.netUnitPrice === "" || Number(activeItem.netUnitPrice) < 0) {
      setItemError("Revisa el costo sin IVA.");
      return;
    }
    back();
  };

  const removeActiveItem = () => {
    if (!activeItem) return;
    setItems((current) => current.filter((row) => Number(row.art_id) !== Number(activeItem.art_id)));
    back();
  };

  const saveOnHold = async () => {
    const saved = await savePendingReception();
    if (saved) reset(["suppliers", "history"]);
  };

  const receiveInSicar = () => {
    if (invoiceMissing) {
      setMessage({ type: "error", text: "Ingresa el número de factura antes de recibir en SICAR." });
      push("document");
      return;
    }
    requestPaymentMethod();
  };

  const summaryBar = (
    <div className="csm-summary-bar">
      <div className="min-w-0">
        <div className="csm-summary-count">{totals.lines} {totals.lines === 1 ? "artículo" : "artículos"}</div>
        <div className="csm-summary-total">{formatMoney(totals.gross)}</div>
      </div>
      <button type="button" onClick={() => push("review")} className="csm-btn csm-btn-primary" disabled={items.length === 0}>
        Revisar recepción
      </button>
    </div>
  );

  let content = null;

  if (screen === "suppliers") {
    content = (
      <div className="csm-rx-root">
        <div className="csm-rx-root-head">
          <div className="min-w-0">
            <h2 className="csm-page-title">Recibir mercadería</h2>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <ConnectionTag connection={connection} catalogSyncing={catalogSyncing} />
              <span className="text-xs text-[var(--gray-500)]">{user}</span>
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            <button type="button" onClick={() => push("history")} className="csm-icon-btn relative" aria-label={`Recepciones y pendientes${drafts.length ? `, ${drafts.length} en espera` : ""}`}>
              <Icon name="history" />
              {drafts.length > 0 ? <span className="csm-badge">{drafts.length}</span> : null}
            </button>
            <button type="button" onClick={openConnectionDialog} className="csm-icon-btn" aria-label="Conexión con SICAR">
              <Icon name="settings" />
            </button>
          </div>
        </div>

        {connectionError ? (
          <div className={`csm-alert ${articleCatalog.length > 0 ? "is-warn" : "is-err"} mb-3`}>
            <span>
              {connectionError}
              {articleCatalog.length > 0 ? " Puedes seguir con el catálogo guardado y recibir sin factura." : ""}
            </span>
          </div>
        ) : null}
        <FlowMessage message={message} onDismiss={() => setMessage(null)} />

        {receptionInProgress ? (
          <section className="csm-rx-resume" aria-label="Recepción en curso">
            <div className="csm-overline">{editingDraftId ? "Pendiente abierto" : "Recepción en curso"}</div>
            <div className="csm-rx-resume-name">{supplier.nombre}</div>
            <div className="csm-rx-resume-meta">
              {items.length} {items.length === 1 ? "artículo" : "artículos"} · {formatMoney(totals.gross)}
              {invoiceNumber ? ` · Fact. ${invoiceNumber}` : ""}
            </div>
            <button type="button" onClick={continueReception} className="csm-btn csm-btn-primary csm-btn-block mt-3">
              Continuar recepción
            </button>
          </section>
        ) : null}

        <label className="app-label mt-1" htmlFor="rx-supplier-search">Proveedor</label>
        <div className="csm-search">
          <Icon name="search" size={18} />
          <input
            id="rx-supplier-search"
            type="search"
            value={supplierQuery}
            onChange={(event) => setSupplierQuery(event.target.value)}
            className="app-input"
            placeholder="Nombre, alias o RUC"
            autoComplete="off"
            enterKeyHint="search"
            disabled={supplierCatalog.length === 0}
          />
        </div>

        {supplierCatalog.length === 0 ? (
          <div className="csm-empty">
            {connection === "checking" || catalogSyncing ? "Descargando proveedores de SICAR..." : "Sin catálogo de proveedores. Conecta con SICAR una vez para descargarlo."}
          </div>
        ) : (
          <ul className="csm-list mt-3" aria-label="Proveedores">
            {suppliers.map((row) => {
              const isCurrent = Number(row.pro_id) === Number(supplier?.pro_id) && receptionInProgress;
              return (
                <li key={row.pro_id}>
                  <button type="button" onClick={() => (isCurrent ? continueReception() : chooseSupplier(row))} className="csm-list-row">
                    <span className="min-w-0 flex-1">
                      <span className="csm-list-title">{row.nombre}</span>
                      {row.alias || row.rfc ? (
                        <span className="csm-list-meta">{[row.alias, row.rfc].filter(Boolean).join(" · ")}</span>
                      ) : null}
                    </span>
                    {isCurrent ? <span className="csm-tag is-warn">En curso</span> : null}
                    <span className="csm-chevron"><Icon name="chevron" /></span>
                  </button>
                </li>
              );
            })}
            {suppliers.length === 0 ? <li className="csm-empty">Sin coincidencias para “{supplierQuery}”.</li> : null}
          </ul>
        )}
        {suppliers.length >= resultLimit ? (
          <p className="csm-hint">Se muestran los primeros {resultLimit}. Escribe para precisar la búsqueda.</p>
        ) : null}
      </div>
    );
  } else if (screen === "document") {
    content = (
      <MobileScreen
        title={editingDraftId ? "Recepción en espera" : "Nueva recepción"}
        subtitle="Datos de la factura"
        onBack={back}
        backLabel="Volver a proveedores"
        direction={direction}
        footer={(
          <button type="button" onClick={() => { setMessage(null); push("items"); }} className="csm-btn csm-btn-primary csm-btn-lg csm-btn-block" disabled={!supplier}>
            {items.length > 0 ? `Ver artículos (${items.length})` : "Continuar a artículos"}
          </button>
        )}
      >
        <FlowMessage message={message} onDismiss={() => setMessage(null)} />
        <section className="csm-block">
          <div className="csm-overline">Proveedor</div>
          <div className="csm-rx-supplier">{supplier?.nombre}</div>
          <button type="button" onClick={back} className="csm-link mt-1">Cambiar proveedor</button>
        </section>

        <section className="csm-block csm-form">
          <div>
            <label className="app-label" htmlFor="rx-invoice">
              Número de factura <span className="csm-required">obligatorio para SICAR</span>
            </label>
            <input
              id="rx-invoice"
              value={invoiceNumber}
              onChange={(event) => setInvoiceNumber(event.target.value.toUpperCase())}
              className="app-input uppercase"
              maxLength={19}
              autoCapitalize="characters"
              autoComplete="off"
              enterKeyHint="next"
              aria-invalid={message?.type === "error" && invoiceMissing ? "true" : undefined}
            />
          </div>
          <div>
            <label className="app-label" htmlFor="rx-date">Fecha de factura</label>
            <input
              id="rx-date"
              type="date"
              value={purchaseDate}
              max={maxDate}
              onChange={(event) => setPurchaseDate(event.target.value)}
              className="app-input"
            />
          </div>
          <div>
            <label className="app-label" htmlFor="rx-note">Nota <span className="csm-optional">opcional</span></label>
            <input
              id="rx-note"
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              className="app-input"
              maxLength={180}
              enterKeyHint="done"
            />
          </div>
        </section>

        <section className="csm-block">
          <h3 className="csm-section-title">Foto de factura <span className="csm-optional">opcional</span></h3>
          {invoiceSupport ? (
            <div className="csm-file-row">
              <Icon name="file" />
              <span className="min-w-0 flex-1 break-all text-sm">{invoiceSupport.name}</span>
              <button type="button" onClick={clearInvoiceSupport} className="csm-btn csm-btn-ghost csm-btn-sm text-[var(--err)]">Quitar</button>
            </div>
          ) : null}
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button type="button" onClick={takeInvoicePhoto} disabled={cameraLoading} className="csm-btn csm-btn-secondary">
              <Icon name="camera" size={18} />
              {cameraLoading ? "Abriendo..." : "Tomar foto"}
            </button>
            <button type="button" onClick={chooseInvoiceFile} className="csm-btn csm-btn-secondary">
              <Icon name="file" size={18} />
              Elegir archivo
            </button>
          </div>
        </section>

        <section className="csm-block">
          <h3 className="csm-section-title">Retenciones <span className="csm-optional">solo contabilidad, no se envían a SICAR</span></h3>
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
                className="app-input csm-num w-36"
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
                className="app-input csm-num w-36"
              />
            ) : null}
          </div>
          <p className="csm-hint">Base: {formatMoney(totals.subtotal)} sin IVA</p>
        </section>

        {receptionInProgress ? (
          <button type="button" onClick={() => setDiscardOpen(true)} className="csm-btn csm-btn-ghost csm-btn-block text-[var(--err)]">
            Descartar recepción
          </button>
        ) : null}
      </MobileScreen>
    );
  } else if (screen === "items") {
    content = (
      <MobileScreen
        title="Artículos"
        subtitle={supplier?.nombre}
        onBack={back}
        backLabel="Volver a datos de factura"
        direction={direction}
        footer={summaryBar}
      >
        <FlowMessage message={message} onDismiss={() => setMessage(null)} />
        <button type="button" onClick={() => push("search")} className="csm-search-trigger" disabled={articleCatalog.length === 0}>
          <Icon name="search" size={18} />
          <span>Buscar por nombre o clave</span>
        </button>

        {missingQuantity.length > 0 ? (
          <div className="csm-alert is-warn mt-3">
            {missingQuantity.length === 1 ? "1 artículo sin cantidad." : `${missingQuantity.length} artículos sin cantidad.`}
          </div>
        ) : null}

        {items.length === 0 ? (
          <div className="csm-empty mt-3">
            <p>Sin artículos en esta recepción.</p>
            <button type="button" onClick={() => push("search")} className="csm-btn csm-btn-secondary mt-3" disabled={articleCatalog.length === 0}>
              <Icon name="plus" size={18} />
              Agregar artículo
            </button>
          </div>
        ) : (
          <ul className="csm-rx-items" aria-label="Artículos de la recepción">
            {items.map((item) => {
              const unit = articleUnit(item);
              const hasQuantity = Number(item.quantity) > 0;
              return (
                <li key={item.art_id} className={`csm-rx-item ${hasQuantity ? "" : "is-incomplete"}`}>
                  <button type="button" onClick={() => openItem(item.art_id)} className="csm-rx-item-head" aria-label={`Editar ${item.descripcion}`}>
                    <ProductIdentity article={item} size="lg" />
                    <span className="csm-chevron"><Icon name="chevron" /></span>
                  </button>
                  <div className="csm-rx-figures">
                    <div className="csm-rx-figure">
                      <label htmlFor={`rx-qty-${item.art_id}`}>Recibido{unit ? ` (${unit})` : ""}</label>
                      <div className="flex items-center gap-1.5">
                        <TouchNumericInput
                          id={`rx-qty-${item.art_id}`}
                          value={item.quantity}
                          onValueChange={(value) => updateItem(item.art_id, "quantity", value)}
                          onOpenBultos={() => openBultos(item.art_id)}
                          bultosCount={item.bultos?.length || 0}
                          label={`Cantidad recibida · ${item.descripcion}`}
                          decimals={4}
                          placeholder="0"
                          className="app-input csm-num"
                        />
                      </div>
                      {item.bultos?.length ? <span className="csm-figure-note">{item.bultos.length} bultos</span> : null}
                    </div>
                    <div className="csm-rx-figure">
                      <span className="csm-figure-label">Costo s/IVA</span>
                      <span className="csm-figure-value">{formatMoney(item.netUnitPrice)}</span>
                    </div>
                    <div className="csm-rx-figure text-right">
                      <span className="csm-figure-label">Subtotal</span>
                      <span className="csm-figure-value">{formatMoney(lineSubtotal(item))}</span>
                    </div>
                  </div>
                  {!hasQuantity ? <div className="csm-rx-item-flag">Falta cantidad</div> : null}
                </li>
              );
            })}
          </ul>
        )}
      </MobileScreen>
    );
  } else if (screen === "search") {
    const addedById = new Map(items.map((item) => [Number(item.art_id), item]));
    content = (
      <MobileScreen title="Agregar artículo" subtitle={supplier?.nombre} onBack={back} backLabel="Volver a artículos" direction={direction}>
        <label className="app-label" htmlFor="rx-product-search">Buscar artículo</label>
        <div className="csm-search">
          <Icon name="search" size={18} />
          <input
            id="rx-product-search"
            ref={searchInputRef}
            type="search"
            value={productQuery}
            onChange={(event) => setProductQuery(event.target.value)}
            className="app-input"
            placeholder="Nombre o clave"
            autoComplete="off"
            autoCapitalize="characters"
            enterKeyHint="search"
          />
        </div>
        <div className="csm-result-count" aria-live="polite">
          {productQuery ? `${products.length}${products.length >= resultLimit ? "+" : ""} resultados` : "Escribe parte del nombre o la clave"}
        </div>
        <ul className="csm-list" aria-label="Resultados">
          {products.map((product) => {
            const added = addedById.get(Number(product.art_id));
            return (
              <li key={product.art_id}>
                <button type="button" onClick={() => selectProduct(product)} className="csm-list-row items-start">
                  <ProductIdentity
                    article={product}
                    size="md"
                    extra={<span>Últ. costo {formatMoney(product.lastPurchaseNet ?? product.precioCompra)}</span>}
                  />
                  {added ? (
                    <span className="csm-tag is-ok shrink-0">
                      {Number(added.quantity) > 0 ? `${formatQuantity(added.quantity)} ${articleUnit(added)}` : "Agregado"}
                    </span>
                  ) : (
                    <span className="csm-chevron self-center"><Icon name="plus" /></span>
                  )}
                </button>
              </li>
            );
          })}
          {productQuery && products.length === 0 ? <li className="csm-empty">Sin coincidencias. Revisa la clave o prueba con otra palabra.</li> : null}
        </ul>
        {products.length >= resultLimit ? <p className="csm-hint">Hay más coincidencias. Escribe más letras para precisar.</p> : null}
      </MobileScreen>
    );
  } else if (screen === "item") {
    const unit = articleUnit(activeItem);
    content = (
      <MobileScreen
        title="Artículo"
        subtitle={supplier?.nombre}
        onBack={back}
        backLabel="Volver a artículos"
        direction={direction}
        footer={activeItem ? (
          <div className="grid grid-cols-[auto_1fr] gap-2">
            <button type="button" onClick={removeActiveItem} className="csm-btn csm-btn-danger-outline" aria-label={`Quitar ${activeItem.descripcion} de la recepción`}>
              <Icon name="trash" size={18} />
              Quitar
            </button>
            <button type="button" onClick={finishItem} className="csm-btn csm-btn-primary csm-btn-lg">Guardar</button>
          </div>
        ) : null}
      >
        {activeItem ? (
          <>
            <section className="csm-block">
              <ProductIdentity article={activeItem} size="xl" hideMeta />
              <dl className="csm-kv mt-3">
                <div><dt>Código</dt><dd className="font-mono">{activeItem.clave || "—"}</dd></div>
                <div><dt>Unidad</dt><dd>{unit || "—"}</dd></div>
                <div><dt>IVA</dt><dd>{Number(activeItem.taxPercent || 0)}%</dd></div>
                <div><dt>Último costo</dt><dd>{formatMoney(activeItem.lastPurchaseNet ?? activeItem.precioCompra)}</dd></div>
              </dl>
            </section>

            <section className="csm-block csm-form">
              <div>
                <label className="app-label" htmlFor="rx-item-qty">Cantidad recibida{unit ? ` (${unit})` : ""}</label>
                <div className="csm-input-unit">
                  <TouchNumericInput
                    id={"rx-item-qty"}
                    value={activeItem.quantity}
                    onValueChange={(value) => {
                      updateItem(activeItem.art_id, "quantity", value);
                      setItemError("");
                    }}
                    onOpenBultos={() => openBultos(activeItem.art_id)}
                    bultosCount={activeItem.bultos?.length || 0}
                    label={`Cantidad recibida · ${activeItem.descripcion}`}
                    decimals={4}
                    placeholder="0"
                    className="app-input csm-num csm-num-lg"
                  />
                  {unit ? <span>{unit}</span> : null}
                </div>
                {itemError && !(Number(activeItem.quantity) > 0) ? <p className="csm-field-error" role="alert">{itemError}</p> : null}
                <button type="button" onClick={() => openBultos(activeItem.art_id)} className="csm-btn csm-btn-secondary csm-btn-sm mt-2">
                  <Icon name="scale" size={16} />
                  {activeItem.bultos?.length ? `Bultos: ${activeItem.bultos.length} (editar)` : "Sumar por bultos"}
                </button>
              </div>

              <div>
                <label className="app-label" htmlFor="rx-item-cost">Costo unitario sin IVA (C$)</label>
                <TouchNumericInput
                  id={"rx-item-cost"}
                  value={activeItem.netUnitPrice}
                  onValueChange={(value) => {
                    updateItem(activeItem.art_id, "netUnitPrice", value);
                    setItemError("");
                  }}
                  label={`Costo sin IVA · ${activeItem.descripcion}`}
                  decimals={2}
                  placeholder="0.00"
                  className="app-input csm-num csm-num-lg"
                />
                {itemError && Number(activeItem.quantity) > 0 ? <p className="csm-field-error" role="alert">{itemError}</p> : null}
              </div>
            </section>

            <section className="csm-block">
              <dl className="csm-totals is-flush">
                <div className="is-strong"><dt>Subtotal sin IVA</dt><dd>{formatMoney(lineSubtotal(activeItem))}</dd></div>
              </dl>
            </section>
          </>
        ) : (
          <div className="csm-empty">Este artículo ya no está en la recepción.</div>
        )}
      </MobileScreen>
    );
  } else if (screen === "review") {
    content = (
      <MobileScreen
        title="Revisar recepción"
        subtitle={supplier?.nombre}
        onBack={back}
        backLabel="Volver a artículos"
        direction={direction}
        footer={(
          <div className="grid gap-2">
            {connection !== "online" ? <p className="csm-footer-note">SICAR sin conexión: solo puedes recibir sin factura.</p> : null}
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={saveOnHold} disabled={loading} className="csm-btn csm-btn-secondary csm-btn-lg">
                {loading ? "Guardando..." : "Recibir sin factura"}
              </button>
              <button type="button" onClick={receiveInSicar} disabled={loading || connection !== "online"} className="csm-btn csm-btn-primary csm-btn-lg">
                {loading ? "Validando..." : "Recibir en SICAR"}
              </button>
            </div>
          </div>
        )}
      >
        <FlowMessage message={message} onDismiss={() => setMessage(null)} />
        <section className="csm-block">
          <dl className="csm-kv">
            <div className="col-span-2"><dt>Proveedor</dt><dd>{supplier?.nombre}</dd></div>
            <div>
              <dt>Factura</dt>
              <dd>
                {invoiceMissing ? (
                  <button type="button" onClick={() => push("document")} className="csm-tag is-warn">Falta número</button>
                ) : invoiceNumber}
              </dd>
            </div>
            <div><dt>Fecha</dt><dd>{purchaseDate}</dd></div>
            {comment ? <div className="col-span-2"><dt>Nota</dt><dd>{comment}</dd></div> : null}
          </dl>
          <button type="button" onClick={() => push("document")} className="csm-link mt-2">Editar datos de factura</button>
        </section>

        <section className="csm-block">
          <h3 className="csm-section-title">{items.length} {items.length === 1 ? "artículo" : "artículos"}</h3>
          <ol className="csm-review-lines">
            {items.map((item, index) => {
              const unit = articleUnit(item);
              const hasQuantity = Number(item.quantity) > 0;
              return (
                <li key={item.art_id}>
                  <button type="button" onClick={() => openItem(item.art_id)} className="csm-review-line">
                    <span className="csm-review-index">{index + 1}</span>
                    <span className="min-w-0 flex-1">
                      <ProductIdentity article={item} size="md" />
                      <span className="csm-review-calc">
                        {hasQuantity ? (
                          <span>{formatQuantity(item.quantity)} {unit} × {formatMoney(item.netUnitPrice)}</span>
                        ) : (
                          <span className="csm-tag is-err">Sin cantidad</span>
                        )}
                        <strong>{formatMoney(lineSubtotal(item))}</strong>
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </section>

        <section className="csm-block">
        <dl className="csm-totals is-flush">
          <div><dt>Subtotal sin IVA</dt><dd>{formatMoney(totals.subtotal)}</dd></div>
          <div><dt>IVA</dt><dd>{formatMoney(totals.taxes)}</dd></div>
          <div className="is-strong"><dt>Total factura</dt><dd>{formatMoney(totals.gross)}</dd></div>
          {retentionTotal > 0 ? (
            <>
              <div><dt>Retenciones</dt><dd>− {formatMoney(retentionTotal)}</dd></div>
              <div className="is-strong"><dt>Neto a pagar</dt><dd>{formatMoney(netTotal)}</dd></div>
            </>
          ) : null}
        </dl>
        </section>
        {invoiceSupport ? <p className="csm-hint">Foto de factura adjunta: {invoiceSupport.name}</p> : null}
      </MobileScreen>
    );
  } else if (screen === "history") {
    content = (
      <ProviderPurchaseHistory
        mobile
        drafts={drafts}
        purchases={history.purchases}
        loading={history.loading}
        error={history.error}
        onBack={back}
        onDeleteDraft={history.onDeleteDraft}
        onEditDraft={(draft) => {
          history.onEditDraft(draft);
          reset(["suppliers", "document", "items"]);
        }}
        onRefresh={history.refresh}
      />
    );
  }

  return (
    <div className="csm-rx">
      {content}

      {pendingSupplier ? (
        <ConfirmSheet
          title="Hay una recepción en curso"
          onClose={() => setPendingSupplier(null)}
          actions={(
            <>
              <button type="button" onClick={() => setPendingSupplier(null)} className="csm-btn csm-btn-secondary">Seguir con la actual</button>
              <button type="button" onClick={discardAndSwitch} className="csm-btn csm-btn-danger">Descartar y cambiar</button>
            </>
          )}
        >
          <p><strong>{supplier?.nombre}</strong> tiene {items.length} {items.length === 1 ? "artículo" : "artículos"} sin enviar.</p>
          <p className="mt-2">Si empiezas con <strong>{pendingSupplier.nombre}</strong>, esa recepción se descarta. Para conservarla, ábrela y usa “Recibir sin factura”.</p>
        </ConfirmSheet>
      ) : null}

      {discardOpen ? (
        <ConfirmSheet
          title="¿Descartar esta recepción?"
          onClose={() => setDiscardOpen(false)}
          actions={(
            <>
              <button type="button" onClick={() => setDiscardOpen(false)} className="csm-btn csm-btn-secondary">Seguir editando</button>
              <button
                type="button"
                onClick={() => {
                  setDiscardOpen(false);
                  resetForm();
                  reset("suppliers");
                }}
                className="csm-btn csm-btn-danger"
              >
                Descartar
              </button>
            </>
          )}
        >
          Se borran los artículos, cantidades y datos de factura capturados en este teléfono.
          {editingDraftId ? " El pendiente guardado se conserva en el historial." : ""}
        </ConfirmSheet>
      ) : null}
    </div>
  );
}
