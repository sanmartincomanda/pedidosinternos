"use client";

import React, { useEffect, useState } from "react";
import { db } from "../firebase";
import { ref, update } from "firebase/database";
import { formatOrderNumber } from "@/lib/orderUtils";

const Icons = {
  chef: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M7 10h10v10a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V10Z" />
      <path d="M6 10a4 4 0 1 1 2-7 4.6 4.6 0 0 1 8 2 3.5 3.5 0 1 1 1 6" />
    </svg>
  ),
  clock: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  ),
  check: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="m5 12 4 4L19 6" />
    </svg>
  ),
  fire: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 2s4 4.4 4 8.3A4 4 0 1 1 8 11c0-2.3 1-4.1 2.4-5.6" />
    </svg>
  ),
  alert: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 9v4M12 17h.01" />
      <path d="m10.3 3.9-8 13.9A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3.2l-8-13.9a2 2 0 0 0-3.4 0Z" />
    </svg>
  ),
  package: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="m3 7 9-4 9 4-9 4-9-4ZM3 7v10l9 4 9-4V7M12 11v10" />
    </svg>
  ),
  scale: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M6 6h12M7 6l-3 13h16L17 6M9 10a3 3 0 0 0 6 0" />
    </svg>
  ),
  close: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M6 6 18 18M6 18 18 6" />
    </svg>
  ),
  calendar: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M8 2v4M16 2v4M3 10h18" />
    </svg>
  ),
};

const STATUS_CONFIG = {
  NUEVO: {
    color: "#38bdf8",
    border: "#38bdf8",
    icon: Icons.clock,
    label: "Nuevo",
    glow: "rgba(56,189,248,0.16)",
  },
  STANDBY_ENTREGA: {
    color: "#f59e0b",
    border: "#f59e0b",
    icon: Icons.alert,
    label: "Standby",
    glow: "rgba(245,158,11,0.14)",
  },
  PREPARACION: {
    color: "#fb923c",
    border: "#fb923c",
    icon: Icons.fire,
    label: "En preparacion",
    glow: "rgba(251,146,60,0.14)",
  },
  LISTO: {
    color: "#22c55e",
    border: "#22c55e",
    icon: Icons.check,
    label: "Listo",
    glow: "rgba(34,197,94,0.14)",
  },
};

function StatCard({ label, value, helper, accent }) {
  return (
    <div
      className="app-card-soft p-4"
      style={{
        borderColor: `${accent}38`,
        background: `linear-gradient(135deg, ${accent}16 0%, rgba(8,24,46,0.72) 100%)`,
      }}
    >
      <div className="text-xs font-extrabold uppercase tracking-[0.18em] text-slate-300">{label}</div>
      <div className="mt-2 text-2xl font-black text-white">{value}</div>
      {helper ? <div className="mt-1 text-sm text-slate-300/80">{helper}</div> : null}
    </div>
  );
}

export default function Cocina({ user, pedidos, personalCocina }) {
  const [modalPreparador, setModalPreparador] = useState(null);
  const [preparadorSeleccionado, setPreparadorSeleccionado] = useState(null);
  const [animatingCards, setAnimatingCards] = useState(new Set());
  const [pesosEditando, setPesosEditando] = useState({});
  const [now, setNow] = useState(() => new Date().getTime());

  const pedidosEnProceso = pedidos.filter(
    (pedido) =>
      pedido.sucursalDestino === user &&
      pedido.estado !== "ENVIADO" &&
      pedido.estado !== "ENTREGADO",
  );

  const actualizarPesoReal = (firebaseId, itemIdx, valor) => {
    const key = `${firebaseId}_${itemIdx}`;
    setPesosEditando((prev) => ({ ...prev, [key]: valor }));
  };

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date().getTime()), 60000);
    return () => clearInterval(interval);
  }, []);

  const guardarPesoReal = (firebaseId, itemIdx) => {
    const key = `${firebaseId}_${itemIdx}`;
    const valor = pesosEditando[key];
    if (valor === undefined) return;

    const pedido = pedidos.find((item) => item.firebaseId === firebaseId);
    if (!pedido) return;

    const nuevosItems = [...(pedido.items || [])];
    nuevosItems[itemIdx] = { ...nuevosItems[itemIdx], pesoReal: valor };

    update(ref(db, `pedidos_internos/${firebaseId}`), {
      items: nuevosItems,
    });

    setPesosEditando((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const iniciarPreparacion = (firebaseId, preparador) => {
    setAnimatingCards((prev) => new Set([...prev, firebaseId]));

    update(ref(db, `pedidos_internos/${firebaseId}`), {
      estado: "PREPARACION",
      preparadoPor: preparador,
      timestampPreparacion: new Date().toLocaleTimeString("es-ES", {
        hour: "2-digit",
        minute: "2-digit",
      }),
      timestamp: new Date().getTime(),
    });

    setTimeout(() => {
      setAnimatingCards((prev) => {
        const next = new Set(prev);
        next.delete(firebaseId);
        return next;
      });
    }, 300);

    setModalPreparador(null);
    setPreparadorSeleccionado(null);
  };

  const marcarListo = (firebaseId) => {
    const pedido = pedidos.find((item) => item.firebaseId === firebaseId);
    if (!pedido) return;

    const todosLosPesosLlenos = (pedido.items || []).every((item) => item.pesoReal && item.pesoReal !== "");
    if (!todosLosPesosLlenos) {
      alert("Debes ingresar el peso real de todos los productos antes de marcar como listo.");
      return;
    }

    setAnimatingCards((prev) => new Set([...prev, firebaseId]));

    update(ref(db, `pedidos_internos/${firebaseId}`), {
      estado: "LISTO",
      timestampListo: new Date().toLocaleTimeString("es-ES", {
        hour: "2-digit",
        minute: "2-digit",
      }),
      timestamp: new Date().getTime(),
    });

    setTimeout(() => {
      setAnimatingCards((prev) => {
        const next = new Set(prev);
        next.delete(firebaseId);
        return next;
      });
    }, 300);
  };

  const getTimeElapsed = (timestamp) => {
    if (!timestamp) return "Ahora";
    const diff = Math.floor((now - timestamp) / 60000);
    if (diff < 1) return "Ahora";
    if (diff < 60) return `${diff}m`;
    return `${Math.floor(diff / 60)}h ${diff % 60}m`;
  };

  const listos = pedidosEnProceso.filter((pedido) => pedido.estado === "LISTO").length;
  const standby = pedidosEnProceso.filter((pedido) => pedido.estado === "STANDBY_ENTREGA").length;
  const preparacion = pedidosEnProceso.filter((pedido) => pedido.estado === "PREPARACION").length;

  return (
    <div className="page-enter space-y-5">
      <section className="app-panel p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="app-chip mb-3 border-orange-300/20 bg-orange-400/12 text-orange-100">
              {Icons.chef}
              Cocina movil
            </div>
            <h2 className="app-title text-3xl font-black text-white">Preparacion pensada para pantalla pequena</h2>
            <p className="mt-2 max-w-2xl text-sm text-slate-300 sm:text-base">
              Cada pedido baja a una sola columna y cada producto se maneja como tarjeta para pesar y avanzar rapido.
            </p>
          </div>

          <div className="app-chip border-white/10 bg-white/5 text-slate-200">
            {Icons.clock}
            {user}
          </div>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Activos" value={pedidosEnProceso.length} helper="Pedidos visibles" accent="#38bdf8" />
          <StatCard label="Standby" value={standby} helper="Entrega programada" accent="#f59e0b" />
          <StatCard label="Preparando" value={preparacion} helper="Con responsable asignado" accent="#fb923c" />
          <StatCard label="Listos" value={listos} helper="Listos para despacho" accent="#22c55e" />
        </div>
      </section>

      {modalPreparador ? (
        <div
          className="app-modal"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setModalPreparador(null);
              setPreparadorSeleccionado(null);
            }
          }}
        >
          <div className="app-modal-panel">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h3 className="app-title text-2xl font-black text-slate-900">Asignar preparador</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Pedido {formatOrderNumber(pedidos.find((item) => item.firebaseId === modalPreparador))}
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setModalPreparador(null);
                  setPreparadorSeleccionado(null);
                }}
                className="app-icon-button text-slate-700"
              >
                {Icons.close}
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {personalCocina.map((nombre) => (
                <button
                  type="button"
                  key={nombre}
                  onClick={() => setPreparadorSeleccionado(nombre)}
                  className="rounded-[24px] border p-4 text-left transition-all"
                  style={{
                    borderColor: preparadorSeleccionado === nombre ? "#fb923c" : "#cbd5e1",
                    background:
                      preparadorSeleccionado === nombre
                        ? "linear-gradient(135deg, #fb923c 0%, #ea580c 100%)"
                        : "#f8fafc",
                    color: preparadorSeleccionado === nombre ? "#ffffff" : "#0f172a",
                  }}
                >
                  <div className="mb-2 text-sm font-extrabold uppercase tracking-[0.18em] opacity-80">Preparador</div>
                  <div className="text-lg font-black">{nombre}</div>
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => {
                if (preparadorSeleccionado) {
                  iniciarPreparacion(modalPreparador, preparadorSeleccionado);
                }
              }}
              disabled={!preparadorSeleccionado}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-[18px] border-none bg-[linear-gradient(135deg,#fb923c_0%,#ea580c_100%)] px-4 py-4 text-base font-black text-white shadow-[0_16px_30px_rgba(234,88,12,0.24)] disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none"
            >
              {Icons.chef}
              {preparadorSeleccionado ? `Asignar a ${preparadorSeleccionado}` : "Selecciona un preparador"}
            </button>
          </div>
        </div>
      ) : null}

      {pedidosEnProceso.length === 0 ? (
        <div className="app-empty px-4 py-14 text-center">
          <div className="text-xl font-black text-white">No hay pedidos pendientes en cocina.</div>
          <p className="mt-2 text-sm text-slate-300">Los nuevos pedidos apareceran aqui automaticamente.</p>
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {pedidosEnProceso.map((pedido) => {
            const status = pedido.estado || "NUEVO";
            const config = STATUS_CONFIG[status] || STATUS_CONFIG.NUEVO;
            const isAnimating = animatingCards.has(pedido.firebaseId);
            const isStandby = status === "STANDBY_ENTREGA";
            const todosPesosLlenos = (pedido.items || []).every((item) => item.pesoReal && item.pesoReal !== "");

            return (
              <article
                key={pedido.firebaseId}
                className="app-panel overflow-hidden transition-all"
                style={{
                  borderColor: `${config.border}55`,
                  boxShadow: `0 24px 60px ${config.glow}`,
                  transform: isAnimating ? "scale(0.99)" : "scale(1)",
                  opacity: isAnimating ? 0.82 : 1,
                }}
              >
                <div
                  className="p-5 sm:p-6"
                  style={{
                    background:
                      status === "LISTO"
                        ? "linear-gradient(135deg, rgba(34,197,94,0.26) 0%, rgba(6,78,59,0.94) 45%, rgba(8,24,46,0.98) 100%)"
                        : `linear-gradient(135deg, ${config.glow} 0%, rgba(8,24,46,0.96) 60%)`,
                  }}
                >
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div
                          className="app-chip mb-3"
                          style={{
                            borderColor: `${config.border}40`,
                            background: `${config.border}1a`,
                            color: "#ffffff",
                          }}
                        >
                          <span style={{ color: config.border }}>{config.icon}</span>
                          {config.label}
                        </div>
                        <h3 className="app-title text-2xl font-black text-white">Pedido {formatOrderNumber(pedido)}</h3>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-200">
                          <span>{pedido.sucursalOrigen}</span>
                          <span className="text-slate-500">/</span>
                          <span>{pedido.sucursalDestino}</span>
                          <span className="text-slate-500">/</span>
                          <span>{getTimeElapsed(pedido.timestamp)}</span>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <span className="app-chip border-white/10 bg-white/8 text-slate-100">
                          {Icons.calendar}
                          {pedido.fechaPedido}
                        </span>
                        {pedido.preparadoPor ? (
                          <span className="app-chip border-orange-300/20 bg-orange-400/12 text-orange-100">
                            {Icons.chef}
                            {pedido.preparadoPor}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    {isStandby ? (
                      <div className="rounded-[22px] border border-amber-300/28 bg-amber-400/12 px-4 py-4 text-sm text-amber-100">
                        <div className="mb-2 flex items-center gap-2 font-black uppercase tracking-[0.16em] text-amber-200">
                          {Icons.alert}
                          Entrega programada
                        </div>
                        <div>Recuerda liberar este pedido para la fecha {pedido.fechaEntrega}.</div>
                      </div>
                    ) : null}

                    {status === "LISTO" ? (
                      <div className="rounded-[24px] border border-red-400/40 bg-red-500/12 px-4 py-5 text-center shadow-[0_16px_32px_rgba(239,68,68,0.18)]">
                        <div className="text-[11px] font-extrabold uppercase tracking-[0.28em] text-red-200">Alerta de despacho</div>
                        <div className="mt-2 text-2xl font-black tracking-[0.08em] text-red-400 sm:text-3xl">
                          LISTOS PARA ENVIAR
                        </div>
                      </div>
                    ) : null}

                    {pedido.notaGeneral ? (
                      <div className="rounded-[22px] border border-sky-400/24 bg-sky-400/10 px-4 py-4 text-sm text-sky-100">
                        <div className="mb-2 font-black uppercase tracking-[0.16em] text-sky-200">Nota general</div>
                        <div>{pedido.notaGeneral}</div>
                      </div>
                    ) : null}

                    <div className="space-y-3">
                      {(pedido.items || []).map((item, idx) => {
                        const pesoKey = `${pedido.firebaseId}_${idx}`;
                        const pesoEditado =
                          pesosEditando[pesoKey] !== undefined ? pesosEditando[pesoKey] : item.pesoReal || "";

                        return (
                          <div key={`${pedido.firebaseId}-${idx}`} className="rounded-[24px] border border-white/10 bg-white/88 p-4 text-slate-900 shadow-[0_12px_30px_rgba(15,23,42,0.10)]">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                              <div className="min-w-0">
                                <div className="text-base font-black uppercase text-slate-900">{item.producto}</div>
                                {item.nota ? (
                                  <div className="mt-2 rounded-[16px] border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">
                                    {item.nota}
                                  </div>
                                ) : null}
                              </div>

                              <div className="grid gap-2 sm:min-w-[220px]">
                                <div className="rounded-[16px] border border-sky-200 bg-sky-50 px-3 py-3">
                                  <div className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-sky-700">Solicitado</div>
                                  <div className="mt-1 text-lg font-black text-sky-900">
                                    {item.cantidad} {item.unidad}
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="mt-3">
                              {status === "NUEVO" || status === "STANDBY_ENTREGA" ? (
                                <div className="rounded-[16px] border border-dashed border-slate-300 bg-slate-100 px-3 py-3 text-center text-sm font-bold text-slate-500">
                                  Peso real se habilita al iniciar preparacion.
                                </div>
                              ) : (
                                <div>
                                  <div className="mb-2 text-xs font-extrabold uppercase tracking-[0.16em] text-slate-500">Peso real</div>
                                  <div className="relative">
                                    <input
                                      type="number"
                                      step="0.01"
                                      value={pesoEditado}
                                      onChange={(event) => actualizarPesoReal(pedido.firebaseId, idx, event.target.value)}
                                      onBlur={() => guardarPesoReal(pedido.firebaseId, idx)}
                                      placeholder="0.00"
                                      className="w-full rounded-[16px] border border-slate-300 bg-white px-4 py-3 pr-12 text-center text-lg font-black text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                                      style={{
                                        borderColor: pesoEditado ? "#22c55e" : undefined,
                                        background: pesoEditado ? "#f0fdf4" : "#ffffff",
                                      }}
                                    />
                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                                      lb
                                    </span>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="grid gap-3">
                      {(status === "NUEVO" || status === "STANDBY_ENTREGA") ? (
                        <button
                          type="button"
                          onClick={() => {
                            setModalPreparador(pedido.firebaseId);
                            setPreparadorSeleccionado(null);
                          }}
                          className="flex w-full items-center justify-center gap-2 rounded-[18px] border border-orange-300/40 bg-orange-400/12 px-4 py-4 text-base font-black text-orange-100 transition hover:-translate-y-0.5"
                        >
                          {Icons.chef}
                          {isStandby ? "Iniciar preparacion de standby" : "Iniciar preparacion"}
                        </button>
                      ) : null}

                      {status === "PREPARACION" ? (
                        <button
                          type="button"
                          onClick={() => marcarListo(pedido.firebaseId)}
                          disabled={!todosPesosLlenos}
                          className="flex w-full items-center justify-center gap-2 rounded-[18px] border-none px-4 py-4 text-base font-black text-white transition"
                          style={{
                            background: todosPesosLlenos
                              ? "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)"
                              : "linear-gradient(135deg, rgba(100,116,139,0.9) 0%, rgba(71,85,105,0.9) 100%)",
                            boxShadow: todosPesosLlenos ? "0 18px 30px rgba(34,197,94,0.24)" : "none",
                            cursor: todosPesosLlenos ? "pointer" : "not-allowed",
                          }}
                        >
                          {Icons.check}
                          {todosPesosLlenos ? "Marcar como listo" : "Completa todos los pesos"}
                        </button>
                      ) : null}

                      {status === "LISTO" ? (
                        <div className="rounded-[20px] border border-emerald-300/40 bg-emerald-400/18 px-4 py-4 text-center text-base font-black text-emerald-50">
                          Pedido listo para enviar.
                        </div>
                      ) : null}

                      {pedido.timestampPreparacion ? (
                        <div className="flex flex-wrap gap-2">
                          <span className="app-chip border-orange-300/20 bg-orange-400/12 text-orange-100">
                            {Icons.clock}
                            Inicio {pedido.timestampPreparacion}
                          </span>
                          {pedido.timestampListo ? (
                            <span className="app-chip border-emerald-300/20 bg-emerald-400/12 text-emerald-100">
                              {Icons.check}
                              Listo {pedido.timestampListo}
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
