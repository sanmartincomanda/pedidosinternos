"use client";

import React, { useEffect, useMemo, useState } from "react";
import { db } from "../firebase";
import { onValue, ref } from "firebase/database";
import Cocina from "./Cocina";
import Configuracion from "./Configuracion";
import EstadoPedidos from "./EstadoPedidos";
import Formulario from "./Formulario";
import Historial from "./Historial";

const Icons = {
  app: (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1">
      <path d="M12 2 3 6.5 12 11l9-4.5L12 2Z" />
      <path d="M3 12.5 12 17l9-4.5" />
      <path d="M3 18.5 12 23l9-4.5" />
    </svg>
  ),
  chef: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M7 10h10v10a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V10Z" />
      <path d="M6 10a4 4 0 1 1 2-7 4.6 4.6 0 0 1 8 2 3.5 3.5 0 1 1 1 6" />
    </svg>
  ),
  clipboard: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="5" y="4" width="14" height="17" rx="2" />
      <path d="M9 4.5h6v3H9z" />
      <path d="M9 11h6M9 15h6" />
    </svg>
  ),
  truck: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 7h11v8H3z" />
      <path d="M14 10h4l3 3v2h-7z" />
      <circle cx="7.5" cy="18" r="2" />
      <circle cx="17.5" cy="18" r="2" />
    </svg>
  ),
  history: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4v5h5" />
      <path d="M12 7v5l3 2" />
    </svg>
  ),
  settings: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 3v2.2M12 18.8V21M4.9 4.9l1.6 1.6M17.5 17.5l1.6 1.6M3 12h2.2M18.8 12H21M4.9 19.1l1.6-1.6M17.5 6.5l1.6-1.6" />
      <circle cx="12" cy="12" r="4" />
    </svg>
  ),
  lock: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  ),
  user: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20 21a8 8 0 0 0-16 0" />
      <circle cx="12" cy="8" r="4" />
    </svg>
  ),
  logout: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 21H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3" />
      <path d="m16 17 5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  ),
  eye: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
  spark: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="m12 3 1.8 4.8L19 9.5l-4 3.2 1.3 5.1L12 15.2 7.7 17.8 9 12.7 5 9.5l5.2-1.7L12 3Z" />
    </svg>
  ),
};

const NAV_ITEMS = [
  {
    key: "formulario",
    label: "Nuevo",
    title: "Nuevo pedido",
    subtitle: "Carga productos y envia rapido.",
    color: "#38bdf8",
    icon: Icons.clipboard,
  },
  {
    key: "cocina",
    label: "Cocina",
    title: "Preparacion",
    subtitle: "Controla pesos y avance de cada orden.",
    color: "#fb923c",
    icon: Icons.chef,
  },
  {
    key: "estados",
    label: "Estados",
    title: "Seguimiento",
    subtitle: "Despacho, recepcion y diferencias.",
    color: "#818cf8",
    icon: Icons.truck,
  },
  {
    key: "historial",
    label: "Historial",
    title: "Historial diario",
    subtitle: "Consulta actividad y consolidados.",
    color: "#a78bfa",
    icon: Icons.history,
  },
  {
    key: "configuracion",
    label: "Ajustes",
    title: "Configuracion",
    subtitle: "Personal, catalogo y parametros.",
    color: "#94a3b8",
    icon: Icons.settings,
  },
];

const SUCURSALES_REGISTRADAS = [
  { nombre: "Granada Gold", pass: "granada2026" },
  { nombre: "Masaya Gold", pass: "masaya2026" },
  { nombre: "Carnes Amparito", pass: "amparito2026" },
  { nombre: "Cedi", pass: "cedi2026" },
  { nombre: "Luis Saenz", pass: "admin123" },
];

const INITIAL_CONFIG = {
  personalCocina: ["Marcos Ramirez", "Miguel Bustamante", "David", "Roberto Marin"],
  personalTransporte: ["Noel Hernandez", "Noel Bendana", "Vladimir", "David", "Nelson", "Julio Amador", "Carlos Mora"],
};

function MetricCard({ label, value, accent, helper }) {
  return (
    <div
      className="app-card-soft p-4"
      style={{
        borderColor: `${accent}35`,
        background: `linear-gradient(135deg, ${accent}18 0%, rgba(7,18,34,0.7) 100%)`,
      }}
    >
      <div className="text-xs font-extrabold uppercase tracking-[0.18em] text-slate-300">{label}</div>
      <div className="mt-2 text-2xl font-black text-white">{value}</div>
      {helper ? <div className="mt-1 text-sm text-slate-300/80">{helper}</div> : null}
    </div>
  );
}

export default function AppInterna() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState("formulario");
  const [pedidos, setPedidos] = useState([]);
  const [config, setConfig] = useState(() => {
    if (typeof window === "undefined") return INITIAL_CONFIG;

    const savedConfig = window.localStorage.getItem("appConfig");
    if (!savedConfig) return INITIAL_CONFIG;

    try {
      return JSON.parse(savedConfig);
    } catch (parseError) {
      console.error("No se pudo leer appConfig", parseError);
      return INITIAL_CONFIG;
    }
  });
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    localStorage.setItem("appConfig", JSON.stringify(config));
  }, [config]);

  useEffect(() => {
    if (!user) return;

    const pedidosRef = ref(db, "pedidos_internos");
    const unsubscribe = onValue(pedidosRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) {
        setPedidos([]);
        return;
      }

      const lista = Object.keys(data).map((key) => ({
        firebaseId: key,
        ...data[key],
      }));

      const pedidosRelevantes = lista.filter(
        (pedido) =>
          pedido.sucursalOrigen === user ||
          pedido.sucursalDestino === user ||
          user === "Luis Saenz",
      );

      setPedidos(pedidosRelevantes.reverse());
    });

    return () => unsubscribe();
  }, [user]);

  const handleLogin = (event) => {
    event.preventDefault();

    const encontrado = SUCURSALES_REGISTRADAS.find(
      (sucursal) =>
        sucursal.nombre.toLowerCase() === username.trim().toLowerCase() &&
        sucursal.pass === password,
    );

    if (!encontrado) {
      setError("Usuario o contrasena incorrectos.");
      return;
    }

    setUser(encontrado.nombre);
    setError("");
    setPassword("");
    setView("formulario");
  };

  const navMeta = useMemo(
    () => NAV_ITEMS.find((item) => item.key === view) || NAV_ITEMS[0],
    [view],
  );

  const stats = useMemo(() => {
    const activos = pedidos.filter(
      (pedido) => !["RECIBIDO_CONFORME", "ENTREGADO"].includes(pedido.estado),
    ).length;
    const standby = pedidos.filter((pedido) => pedido.estado === "STANDBY_ENTREGA").length;
    const listos = pedidos.filter((pedido) => pedido.estado === "LISTO").length;

    return {
      activos,
      standby,
      listos,
      total: pedidos.length,
    };
  }, [pedidos]);

  const fechaActual = new Intl.DateTimeFormat("es-NI", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());

  const sharedProps = {
    user,
    pedidos,
    config,
  };

  if (!user) {
    return (
      <div className="app-shell flex min-h-screen items-center">
        <div className="grid w-full gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="app-panel page-enter overflow-hidden p-6 sm:p-8 lg:p-10">
            <div className="app-chip mb-5 w-fit border-sky-400/30 bg-sky-400/10 text-sky-200">
              {Icons.spark}
              Version movil
            </div>
            <div className="max-w-2xl">
              <h1 className="app-title text-4xl font-black leading-tight text-white sm:text-5xl">
                Pedidos internos con experiencia pensada para telefono y handheld.
              </h1>
              <p className="mt-4 max-w-xl text-base leading-7 text-slate-300 sm:text-lg">
                Mantuvimos el flujo operativo y le dimos una interfaz mas tactil, rapida y lista para el salto a Android.
              </p>
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              <MetricCard label="Vista movil" value="100%" accent="#38bdf8" helper="Controles grandes y claros" />
              <MetricCard label="Navegacion" value="Inferior" accent="#2dd4bf" helper="Mas natural en mano" />
              <MetricCard label="Objetivo" value="Android" accent="#818cf8" helper="Base visual ya preparada" />
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {[
                "Acciones principales accesibles con el pulgar.",
                "Tarjetas apiladas en lugar de tablas pesadas.",
                "Colores y jerarquia visual pensados para turnos rapidos.",
                "Base lista para empaquetar luego en Android.",
              ].map((item) => (
                <div key={item} className="app-card-soft flex items-start gap-3 p-4 text-sm text-slate-200">
                  <span className="mt-1 flex h-6 w-6 items-center justify-center rounded-full bg-sky-400/20 text-sky-200">
                    {Icons.spark}
                  </span>
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="app-panel page-enter p-6 sm:p-8">
            <div className="mx-auto max-w-md">
              <div className="mb-6 flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-[22px] bg-[linear-gradient(135deg,#38bdf8_0%,#2563eb_100%)] text-white shadow-[0_18px_40px_rgba(37,99,235,0.38)]">
                  {Icons.app}
                </div>
                <div>
                  <div className="app-title text-3xl font-black text-white">Sistema Interno</div>
                  <div className="mt-1 text-sm text-slate-300">Ingreso de sucursales y seguimiento operativo.</div>
                </div>
              </div>

              <form className="space-y-5" onSubmit={handleLogin}>
                <div>
                  <label className="app-label">Sucursal</label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                      {Icons.user}
                    </span>
                    <input
                      type="text"
                      value={username}
                      onChange={(event) => setUsername(event.target.value)}
                      placeholder="Ej. Granada Gold"
                      className="app-input pl-12"
                    />
                  </div>
                </div>

                <div>
                  <label className="app-label">Contrasena</label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                      {Icons.lock}
                    </span>
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="Ingresa tu clave"
                      className="app-input pl-12 pr-14"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((current) => !current)}
                      className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-200"
                    >
                      {Icons.eye}
                    </button>
                  </div>
                </div>

                {error ? (
                  <div className="rounded-2xl border border-rose-400/35 bg-rose-500/12 px-4 py-3 text-sm font-semibold text-rose-200">
                    {error}
                  </div>
                ) : null}

                <button type="submit" className="app-button-primary w-full text-base">
                  Entrar al sistema
                </button>
              </form>

              <div className="mt-6 rounded-[24px] border border-white/8 bg-white/4 p-4 text-sm text-slate-300">
                La app ya esta organizada para una experiencia movil: tarjetas, botoneria grande y navegacion inferior.
              </div>
            </div>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell page-enter">
      <header className="app-panel overflow-hidden px-4 py-4 sm:px-6">
        <div
          className="absolute inset-0 opacity-40"
          style={{
            background: `radial-gradient(circle at top right, ${navMeta.color}28, transparent 30%), linear-gradient(135deg, rgba(255,255,255,0.04), transparent 55%)`,
          }}
        />

        <div className="relative flex flex-col gap-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-start gap-4">
              <div
                className="flex h-14 w-14 items-center justify-center rounded-[20px] text-white shadow-[0_18px_40px_rgba(15,23,42,0.28)]"
                style={{ background: `linear-gradient(135deg, ${navMeta.color} 0%, #1d4ed8 100%)` }}
              >
                {navMeta.icon}
              </div>
              <div>
                <div className="app-chip mb-2 border-white/10 bg-white/5 text-slate-200">{fechaActual}</div>
                <h1 className="app-title text-3xl font-black text-white">{navMeta.title}</h1>
                <p className="mt-1 max-w-2xl text-sm text-slate-300 sm:text-base">{navMeta.subtitle}</p>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="rounded-[22px] border border-white/10 bg-white/5 px-4 py-3">
                <div className="text-xs font-extrabold uppercase tracking-[0.18em] text-slate-400">Sesion</div>
                <div className="mt-1 text-lg font-black text-white">{user}</div>
              </div>
              <button
                onClick={() => {
                  setUser(null);
                  setPassword("");
                  setView("formulario");
                }}
                className="app-button-ghost whitespace-nowrap text-sm"
              >
                {Icons.logout}
                Salir
              </button>
            </div>
          </div>

          <div className={`grid gap-3 sm:grid-cols-2 xl:grid-cols-4 ${view === "formulario" ? "hidden sm:grid" : ""}`}>
            <MetricCard label="Pedidos visibles" value={stats.total} accent="#38bdf8" helper="Todo lo relacionado contigo" />
            <MetricCard label="Activos" value={stats.activos} accent="#818cf8" helper="Pendientes de cerrar" />
            <MetricCard label="Standby" value={stats.standby} accent="#f59e0b" helper="Entrega programada" />
            <MetricCard label="Listos" value={stats.listos} accent="#22c55e" helper="Esperando despacho" />
          </div>
        </div>
      </header>

      <main className="mt-5 space-y-5">
        <section className="app-panel px-4 py-4 sm:px-6">
          <div className="flex flex-wrap items-center gap-3">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.key}
                onClick={() => setView(item.key)}
                className="app-chip transition-all"
                style={{
                  borderColor: view === item.key ? `${item.color}55` : "rgba(255,255,255,0.08)",
                  background: view === item.key ? `${item.color}18` : "rgba(255,255,255,0.04)",
                  color: view === item.key ? "#ffffff" : "#cbd5e1",
                }}
              >
                <span style={{ color: item.color }}>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="app-section p-4 sm:p-6">
          {view === "formulario" ? (
            <Formulario
              user={sharedProps.user}
              pedidos={sharedProps.pedidos}
              setView={setView}
              sucursales={SUCURSALES_REGISTRADAS.map((item) => item.nombre).filter((name) => name !== user)}
              productosCSV={config.productos || []}
            />
          ) : null}

          {view === "cocina" ? (
            <Cocina user={sharedProps.user} pedidos={sharedProps.pedidos} personalCocina={config.personalCocina || []} />
          ) : null}

          {view === "estados" ? (
            <EstadoPedidos
              user={sharedProps.user}
              pedidos={sharedProps.pedidos}
              personalTransporte={config.personalTransporte || []}
            />
          ) : null}

          {view === "historial" ? <Historial user={sharedProps.user} pedidos={sharedProps.pedidos} /> : null}

          {view === "configuracion" ? <Configuracion config={config} setConfig={setConfig} /> : null}
        </section>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-50 px-3 pb-[calc(12px+env(safe-area-inset-bottom))] pt-4">
        <div className="mx-auto flex max-w-4xl gap-2 rounded-[28px] border border-white/10 bg-slate-950/80 p-2 shadow-[0_24px_70px_rgba(2,6,23,0.46)] backdrop-blur-2xl">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.key}
              onClick={() => setView(item.key)}
              className="flex min-h-[68px] flex-1 flex-col items-center justify-center rounded-[22px] px-2 text-xs font-bold transition-all sm:flex-row sm:gap-2 sm:text-sm"
              style={{
                background: view === item.key ? `${item.color}22` : "transparent",
                border: `1px solid ${view === item.key ? `${item.color}55` : "transparent"}`,
                color: view === item.key ? "#ffffff" : "#94a3b8",
              }}
            >
              <span style={{ color: item.color }}>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
