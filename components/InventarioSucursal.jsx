"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  checkSicarInventoryApi,
  getInventoryAdjustmentRequests,
  getSicarInventoryCatalog,
  previewInventoryAdjustmentRequest,
  submitInventoryAdjustmentRequest,
} from "@/lib/sicarInventoryApi";

const numberFormat = new Intl.NumberFormat("es-NI", { minimumFractionDigits: 0, maximumFractionDigits: 4 });

function normalizeText(value = "") {
  return `${value}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function branchToken(value = "") {
  const normalized = normalizeText(value);
  if (normalized.includes("amparito")) return "amparito";
  if (normalized.includes("masaya")) return "masaya";
  if (normalized.includes("nindiri")) return "nindiri";
  if (normalized.includes("granada")) return "granada";
  return normalized;
}

function localDate() {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Managua", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function newIdentity() {
  const stamp = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Managua", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).format(new Date()).replace(/[^0-9]/g, "");
  const random = globalThis.crypto?.randomUUID?.().replaceAll("-", "") || `${Date.now()}${Math.random()}`.replace(/\D/g, "");
  return { sessionId: random.slice(0, 32), folio: `INVCSM${stamp}` };
}

function scoreArticle(article, query) {
  const needle = normalizeText(query);
  if (!needle) return null;
  const key = normalizeText(article.clave);
  const description = normalizeText(article.descripcion);
  if (key === needle) return 0;
  if (key.startsWith(needle)) return 1;
  if (description.startsWith(needle)) return 2;
  if (description.split(" ").some((token) => token.startsWith(needle))) return 3;
  if (key.includes(needle) || description.includes(needle)) return 4;
  return needle.split(" ").filter(Boolean).every((word) => description.includes(word)) ? 5 : null;
}

function roundQuantity(value) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 10000) / 10000;
}

function createInventoryLineId(articleId) {
  const random = globalThis.crypto?.randomUUID?.().replaceAll("-", "") || `${Date.now()}${Math.random()}`.replace(/\D/g, "");
  return `inventory-${articleId}-${random}`;
}

function hydrateDraftLines(lines = []) {
  return lines.map((line, index) => ({
    ...line,
    lineId: line.lineId || `legacy-${line.articleId}-${normalizeText(line.zona || "Bodega principal")}-${index}`,
    zona: `${line.zona || "Bodega principal"}`.trim() || "Bodega principal",
  }));
}

function aggregateCountedLines(lines = []) {
  const totals = new Map();
  lines.forEach((line) => {
    if (line.countedExistence === "" || !Number.isFinite(Number(line.countedExistence))) return;
    const key = Number(line.articleId) || `${line.clave}`;
    const current = totals.get(key) || {
      articleId: Number(line.articleId),
      clave: line.clave,
      descripcion: line.descripcion,
      unidad: line.unidad,
      currentExistence: line.currentExistence === null ? null : Number(line.currentExistence),
      countedExistence: 0,
      zones: [],
    };
    current.countedExistence = roundQuantity(current.countedExistence + Number(line.countedExistence));
    if (!current.zones.includes(line.zona)) current.zones.push(line.zona);
    totals.set(key, current);
  });
  return [...totals.values()];
}

function Icon({ name, className = "h-5 w-5" }) {
  const paths = {
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
    inventory: <><path d="M4 5h16v15H4z" /><path d="M8 2h8v6H8zM8 12h8M8 16h5" /></>,
    history: <><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v5h5M12 7v5l3 2" /></>,
    refresh: <><path d="M20 6v5h-5" /><path d="M4 18v-5h5M18 9a7 7 0 0 0-12-2M6 15a7 7 0 0 0 12 2" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1" /></>,
    trash: <><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13" /></>,
    plus: <path d="M12 5v14M5 12h14" />,
    scale: <><path d="M6 5h12l2 16H4L6 5Z" /><path d="M9 10a3 3 0 0 1 6 0M12 10l2-2" /></>,
    cloud: <><path d="M6 19h12a4 4 0 0 0 .4-8A6 6 0 0 0 7 9a5 5 0 0 0-1 10Z" /><path d="m9 14 3-3 3 3M12 11v6" /></>,
  };
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

function WeightsDialog({ line, onClose, onSave }) {
  const [weights, setWeights] = useState(line.pesos || []);
  const [value, setValue] = useState("");
  const inputRef = useRef(null);
  const total = roundQuantity(weights.reduce((sum, weight) => sum + Number(weight || 0), 0));
  const addWeight = () => {
    const numeric = Number(`${value}`.replace(",", "."));
    if (!Number.isFinite(numeric) || numeric < 0) return;
    setWeights((current) => [...current, roundQuantity(numeric)]);
    setValue("");
    requestAnimationFrame(() => inputRef.current?.focus());
  };
  return <div className="app-modal z-[120] px-4" role="dialog" aria-modal="true"><div className="app-modal-panel w-full max-w-md overflow-hidden p-0">
    <div className="bg-slate-950 p-5 text-white"><div className="text-[10px] font-black uppercase tracking-[0.2em] text-lime-300">Suma de bultos</div><h2 className="mt-2 truncate text-xl font-black">{line.descripcion}</h2><div className="mt-4 flex items-end justify-between"><span className="text-sm font-bold text-slate-300">Total</span><strong className="text-3xl">{numberFormat.format(total)} lb</strong></div></div>
    <div className="p-5"><div className="flex gap-2"><input ref={inputRef} autoFocus inputMode="decimal" className="app-input text-right text-xl font-black" value={value} onChange={(event) => setValue(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addWeight(); } }} placeholder="Peso lb" /><button type="button" className="app-button-primary w-14 shrink-0 px-0" onClick={addWeight}><Icon name="plus" /></button></div>
      <div className="mt-4 max-h-48 overflow-y-auto rounded-xl border border-slate-200">{weights.length ? weights.map((weight, index) => <div key={`${index}-${weight}`} className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5 last:border-0"><span className="text-xs font-black text-slate-400">Bulto {index + 1}</span><div className="flex items-center gap-3"><strong>{numberFormat.format(weight)} lb</strong><button type="button" className="text-rose-500" onClick={() => setWeights((current) => current.filter((_, itemIndex) => itemIndex !== index))}><Icon name="trash" className="h-4 w-4" /></button></div></div>) : <div className="p-6 text-center text-sm font-bold text-slate-400">Escribe un peso y presiona Enter.</div>}</div>
      <div className="mt-5 grid grid-cols-2 gap-3"><button type="button" className="app-button-secondary" onClick={onClose}>Cancelar</button><button type="button" className="app-button-primary" onClick={() => onSave(weights, total)}>Usar total</button></div>
    </div>
  </div></div>;
}

function statusMeta(status) {
  return ({
    requested: ["Solicitado", "border-sky-200 bg-sky-50 text-sky-700"],
    processing: ["Procesando", "border-amber-200 bg-amber-50 text-amber-700"],
    done: ["Aplicado", "border-emerald-200 bg-emerald-50 text-emerald-700"],
    duplicate: ["Ya aplicado", "border-emerald-200 bg-emerald-50 text-emerald-700"],
    "dry-run": ["Simulación", "border-violet-200 bg-violet-50 text-violet-700"],
    error: ["Error", "border-rose-200 bg-rose-50 text-rose-700"],
  })[`${status || "requested"}`] || [`${status}`, "border-slate-200 bg-slate-50 text-slate-600"];
}

export default function InventarioSucursal({ user, companyContext }) {
  const draftKey = `csmInventoryApiDraft:${companyContext?.identificador || branchToken(user) || "branch"}`;
  const initialDraft = useRef(null);
  if (initialDraft.current === null && typeof window !== "undefined") {
    try { initialDraft.current = JSON.parse(window.localStorage.getItem(draftKey) || "null"); } catch { initialDraft.current = null; }
  }
  const identity = useRef(initialDraft.current?.identity || newIdentity());
  const searchRoot = useRef(null);
  const [tab, setTab] = useState("count");
  const [catalog, setCatalog] = useState([]);
  const [branch, setBranch] = useState(null);
  const [health, setHealth] = useState(null);
  const [history, setHistory] = useState([]);
  const [lines, setLines] = useState(() => hydrateDraftLines(initialDraft.current?.lines || []));
  const [date, setDate] = useState(initialDraft.current?.date || localDate());
  const [zone, setZone] = useState(initialDraft.current?.zone || "Bodega principal");
  const [performedBy, setPerformedBy] = useState(initialDraft.current?.performedBy || "");
  const [supervisedBy, setSupervisedBy] = useState(initialDraft.current?.supervisedBy || "");
  const [notes, setNotes] = useState(initialDraft.current?.notes || "");
  const [query, setQuery] = useState("");
  const [showResults, setShowResults] = useState(false);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [weightsLineId, setWeightsLineId] = useState(null);
  const [serverPreview, setServerPreview] = useState(null);
  const [draftStatus, setDraftStatus] = useState(initialDraft.current?.status || "active");
  const [draftSavedAt, setDraftSavedAt] = useState(initialDraft.current?.updatedAt || null);

  const connectionMismatch = Boolean(
    health?.company?.identifier
    && health.company.identifier !== companyContext?.identificador,
  );
  const writeEnabled = health?.writes?.inventoryAdjustments === true;

  async function loadData() {
    setLoading(true);
    setMessage(null);
    const [healthResult, catalogResult, historyResult] = await Promise.allSettled([
      checkSicarInventoryApi(),
      getSicarInventoryCatalog(),
      getInventoryAdjustmentRequests(100),
    ]);
    if (healthResult.status === "fulfilled") setHealth(healthResult.value);
    if (catalogResult.status === "fulfilled") { setBranch(catalogResult.value.branch); setCatalog(catalogResult.value.articles || []); }
    if (historyResult.status === "fulfilled") setHistory(historyResult.value.rows || []);
    const failure = [healthResult, catalogResult, historyResult].find((result) => result.status === "rejected");
    if (failure) setMessage({ type: "error", text: failure.reason?.message || "No se pudo consultar el inventario." });
    setLoading(false);
  }

  useEffect(() => { loadData(); }, []);
  useEffect(() => {
    const close = (event) => { if (!searchRoot.current?.contains(event.target)) setShowResults(false); };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);
  useEffect(() => {
    const hasContent = lines.length > 0 || performedBy.trim() || supervisedBy.trim() || notes.trim();
    if (!hasContent) {
      window.localStorage.removeItem(draftKey);
      return;
    }
    const updatedAt = new Date().toISOString();
    window.localStorage.setItem(draftKey, JSON.stringify({ identity: identity.current, date, zone, performedBy, supervisedBy, notes, lines, status: draftStatus, updatedAt }));
  }, [date, draftKey, draftStatus, lines, notes, performedBy, supervisedBy, zone]);

  const currentZoneToken = normalizeText(zone || "Bodega principal");
  const selectedKeys = useMemo(() => new Set(lines.filter((line) => normalizeText(line.zona) === currentZoneToken).map((line) => `${line.clave}`)), [currentZoneToken, lines]);
  const results = useMemo(() => !query.trim() ? [] : catalog.map((article) => ({ article, score: scoreArticle(article, query) })).filter((entry) => entry.score !== null && !selectedKeys.has(`${entry.article.clave}`)).sort((left, right) => left.score - right.score || left.article.descripcion.localeCompare(right.article.descripcion)).slice(0, 30).map((entry) => entry.article), [catalog, query, selectedKeys]);
  const aggregatedLines = useMemo(() => aggregateCountedLines(lines), [lines]);
  const totalsByArticle = useMemo(() => new Map(aggregatedLines.map((line) => [Number(line.articleId), line])), [aggregatedLines]);
  const zoneCount = useMemo(() => new Set(lines.map((line) => normalizeText(line.zona)).filter(Boolean)).size, [lines]);
  const summary = useMemo(() => {
    const ready = aggregatedLines;
    const changed = ready.filter((line) => line.currentExistence === null || Math.abs(Number(line.countedExistence) - Number(line.currentExistence)) > 0.0001);
    const comparable = changed.filter((line) => line.currentExistence !== null);
    return { ready: ready.length, changed: changed.length, positive: comparable.filter((line) => Number(line.countedExistence) > Number(line.currentExistence)).length, negative: comparable.filter((line) => Number(line.countedExistence) < Number(line.currentExistence)).length };
  }, [aggregatedLines]);

  function addArticle(article) {
    const activeZone = zone.trim();
    if (!activeZone) {
      setMessage({ type: "error", text: "Indica la zona antes de agregar productos." });
      return;
    }
    const lineId = createInventoryLineId(article.art_id);
    setLines((current) => [...current, { lineId, articleId: Number(article.art_id), clave: article.clave, descripcion: article.descripcion, unidad: `${article.unidad || "PZA"}`.toUpperCase(), currentExistence: article.existencia === null || article.existencia === undefined ? null : Number(article.existencia), countedExistence: "", pesos: [], cajas: 0, zona: activeZone }]);
    setDraftStatus("active");
    setQuery(""); setShowResults(false);
    requestAnimationFrame(() => document.querySelector(`[data-count-id="${lineId}"]`)?.focus());
  }
  function updateLine(lineId, patch) {
    setLines((current) => current.map((line) => line.lineId === lineId ? { ...line, ...patch } : line));
    setDraftStatus("active");
    setPreviewOpen(false);
  }
  function newDraft(force = false) {
    if (!force && lines.length > 0 && !window.confirm("¿Descartar el levantamiento actual?")) return;
    identity.current = newIdentity(); setLines([]); setDate(localDate()); setZone("Bodega principal"); setPerformedBy(""); setSupervisedBy(""); setNotes(""); setPreviewOpen(false); setDraftStatus("active"); setDraftSavedAt(null); window.localStorage.removeItem(draftKey);
  }
  function holdDraft() {
    if (lines.length < 1) {
      setMessage({ type: "error", text: "Agrega al menos un producto antes de guardar el levantamiento en espera." });
      return;
    }
    const updatedAt = new Date().toISOString();
    window.localStorage.setItem(draftKey, JSON.stringify({ identity: identity.current, date, zone, performedBy, supervisedBy, notes, lines, status: "waiting", updatedAt }));
    setDraftStatus("waiting");
    setDraftSavedAt(updatedAt);
    setMessage({ type: "success", text: "Levantamiento guardado en espera. Puedes cerrar la app y continuar después." });
  }
  function buildAdjustmentPayload() {
    return {
      sessionId: identity.current.sessionId,
      folio: identity.current.folio,
      branchId: companyContext?.branchId,
      branchAlias: companyContext?.branchAlias,
      fecha: date,
      zona: aggregatedLines.length > 0 ? [...new Set(aggregatedLines.flatMap((line) => line.zones))].join(", ") : zone,
      realizadoPor: performedBy,
      supervisadoPor: supervisedBy,
      observaciones: notes,
      items: aggregatedLines.map((line) => ({
          articleId: line.articleId,
          sku: line.clave,
          nombre: line.descripcion,
          unidad: line.unidad,
          cantidadContada: Number(line.countedExistence),
          expectedExistence: line.currentExistence === null ? null : Number(line.currentExistence),
          zonas: line.zones,
        })),
    };
  }
  async function preparePreview() {
    if (connectionMismatch || !writeEnabled) return;
    if (!performedBy.trim() || !supervisedBy.trim()) {
      setMessage({ type: "error", text: "Indica quién realizó y quién supervisó el levantamiento." });
      return;
    }
    setWorking(true);
    setMessage(null);
    try {
      const preview = await previewInventoryAdjustmentRequest(buildAdjustmentPayload());
      setServerPreview(preview);
      setPreviewOpen(true);
    } catch (error) {
      setMessage({ type: "error", text: error.message });
    } finally {
      setWorking(false);
    }
  }
  async function submitAdjustment() {
    if (connectionMismatch || !writeEnabled || !serverPreview) return;
    if (!performedBy.trim() || !supervisedBy.trim()) { setMessage({ type: "error", text: "Indica quién realizó y quién supervisó el levantamiento." }); setPreviewOpen(false); return; }
    setWorking(true); setMessage(null);
    try {
      const result = await submitInventoryAdjustmentRequest(buildAdjustmentPayload(), serverPreview);
      setHistory((current) => [result.request, ...current.filter((item) => item.sessionId !== result.request.sessionId)]);
      setPreviewOpen(false);
      setMessage(result.requiresRetry
        ? { type: "error", text: "Este levantamiento ya existe con error. Usa Reintentar desde el historial." }
        : { type: "success", text: result.request.message });
      newDraft(true); setTab("history");
    } catch (error) { setMessage({ type: "error", text: error.message }); setPreviewOpen(false); } finally { setWorking(false); }
  }

  const activeWeightsLine = lines.find((line) => line.lineId === weightsLineId) || null;
  return <div className="erp-operation-module inventory-module min-w-0 space-y-4 pb-24 lg:pb-6">
    <section className="erp-module-hero erp-inventory-hero overflow-hidden border border-emerald-950/20 bg-[#10271f] text-white">
      <div className="grid gap-4 p-5 sm:p-6 lg:grid-cols-[1fr_auto] lg:items-end"><div><div className="text-[10px] font-black uppercase tracking-[0.28em] text-lime-300">Módulo Inventario</div><h2 className="mt-2 text-2xl font-black sm:text-3xl">Levantamiento físico</h2><p className="mt-2 text-sm font-semibold text-emerald-50/70">Conteo validado y aplicado mediante la API local de SICAR.</p></div><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full border px-3 py-2 text-xs font-black ${writeEnabled ? "border-lime-300/25 bg-lime-300/10 text-lime-200" : "border-amber-300/25 bg-amber-300/10 text-amber-100"}`}>{writeEnabled ? `API conectada · ${companyContext?.empresa || user}` : "API sin escritura"}</span></div></div>
      {connectionMismatch ? <div className="border-t border-rose-300/20 bg-rose-400/15 px-5 py-3 text-sm font-black text-rose-100">Bloqueado: sesión {user}, servidor {branch?.alias}.</div> : null}
      {!writeEnabled ? <div className="border-t border-amber-300/20 bg-amber-300/10 px-5 py-3 text-sm font-black text-amber-100">La API local todavía no permite aplicar ajustes.</div> : null}
    </section>
    <div className="erp-segmented-control grid grid-cols-2 gap-1 border border-slate-200 bg-white p-1"><button type="button" onClick={() => setTab("count")} className={`erp-segmented-button flex min-h-11 items-center justify-center gap-2 text-sm font-black ${tab === "count" ? "is-active" : ""}`}><Icon name="inventory" />Levantamiento</button><button type="button" onClick={() => setTab("history")} className={`erp-segmented-button flex min-h-11 items-center justify-center gap-2 text-sm font-black ${tab === "history" ? "is-active" : ""}`}><Icon name="history" />Historial</button></div>
    {message ? <div className={`erp-module-alert rounded-2xl border px-4 py-3 text-sm font-bold ${message.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-rose-200 bg-rose-50 text-rose-700"}`}>{message.text}</div> : null}
    {loading ? <div className="erp-loading-strip" role="status" aria-live="polite"><span className="erp-loading-spinner" aria-hidden="true" /><span>Consultando inventario SICAR</span><span className="erp-loading-track" aria-hidden="true"><span /></span></div> : null}
    {draftStatus === "waiting" && lines.length > 0 ? <div className="erp-module-alert flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3"><div><div className="text-sm font-black text-amber-900">Levantamiento en espera</div><div className="text-xs font-bold text-amber-700">{lines.length} líneas · {zoneCount} zonas{draftSavedAt ? ` · Guardado ${new Date(draftSavedAt).toLocaleString("es-NI")}` : ""}</div></div><button type="button" className="erp-primary-action rounded-lg bg-amber-500 px-4 py-2 text-sm font-black text-white" onClick={() => { setDraftStatus("active"); setMessage({ type: "success", text: "Levantamiento reanudado." }); }}>Continuar</button></div> : null}

    {tab === "count" ? <>
      <section className="erp-form-panel rounded-[1.2rem] border border-slate-200 bg-white p-4 sm:p-5">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[150px_180px_1fr_1fr_auto]"><label><span className="app-label">Folio</span><input className="app-input bg-slate-50 font-mono text-xs" value={identity.current.folio} readOnly /></label><label><span className="app-label">Fecha</span><input type="date" className="app-input" max={localDate()} value={date} onChange={(event) => { setDate(event.target.value); setDraftStatus("active"); }} /></label><label><span className="app-label">Realizado por</span><input className="app-input" value={performedBy} onChange={(event) => { setPerformedBy(event.target.value); setDraftStatus("active"); }} placeholder="Nombre" /></label><label><span className="app-label">Supervisado por</span><input className="app-input" value={supervisedBy} onChange={(event) => { setSupervisedBy(event.target.value); setDraftStatus("active"); }} placeholder="Nombre" /></label><div className="grid gap-2 self-end"><button type="button" className="app-button-secondary" onClick={holdDraft}>Guardar en espera</button><button type="button" className="app-button-ghost" onClick={() => newDraft(false)}>Nuevo</button></div></div>
        <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(180px,0.4fr)_1fr]"><label><span className="app-label">Zona actual</span><input className="app-input" value={zone} onChange={(event) => { setZone(event.target.value); setDraftStatus("active"); }} placeholder="Bodega principal" /><span className="mt-1 block text-[10px] font-bold text-slate-400">La zona es informativa. SICAR recibirá el total sumado por clave.</span></label><label><span className="app-label">Observación</span><input className="app-input" maxLength={500} value={notes} onChange={(event) => { setNotes(event.target.value); setDraftStatus("active"); }} placeholder="Opcional" /></label></div>
        <div ref={searchRoot} className="relative mt-4"><label className="app-label">Agregar producto</label><div className="relative"><span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-emerald-600"><Icon name="search" /></span><input className="app-input pl-12 pr-14" value={query} onChange={(event) => { setQuery(event.target.value); setShowResults(true); }} onFocus={() => setShowResults(true)} onKeyDown={(event) => { if (event.key === "Enter" && results[0]) { event.preventDefault(); addArticle(results[0]); } }} placeholder="Clave, código de barra o nombre" /><button type="button" className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-xl bg-emerald-600 text-white" onClick={() => results[0] && addArticle(results[0])} aria-label="Agregar"><Icon name="plus" /></button></div>
          {showResults && query.trim() ? <div className="absolute inset-x-0 top-full z-[80] mt-2 max-h-72 overflow-y-auto rounded-2xl border border-emerald-200 bg-white p-2 shadow-2xl">{results.length ? results.map((article) => <button key={article.art_id} type="button" onClick={() => addArticle(article)} className="grid w-full grid-cols-[82px_minmax(0,1fr)_auto] items-center gap-3 rounded-xl px-3 py-3 text-left hover:bg-emerald-50"><span className="font-mono text-xs font-black text-emerald-700">{article.clave}</span><span className="truncate text-sm font-black text-slate-800">{article.descripcion}</span><span className="text-xs font-bold text-slate-400">{article.existencia === null ? "SICAR valida" : numberFormat.format(article.existencia)} {article.unidad}</span></button>) : <div className="px-4 py-6 text-center text-sm font-bold text-slate-400">Sin coincidencias</div>}</div> : null}
        </div>
      </section>
      <section className="erp-products-panel overflow-hidden rounded-[1.2rem] border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-4 sm:px-5"><div><h3 className="text-lg font-black text-slate-950">Productos contados</h3><p className="text-xs font-bold text-slate-400">{lines.length} líneas · {zoneCount} zonas · {summary.ready} claves totalizadas · {summary.changed} diferencias</p></div><button type="button" onClick={() => loadData()} className="app-icon-button" aria-label="Actualizar catálogo"><Icon name="refresh" /></button></div>
        {lines.length ? <div className="divide-y divide-slate-100">{lines.map((line, index) => {
          const aggregate = totalsByArticle.get(Number(line.articleId));
          const difference = !aggregate || aggregate.currentExistence === null ? null : roundQuantity(Number(aggregate.countedExistence) - Number(aggregate.currentExistence));
          return <div key={line.lineId} className="inventory-item-row grid gap-2 px-4 py-3 sm:grid-cols-[34px_minmax(180px,1fr)_72px_150px_42px] sm:items-center">
            <span className="inventory-item-index hidden text-xs font-black text-slate-300 sm:block">{`${index + 1}`.padStart(2, "0")}</span>
            <div className="inventory-item-info min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="rounded-md bg-emerald-50 px-2 py-1 font-mono text-[10px] font-black text-emerald-700">{line.clave}</span><strong className="truncate text-sm text-slate-800">{line.descripcion}</strong><span className="rounded-md bg-amber-50 px-2 py-1 text-[9px] font-black uppercase text-amber-700">{line.zona}</span></div><div className="mt-1 text-[10px] font-black uppercase text-slate-400">{aggregate ? `Total clave ${numberFormat.format(aggregate.countedExistence)} ${line.unidad}${line.currentExistence === null ? " · SICAR valida al aplicar" : ` · SICAR ${numberFormat.format(line.currentExistence)}${difference !== null ? ` · Diferencia ${difference > 0 ? "+" : ""}${numberFormat.format(difference)}` : ""}`}` : `Pendiente en ${line.zona}`}</div></div>
            <button type="button" className="inventory-item-bultos flex h-8 items-center justify-center gap-1 rounded-md border border-slate-200 px-1 text-[10px] font-black text-slate-600" onClick={() => setWeightsLineId(line.lineId)}><Icon name="scale" className="h-3.5 w-3.5" /><span>Bultos</span></button>
            <input data-count-id={line.lineId} inputMode="decimal" className="inventory-item-quantity h-10 w-full rounded-lg border border-slate-300 px-3 text-right text-sm font-black outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100" value={line.countedExistence} onChange={(event) => updateLine(line.lineId, { countedExistence: event.target.value, pesos: [] })} placeholder={`Conteo ${line.unidad}`} />
            <button type="button" className="inventory-item-delete app-icon-button text-rose-500" onClick={() => { setLines((current) => current.filter((item) => item.lineId !== line.lineId)); setDraftStatus("active"); }}><Icon name="trash" /></button>
          </div>;
        })}</div> : <div className="px-5 py-16 text-center"><Icon name="inventory" className="mx-auto h-9 w-9 text-slate-300" /><div className="mt-3 text-sm font-black text-slate-500">Busca y agrega los productos contados</div></div>}
        <div className="grid gap-3 border-t border-slate-200 bg-slate-50 p-4 sm:grid-cols-[1fr_auto] sm:items-center"><div className="grid grid-cols-3 gap-2 text-center"><div><div className="text-[9px] font-black uppercase text-slate-400">Diferencias</div><strong>{summary.changed}</strong></div><div><div className="text-[9px] font-black uppercase text-emerald-600">Positivas</div><strong className="text-emerald-700">{summary.positive}</strong></div><div><div className="text-[9px] font-black uppercase text-rose-600">Negativas</div><strong className="text-rose-700">{summary.negative}</strong></div></div><div className="grid gap-2"><button type="button" className="app-button-secondary min-w-56" onClick={holdDraft} disabled={lines.length < 1}>Guardar en espera</button><button type="button" className="app-button-primary min-w-56" disabled={loading || working || summary.ready < 1 || summary.changed < 1 || connectionMismatch || !writeEnabled} onClick={preparePreview}><Icon name="cloud" />{working ? "Validando..." : "Revisar y aplicar"}</button></div></div>
      </section>
    </> : <section className="overflow-hidden rounded-[1.6rem] border border-slate-200 bg-white shadow-sm"><div className="flex items-center justify-between border-b border-slate-200 px-5 py-4"><div><h3 className="text-lg font-black text-slate-950">Levantamientos aplicados</h3><p className="text-xs font-bold text-slate-400">Historial del SICAR local</p></div><button type="button" className="app-icon-button" onClick={() => loadData()}><Icon name="refresh" /></button></div>
      {history.length ? <div className="divide-y divide-slate-100">{history.map((item) => { const [label, statusClass] = statusMeta(item.status); return <div key={item.sessionId || item.id} className="grid gap-3 px-5 py-4 sm:grid-cols-[150px_130px_minmax(0,1fr)] sm:items-center"><div><div className="font-mono text-base font-black text-slate-900">{item.folio || "Sin folio"}</div><div className="mt-1 truncate font-mono text-[10px] text-slate-400">{item.sessionId}</div></div><div><span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-black uppercase ${statusClass}`}>{label}</span>{item.ainId ? <div className="mt-1 text-xs font-bold text-slate-500">SICAR #{item.ainId}</div> : null}</div><div className="min-w-0"><div className="truncate text-sm font-bold text-slate-700">{item.message || "Ajuste aplicado"}</div></div></div>; })}</div> : <div className="px-5 py-16 text-center text-sm font-bold text-slate-400">Todavía no hay ajustes creados por la app.</div>}
    </section>}

    {previewOpen ? <div className="app-modal z-[100] px-4" role="dialog" aria-modal="true"><div className="app-modal-panel w-full max-w-xl overflow-hidden p-0"><div className="bg-slate-950 p-5 text-white"><div className="text-[10px] font-black uppercase tracking-[0.2em] text-lime-300">Confirmar levantamiento</div><h2 className="mt-2 text-2xl font-black">Aplicar {identity.current.folio}</h2><p className="mt-2 text-sm font-semibold text-slate-300">La API volverá a validar existencias y aplicará el ajuste en una transacción.</p></div><div className="grid grid-cols-3 gap-3 p-5"><div className="rounded-xl bg-slate-50 p-3 text-center"><div className="text-[9px] font-black uppercase text-slate-400">Diferencias</div><strong className="text-xl">{serverPreview?.summary?.changedLines ?? summary.changed}</strong></div><div className="rounded-xl bg-emerald-50 p-3 text-center"><div className="text-[9px] font-black uppercase text-emerald-600">Positivas</div><strong className="text-xl text-emerald-700">{serverPreview?.summary?.positiveLines ?? summary.positive}</strong></div><div className="rounded-xl bg-rose-50 p-3 text-center"><div className="text-[9px] font-black uppercase text-rose-600">Negativas</div><strong className="text-xl text-rose-700">{serverPreview?.summary?.negativeLines ?? summary.negative}</strong></div></div><div className="border-y border-slate-100 px-5 py-4 text-sm"><div className="flex justify-between py-1"><span className="font-bold text-slate-500">Sucursal</span><strong>{companyContext?.empresa || user}</strong></div><div className="flex justify-between py-1"><span className="font-bold text-slate-500">Realizado</span><strong>{performedBy || "Pendiente"}</strong></div><div className="flex justify-between py-1"><span className="font-bold text-slate-500">Supervisado</span><strong>{supervisedBy || "Pendiente"}</strong></div></div><div className="grid grid-cols-2 gap-3 p-5"><button type="button" className="app-button-secondary" onClick={() => setPreviewOpen(false)} disabled={working}>Volver</button><button type="button" className="app-button-primary" onClick={submitAdjustment} disabled={working}>{working ? "Aplicando..." : "Aplicar en SICAR"}</button></div></div></div> : null}
    {activeWeightsLine ? <WeightsDialog line={activeWeightsLine} onClose={() => setWeightsLineId(null)} onSave={(weights, total) => { updateLine(activeWeightsLine.lineId, { pesos: weights, cajas: weights.length, countedExistence: `${total}` }); setWeightsLineId(null); }} /> : null}
  </div>;
}
