"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  checkSicarInventoryApi,
  getInventoryAdjustmentRequest,
  getInventoryAdjustmentRequests,
  getInventoryAuthUser,
  getSicarInventoryCatalog,
  loginInventoryUser,
  logoutInventoryUser,
  observeInventoryAuth,
  retryInventoryAdjustmentRequest,
  submitInventoryAdjustmentRequest,
} from "@/lib/sicarInventoryApi";

const numberFormat = new Intl.NumberFormat("es-NI", { minimumFractionDigits: 0, maximumFractionDigits: 4 });
const ACTIVE_STATUSES = new Set(["requested", "processing"]);
const SUCCESS_STATUSES = new Set(["done", "duplicate"]);

function normalizeText(value = "") {
  return `${value}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function branchToken(value = "") {
  const normalized = normalizeText(value);
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

function InventoryAuthDialog({ currentUser, onClose, onLogin, onLogout }) {
  const [email, setEmail] = useState(currentUser?.email || "");
  const [password, setPassword] = useState("");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    setWorking(true);
    setError("");
    try {
      await onLogin(email, password);
    } catch (loginError) {
      const code = `${loginError?.code || ""}`;
      setError(
        code.includes("invalid-credential") || code.includes("wrong-password")
          ? "Correo o contraseña incorrectos."
          : loginError?.message || "No fue posible iniciar sesión.",
      );
    } finally {
      setWorking(false);
    }
  }

  return <div className="app-modal z-[110] px-4" role="dialog" aria-modal="true">
    <form className="app-modal-panel w-full max-w-lg p-5 sm:p-6" onSubmit={submit}>
      <div className="text-[10px] font-black uppercase tracking-[0.22em] text-emerald-600">Inventario protegido</div>
      <h2 className="mt-2 text-2xl font-black text-slate-950">Acceso al integrador</h2>
      {currentUser ? <>
        <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4">
          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-600">Sesión activa</div>
          <div className="mt-1 break-all text-sm font-black text-emerald-950">{currentUser.email}</div>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-3"><button type="button" className="app-button-secondary" onClick={onClose}>Cerrar</button><button type="button" className="app-button-primary bg-rose-600" onClick={onLogout}>Salir de inventario</button></div>
      </> : <>
        <p className="mt-2 text-sm font-semibold text-slate-500">Usa el mismo correo y contraseña de la app de inventario.</p>
        <label className="app-label mt-5">Correo</label>
        <input className="app-input" type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required />
        <label className="app-label mt-4">Contraseña</label>
        <input className="app-input" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
        {error ? <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{error}</div> : null}
        <div className="mt-6 grid grid-cols-2 gap-3"><button type="button" className="app-button-secondary" onClick={onClose}>Cancelar</button><button type="submit" className="app-button-primary" disabled={working}>{working ? "Validando..." : "Entrar"}</button></div>
      </>}
    </form>
  </div>;
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

export default function InventarioSucursal({ user }) {
  const draftKey = `csmInventoryFirestoreDraft:${branchToken(user) || "branch"}`;
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
  const [lines, setLines] = useState(initialDraft.current?.lines || []);
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
  const [authOpen, setAuthOpen] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [inventoryUser, setInventoryUser] = useState(getInventoryAuthUser());
  const [submittedRequest, setSubmittedRequest] = useState(null);

  const connectionMismatch = branch?.alias && branchToken(branch.alias) !== branchToken(user);
  const unsupportedBranch = branchToken(user) !== "granada";
  const triggerEnabled = Boolean(inventoryUser) && health?.writes?.inventoryTriggers === true;

  async function loadData(forceCatalog = false, authenticated = Boolean(getInventoryAuthUser())) {
    setLoading(true);
    setMessage(null);
    const [healthResult, catalogResult, historyResult] = await Promise.allSettled([
      checkSicarInventoryApi(),
      getSicarInventoryCatalog({ force: forceCatalog }),
      authenticated ? getInventoryAdjustmentRequests(100) : Promise.resolve({ rows: [] }),
    ]);
    if (healthResult.status === "fulfilled") setHealth(healthResult.value);
    if (catalogResult.status === "fulfilled") { setBranch(catalogResult.value.branch); setCatalog(catalogResult.value.articles || []); }
    if (historyResult.status === "fulfilled") setHistory(historyResult.value.rows || []);
    const failure = [healthResult, catalogResult, historyResult].find((result) => result.status === "rejected");
    if (failure) setMessage({ type: "error", text: failure.reason?.message || "No se pudo consultar el inventario." });
    setLoading(false);
  }

  useEffect(() => observeInventoryAuth((nextUser) => {
    setInventoryUser(nextUser);
    setAuthReady(true);
    loadData(false, Boolean(nextUser));
  }), []);
  useEffect(() => {
    const close = (event) => { if (!searchRoot.current?.contains(event.target)) setShowResults(false); };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);
  useEffect(() => {
    window.localStorage.setItem(draftKey, JSON.stringify({ identity: identity.current, date, zone, performedBy, supervisedBy, notes, lines, updatedAt: new Date().toISOString() }));
  }, [date, draftKey, lines, notes, performedBy, supervisedBy, zone]);
  useEffect(() => {
    if (!submittedRequest?.sessionId || !ACTIVE_STATUSES.has(`${submittedRequest.status}`)) return undefined;
    let disposed = false;
    const timer = window.setInterval(async () => {
      try {
        const result = await getInventoryAdjustmentRequest(submittedRequest.sessionId);
        if (disposed) return;
        setSubmittedRequest(result.request);
        setHistory((current) => [result.request, ...current.filter((item) => item.sessionId !== result.request.sessionId)]);
        if (SUCCESS_STATUSES.has(`${result.request.status}`)) setMessage({ type: "success", text: result.request.message || "Ajuste aplicado en SICAR." });
      } catch (error) { if (!disposed) setMessage({ type: "error", text: error.message }); }
    }, 10000);
    return () => { disposed = true; window.clearInterval(timer); };
  }, [submittedRequest?.sessionId, submittedRequest?.status]);

  const selectedKeys = useMemo(() => new Set(lines.map((line) => `${line.clave}`)), [lines]);
  const results = useMemo(() => !query.trim() ? [] : catalog.map((article) => ({ article, score: scoreArticle(article, query) })).filter((entry) => entry.score !== null && !selectedKeys.has(`${entry.article.clave}`)).sort((left, right) => left.score - right.score || left.article.descripcion.localeCompare(right.article.descripcion)).slice(0, 30).map((entry) => entry.article), [catalog, query, selectedKeys]);
  const summary = useMemo(() => {
    const ready = lines.filter((line) => line.countedExistence !== "" && Number.isFinite(Number(line.countedExistence)));
    const changed = ready.filter((line) => line.currentExistence === null || Math.abs(Number(line.countedExistence) - Number(line.currentExistence)) > 0.0001);
    const comparable = changed.filter((line) => line.currentExistence !== null);
    return { ready: ready.length, changed: changed.length, positive: comparable.filter((line) => Number(line.countedExistence) > Number(line.currentExistence)).length, negative: comparable.filter((line) => Number(line.countedExistence) < Number(line.currentExistence)).length };
  }, [lines]);

  function addArticle(article) {
    setLines((current) => [...current, { articleId: Number(article.art_id), clave: article.clave, descripcion: article.descripcion, unidad: `${article.unidad || "PZA"}`.toUpperCase(), currentExistence: article.existencia === null || article.existencia === undefined ? null : Number(article.existencia), countedExistence: "", pesos: [], cajas: 0, zona: zone }]);
    setQuery(""); setShowResults(false);
    requestAnimationFrame(() => document.querySelector(`[data-count-id="${article.art_id}"]`)?.focus());
  }
  function updateLine(articleId, patch) {
    setLines((current) => current.map((line) => line.articleId === articleId ? { ...line, ...patch } : line));
    setPreviewOpen(false);
  }
  function newDraft(force = false) {
    if (!force && lines.length > 0 && !window.confirm("¿Descartar el levantamiento actual?")) return;
    identity.current = newIdentity(); setLines([]); setDate(localDate()); setZone("Bodega principal"); setPerformedBy(""); setSupervisedBy(""); setNotes(""); setPreviewOpen(false); window.localStorage.removeItem(draftKey);
  }
  async function submitAdjustment() {
    if (unsupportedBranch || connectionMismatch || !triggerEnabled) return;
    if (!performedBy.trim() || !supervisedBy.trim()) { setMessage({ type: "error", text: "Indica quién realizó y quién supervisó el levantamiento." }); setPreviewOpen(false); return; }
    setWorking(true); setMessage(null);
    try {
      const result = await submitInventoryAdjustmentRequest({
        sessionId: identity.current.sessionId, folio: identity.current.folio, branchId: user, fecha: date, zona: zone,
        proveedor: "Interno", realizadoPor: performedBy, supervisadoPor: supervisedBy,
        firmaRealizadoPor: performedBy.slice(0, 1).toUpperCase(), firmaSupervisadoPor: supervisedBy.slice(0, 1).toUpperCase(), observaciones: notes,
        requestedBy: { uid: inventoryUser?.uid || "", email: inventoryUser?.email || "", label: performedBy },
        items: lines.filter((line) => line.countedExistence !== "" && Number.isFinite(Number(line.countedExistence))).map((line) => ({ sku: line.clave, nombre: line.descripcion, unidad: line.unidad, cantidadContada: Number(line.countedExistence), cajas: line.pesos.length || line.cajas || 0, pesos: line.pesos, zona: line.zona || zone })),
      });
      setSubmittedRequest(result.request);
      setHistory((current) => [result.request, ...current.filter((item) => item.sessionId !== result.request.sessionId)]);
      setPreviewOpen(false);
      setMessage(result.requiresRetry
        ? { type: "error", text: "Este levantamiento ya existe con error. Usa Reintentar desde el historial." }
        : { type: "success", text: result.alreadySubmitted ? "Este levantamiento ya estaba enviado; no se duplicó." : "Levantamiento enviado. El integrador aplicará el ajuste en SICAR." });
      newDraft(true); setTab("history");
    } catch (error) { setMessage({ type: "error", text: error.message }); setPreviewOpen(false); } finally { setWorking(false); }
  }
  async function retryRequest(sessionId) {
    setWorking(true); setMessage(null);
    try { const result = await retryInventoryAdjustmentRequest(sessionId); setHistory((current) => [result.request, ...current.filter((item) => item.sessionId !== sessionId)]); setSubmittedRequest(result.request); setMessage({ type: "success", text: "Reintento enviado al integrador." }); }
    catch (error) { setMessage({ type: "error", text: error.message }); } finally { setWorking(false); }
  }

  const activeWeightsLine = lines.find((line) => line.articleId === weightsLineId) || null;
  return <div className="inventory-module min-w-0 space-y-4 pb-24 lg:pb-6">
    <section className="overflow-hidden rounded-[1.75rem] border border-emerald-950/10 bg-[linear-gradient(135deg,#0b1d18_0%,#102a20_58%,#173b28_100%)] text-white shadow-[0_24px_65px_-38px_rgba(5,46,22,0.7)]">
      <div className="grid gap-4 p-5 sm:p-6 lg:grid-cols-[1fr_auto] lg:items-end"><div><div className="text-[10px] font-black uppercase tracking-[0.28em] text-lime-300">Módulo Inventario</div><h2 className="mt-2 text-2xl font-black sm:text-3xl">Levantamiento físico</h2><p className="mt-2 text-sm font-semibold text-emerald-50/70">Conteo guardado en Firebase y aplicado por el integrador local de SICAR.</p></div><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full border px-3 py-2 text-xs font-black ${triggerEnabled ? "border-lime-300/25 bg-lime-300/10 text-lime-200" : "border-amber-300/25 bg-amber-300/10 text-amber-100"}`}>{triggerEnabled ? `Inventario conectado · ${inventoryUser?.email || ""}` : authReady ? "Inicia sesión de inventario" : "Validando sesión"}</span><button type="button" className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/8" onClick={() => setAuthOpen(true)} aria-label="Acceso de inventario"><Icon name="settings" /></button></div></div>
      {unsupportedBranch ? <div className="border-t border-amber-300/20 bg-amber-300/10 px-5 py-3 text-sm font-black text-amber-100">Granada es la única sucursal habilitada por este integrador.</div> : null}
      {connectionMismatch ? <div className="border-t border-rose-300/20 bg-rose-400/15 px-5 py-3 text-sm font-black text-rose-100">Bloqueado: sesión {user}, servidor {branch?.alias}.</div> : null}
      {!triggerEnabled && authReady ? <button type="button" className="w-full border-t border-amber-300/20 bg-amber-300/10 px-5 py-3 text-left text-sm font-black text-amber-100" onClick={() => setAuthOpen(true)}>Conecta tu usuario de inventario para enviar ajustes a SICAR.</button> : null}
    </section>
    <div className="grid grid-cols-2 gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm"><button type="button" onClick={() => setTab("count")} className={`flex min-h-12 items-center justify-center gap-2 rounded-xl text-sm font-black ${tab === "count" ? "bg-slate-950 text-white" : "text-slate-500"}`}><Icon name="inventory" />Levantamiento</button><button type="button" onClick={() => setTab("history")} className={`flex min-h-12 items-center justify-center gap-2 rounded-xl text-sm font-black ${tab === "history" ? "bg-slate-950 text-white" : "text-slate-500"}`}><Icon name="history" />Historial</button></div>
    {message ? <div className={`rounded-2xl border px-4 py-3 text-sm font-bold ${message.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-rose-200 bg-rose-50 text-rose-700"}`}>{message.text}</div> : null}

    {tab === "count" ? <>
      <section className="rounded-[1.6rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[150px_180px_1fr_1fr_auto]"><label><span className="app-label">Folio</span><input className="app-input bg-slate-50 font-mono text-xs" value={identity.current.folio} readOnly /></label><label><span className="app-label">Fecha</span><input type="date" className="app-input" max={localDate()} value={date} onChange={(event) => setDate(event.target.value)} /></label><label><span className="app-label">Realizado por</span><input className="app-input" value={performedBy} onChange={(event) => setPerformedBy(event.target.value)} placeholder="Nombre" /></label><label><span className="app-label">Supervisado por</span><input className="app-input" value={supervisedBy} onChange={(event) => setSupervisedBy(event.target.value)} placeholder="Nombre" /></label><button type="button" className="app-button-secondary self-end" onClick={() => newDraft(false)}>Nuevo</button></div>
        <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(180px,0.4fr)_1fr]"><label><span className="app-label">Zona</span><input className="app-input" value={zone} onChange={(event) => setZone(event.target.value)} placeholder="Bodega principal" /></label><label><span className="app-label">Observación</span><input className="app-input" maxLength={500} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Opcional" /></label></div>
        <div ref={searchRoot} className="relative mt-4"><label className="app-label">Agregar producto</label><div className="relative"><span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-emerald-600"><Icon name="search" /></span><input className="app-input pl-12 pr-14" value={query} onChange={(event) => { setQuery(event.target.value); setShowResults(true); }} onFocus={() => setShowResults(true)} onKeyDown={(event) => { if (event.key === "Enter" && results[0]) { event.preventDefault(); addArticle(results[0]); } }} placeholder="Clave, código de barra o nombre" /><button type="button" className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-xl bg-emerald-600 text-white" onClick={() => results[0] && addArticle(results[0])} aria-label="Agregar"><Icon name="plus" /></button></div>
          {showResults && query.trim() ? <div className="absolute inset-x-0 top-full z-[80] mt-2 max-h-72 overflow-y-auto rounded-2xl border border-emerald-200 bg-white p-2 shadow-2xl">{results.length ? results.map((article) => <button key={article.art_id} type="button" onClick={() => addArticle(article)} className="grid w-full grid-cols-[82px_minmax(0,1fr)_auto] items-center gap-3 rounded-xl px-3 py-3 text-left hover:bg-emerald-50"><span className="font-mono text-xs font-black text-emerald-700">{article.clave}</span><span className="truncate text-sm font-black text-slate-800">{article.descripcion}</span><span className="text-xs font-bold text-slate-400">{article.existencia === null ? "SICAR valida" : numberFormat.format(article.existencia)} {article.unidad}</span></button>) : <div className="px-4 py-6 text-center text-sm font-bold text-slate-400">Sin coincidencias</div>}</div> : null}
        </div>
      </section>
      <section className="overflow-hidden rounded-[1.6rem] border border-slate-200 bg-white shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-4 sm:px-5"><div><h3 className="text-lg font-black text-slate-950">Productos contados</h3><p className="text-xs font-bold text-slate-400">{lines.length} agregados · {summary.ready} listos · {summary.changed} diferencias</p></div><button type="button" onClick={() => loadData(true)} className="app-icon-button" aria-label="Actualizar catálogo"><Icon name="refresh" /></button></div>
        {lines.length ? <div className="divide-y divide-slate-100">{lines.map((line, index) => { const difference = line.countedExistence === "" || line.currentExistence === null ? null : roundQuantity(Number(line.countedExistence) - Number(line.currentExistence)); return <div key={line.articleId} className="grid gap-2 px-4 py-3 sm:grid-cols-[34px_minmax(180px,1fr)_100px_128px_48px] sm:items-center"><span className="hidden text-xs font-black text-slate-300 sm:block">{`${index + 1}`.padStart(2, "0")}</span><div className="min-w-0"><div className="flex items-center gap-2"><span className="rounded-md bg-emerald-50 px-2 py-1 font-mono text-[10px] font-black text-emerald-700">{line.clave}</span><strong className="truncate text-sm text-slate-800">{line.descripcion}</strong></div><div className="mt-1 text-[10px] font-black uppercase text-slate-400">{line.currentExistence === null ? "Existencia actual validada al aplicar en SICAR" : `SICAR ${numberFormat.format(line.currentExistence)} ${line.unidad}${difference !== null ? ` · Diferencia ${difference > 0 ? "+" : ""}${numberFormat.format(difference)}` : ""}`}</div></div><button type="button" className="flex h-10 items-center justify-center gap-1 rounded-xl border border-slate-200 text-xs font-black text-slate-600" onClick={() => setWeightsLineId(line.articleId)}><Icon name="scale" className="h-4 w-4" />Bultos</button><input data-count-id={line.articleId} inputMode="decimal" className="h-10 w-full rounded-xl border border-slate-200 px-3 text-right text-base font-black outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100" value={line.countedExistence} onChange={(event) => updateLine(line.articleId, { countedExistence: event.target.value, pesos: [] })} placeholder={`Conteo ${line.unidad}`} /><button type="button" className="app-icon-button text-rose-500" onClick={() => setLines((current) => current.filter((item) => item.articleId !== line.articleId))}><Icon name="trash" /></button></div>; })}</div> : <div className="px-5 py-16 text-center"><Icon name="inventory" className="mx-auto h-9 w-9 text-slate-300" /><div className="mt-3 text-sm font-black text-slate-500">Busca y agrega los productos contados</div></div>}
        <div className="grid gap-3 border-t border-slate-200 bg-slate-50 p-4 sm:grid-cols-[1fr_auto] sm:items-center"><div className="grid grid-cols-3 gap-2 text-center"><div><div className="text-[9px] font-black uppercase text-slate-400">Diferencias</div><strong>{summary.changed}</strong></div><div><div className="text-[9px] font-black uppercase text-emerald-600">Positivas</div><strong className="text-emerald-700">{summary.positive}</strong></div><div><div className="text-[9px] font-black uppercase text-rose-600">Negativas</div><strong className="text-rose-700">{summary.negative}</strong></div></div><button type="button" className="app-button-primary min-w-56" disabled={loading || working || summary.ready < 1 || summary.changed < 1 || unsupportedBranch || connectionMismatch || !triggerEnabled} onClick={() => setPreviewOpen(true)}><Icon name="cloud" />Revisar y enviar</button></div>
      </section>
    </> : <section className="overflow-hidden rounded-[1.6rem] border border-slate-200 bg-white shadow-sm"><div className="flex items-center justify-between border-b border-slate-200 px-5 py-4"><div><h3 className="text-lg font-black text-slate-950">Levantamientos enviados</h3><p className="text-xs font-bold text-slate-400">Estado informado por el integrador de Granada</p></div><button type="button" className="app-icon-button" onClick={() => loadData(false)}><Icon name="refresh" /></button></div>
      {history.length ? <div className="divide-y divide-slate-100">{history.map((item) => { const [label, statusClass] = statusMeta(item.status); return <div key={item.sessionId || item.id} className="grid gap-3 px-5 py-4 sm:grid-cols-[150px_130px_minmax(0,1fr)_auto] sm:items-center"><div><div className="font-mono text-base font-black text-slate-900">{item.folio || "Sin folio"}</div><div className="mt-1 truncate font-mono text-[10px] text-slate-400">{item.sessionId}</div></div><div><span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-black uppercase ${statusClass}`}>{label}</span>{item.ainId ? <div className="mt-1 text-xs font-bold text-slate-500">SICAR #{item.ainId}</div> : null}</div><div className="min-w-0"><div className="truncate text-sm font-bold text-slate-700">{item.message || item.lastError || "Solicitud registrada"}</div>{item.warningSummary ? <div className="mt-1 truncate text-xs font-bold text-amber-600">{item.warningSummary}</div> : null}</div>{item.status === "error" ? <button type="button" className="app-button-secondary min-h-10 px-4" disabled={working} onClick={() => retryRequest(item.sessionId)}>Reintentar</button> : <span />}</div>; })}</div> : <div className="px-5 py-16 text-center text-sm font-bold text-slate-400">Todavía no hay solicitudes de ajuste.</div>}
    </section>}

    {previewOpen ? <div className="app-modal z-[100] px-4" role="dialog" aria-modal="true"><div className="app-modal-panel w-full max-w-xl overflow-hidden p-0"><div className="bg-slate-950 p-5 text-white"><div className="text-[10px] font-black uppercase tracking-[0.2em] text-lime-300">Confirmar levantamiento</div><h2 className="mt-2 text-2xl font-black">Enviar {identity.current.folio}</h2><p className="mt-2 text-sm font-semibold text-slate-300">El integrador comparará estos conteos y aplicará las diferencias en SICAR.</p></div><div className="grid grid-cols-3 gap-3 p-5"><div className="rounded-xl bg-slate-50 p-3 text-center"><div className="text-[9px] font-black uppercase text-slate-400">Productos</div><strong className="text-xl">{summary.ready}</strong></div><div className="rounded-xl bg-emerald-50 p-3 text-center"><div className="text-[9px] font-black uppercase text-emerald-600">Positivas</div><strong className="text-xl text-emerald-700">{summary.positive}</strong></div><div className="rounded-xl bg-rose-50 p-3 text-center"><div className="text-[9px] font-black uppercase text-rose-600">Negativas</div><strong className="text-xl text-rose-700">{summary.negative}</strong></div></div><div className="border-y border-slate-100 px-5 py-4 text-sm"><div className="flex justify-between py-1"><span className="font-bold text-slate-500">Sucursal</span><strong>Granada</strong></div><div className="flex justify-between py-1"><span className="font-bold text-slate-500">Realizado</span><strong>{performedBy || "Pendiente"}</strong></div><div className="flex justify-between py-1"><span className="font-bold text-slate-500">Supervisado</span><strong>{supervisedBy || "Pendiente"}</strong></div></div><div className="grid grid-cols-2 gap-3 p-5"><button type="button" className="app-button-secondary" onClick={() => setPreviewOpen(false)} disabled={working}>Volver</button><button type="button" className="app-button-primary" onClick={submitAdjustment} disabled={working}>{working ? "Enviando..." : "Enviar al integrador"}</button></div></div></div> : null}
    {activeWeightsLine ? <WeightsDialog line={activeWeightsLine} onClose={() => setWeightsLineId(null)} onSave={(weights, total) => { updateLine(activeWeightsLine.articleId, { pesos: weights, cajas: weights.length, countedExistence: `${total}` }); setWeightsLineId(null); }} /> : null}
    {authOpen ? <InventoryAuthDialog currentUser={inventoryUser} onClose={() => setAuthOpen(false)} onLogin={async (email, password) => { await loginInventoryUser(email, password); setAuthOpen(false); }} onLogout={async () => { await logoutInventoryUser(); setAuthOpen(false); }} /> : null}
  </div>;
}
