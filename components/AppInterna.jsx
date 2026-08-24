"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { db } from "../firebase";
import { onValue, ref } from "firebase/database";
import {
  getBranchDisplayName,
  getSelectableBranches,
  isSameBranch,
} from "@/lib/branchUtils";
import { companyCanUseModule } from "@/lib/companyProfiles";
import { loginOperations, logoutOperations, observeOperationsSession } from "@/lib/operationsAuth";
import { setSicarApiCompanyContext } from "@/lib/sicarPurchaseApi";
import { setProviderCatalogScope } from "@/lib/providerCatalogStore";
import { setProviderDraftScope } from "@/lib/providerDraftStore";
import {
  getPedidoCreationTimestamp,
  getPedidoItems,
  normalizePedidoForUi,
} from "@/lib/orderUtils";
import {
  deactivateMobileNotifications,
  initializeMobileNotifications,
  isNativeAndroidApp,
  showMobileOperationalNotification,
  stopMobileNotificationListeners,
} from "@/lib/mobileNotifications";
import { IS_HANDHELD } from "@/lib/deviceProfile";
import Cocina from "./Cocina";
import Configuracion from "./Configuracion";
import EstadoPedidos from "./EstadoPedidos";
import ErpModulePanel from "./ErpModulePanel";
import Formulario from "./Formulario";
import Historial from "./Historial";
import InventarioSucursal from "./InventarioSucursal";
import PedidoVacuna from "./PedidoVacuna";
import ProveedoresExternos from "./ProveedoresExternos";

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
  internal: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 7h11v8H3z" />
      <path d="M14 10h4l3 3v2h-7z" />
      <path d="m8 4 2-2 2 2M10 2v5" />
      <circle cx="7.5" cy="18" r="2" />
      <circle cx="17.5" cy="18" r="2" />
    </svg>
  ),
  external: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 21h18M5 21V7l7-4 7 4v14" />
      <path d="M9 9h2v2H9zM14 9h2v2h-2zM9 14h2v2H9zM14 14h2v2h-2z" />
    </svg>
  ),
  panel: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  ),
  inventory: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 5h16v15H4z" />
      <path d="M8 2h8v6H8zM8 12h8M8 16h5" />
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

const BUSINESS_MODULES = [
  { key: "panel", label: "Panel general", shortLabel: "Panel", icon: Icons.panel, accent: "#9ddd37" },
  { key: "internos", label: "Traspasos internos", shortLabel: "Internos", icon: Icons.internal, accent: "#16a36a" },
  { key: "proveedores", label: "Proveedores externos", shortLabel: "Proveedores", icon: Icons.external, accent: "#0ea5e9" },
  { key: "inventario", label: "Inventario fisico", shortLabel: "Inventario", icon: Icons.inventory, accent: "#84cc16" },
];

const INITIAL_CONFIG = {
  personalCocina: ["Marcos Ramirez", "Miguel Bustamante", "David", "Roberto Marin"],
  personalTransporte: ["Noel Hernandez", "Noel Bendana", "Vladimir", "David", "Nelson", "Julio Amador", "Carlos Mora"],
  impresion: {
    impresoraPredeterminada: "",
    impresionAutomaticaEnvio: true,
    formato: "letter",
  },
};

const FINAL_ORDER_STATUSES = new Set(["RECIBIDO_CONFORME", "ENTREGADO", "ANULADO"]);
const PREPARATION_STATUSES = new Set(["NUEVO", "STANDBY_ENTREGA", "PREPARACION", "LISTO"]);
const STATUS_NOTIFICATIONS = {
  NUEVO: { title: "NUEVO PEDIDO SOLICITADO", action: "Preparar", view: "cocina", target: "sender" },
  STANDBY_ENTREGA: { title: "NUEVO PEDIDO SOLICITADO", action: "Preparar", view: "cocina", target: "sender" },
  ENVIADO: { title: "PRODUCTO EN CAMINO", action: "Recibir", view: "estados", target: "receiver" },
};
const ALERT_FRESHNESS_MS = 72 * 60 * 60 * 1000;
const ALERT_STORAGE_PREFIX = "csmOperationalAlertsSeenV2";

function getPedidoIdentity(pedido) {
  return `${pedido?.firebaseId || pedido?.id || pedido?.numeroOrden || ""}`;
}

function buildOperationalAlert(pedido, user) {
  const status = `${pedido?.estado || ""}`;
  const config = STATUS_NOTIFICATIONS[status];
  if (!config) return null;

  const sender = pedido?.sucursalDestino;
  const receiver = pedido?.sucursalOrigen;
  const targetBranch = config.target === "sender" ? sender : receiver;
  if (!isSameBranch(targetBranch, user)) return null;

  const items = getPedidoItems(pedido);
  const productNames = items
    .map((item) => `${item?.producto || item?.descripcion || item?.nombre || ""}`.trim())
    .filter(Boolean);
  const visibleProducts = productNames.slice(0, 3).join(", ");
  const remainingProducts = Math.max(0, productNames.length - 3);
  const productSummary = `${visibleProducts}${remainingProducts > 0 ? ` y ${remainingProducts} mas` : ""}` || "Ver detalle del pedido";
  const orderId = getPedidoIdentity(pedido);
  const orderNumber = `${pedido?.numeroOrden || pedido?.id || "Pedido"}`;
  const senderLabel = getBranchDisplayName(sender) || "Origen";
  const receiverLabel = getBranchDisplayName(receiver) || "Destino";

  return {
    key: `${orderId}:${status}`,
    orderId,
    orderNumber,
    status,
    title: config.title,
    action: config.action,
    view: config.view,
    sender: senderLabel,
    receiver: receiverLabel,
    itemCount: items.length,
    productSummary,
    body: `${config.action} ${orderNumber} | ${senderLabel} -> ${receiverLabel}`,
  };
}

function getStoredAlertKeys(user) {
  if (typeof window === "undefined") return new Set();

  try {
    const stored = JSON.parse(window.localStorage.getItem(`${ALERT_STORAGE_PREFIX}:${user}`) || "[]");
    return new Set(Array.isArray(stored) ? stored : []);
  } catch {
    return new Set();
  }
}

function storeAlertKeys(user, keys) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(`${ALERT_STORAGE_PREFIX}:${user}`, JSON.stringify(Array.from(keys).slice(-200)));
}

function markAlertReviewed(user, alertKey) {
  if (!user || !alertKey) return;
  const seenKeys = getStoredAlertKeys(user);
  seenKeys.add(alertKey);
  storeAlertKeys(user, seenKeys);
}

function playDesktopAlertSound(status) {
  if (typeof window === "undefined" || !window.desktopAPI) return;

  const soundFile = status === "ENVIADO"
    ? "/sounds/producto-en-camino.wav"
    : "/sounds/pedido-nuevo.wav";
  const audio = new Audio(soundFile);
  audio.volume = 0.95;
  audio.play().catch((soundError) => {
    console.error("No se pudo reproducir el sonido del aviso:", soundError);
  });
}

function isRecentOperationalAlert(pedido) {
  const timestamp = Number(pedido?.timestamp || 0) || getPedidoCreationTimestamp(pedido);
  return timestamp > 0 && Date.now() - timestamp <= ALERT_FRESHNESS_MS;
}

function collectPedidoAlerts(pedidos, previousStatusesRef, user) {
  const currentStatuses = Object.fromEntries(
    pedidos.map((pedido) => [getPedidoIdentity(pedido), `${pedido?.estado || ""}`]),
  );
  const previousStatuses = previousStatusesRef.current;
  const seenKeys = getStoredAlertKeys(user);
  const alerts = [];

  pedidos.forEach((pedido) => {
    const alert = buildOperationalAlert(pedido, user);
    if (!alert || seenKeys.has(alert.key)) return;

    const previousStatus = previousStatuses?.[alert.orderId];
    const statusChanged = previousStatuses
      ? previousStatus !== alert.status
      : isRecentOperationalAlert(pedido);
    if (!statusChanged) return;

    alerts.push(alert);
    if (window.desktopAPI?.notify) {
      window.desktopAPI.notify(alert);
      playDesktopAlertSound(alert.status);
    }
  });

  previousStatusesRef.current = currentStatuses;
  return alerts;
}

function alertFromNavigation(data = {}) {
  if (!data?.title || !data?.view) return null;

  const orderId = `${data.orderId || data.orderNumber || "notification"}`;
  const status = `${data.status || ""}`;
  return {
    key: `${orderId}:${status || data.title}`,
    orderId,
    orderNumber: `${data.orderNumber || "Pedido"}`,
    status,
    title: `${data.title}`,
    action: status === "ENVIADO" ? "Recibir" : "Preparar",
    view: `${data.view}`,
    sender: `${data.sender || "Origen"}`,
    receiver: `${data.receiver || "Destino"}`,
    itemCount: Number(data.itemCount || 0),
    productSummary: `${data.productSummary || "Ver detalle del pedido"}`,
    body: `${data.body || "Hay una novedad en pedidos internos."}`,
  };
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
      <span>{item.shortLabel || item.label}</span>
      <span className="desktop-rail-indicator" />
    </button>
  );
}

function MobileNavButton({ item, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mobile-nav-button flex min-h-[64px] flex-1 flex-col items-center justify-center gap-1 rounded-[18px] border px-2 text-[11px] font-black transition-all sm:text-xs"
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

function AppBootSkeleton() {
  return (
    <div className="native-boot-shell" aria-label="Cargando CSM Operaciones" aria-busy="true">
      <div className="native-boot-card">
        <div className="flex items-center gap-3">
          <span className="app-skeleton h-12 w-12 rounded-2xl" />
          <div className="min-w-0 flex-1 space-y-2">
            <span className="app-skeleton block h-3 w-28 rounded-full" />
            <span className="app-skeleton block h-6 w-48 max-w-full rounded-lg" />
          </div>
        </div>
        <div className="mt-7 space-y-3">
          <span className="app-skeleton block h-14 rounded-2xl" />
          <span className="app-skeleton block h-14 rounded-2xl" />
          <span className="app-skeleton block h-14 rounded-2xl" />
        </div>
      </div>
    </div>
  );
}

export default function AppInterna() {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const user = session?.company?.legacyBranchId || null;
  const companyContext = session?.company || null;
  const [view, setView] = useState(() => {
    if (typeof window === "undefined") return "formulario";
    const savedView = window.localStorage.getItem("csmInternalView");
    return NAV_ITEMS.some((item) => item.key === savedView) ? savedView : "formulario";
  });
  const [businessModule, setBusinessModule] = useState(() => {
    if (typeof window === "undefined") return "panel";
    const savedModule = window.localStorage.getItem("csmBusinessModule");
    return BUSINESS_MODULES.some((item) => item.key === savedModule) ? savedModule : "panel";
  });
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
  const [operationalAlerts, setOperationalAlerts] = useState([]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const previousOrderStatusesRef = useRef(null);

  useEffect(() => {
    return observeOperationsSession(({ session: nextSession, error: sessionError }) => {
      setSession(nextSession);
      setAuthLoading(false);
      if (sessionError) setError(sessionError.message || "No fue posible validar tu empresa.");
    });
  }, []);

  useEffect(() => {
    setSicarApiCompanyContext(companyContext);
    setProviderCatalogScope(companyContext?.identificador);
    setProviderDraftScope(companyContext?.identificador);
    if (!companyContext) return;
    if (businessModule !== "panel" && !companyCanUseModule(companyContext, businessModule)) setBusinessModule("panel");
  }, [businessModule, companyContext]);

  useEffect(() => {
    const desktopMode = Boolean(window.desktopAPI?.isDesktop);
    const mobileMode = isNativeAndroidApp();
    queueMicrotask(() => {
      setIsDesktop(desktopMode);
      setIsMobile(mobileMode);
    });
    document.documentElement.classList.toggle("desktop-runtime", desktopMode);
    document.documentElement.classList.toggle("android-runtime", mobileMode);
    document.documentElement.classList.toggle("handheld-runtime", IS_HANDHELD);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    const disposeNavigation = window.desktopAPI?.onNavigate?.((destination) => {
      const nextView = typeof destination === "string" ? destination : destination?.view;
      if (NAV_ITEMS.some((item) => item.key === nextView) || nextView === "configuracion") {
        setBusinessModule("internos");
        setView(nextView);
      }

      const alert = typeof destination === "object" ? alertFromNavigation(destination) : null;
      if (alert) {
        setOperationalAlerts((current) =>
          current.some((item) => item.key === alert.key) ? current : [alert, ...current],
        );
      }
    });

    return () => {
      document.documentElement.classList.remove("desktop-runtime");
      document.documentElement.classList.remove("android-runtime");
      document.documentElement.classList.remove("handheld-runtime");
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      if (typeof disposeNavigation === "function") disposeNavigation();
    };
  }, []);

  useEffect(() => {
    if (!user || !companyContext?.internalTransfers || !isNativeAndroidApp()) return undefined;

    let disposed = false;
    let cleanup = stopMobileNotificationListeners;
    initializeMobileNotifications(user, (nextView, notificationData) => {
      if (NAV_ITEMS.some((item) => item.key === nextView) || nextView === "configuracion") {
        setBusinessModule("internos");
        setView(nextView);
      }

      const alert = alertFromNavigation(notificationData);
      if (alert) {
        setOperationalAlerts((current) =>
          current.some((item) => item.key === alert.key) ? current : [alert, ...current],
        );
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
  }, [companyContext?.internalTransfers, user]);

  useEffect(() => {
    localStorage.setItem("appConfig", JSON.stringify(config));
  }, [config]);

  useEffect(() => {
    localStorage.setItem("csmBusinessModule", businessModule);
  }, [businessModule]);

  useEffect(() => {
    if (NAV_ITEMS.some((item) => item.key === view)) localStorage.setItem("csmInternalView", view);
  }, [view]);

  useEffect(() => {
    if (!companyContext?.internalTransfers) return undefined;
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
  }, [companyContext?.internalTransfers]);

  useEffect(() => {
    if (!user || !companyContext?.internalTransfers) return;

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
      const newAlerts = collectPedidoAlerts(pedidosOrdenados, previousOrderStatusesRef, user);
      if (newAlerts.length > 0) {
        setOperationalAlerts((current) => {
          const currentKeys = new Set(current.map((alert) => alert.key));
          return [...current, ...newAlerts.filter((alert) => !currentKeys.has(alert.key))];
        });
        showMobileOperationalNotification(newAlerts[0]).catch((notificationError) => {
          console.error("No se pudo mostrar el aviso sonoro Android:", notificationError);
        });
      }
      setPedidos(pedidosOrdenados);
    });

    return () => unsubscribe();
  }, [companyContext?.internalTransfers, user]);

  const handleLogin = async (event) => {
    event.preventDefault();
    setAuthLoading(true);
    setError("");
    try {
      const nextSession = await loginOperations(username, password);
      setSession(nextSession);
      previousOrderStatusesRef.current = null;
      setOperationalAlerts([]);
      setPassword("");
      setPedidoEditar(null);
      setBusinessModule("panel");
      setView("formulario");
    } catch (loginError) {
      const code = `${loginError?.code || ""}`;
      setError(code.includes("invalid-credential") ? "Usuario o contrasena incorrectos." : loginError.message || "No fue posible iniciar sesion.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    deactivateMobileNotifications().catch((notificationError) => {
      console.error("No se pudo desactivar este telefono:", notificationError);
    });
    await logoutOperations().catch(() => undefined);
    previousOrderStatusesRef.current = null;
    setOperationalAlerts([]);
    setSession(null);
    setPassword("");
    setPedidoEditar(null);
    setBusinessModule("panel");
    setView("formulario");
  };

  const navMeta = useMemo(() => {
    if (businessModule === "panel") {
      return { title: "Panel general", icon: Icons.panel };
    }
    if (businessModule === "proveedores") {
      return { title: "Recibir de proveedor", icon: Icons.external };
    }
    if (businessModule === "inventario") {
      return { title: "Inventario fisico", icon: Icons.inventory };
    }

    return NAV_ITEMS.find((item) => item.key === view) || {
      title: "Configuracion",
      icon: Icons.settings,
    };
  }, [businessModule, view]);

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

  const availableBusinessModules = useMemo(
    () => BUSINESS_MODULES.filter((item) => item.key === "panel" || companyCanUseModule(companyContext, item.key)),
    [companyContext],
  );

  const activeOperationalAlert = operationalAlerts[0] || null;
  const closeOperationalAlert = () => {
    markAlertReviewed(user, activeOperationalAlert?.key);
    setOperationalAlerts((current) => current.slice(1));
  };
  const openOperationalAlert = () => {
    if (!activeOperationalAlert) return;
    markAlertReviewed(user, activeOperationalAlert.key);
    setBusinessModule("internos");
    setView(activeOperationalAlert.view);
    setOperationalAlerts((current) => current.slice(1));
  };

  const renderCurrentView = () => {
    if (businessModule === "panel") {
      return (
        <ErpModulePanel
          user={user}
          companyContext={companyContext}
          isOnline={isOnline}
          summary={operationalSummary}
          onOpen={setBusinessModule}
        />
      );
    }
    if (!companyCanUseModule(companyContext, businessModule)) {
      return null;
    }
    if (businessModule === "proveedores") {
      return <ProveedoresExternos user={companyContext?.empresa || user} companyContext={companyContext} />;
    }
    if (businessModule === "inventario") {
      return <InventarioSucursal user={user} companyContext={companyContext} />;
    }

    const commonPrinterSettings = config.impresion || INITIAL_CONFIG.impresion;
    const branchOptions = getSelectableBranches(user);

    switch (view) {
      case "formulario":
        return (
          <Formulario
            user={user}
            pedidos={pedidos}
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
        return <Historial user={user} pedidos={pedidos} />;
      case "configuracion":
        return <Configuracion config={config} setConfig={setConfig} />;
      default:
        return null;
    }
  };

  if (authLoading && !user) {
    return <AppBootSkeleton />;
  }

  if (!user) {
    return (
      <div className={`login-shell native-login flex items-center px-4 py-6 ${IS_HANDHELD ? "handheld-app" : ""}`}>
        <div className="mx-auto grid w-full max-w-6xl gap-5 lg:grid-cols-[1.05fr_0.95fr]">
          <section className="login-aside page-enter p-6 sm:p-8 lg:p-10">
            <div className="text-[10px] font-black uppercase tracking-[0.38em] text-[#9bdd3a]">
              Carnes San Martin
            </div>
            <h1 className="app-title mt-3 text-4xl font-black text-white sm:text-5xl">
              {IS_HANDHELD ? "CSM Hand Held" : "CSM Operaciones"}
            </h1>
            <div className="mt-3 text-sm font-semibold text-slate-300 sm:text-base">
              Traspasos, proveedores e inventario
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
                "Carnes San Martin Granada",
                "Carnes San Martin Nindiri",
                "Carnes Amparito",
                "Carnes San Martin Masaya",
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
                <div className="native-login-logo flex h-15 w-15 items-center justify-center rounded-[1.35rem] bg-white text-[#08110a] shadow-[0_18px_38px_-22px_rgba(118,185,0,0.62)]">
                  <Image src="/csm-logo.svg" alt="Carnes San Martin" width={56} height={56} priority />
                </div>
                <div>
                  <div className="app-title text-3xl font-black text-slate-950">Acceso</div>
                  <div className="mt-1 text-sm font-semibold text-slate-500">Cuenta de empresa</div>
                </div>
              </div>

              <form className="space-y-5" onSubmit={handleLogin}>
                <div>
                  <label className="app-label">Usuario</label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                      {Icons.user}
                    </span>
                    <input
                      type="text"
                      value={username}
                      onChange={(event) => setUsername(event.target.value)}
                      placeholder="Usuario o correo"
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

                <button type="submit" className="app-button-primary w-full text-base" disabled={authLoading}>
                  {authLoading ? "Validando..." : "Entrar"}
                </button>
              </form>

              <div className="mt-6 grid gap-2 sm:grid-cols-2">
                <div className="rounded-[1rem] border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600">
                  Granada y Nindiri
                </div>
                <div className="rounded-[1rem] border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600">
                  Amparito y Masaya
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className={`desktop-app-frame native-app-frame min-h-screen ${IS_HANDHELD ? "handheld-app" : ""}`}>
      <aside className="desktop-sidebar hidden xl:flex">
        <div className="desktop-brand-block">
          <div className="desktop-brand-mark">CSM</div>
          <div>
            <div className="desktop-brand-kicker">Carnes San Martin</div>
            <div className="desktop-brand-title">Operaciones</div>
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
          <div className="desktop-live-branch">{companyContext?.empresa || getBranchDisplayName(user)}</div>
        </div>

        <div className="desktop-business-switch">
          <div className="desktop-rail-caption">Modulos ERP</div>
          {availableBusinessModules.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setBusinessModule(item.key)}
              className={`desktop-business-button ${businessModule === item.key ? "is-active" : ""}`}
              style={{ "--module-accent": item.accent }}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </div>

        {businessModule === "internos" ? (
          <nav className="desktop-rail-nav">
            <div className="desktop-rail-caption">Traspasos internos</div>
            {NAV_ITEMS.map((item) => (
              <SidebarNavButton
                key={item.key}
                item={item}
                active={view === item.key}
                onClick={() => setView(item.key)}
              />
            ))}
          </nav>
        ) : businessModule === "proveedores" ? (
          <div className="desktop-external-note">
            <span>{Icons.external}</span>
            <div>
              <strong>Recepcion SICAR</strong>
              <small>Inventario y costo de compra</small>
            </div>
          </div>
        ) : businessModule === "inventario" ? (
          <div className="desktop-external-note">
            <span>{Icons.inventory}</span>
            <div>
              <strong>Levantamiento fisico</strong>
              <small>Conteo y ajuste controlado</small>
            </div>
          </div>
        ) : (
          <div className="desktop-external-note">
            <span>{Icons.panel}</span>
            <div>
              <strong>Panel general</strong>
              <small>Selecciona un modulo</small>
            </div>
          </div>
        )}

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

      <section className="desktop-content native-content min-h-screen min-w-0">
        <header className="desktop-topbar native-topbar">
          <div className="flex min-w-0 items-center gap-3">
            <div className="desktop-module-icon native-module-icon">
              <span className="hidden sm:block">{navMeta.icon}</span>
              <Image className="sm:hidden" src="/csm-logo.svg" alt="" width={40} height={40} />
            </div>
            <div className="min-w-0">
              <div className="desktop-topbar-kicker">{IS_HANDHELD ? "Hand Held" : "Panel operativo"}</div>
              <h1 className="desktop-topbar-title">{navMeta.title}</h1>
              <div className="native-mobile-branch sm:hidden">{companyContext?.branchAlias || getBranchDisplayName(user)}</div>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <div className={`desktop-connection-pill native-connection-pill ${isOnline ? "is-online" : "is-offline"}`}>
              <span />
              <b className="hidden md:inline">{isOnline ? "Sincronizado" : "Sin conexion"}</b>
            </div>
            <div className="app-chip hidden lg:inline-flex">{Icons.calendar}{fechaActual}</div>
            <div className="app-chip hidden sm:inline-flex">{Icons.user}{companyContext?.empresa || getBranchDisplayName(user)}</div>
            <button
              type="button"
              onClick={() => {
                setBusinessModule("internos");
                setView("configuracion");
              }}
              className="app-icon-button desktop-topbar-action hidden lg:inline-flex"
              aria-label="Configuracion"
              title="Configuracion"
            >
              {Icons.settings}
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="app-icon-button desktop-topbar-action hidden lg:inline-flex"
              aria-label="Salir"
              title="Salir"
            >
              {Icons.logout}
            </button>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="app-icon-button desktop-topbar-action lg:hidden"
              aria-label="Abrir cuenta y opciones"
            >
              {Icons.user}
            </button>
          </div>
        </header>

        <div className="native-module-strip hidden px-4 pt-3 md:block sm:px-6 xl:hidden">
          <div className="mobile-business-switch flex gap-2 overflow-x-auto rounded-[1.15rem] border border-slate-200 bg-white/90 p-1.5 shadow-sm backdrop-blur-xl">
            {availableBusinessModules.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setBusinessModule(item.key)}
                className={`flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-xl px-4 text-sm font-black transition ${
                  businessModule === item.key ? "bg-slate-950 text-white shadow-lg" : "text-slate-500"
                }`}
              >
                <span style={{ color: businessModule === item.key ? "#67e8f9" : item.accent }}>{item.icon}</span>
                <span>{item.shortLabel}</span>
              </button>
            ))}
          </div>
        </div>

        {businessModule === "internos" ? (
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
        ) : null}

        <div className="app-shell">
          <main className="app-route-shell page-enter">{renderCurrentView()}</main>
        </div>
      </section>

      <nav className="mobile-bottom-nav native-bottom-nav fixed inset-x-0 bottom-0 z-50 px-2 pb-[calc(8px+env(safe-area-inset-bottom))] pt-3 lg:hidden" aria-label={businessModule === "internos" ? "Traspasos internos" : "Modulos"}>
          <div className="mx-auto flex max-w-4xl gap-1 rounded-[22px] border border-slate-200 bg-white/94 p-1.5 shadow-[0_18px_42px_-24px_rgba(17,24,39,0.32)] backdrop-blur-xl">
            {(businessModule === "internos" ? NAV_ITEMS : availableBusinessModules).map((item) => (
              <MobileNavButton
                key={item.key}
                item={item}
                active={businessModule === "internos" ? view === item.key : businessModule === item.key}
                onClick={() => {
                  if (businessModule === "internos") setView(item.key);
                  else setBusinessModule(item.key);
                }}
              />
            ))}
          </div>
        </nav>

      {mobileMenuOpen ? (
        <div className="app-modal native-account-modal z-[100]" role="dialog" aria-modal="true" aria-labelledby="mobile-account-title" onClick={() => setMobileMenuOpen(false)}>
          <div className="app-modal-panel native-account-sheet w-full max-w-lg p-0" onClick={(event) => event.stopPropagation()}>
            <div className="native-account-header">
              <div className="native-account-logo"><Image src="/csm-logo.svg" alt="" width={52} height={52} /></div>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-700">Cuenta activa</div>
                <h2 id="mobile-account-title" className="truncate text-lg font-black text-slate-950">{companyContext?.empresa || getBranchDisplayName(user)}</h2>
                <div className={`mt-1 flex items-center gap-2 text-xs font-bold ${isOnline ? "text-emerald-700" : "text-rose-600"}`}><span className={`h-2 w-2 rounded-full ${isOnline ? "bg-emerald-500" : "bg-rose-500"}`} />{isOnline ? "En linea" : "Sin conexion"}</div>
              </div>
            </div>
            <div className="grid gap-2 p-4 pb-[calc(16px+env(safe-area-inset-bottom))]">
              <button type="button" className="native-sheet-action" onClick={() => { setBusinessModule("panel"); setMobileMenuOpen(false); }}><span>{Icons.panel}</span><b>Ir al inicio</b></button>
              {companyContext?.internalTransfers ? <button type="button" className="native-sheet-action" onClick={() => { setBusinessModule("internos"); setView("configuracion"); setMobileMenuOpen(false); }}><span>{Icons.settings}</span><b>Configuracion</b></button> : null}
              <button type="button" className="native-sheet-action is-danger" onClick={() => { setMobileMenuOpen(false); handleLogout(); }}><span>{Icons.logout}</span><b>Cerrar sesion</b></button>
              <button type="button" className="app-button-secondary mt-1" onClick={() => setMobileMenuOpen(false)}>Cerrar</button>
            </div>
          </div>
        </div>
      ) : null}

      {activeOperationalAlert ? (
        <div className="app-modal z-[90] px-4" role="dialog" aria-modal="true" aria-labelledby="operational-alert-title">
          <div className="app-modal-panel w-full max-w-[520px] overflow-hidden p-0">
            <div
              className={`h-2 w-full ${activeOperationalAlert.status === "ENVIADO" ? "bg-emerald-500" : "bg-amber-400"}`}
            />
            <div className="p-5 sm:p-6">
              <div className="flex items-start gap-4">
                <div
                  className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${
                    activeOperationalAlert.status === "ENVIADO"
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-amber-100 text-amber-700"
                  }`}
                >
                  {activeOperationalAlert.status === "ENVIADO" ? Icons.truck : Icons.clipboard}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                    Aviso operativo
                  </div>
                  <h2 id="operational-alert-title" className="mt-1 text-xl font-black text-slate-900 sm:text-2xl">
                    {activeOperationalAlert.title}
                  </h2>
                  <div className="mt-2 inline-flex rounded-full bg-slate-900 px-3 py-1 text-sm font-black text-white">
                    {activeOperationalAlert.orderNumber}
                  </div>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Origen</div>
                  <div className="mt-1 font-extrabold text-slate-700">{activeOperationalAlert.sender}</div>
                </div>
                <div className="text-xl font-black text-slate-300">{"->"}</div>
                <div className="text-right">
                  <div className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Destino</div>
                  <div className="mt-1 font-extrabold text-slate-700">{activeOperationalAlert.receiver}</div>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-slate-200 px-4 py-3">
                <div className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                  {activeOperationalAlert.itemCount || 0} productos
                </div>
                <p className="mt-1 text-sm font-semibold leading-6 text-slate-600">
                  {activeOperationalAlert.productSummary}
                </p>
              </div>

              <div className="mt-6 grid grid-cols-[auto_1fr] gap-3">
                <button type="button" onClick={closeOperationalAlert} className="app-button app-button-secondary px-5">
                  Cerrar
                </button>
                <button type="button" onClick={openOperationalAlert} className="app-button app-button-primary">
                  Ver pedido
                </button>
              </div>

              {operationalAlerts.length > 1 ? (
                <div className="mt-3 text-center text-xs font-bold text-slate-400">
                  Quedan {operationalAlerts.length - 1} avisos por revisar
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
