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
        background: `linear-gradient(135deg, ${accent}14 0%, rgba(255,255,255,0.98) 100%)`,
      }}
    >
      <div className="text-xs font-extrabold uppercase tracking-[0.18em] text-slate-500">{label}</div>
      <div className="mt-2 text-2xl font-black text-slate-900">{value}</div>
      {helper ? <div className="mt-1 text-sm text-slate-600">{helper}</div> : null}
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
    const configRef = ref(db, "configuracion");

    const unsubscribe = onValue(
      configRef,
      (snapshot) => {
        const data = snapshot.val();

        if (!data) {
          setConfig(INITIAL_CONFIG);
          return;
        }

        setConfig({
          ...INITIAL_CONFIG,
          ...data,
          personalCocina: data.personalCocina || INITIAL_CONFIG.personalCocina,
          personalTransporte: data.personalTransporte || INITIAL_CONFIG.personalTransporte,
          productos: data.productos || [],
        });
      },
      (error) => {
        console.error("Error cargando configuracion global:", error);
      },
    );

    return () => {
      if (typeof unsubscribe === "function") {
        unsubscribe();
      }
    };
  }, []);

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
  const isFormularioView = view === "formulario";

  if (!user) {
    return (
      <div className="app-shell flex min-h-screen items-center">
        <div className="grid w-full gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          <section
            className="app-panel page-enter overflow-hidden p-6 sm:p-8 lg:p-10"
            style={{
              background:
                "linear-gradient(135deg, rgba(53,125,191,0.98) 0%, rgba(71,138,198,0.96) 52%, rgba(244,249,254,0.95) 100%)",
            }}
          >
            <div className="app-chip mb-5 w-fit border-white/25 bg-white/14 text-white">
              {Icons.spark}
              Version interna
            </div>
            <div className="max-w-2xl">
              <h1 className="app-title text-4xl font-black leading-tight text-white sm:text-5xl">
                Pedidos internos con imagen mas limpia, blanca y lista para uso diario.
              </h1>
              <p className="mt-4 max-w-xl text-base leading-7 text-sky-50 sm:text-lg">
                Mantuvimos toda la operacion y la llevamos a una presentacion mas clara, mas parecida a un sistema de escritorio moderno como SICAR.
              </p>
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              <MetricCard label="Tema" value="Claro" accent="#dceeff" helper="Mas descanso visual" />
              <MetricCard label="Navegacion" value="Ordenada" accent="#d7ecfb" helper="Mas intuitiva en telefono" />
              <MetricCard label="Estilo" value="SICAR" accent="#dbe8ff" helper="Azul, blanco y limpio" />
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {[
                "Acciones principales visibles y faciles de tocar.",
                "Tarjetas compactas en vez de bloques pesados y oscuros.",
                "Jerarquia visual inspirada en SICAR: barra azul y zona de trabajo clara.",
                "Base lista para seguir refinando y pasar luego a Android.",
              ].map((item) => (
                <div key={item} className="rounded-[24px] border border-white/18 bg-white/12 p-4 text-sm text-white shadow-[0_12px_28px_rgba(17,57,96,0.14)] backdrop-blur-sm">
                  <span className="mr-3 inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/18 text-white">
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
                <div className="flex h-16 w-16 items-center justify-center rounded-[22px] bg-[linear-gradient(135deg,#3f83c0_0%,#2373b9_100%)] text-white shadow-[0_16px_34px_rgba(35,115,185,0.24)]">
                  {Icons.app}
                </div>
                <div>
                  <div className="app-title text-3xl font-black text-slate-900">Sistema Interno</div>
                  <div className="mt-1 text-sm text-slate-600">Ingreso de sucursales y seguimiento operativo.</div>
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
                      className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-600"
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

                <div className="mt-6 rounded-[24px] border border-sky-100 bg-sky-50 p-4 text-sm text-slate-600">
                  La app ya esta organizada para una experiencia movil: tarjetas claras, botoneria grande y navegacion facil.
                </div>
            </div>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell page-enter">
      <header
        className="app-panel overflow-hidden px-4 py-4 sm:px-6"
        style={{
          background:
            "linear-gradient(135deg, rgba(54,124,189,0.98) 0%, rgba(73,138,197,0.96) 42%, rgba(232,241,249,0.96) 100%)",
        }}
      >
        <div
          className="absolute inset-0 opacity-40"
          style={{
            background: `radial-gradient(circle at top right, rgba(255,255,255,0.22), transparent 28%), linear-gradient(135deg, ${navMeta.color}20, transparent 54%)`,
          }}
        />

        <div className="relative flex flex-col gap-4">
          {isFormularioView ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="app-chip w-fit border-white/25 bg-white/14 text-white">{fechaActual}</div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="rounded-[22px] border border-white/24 bg-white/14 px-4 py-3 text-white">
                  <div className="text-xs font-extrabold uppercase tracking-[0.18em] text-sky-50/80">Sesion</div>
                  <div className="mt-1 text-lg font-black text-white">{user}</div>
                </div>
                <button
                  onClick={() => {
                    setUser(null);
                    setPassword("");
                    setView("formulario");
                  }}
                  className="app-button-ghost whitespace-nowrap border-white/24 bg-white/14 text-sm text-white"
                >
                  {Icons.logout}
                  Salir
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex items-start gap-4">
                  <div
                    className="flex h-14 w-14 items-center justify-center rounded-[20px] text-white shadow-[0_18px_40px_rgba(15,23,42,0.28)]"
                    style={{ background: `linear-gradient(135deg, ${navMeta.color} 0%, #1d4ed8 100%)` }}
                  >
                    {navMeta.icon}
                  </div>
                  <div>
                    <div className="app-chip mb-2 border-white/24 bg-white/14 text-white">{fechaActual}</div>
                    <h1 className="app-title text-3xl font-black text-white">{navMeta.title}</h1>
                    <p className="mt-1 max-w-2xl text-sm text-sky-50 sm:text-base">{navMeta.subtitle}</p>
                  </div>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="rounded-[22px] border border-white/24 bg-white/14 px-4 py-3 text-white">
                    <div className="text-xs font-extrabold uppercase tracking-[0.18em] text-sky-50/80">Sesion</div>
                    <div className="mt-1 text-lg font-black text-white">{user}</div>
                  </div>
                  <button
                    onClick={() => {
                      setUser(null);
                      setPassword("");
                      setView("formulario");
                    }}
                    className="app-button-ghost whitespace-nowrap border-white/24 bg-white/14 text-sm text-white"
                  >
                    {Icons.logout}
                    Salir
                  </button>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <MetricCard label="Pedidos visibles" value={stats.total} accent="#38bdf8" helper="Todo lo relacionado contigo" />
                <MetricCard label="Activos" value={stats.activos} accent="#818cf8" helper="Pendientes de cerrar" />
                <MetricCard label="Standby" value={stats.standby} accent="#f59e0b" helper="Entrega programada" />
                <MetricCard label="Listos" value={stats.listos} accent="#22c55e" helper="Esperando despacho" />
              </div>
            </>
          )}
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
                  borderColor: view === item.key ? `${item.color}40` : "rgba(148,163,184,0.2)",
                  background: view === item.key ? `${item.color}14` : "rgba(247,251,255,0.98)",
                  color: view === item.key ? "#12324e" : "#55718d",
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
        <div className="mx-auto flex max-w-4xl gap-2 rounded-[28px] border border-slate-200 bg-white/94 p-2 shadow-[0_16px_42px_rgba(60,90,122,0.16)] backdrop-blur-2xl">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.key}
              onClick={() => setView(item.key)}
              className="flex min-h-[68px] flex-1 flex-col items-center justify-center rounded-[22px] px-2 text-xs font-bold transition-all sm:flex-row sm:gap-2 sm:text-sm"
              style={{
                background: view === item.key ? `${item.color}14` : "transparent",
                border: `1px solid ${view === item.key ? `${item.color}36` : "transparent"}`,
                color: view === item.key ? "#12324e" : "#6b7f92",
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
