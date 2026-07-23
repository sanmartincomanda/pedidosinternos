"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { db } from "../firebase";
import { onValue, ref } from "firebase/database";
import {
  authenticateBranch,
  getBranchDisplayName,
  getSelectableBranches,
  isSameBranch,
} from "@/lib/branchUtils";
import { normalizePedidoForUi } from "@/lib/orderUtils";
import {
  deactivateMobileNotifications,
  initializeMobileNotifications,
  isNativeAndroidApp,
  stopMobileNotificationListeners,
} from "@/lib/mobileNotifications";
import Cocina from "./Cocina";
import Configuracion from "./Configuracion";
import EstadoPedidos from "./EstadoPedidos";
import Formulario from "./Formulario";
import Historial from "./Historial";
import PedidoVacuna from "./PedidoVacuna";

const Icons = {
  app: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 2 3 6.5 12 11l9-4.5L12 2Z" />
      <path d="M3 12.5 12 17l9-4.5" />
      <path d="M3 18.5 12 23l9-4.5" />
    </svg>
  ),
  clipboard: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="5" y="4" width="14" height="17" rx="2" />
      <path d="M9 4.5h6v3H9z" />
      <path d="M9 11h6M9 15h6" />
    </svg>
  ),
  vaccine: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 3h6v4H9z" />
      <path d="M8 7h8v4a4 4 0 0 1-4 4 4 4 0 0 1-4-4V7Z" />
      <path d="M12 15v6M9 19h6" />
    </svg>
  ),
  chef: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M7 10h10v10a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V10Z" />
      <path d="M6 10a4 4 0 1 1 2-7 4.6 4.6 0 0 1 8 2 3.5 3.5 0 1 1 1 6" />
    </svg>
  ),
  truck: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 7h11v8H3z" />
      <path d="M14 10h4l3 3v2h-7z" />
      <circle cx="7.5" cy="18" r="2" />
      <circle cx="17.5" cy="18" r="2" />
    </svg>
  ),
  history: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4v5h5" />
      <path d="M12 7v5l3 2" />
    </svg>
  ),
  settings: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 3v2.2M12 18.8V21M4.9 4.9l1.6 1.6M17.5 17.5l1.6 1.6M3 12h2.2M18.8 12H21M4.9 19.1l1.6-1.6M17.5 6.5l1.6-1.6" />
      <circle cx="12" cy="12" r="4" />
    </svg>
  ),
  user: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20 21a8 8 0 0 0-16 0" />
      <circle cx="12" cy="8" r="4" />
    </svg>
  ),
  lock: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  ),
  eye: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
  logout: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 21H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3" />
      <path d="m16 17 5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  ),
  calendar: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M8 2v4M16 2v4M3 10h18" />
    </svg>
  ),
  spark: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="m12 3 1.8 4.8L19 9.5l-4 3.2 1.3 5.1L12 15.2 7.7 17.8 9 12.7 5 9.5l5.2-1.7L12 3Z" />
    </svg>
  ),
  bell: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
      <path d="M10 21h4" />
    </svg>
  ),
  monitor: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4" width="18" height="13" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </svg>
  ),
};

const NAV_ITEMS = [
  { key: "formulario", label: "Pedido", title: "Realizar Pedido", icon: Icons.clipboard, accent: "#76b900" },
  { key: "vacuna", label: "Traspaso", title: "Traspaso", icon: Icons.vaccine, accent: "#16a36a" },
  { key: "cocina", label: "Cocina", title: "Cocina - Preparacion", icon: Icons.chef, accent: "#f59e0b" },
  { key: "estados", label: "Recibir", title: "Recibir Producto", icon: Icons.truck, accent: "#0ea5e9" },
  { key: "historial", label: "Historial", title: "Historial", icon: Icons.history, accent: "#8b9a8f" },
];

const INITIAL_CONFIG = {
  personalCocina: ["Marcos Ramirez", "Miguel Bustamante", "David", "Roberto Marin"],
  personalTransporte: ["Noel Hernandez", "Noel Bendana", "Vladimir", "David", "Nelson", "Julio Amador", "Carlos Mora"],
  impresion: {
    impresoraPredeterminada: "",
    impresionAutomaticaEnvio: true,
    formato: "80mm",
  },
};

const FINAL_ORDER_STATUSES = new Set(["RECIBIDO_CONFORME", "ENTREGADO", "ANULADO"]);
const PREPARATION_STATUSES = new Set(["NUEVO", "STANDBY_ENTREGA", "PREPARACION", "LISTO"]);
const STATUS_NOTIFICATIONS = {
  NUEVO: { title: "Nuevo pedido recibido", view: "cocina" },
  STANDBY_ENTREGA: { title: "Pedido pendiente de preparar", view: "cocina" },
  PREPARACION: { title: "Pedido en preparacion", view: "cocina" },
  LISTO: { title: "Pedido listo para enviar", view: "cocina" },
  ENVIADO: { title: "Pedido enviado", view: "estados" },
  RECIBIDO_CONFORME: { title: "Pedido recibido conforme", view: "historial" },
  ENTREGADO: { title: "Pedido entregado", view: "historial" },
  ANULADO: { title: "Pedido anulado", view: "historial" },
};

function getPedidoIdentity(pedido) {
  return `${pedido?.firebaseId || pedido?.id || pedido?.numeroOrden || ""}`;
}

function notifyPedidoChanges(pedidos, previousStatusesRef) {
  const currentStatuses = Object.fromEntries(
    pedidos.map((pedido) => [getPedidoIdentity(pedido), `${pedido?.estado || ""}`]),
  );
  const previousStatuses = previousStatusesRef.current;

  if (previousStatuses && typeof window !== "undefined" && window.desktopAPI?.notify) {
    pedidos.forEach((pedido) => {
      const pedidoId = getPedidoIdentity(pedido);
      const previousStatus = previousStatuses[pedidoId];
      const currentStatus = `${pedido?.estado || ""}`;
      const isNewOperationalOrder = !previousStatus && ["NUEVO", "ENVIADO"].includes(currentStatus);

      if ((previousStatus && previousStatus !== currentStatus) || isNewOperationalOrder) {
        const notification = STATUS_NOTIFICATIONS[currentStatus];
        if (!notification) return;

        window.desktopAPI.notify({
          title: notification.title,
          body: `${pedido?.numeroOrden || "Pedido"} - Estado actualizado correctamente`,
          orderId: pedidoId,
          view: notification.view,
        });
      }
    });
  }

  previousStatusesRef.current = currentStatuses;
}

function DesktopNavButton({ item, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-3 rounded-[1rem] border px-4 py-3 text-left transition-all"
      style={{
        borderColor: active ? `${item.accent}33` : "rgba(217, 225, 232, 0.9)",
        background: active ? `${item.accent}12` : "rgba(255,255,255,0.92)",
        color: active ? "#111827" : "#475569",
        boxShadow: active ? `0 12px 24px -18px ${item.accent}55` : "none",
      }}
    >
      <span style={{ color: item.accent }}>{item.icon}</span>
      <span className="text-sm font-black">{item.label}</span>
    </button>
  );
}

function SidebarNavButton({ item, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`desktop-rail-item ${active ? "is-active" : ""}`}
      style={{ "--nav-accent": item.accent }}
    >
      <span className="desktop-rail-icon">{item.icon}</span>
      <span>{item.label}</span>
      <span className="desktop-rail-indicator" />
    </button>
  );
}

function MobileNavButton({ item, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-[64px] flex-1 flex-col items-center justify-center gap-1 rounded-[18px] border px-2 text-[11px] font-black transition-all sm:text-xs"
      style={{
        borderColor: active ? `${item.accent}30` : "transparent",
        background: active ? `${item.accent}12` : "transparent",
        color: active ? "#111827" : "#64748b",
      }}
    >
      <span style={{ color: item.accent }}>{item.icon}</span>
      <span>{item.label}</span>
    </button>
  );
}

export default function AppInterna() {
  const [user, setUser] = useState(() => {
    if (typeof window === "undefined") return null;
    const savedBranch = window.localStorage.getItem("csmDesktopBranch");
    return ["Granada", "Nindiri"].includes(savedBranch) ? savedBranch : null;
  });
  const [view, setView] = useState("formulario");
  const [pedidos, setPedidos] = useState([]);
  const [pedidoEditar, setPedidoEditar] = useState(null);
  const [config, setConfig] = useState(() => {
    if (typeof window === "undefined") return INITIAL_CONFIG;

    const savedConfig = window.localStorage.getItem("appConfig");
    if (!savedConfig) return INITIAL_CONFIG;

    try {
      return JSON.parse(savedConfig);
    } catch (error) {
      console.error("No se pudo leer appConfig", error);
      return INITIAL_CONFIG;
    }
  });
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isOnline, setIsOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));
  const [isDesktop, setIsDesktop] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const previousOrderStatusesRef = useRef(null);

  useEffect(() => {
    const desktopMode = Boolean(window.desktopAPI?.isDesktop);
    const mobileMode = isNativeAndroidApp();
    queueMicrotask(() => {
      setIsDesktop(desktopMode);
      setIsMobile(mobileMode);
    });
    document.documentElement.classList.toggle("desktop-runtime", desktopMode);
    document.documentElement.classList.toggle("android-runtime", mobileMode);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    const disposeNavigation = window.desktopAPI?.onNavigate?.((nextView) => {
      if (NAV_ITEMS.some((item) => item.key === nextView) || nextView === "configuracion") {
        setView(nextView);
      }
    });

    return () => {
      document.documentElement.classList.remove("desktop-runtime");
      document.documentElement.classList.remove("android-runtime");
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      if (typeof disposeNavigation === "function") disposeNavigation();
    };
  }, []);

  useEffect(() => {
    if (!user || !isNativeAndroidApp()) return undefined;

    let disposed = false;
    let cleanup = stopMobileNotificationListeners;
    initializeMobileNotifications(user, (nextView) => {
      if (NAV_ITEMS.some((item) => item.key === nextView) || nextView === "configuracion") {
        setView(nextView);
      }
    })
      .then((removeListeners) => {
        if (disposed) {
          removeListeners();
        } else {
          cleanup = removeListeners;
        }
      })
      .catch((notificationError) => {
        console.error("No se pudieron iniciar las notificaciones Android:", notificationError);
      });

    return () => {
      disposed = true;
      cleanup();
    };
  }, [user]);

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
          impresion: {
            ...INITIAL_CONFIG.impresion,
            ...(data.impresion || {}),
          },
        });
      },
      (readError) => {
        console.error("Error cargando configuracion global:", readError);
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

      const lista = Object.keys(data).map((key) => normalizePedidoForUi(data[key], key));

      const pedidosRelevantes = lista.filter(
        (pedido) =>
          isSameBranch(pedido.sucursalOrigen, user) ||
          isSameBranch(pedido.sucursalDestino, user),
      );

      const pedidosOrdenados = pedidosRelevantes.reverse();
      notifyPedidoChanges(pedidosOrdenados, previousOrderStatusesRef);
      setPedidos(pedidosOrdenados);
    });

    return () => unsubscribe();
  }, [user]);

  const handleLogin = (event) => {
    event.preventDefault();

    const found = authenticateBranch(username, password);

    if (!found) {
      setError("Usuario o contrasena incorrectos.");
      return;
    }

    window.localStorage.setItem("csmDesktopBranch", found.id);
    previousOrderStatusesRef.current = null;
    setUser(found.id);
    setError("");
    setPassword("");
    setPedidoEditar(null);
    setView("formulario");
  };

  const handleLogout = () => {
    deactivateMobileNotifications().catch((notificationError) => {
      console.error("No se pudo desactivar este telefono:", notificationError);
    });
    window.localStorage.removeItem("csmDesktopBranch");
    previousOrderStatusesRef.current = null;
    setUser(null);
    setPassword("");
    setPedidoEditar(null);
    setView("formulario");
  };

  const navMeta = useMemo(
    () =>
      NAV_ITEMS.find((item) => item.key === view) || {
        title: "Configuracion",
        icon: Icons.settings,
      },
    [view],
  );

  const fechaActual = new Intl.DateTimeFormat("es-NI", {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date());

  const operationalSummary = useMemo(() => {
    const active = pedidos.filter((pedido) => !FINAL_ORDER_STATUSES.has(pedido.estado)).length;
    const preparation = pedidos.filter((pedido) => PREPARATION_STATUSES.has(pedido.estado)).length;
    const inTransit = pedidos.filter((pedido) => pedido.estado === "ENVIADO").length;
    return { active, preparation, inTransit };
  }, [pedidos]);

  const renderCurrentView = () => {
    const commonPrinterSettings = config.impresion || INITIAL_CONFIG.impresion;
    const branchOptions = getSelectableBranches(user);

    switch (view) {
      case "formulario":
        return (
          <Formulario
            user={user}
            pedidos={pedidos}
            printerSettings={commonPrinterSettings}
            setView={setView}
            pedidoEditar={pedidoEditar}
            setPedidoEditar={setPedidoEditar}
            sucursales={branchOptions}
            productosCSV={config.productos || []}
          />
        );
      case "vacuna":
        return (
          <PedidoVacuna
            user={user}
            pedidos={pedidos}
            printerSettings={commonPrinterSettings}
            setView={setView}
            sucursales={branchOptions}
            productosCSV={config.productos || []}
          />
        );
      case "cocina":
        return (
          <Cocina
            user={user}
            pedidos={pedidos}
            personalCocina={config.personalCocina || []}
            personalTransporte={config.personalTransporte || []}
            printerSettings={commonPrinterSettings}
          />
        );
      case "estados":
        return (
          <EstadoPedidos
            user={user}
            pedidos={pedidos}
            personalTransporte={config.personalTransporte || []}
            printerSettings={commonPrinterSettings}
            setView={setView}
            setPedidoEditar={setPedidoEditar}
          />
        );
      case "historial":
        return <Historial user={user} pedidos={pedidos} printerSettings={commonPrinterSettings} />;
      case "configuracion":
        return <Configuracion config={config} setConfig={setConfig} />;
      default:
        return null;
    }
  };

  if (!user) {
    return (
      <div className="login-shell flex items-center px-4 py-6">
        <div className="mx-auto grid w-full max-w-6xl gap-5 lg:grid-cols-[1.05fr_0.95fr]">
          <section className="login-aside page-enter p-6 sm:p-8 lg:p-10">
            <div className="text-[10px] font-black uppercase tracking-[0.38em] text-[#9bdd3a]">
              Carnes San Martin
            </div>
            <h1 className="app-title mt-3 text-4xl font-black text-white sm:text-5xl">
              Pedidos Internos
            </h1>
            <div className="mt-3 text-sm font-semibold text-slate-300 sm:text-base">
              Granada y Nindiri
            </div>

            <div className="mt-7 grid gap-3 sm:grid-cols-3">
              <div className="rounded-[1.25rem] border border-white/12 bg-white/8 p-4">
                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-300">Pedido</div>
                <div className="mt-2 text-lg font-black text-white">Captura rapida</div>
              </div>
              <div className="rounded-[1.25rem] border border-white/12 bg-white/8 p-4">
                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-300">Costo</div>
                <div className="mt-2 text-lg font-black text-white">Contabilidad</div>
              </div>
              <div className="rounded-[1.25rem] border border-white/12 bg-white/8 p-4">
                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-300">PDF</div>
                <div className="mt-2 text-lg font-black text-white">Soporte</div>
              </div>
            </div>

            <div className="mt-7 grid gap-3">
              {[
                "Serie A - Granada",
                "Serie B - Nindiri",
                "Costo total reflejado en historial y requisa",
              ].map((item) => (
                <div
                  key={item}
                  className="rounded-[1.15rem] border border-white/10 bg-white/7 px-4 py-3 text-sm font-semibold text-slate-100"
                >
                  {item}
                </div>
              ))}
            </div>
          </section>

          <section className="login-panel page-enter p-6 sm:p-8">
            <div className="mx-auto max-w-md">
              <div className="mb-6 flex items-center gap-4">
                <div className="flex h-15 w-15 items-center justify-center rounded-[1.35rem] bg-[linear-gradient(135deg,#9bdd3a_0%,#4f8f00_100%)] text-[#08110a] shadow-[0_18px_38px_-22px_rgba(118,185,0,0.62)]">
                  {Icons.app}
                </div>
                <div>
                  <div className="app-title text-3xl font-black text-slate-950">Acceso</div>
                  <div className="mt-1 text-sm font-semibold text-slate-500">Sucursal</div>
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
                      placeholder="Granada o Nindiri"
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
                      placeholder="Clave"
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
                  <div className="rounded-[1rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
                    {error}
                  </div>
                ) : null}

                <button type="submit" className="app-button-primary w-full text-base">
                  Entrar
                </button>
              </form>

              <div className="mt-6 grid gap-2 sm:grid-cols-2">
                <div className="rounded-[1rem] border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600">
                  Granada / Serie A
                </div>
                <div className="rounded-[1rem] border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600">
                  Nindiri / Serie B
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="desktop-app-frame min-h-screen">
      <aside className="desktop-sidebar hidden xl:flex">
        <div className="desktop-brand-block">
          <div className="desktop-brand-mark">CSM</div>
          <div>
            <div className="desktop-brand-kicker">Carnes San Martin</div>
            <div className="desktop-brand-title">Pedidos</div>
          </div>
        </div>

        <div className="desktop-live-card">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="desktop-live-label">Operacion</div>
              <div className="desktop-live-value">{isOnline ? "En linea" : "Sin conexion"}</div>
            </div>
            <span className={`desktop-live-dot ${isOnline ? "is-online" : "is-offline"}`} />
          </div>
          <div className="desktop-live-branch">{getBranchDisplayName(user)}</div>
        </div>

        <nav className="desktop-rail-nav">
          <div className="desktop-rail-caption">Modulos</div>
          {NAV_ITEMS.map((item) => (
            <SidebarNavButton
              key={item.key}
              item={item}
              active={view === item.key}
              onClick={() => setView(item.key)}
            />
          ))}
        </nav>

        <div className="desktop-sidebar-summary">
          <div className="desktop-rail-caption">Actividad</div>
          <div className="desktop-metric-row"><span>Activos</span><strong>{operationalSummary.active}</strong></div>
          <div className="desktop-metric-row"><span>Preparacion</span><strong>{operationalSummary.preparation}</strong></div>
          <div className="desktop-metric-row"><span>En camino</span><strong>{operationalSummary.inTransit}</strong></div>
        </div>

        <div className="desktop-sidebar-footer">
          <span className="desktop-footer-icon">{isDesktop || isMobile ? Icons.bell : Icons.monitor}</span>
          <div>
            <div className="desktop-footer-title">{isDesktop || isMobile ? "Avisos activos" : "Modo web"}</div>
            <div className="desktop-footer-copy">
              {isDesktop ? "Segundo plano" : isMobile ? "Android" : "Navegador"}
            </div>
          </div>
        </div>
      </aside>

      <section className="desktop-content min-h-screen min-w-0">
        <header className="desktop-topbar">
          <div className="flex min-w-0 items-center gap-3">
            <div className="desktop-module-icon">{navMeta.icon}</div>
            <div className="min-w-0">
              <div className="desktop-topbar-kicker">Panel operativo</div>
              <h1 className="desktop-topbar-title">{navMeta.title}</h1>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <div className={`desktop-connection-pill hidden md:flex ${isOnline ? "is-online" : "is-offline"}`}>
              <span />
              {isOnline ? "Sincronizado" : "Sin conexion"}
            </div>
            <div className="app-chip hidden lg:inline-flex">{Icons.calendar}{fechaActual}</div>
            <div className="app-chip hidden sm:inline-flex">{Icons.user}{getBranchDisplayName(user)}</div>
            <button
              type="button"
              onClick={() => setView("configuracion")}
              className="app-icon-button desktop-topbar-action"
              aria-label="Configuracion"
              title="Configuracion"
            >
              {Icons.settings}
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="app-icon-button desktop-topbar-action"
              aria-label="Salir"
              title="Salir"
            >
              {Icons.logout}
            </button>
          </div>
        </header>

        <nav className="desktop-compact-nav hidden grid-cols-5 gap-2 px-4 pb-3 pt-3 lg:grid xl:hidden sm:px-6">
          {NAV_ITEMS.map((item) => (
            <DesktopNavButton
              key={item.key}
              item={item}
              active={view === item.key}
              onClick={() => setView(item.key)}
            />
          ))}
        </nav>

        <div className="app-shell">
          <main className="app-route-shell page-enter" key={view}>{renderCurrentView()}</main>
        </div>
      </section>

      <nav className="fixed inset-x-0 bottom-0 z-50 px-3 pb-[calc(12px+env(safe-area-inset-bottom))] pt-4 lg:hidden">
        <div className="mx-auto flex max-w-4xl gap-2 rounded-[24px] border border-slate-200 bg-white/94 p-2 shadow-[0_18px_42px_-24px_rgba(17,24,39,0.32)] backdrop-blur-xl">
          {NAV_ITEMS.map((item) => (
            <MobileNavButton
              key={item.key}
              item={item}
              active={view === item.key}
              onClick={() => setView(item.key)}
            />
          ))}
        </div>
      </nav>
    </div>
  );
}
