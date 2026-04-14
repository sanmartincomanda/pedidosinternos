"use client";

import React, { useEffect, useRef, useState } from "react";
import { db } from "../firebase";
import { off, onValue, push, ref, runTransaction } from "firebase/database";
import {
  buildOrderNumber,
  getHighestBranchSequence,
  getLocalDateString,
  getUserCounterKey,
  getUserOrderPrefix,
  MAX_ORDER_NUMBER,
} from "@/lib/orderUtils";

const Icons = {
  plus: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
      <path d="M12 5v14M5 12h14" />
    </svg>
  ),
  trash: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 6h18M8 6V4h8v2M19 6l-1 13a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  ),
  calendar: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M8 2v4M16 2v4M3 10h18" />
    </svg>
  ),
  note: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z" />
      <path d="M14 3v6h6M8 13h8M8 17h5" />
    </svg>
  ),
  send: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="m22 2-7 20-4-9-9-4 20-7Z" />
      <path d="M22 2 11 13" />
    </svg>
  ),
  package: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="m3 7 9-4 9 4-9 4-9-4ZM3 7v10l9 4 9-4V7M12 11v10" />
    </svg>
  ),
  alert: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 9v4M12 17h.01" />
      <path d="m10.3 3.9-8 13.9A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3.2l-8-13.9a2 2 0 0 0-3.4 0Z" />
    </svg>
  ),
  search: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  ),
  key: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 2 10.5 12.5M18.5 4.5 20 6l2-2-1.5-1.5" />
      <circle cx="7.5" cy="15.5" r="5.5" />
    </svg>
  ),
  sync: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 2v6h-6M3 22v-6h6" />
      <path d="M20 8A8 8 0 0 0 6.3 5.3L3 8M4 16a8 8 0 0 0 13.7 2.7L21 16" />
    </svg>
  ),
};

const UNIDADES = [
  { value: "lb", label: "lb" },
  { value: "cajas", label: "Cajas" },
  { value: "paquetes_vp", label: "Paquetes VP" },
  { value: "unidades", label: "Unidades" },
  { value: "kg", label: "Kg" },
  { value: "sacos", label: "Sacos" },
];

const PRODUCTOS_EJEMPLO = [
  { clave: "BIS-001", nombre: "BISTEC DE RES" },
  { clave: "BIS-002", nombre: "BISTEC DE CERDO" },
  { clave: "POL-001", nombre: "POLLO ENTERO" },
  { clave: "POL-002", nombre: "PECHUGA DE POLLO" },
  { clave: "CAR-001", nombre: "CARNE MOLIDA" },
  { clave: "CER-001", nombre: "COSTILLA DE CERDO" },
  { clave: "RES-001", nombre: "CHULETA DE RES" },
  { clave: "EMB-001", nombre: "JAMON EMBUTIDO" },
  { clave: "EMB-002", nombre: "SALCHICHAS" },
  { clave: "MAR-001", nombre: "CAMARON" },
];

function normalizeCatalogSearch(value = "") {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim();
}

const createEmptyItem = () => ({
  clave: "",
  producto: "",
  cantidad: "",
  unidad: "lb",
  nota: "",
  mostrarNota: false,
  mostrarDropdown: false,
});

function FieldLabel({ icon, label, badge }) {
  return (
    <label className="app-label flex items-center gap-2">
      <span className="text-slate-400">{icon}</span>
      <span>{label}</span>
      {badge ? (
        <span className="rounded-full bg-amber-400/15 px-2 py-1 text-[10px] font-black tracking-[0.14em] text-amber-200">
          {badge}
        </span>
      ) : null}
    </label>
  );
}

function SummaryCard({ label, value, helper, accent }) {
  return (
    <div
      className="app-card-soft p-4"
      style={{
        borderColor: `${accent}35`,
        background: `linear-gradient(135deg, ${accent}14 0%, rgba(8,24,46,0.72) 100%)`,
      }}
    >
      <div className="text-xs font-extrabold uppercase tracking-[0.18em] text-slate-300">{label}</div>
      <div className="mt-2 text-xl font-black text-white">{value}</div>
      {helper ? <div className="mt-1 text-sm text-slate-300/80">{helper}</div> : null}
    </div>
  );
}

export default function Formulario({ user, setView, sucursales = [], productosCSV = [], pedidos = [] }) {
  const MAX_LINEAS = 25;
  const catalogoProductos = productosCSV.length > 0 ? productosCSV : PRODUCTOS_EJEMPLO;
  const hoy = getLocalDateString();
  const userPrefix = getUserOrderPrefix(user);
  const userCounterKey = getUserCounterKey(user);

  const [items, setItems] = useState([createEmptyItem()]);
  const [destino, setDestino] = useState(sucursales[0] || "Cedi");
  const [notaGeneral, setNotaGeneral] = useState("");
  const [cargando, setCargando] = useState(false);
  const [counterValue, setCounterValue] = useState(0);
  const [cargandoId, setCargandoId] = useState(true);
  const [fechaPedido] = useState(hoy);
  const [fechaEntrega, setFechaEntrega] = useState(hoy);
  const [showGeneralNote, setShowGeneralNote] = useState(false);

  const productInputRefs = useRef([]);
  const quantityInputRefs = useRef([]);
  const noteInputRefs = useRef([]);
  const unitButtonRefs = useRef({});
  const dropdownRefs = useRef({});

  const esStandby = fechaEntrega > hoy;
  const lineasUsadas = items.filter((item) => item.producto.trim() !== "").length;
  const lineasListas = items.filter(
    (item) => item.producto.trim() !== "" && String(item.cantidad).trim() !== "",
  ).length;
  const highestBranchSequence = getHighestBranchSequence(pedidos, user);
  const nextOrderSequence = Math.min(MAX_ORDER_NUMBER, Math.max(counterValue, highestBranchSequence) + 1);
  const orderPreview = cargandoId ? "..." : buildOrderNumber(userPrefix, nextOrderSequence);

  useEffect(() => {
    if (!sucursales.includes(destino)) {
      setDestino(sucursales[0] || "Cedi");
    }
  }, [destino, sucursales]);

  useEffect(() => {
    const contadorRef = ref(db, `configuracion/contadores_pedidos_por_sucursal/${userCounterKey}`);

    const unsubscribe = onValue(
      contadorRef,
      (snapshot) => {
        const valor = Number(snapshot.val() || 0);
        setCounterValue(valor >= MAX_ORDER_NUMBER ? MAX_ORDER_NUMBER : valor);
        setCargandoId(false);
      },
      (error) => {
        console.error("Error cargando contador:", error);
        setCargandoId(false);
      },
    );

    return () => {
      if (typeof unsubscribe === "function") {
        unsubscribe();
      } else {
        off(contadorRef);
      }
    };
  }, [userCounterKey]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      const clickedInside = Object.values(dropdownRefs.current).some(
        (node) => node && node.contains(event.target),
      );

      if (clickedInside) return;

      setItems((prev) =>
        prev.map((item) => ({
          ...item,
          mostrarDropdown: false,
        })),
      );
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const obtenerSiguienteId = async () => {
    const contadorRef = ref(db, `configuracion/contadores_pedidos_por_sucursal/${userCounterKey}`);
    const resultado = await runTransaction(contadorRef, (valorActual) => {
      const actual = Number(valorActual || 0);
      const base = Math.max(actual, highestBranchSequence);

      if (base >= MAX_ORDER_NUMBER) {
        return;
      }

      return base + 1;
    });

    if (!resultado.committed) {
      throw new Error("No se pudo generar un nuevo numero de orden para esta sucursal.");
    }

    return resultado.snapshot.val();
  };

  const focusElement = (element, options = {}) => {
    if (!element) return;

    element.focus();
    if (options.select && typeof element.select === "function") {
      element.select();
    }

    setTimeout(() => {
      if (typeof element.scrollIntoView === "function") {
        element.scrollIntoView({
          behavior: "smooth",
          block: "center",
          inline: "nearest",
        });
      }
    }, 30);
  };

  const abrirDropdown = (idx) => {
    setItems((prev) =>
      prev.map((item, itemIndex) => ({
        ...item,
        mostrarDropdown: itemIndex === idx,
      })),
    );
  };

  const focusProductField = (idx) => {
    abrirDropdown(idx);
    setTimeout(() => focusElement(productInputRefs.current[idx]), 50);
  };

  const focusCantidadField = (idx) => {
    setTimeout(() => focusElement(quantityInputRefs.current[idx], { select: true }), 50);
  };

  const focusNoteField = (idx) => {
    setTimeout(() => focusElement(noteInputRefs.current[idx]), 50);
  };

  const focusUnitField = (idx) => {
    const firstButton = (unitButtonRefs.current[idx] || []).find(Boolean);
    setTimeout(() => focusElement(firstButton), 50);
  };

  const moverASiguienteLinea = (idx) => {
    const nextIndex = idx + 1;

    if (nextIndex < items.length) {
      focusProductField(nextIndex);
      return;
    }

    if (items[idx]?.producto.trim() !== "" && items.length < MAX_LINEAS) {
      setItems((prev) => [...prev, createEmptyItem()]);
      setTimeout(() => focusProductField(nextIndex), 70);
    }
  };

  const agregarFila = (shouldFocus = true) => {
    if (items.length >= MAX_LINEAS) {
      alert(`Maximo ${MAX_LINEAS} lineas permitidas`);
      return;
    }

    const nextIndex = items.length;
    setItems((prev) => [...prev, createEmptyItem()]);

    if (shouldFocus) {
      setTimeout(() => focusProductField(nextIndex), 70);
    }
  };

  const eliminarFila = (idx) => {
    if (items.length === 1) {
      setItems([createEmptyItem()]);
      return;
    }

    setItems((prev) => prev.filter((_, index) => index !== idx));
  };

  const handleInputChange = (idx, field, value) => {
    setItems((prev) => {
      const next = [...prev];
      next[idx] = {
        ...next[idx],
        [field]: field === "nota" ? value.toUpperCase() : value,
      };

      if (field === "producto") {
        const productoEncontrado = catalogoProductos.find(
          (producto) => producto.nombre.toUpperCase() === value.toUpperCase(),
        );

        if (productoEncontrado) {
          next[idx].clave = productoEncontrado.clave;
          next[idx].mostrarDropdown = false;
        } else {
          next[idx].clave = "";
        }
      }

      return next;
    });
  };

  const seleccionarProducto = (idx, producto) => {
    setItems((prev) => {
      const next = [...prev];
      next[idx] = {
        ...next[idx],
        producto: producto.nombre,
        clave: producto.clave,
        mostrarDropdown: false,
      };
      return next;
    });

    focusCantidadField(idx);
  };

  const filtrarProductos = (busqueda) => {
    const texto = normalizeCatalogSearch(busqueda);

    if (!texto) {
      return catalogoProductos.slice(0, 8);
    }

    return catalogoProductos
      .map((producto) => {
        const nombre = normalizeCatalogSearch(producto.nombre);
        const clave = normalizeCatalogSearch(producto.clave);

        let prioridad = null;

        if (clave === texto) prioridad = 0;
        else if (nombre === texto) prioridad = 1;
        else if (clave.startsWith(texto)) prioridad = 2;
        else if (nombre.startsWith(texto)) prioridad = 3;
        else if (clave.includes(texto)) prioridad = 4;
        else if (nombre.includes(texto)) prioridad = 5;

        if (prioridad === null) return null;

        return { producto, prioridad };
      })
      .filter(Boolean)
      .sort((a, b) => a.prioridad - b.prioridad || a.producto.nombre.localeCompare(b.producto.nombre))
      .slice(0, 10)
      .map((entry) => entry.producto);
  };

  const toggleNotaLinea = (idx) => {
    setItems((prev) =>
      prev.map((item, itemIndex) =>
        itemIndex === idx
          ? { ...item, mostrarNota: item.nota ? true : !item.mostrarNota }
          : item,
      ),
    );
  };

  const seleccionarUnidad = (idx, unidad) => {
    const itemActual = items[idx];

    setItems((prev) =>
      prev.map((item, itemIndex) =>
        itemIndex === idx
          ? { ...item, unidad }
          : item,
      ),
    );

    setTimeout(() => {
      if (!itemActual?.producto.trim()) {
        focusProductField(idx);
        return;
      }

      if (!String(itemActual?.cantidad || "").trim()) {
        focusCantidadField(idx);
        return;
      }

      if (itemActual.mostrarNota || itemActual.nota) {
        focusNoteField(idx);
        return;
      }

      moverASiguienteLinea(idx);
    }, 50);
  };

  const handleKeyDown = (event, idx, field) => {
    if (event.key === "Escape") {
      setItems((prev) =>
        prev.map((item, itemIndex) =>
          itemIndex === idx ? { ...item, mostrarDropdown: false } : item,
        ),
      );
      return;
    }

    if (event.key !== "Enter") return;

    event.preventDefault();

    if (field === "producto") {
      if (items[idx].mostrarDropdown) {
        const filtrados = filtrarProductos(items[idx].producto);
        if (filtrados.length > 0) {
          seleccionarProducto(idx, filtrados[0]);
          return;
        }
      }
      focusCantidadField(idx);
      return;
    }

    if (field === "cantidad") {
      focusUnitField(idx);
      return;
    }

    if (field === "nota") {
      moverASiguienteLinea(idx);
    }
  };

  const enviar = async (event) => {
    event.preventDefault();

    const validos = items.filter((item) => item.producto.trim() !== "");
    if (validos.length === 0) {
      alert("Error: el pedido esta vacio. Agrega al menos un producto.");
      return;
    }

    if (!db) {
      alert("Error: no hay conexion con la base de datos.");
      return;
    }

    setCargando(true);

    try {
      const nuevoId = await obtenerSiguienteId();
      const estadoInicial = esStandby ? "STANDBY_ENTREGA" : "NUEVO";
      const numeroOrden = buildOrderNumber(userPrefix, nuevoId);

      const nuevaOrden = {
        id: numeroOrden,
        numeroOrden,
        consecutivoOrden: nuevoId,
        prefijoOrden: userPrefix,
        sucursalOrigen: user,
        sucursalDestino: destino,
        fechaPedido,
        fechaEntrega,
        esStandby,
        fechaCreacion: new Date().toISOString(),
        hora: new Date().toLocaleTimeString("es-ES", {
          hour: "2-digit",
          minute: "2-digit",
        }),
        items: validos.map((item) => ({
          clave: item.clave,
          producto: item.producto,
          cantidad: item.cantidad,
          unidad: item.unidad,
          nota: item.nota,
          pesoReal: "",
          preparadoPor: "",
          listo: false,
        })),
        notaGeneral,
        estado: estadoInicial,
        preparadoPor: "",
        enviadoCon: "",
        timestamp: Date.now(),
      };

      await push(ref(db, "pedidos_internos"), nuevaOrden);

      setCounterValue(nuevoId);
      alert(`Pedido ${numeroOrden} ${esStandby ? "guardado en standby" : "enviado"} con exito.`);

      setItems([createEmptyItem()]);
      setNotaGeneral("");
      setShowGeneralNote(false);
      setFechaEntrega(hoy);
      setView("estados");
    } catch (error) {
      console.error("Fallo el envio:", error);
      alert(`Error: ${error.message}`);
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="page-enter space-y-4 pb-32 sm:space-y-5 md:pb-0">
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_320px]">
        <div className="app-panel overflow-hidden p-4 sm:p-6">
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="app-chip mb-3 border-sky-400/25 bg-sky-400/10 text-sky-200">
                  {Icons.sync}
                  Modo express
                </div>
                <h2 className="app-title text-3xl font-black text-white">Nuevo pedido rapido</h2>
                <p className="mt-2 max-w-2xl text-sm text-slate-300 sm:text-base">
                  Busca el producto, escribe la cantidad, toca la unidad y sigue con la siguiente linea sin perder tiempo.
                </p>
              </div>

              <div className="hidden sm:block">
                <SummaryCard
                  label="Pedido"
                  value={orderPreview}
                  helper={cargandoId ? "Sincronizando consecutivo..." : `Secuencia por sucursal ${userPrefix}`}
                  accent="#38bdf8"
                />
              </div>
            </div>

            <div className="grid gap-3 sm:hidden">
              <div className="grid grid-cols-2 gap-3">
                <div className="app-card-soft p-4">
                  <div className="text-xs font-extrabold uppercase tracking-[0.18em] text-slate-300">Pedido</div>
                  <div className="mt-2 text-xl font-black text-white">{orderPreview}</div>
                  <div className="mt-1 text-sm text-slate-300/80">Secuencia {userPrefix}</div>
                </div>
                <div className="app-card-soft p-4">
                  <div className="text-xs font-extrabold uppercase tracking-[0.18em] text-slate-300">Listas</div>
                  <div className="mt-2 text-xl font-black text-white">{lineasListas}</div>
                  <div className="mt-1 text-sm text-slate-300/80">de {items.length} lineas</div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <span className="app-chip border-white/10 bg-white/5 text-slate-100">{user}</span>
                <span className="app-chip border-sky-400/25 bg-sky-400/10 text-sky-100">{destino}</span>
                <span
                  className="app-chip"
                  style={{
                    borderColor: esStandby ? "rgba(245,158,11,0.28)" : "rgba(34,197,94,0.24)",
                    background: esStandby ? "rgba(245,158,11,0.12)" : "rgba(34,197,94,0.12)",
                    color: esStandby ? "#fcd34d" : "#bbf7d0",
                  }}
                >
                  {esStandby ? `Standby ${fechaEntrega}` : "Entrega hoy"}
                </span>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
              <div>
                <FieldLabel icon={Icons.send} label="Enviar a" />
                <select className="app-select" value={destino} onChange={(event) => setDestino(event.target.value)}>
                  {sucursales.filter((sucursal) => sucursal !== user).map((sucursal) => (
                    <option key={sucursal} value={sucursal} style={{ background: "#0f172a" }}>
                      {sucursal}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <FieldLabel icon={Icons.calendar} label="Fecha de entrega" badge={esStandby ? "STANDBY" : null} />
                <input
                  type="date"
                  value={fechaEntrega}
                  min={hoy}
                  onChange={(event) => setFechaEntrega(event.target.value)}
                  className="app-input"
                  style={{
                    borderColor: esStandby ? "rgba(245,158,11,0.55)" : undefined,
                    boxShadow: esStandby ? "0 0 0 4px rgba(245,158,11,0.08)" : undefined,
                  }}
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <div className="app-card-soft p-4">
                <div className="text-xs font-extrabold uppercase tracking-[0.18em] text-slate-400">Sucursal origen</div>
                <div className="mt-2 text-base font-black text-white">{user}</div>
              </div>

              <div className="app-card-soft p-4">
                <div className="text-xs font-extrabold uppercase tracking-[0.18em] text-slate-400">Fecha del pedido</div>
                <div className="mt-2 text-base font-black text-white">{fechaPedido}</div>
              </div>

              <div className="app-card-soft flex items-center justify-between p-4">
                <div>
                  <div className="text-xs font-extrabold uppercase tracking-[0.18em] text-slate-400">Catalogo</div>
                  <div className="mt-1 text-lg font-black text-white">{catalogoProductos.length} productos</div>
                </div>
                <div className="rounded-full bg-sky-400/15 p-3 text-sky-200">{Icons.search}</div>
              </div>
            </div>

            {esStandby ? (
              <div className="rounded-[24px] border border-amber-300/25 bg-amber-400/12 p-4 text-sm text-amber-100">
                <div className="mb-2 flex items-center gap-2 font-black uppercase tracking-[0.16em] text-amber-200">
                  {Icons.alert}
                  Pedido en standby
                </div>
                <div>Se guardara con entrega programada hasta la fecha seleccionada.</div>
              </div>
            ) : (
              <div className="rounded-[24px] border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm text-emerald-100">
                <div className="mb-2 flex items-center gap-2 font-black uppercase tracking-[0.16em] text-emerald-200">
                  {Icons.sync}
                  Envio directo
                </div>
                <div>Al confirmar, el pedido aparecera de inmediato en el seguimiento.</div>
              </div>
            )}
          </div>
        </div>

        <aside className="hidden app-panel xl:flex xl:flex-col xl:gap-4 xl:p-5">
          <SummaryCard label="Lineas" value={`${items.length}/${MAX_LINEAS}`} helper="Tarjetas disponibles" accent="#2dd4bf" />
          <SummaryCard label="Con contenido" value={lineasUsadas} helper="Productos ya agregados" accent="#818cf8" />
          <SummaryCard label="Listas" value={lineasListas} helper="Cantidad y unidad definidas" accent="#38bdf8" />
          <SummaryCard label="Destino" value={destino} helper={esStandby ? "Entrega programada" : "Entrega inmediata"} accent={esStandby ? "#f59e0b" : "#22c55e"} />
        </aside>
      </section>

      <section className="app-panel p-3 sm:p-6">
        <div className="-mx-1 mb-4 rounded-[24px] border border-white/10 bg-slate-950/80 p-3 shadow-[0_18px_40px_rgba(2,6,23,0.34)] backdrop-blur-xl md:mx-0 md:mb-5 md:border-0 md:bg-transparent md:p-0 md:shadow-none">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="app-title text-2xl font-black text-white">Captura express</h3>
              <p className="mt-1 text-sm text-slate-300">
                1. Busca producto 2. Cantidad 3. Unidad. La siguiente linea queda lista enseguida.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="app-chip border-white/10 bg-white/5 text-slate-100">{lineasListas} listas</span>
              <button
                type="button"
                onClick={() => agregarFila(true)}
                disabled={items.length >= MAX_LINEAS}
                className="app-button-secondary sm:w-auto"
              >
                {Icons.plus}
                Agregar linea
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-3 sm:space-y-4">
          {items.map((item, idx) => {
            const productosFiltrados = filtrarProductos(item.producto);
            const claveVisible = item.clave || "Sin clave";
            const notaVisible = item.mostrarNota || Boolean(item.nota);
            const estadoLinea = item.producto
              ? `${item.cantidad || "0"} ${item.unidad || "sin unidad"}`
              : "Toca para comenzar";

            return (
              <article
                key={idx}
                className="app-card app-status-glow p-4 sm:p-5"
                style={{ color: item.producto ? "#38bdf8" : "#64748b" }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="app-chip border-white/10 bg-white/5 text-slate-100">
                        Linea {String(idx + 1).padStart(2, "0")}
                      </span>
                      <span
                        className="app-chip"
                        style={{
                          borderColor: item.clave ? "rgba(56,189,248,0.28)" : "rgba(148,163,184,0.18)",
                          background: item.clave ? "rgba(56,189,248,0.10)" : "rgba(148,163,184,0.10)",
                          color: item.clave ? "#d7f0ff" : "#cbd5e1",
                        }}
                      >
                        {Icons.key}
                        {claveVisible}
                      </span>
                    </div>
                    <div className="mt-3 text-sm text-slate-300">
                      Busca rapido y sigue con cantidad y unidad sin salir de la misma tarjeta.
                    </div>
                  </div>

                  <button type="button" onClick={() => eliminarFila(idx)} className="app-icon-button text-rose-200">
                    {Icons.trash}
                  </button>
                </div>

                <div className="mt-4 space-y-4">
                  <div className="relative" ref={(element) => (dropdownRefs.current[idx] = element)}>
                    <FieldLabel icon={Icons.search} label="Producto" />
                    <div className="relative">
                      <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                        {Icons.search}
                      </span>
                      <input
                        ref={(element) => (productInputRefs.current[idx] = element)}
                        type="text"
                        value={item.producto}
                        onChange={(event) => {
                          handleInputChange(idx, "producto", event.target.value.toUpperCase());
                          abrirDropdown(idx);
                        }}
                        onFocus={() => abrirDropdown(idx)}
                        onKeyDown={(event) => handleKeyDown(event, idx, "producto")}
                        placeholder="Buscar por nombre o clave..."
                        className="app-input pl-12 text-base uppercase sm:text-lg"
                        autoComplete="off"
                        autoCorrect="off"
                        autoCapitalize="characters"
                        enterKeyHint="search"
                      />
                    </div>

                    {item.mostrarDropdown ? (
                      <div className="app-scroll-y absolute left-0 right-0 top-[calc(100%+6px)] z-30 max-h-64 rounded-[22px] border border-white/10 bg-slate-950/96 p-2 shadow-[0_22px_60px_rgba(2,6,23,0.46)] backdrop-blur-xl">
                        <div className="px-2 pb-2 text-[11px] font-extrabold uppercase tracking-[0.2em] text-slate-400">
                          {item.producto ? "Coincidencias" : "Sugeridos rapidos"}
                        </div>

                        {productosFiltrados.length === 0 ? (
                          <div className="rounded-[18px] px-4 py-6 text-center text-sm text-slate-400">
                            No se encontraron productos.
                          </div>
                        ) : (
                          productosFiltrados.map((producto) => (
                            <button
                              type="button"
                              key={`${producto.clave}-${producto.nombre}`}
                              onClick={() => seleccionarProducto(idx, producto)}
                              className="mb-2 flex w-full items-start gap-3 rounded-[18px] border border-transparent bg-white/4 px-4 py-3 text-left transition hover:border-sky-400/30 hover:bg-sky-400/10"
                            >
                              <span className="rounded-full bg-sky-400/15 px-3 py-1 text-xs font-black tracking-[0.16em] text-sky-200">
                                {producto.clave}
                              </span>
                              <div className="min-w-0">
                                <div className="text-sm font-semibold text-white">{producto.nombre}</div>
                                <div className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-400">
                                  Tocar para usar
                                </div>
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    ) : null}
                  </div>

                  <div className="grid gap-3 lg:grid-cols-[170px_minmax(0,1fr)]">
                    <div>
                      <FieldLabel icon={Icons.package} label="Cantidad" />
                      <input
                        ref={(element) => (quantityInputRefs.current[idx] = element)}
                        type="number"
                        value={item.cantidad}
                        onChange={(event) => handleInputChange(idx, "cantidad", event.target.value)}
                        onKeyDown={(event) => handleKeyDown(event, idx, "cantidad")}
                        onFocus={(event) => event.target.select()}
                        placeholder="0"
                        min="0"
                        step="0.01"
                        inputMode="decimal"
                        enterKeyHint="next"
                        className="app-input text-center text-lg font-black text-white"
                      />
                    </div>

                    <div>
                      <FieldLabel icon={Icons.package} label="Unidad" />
                      <div className="grid grid-cols-3 gap-2">
                        {UNIDADES.map((unidad, unitIdx) => {
                          const selected = item.unidad === unidad.value;

                          return (
                            <button
                              key={unidad.value}
                              ref={(element) => {
                                unitButtonRefs.current[idx] = unitButtonRefs.current[idx] || [];
                                unitButtonRefs.current[idx][unitIdx] = element;
                              }}
                              type="button"
                              onClick={() => seleccionarUnidad(idx, unidad.value)}
                              className="min-h-[48px] rounded-[16px] border px-3 py-2 text-sm font-black transition"
                              style={{
                                borderColor: selected ? "rgba(56,189,248,0.5)" : "rgba(148,163,184,0.2)",
                                background: selected ? "rgba(56,189,248,0.16)" : "rgba(255,255,255,0.04)",
                                color: selected ? "#e0f2fe" : "#cbd5e1",
                                boxShadow: selected ? "0 12px 24px rgba(56,189,248,0.12)" : "none",
                              }}
                            >
                              {unidad.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className="app-chip"
                      style={{
                        borderColor: item.producto ? "rgba(45,212,191,0.24)" : "rgba(148,163,184,0.18)",
                        background: item.producto ? "rgba(45,212,191,0.10)" : "rgba(148,163,184,0.10)",
                        color: item.producto ? "#ccfbf1" : "#cbd5e1",
                      }}
                    >
                      {estadoLinea}
                    </span>

                    <button
                      type="button"
                      onClick={() => toggleNotaLinea(idx)}
                      className="app-chip border-white/10 bg-white/5 text-slate-200"
                    >
                      {Icons.note}
                      {notaVisible ? "Editar nota" : "Agregar nota"}
                    </button>
                  </div>

                  {notaVisible ? (
                    <div>
                      <FieldLabel icon={Icons.note} label="Nota de la linea" />
                      <input
                        ref={(element) => (noteInputRefs.current[idx] = element)}
                        type="text"
                        value={item.nota}
                        onChange={(event) => handleInputChange(idx, "nota", event.target.value)}
                        onKeyDown={(event) => handleKeyDown(event, idx, "nota")}
                        placeholder="Ej. Sin hueso, cortar fino, etc."
                        className="app-input uppercase"
                        autoCorrect="off"
                        autoCapitalize="characters"
                        enterKeyHint="next"
                      />
                    </div>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-slate-300">
            {lineasUsadas} lineas con contenido de {items.length} creadas.
          </div>
          <div className="app-chip border-white/10 bg-white/5 text-slate-200">
            Maximo {MAX_LINEAS} lineas por pedido
          </div>
        </div>
      </section>

      <section className="app-panel p-4 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <FieldLabel icon={Icons.note} label="Nota general del pedido" />
            <div className="text-sm text-slate-300">Usala solo si todo el pedido lleva la misma instruccion.</div>
          </div>

          <button
            type="button"
            onClick={() => setShowGeneralNote((current) => !current)}
            className="app-button-ghost sm:w-auto"
          >
            {Icons.note}
            {showGeneralNote || notaGeneral ? "Ocultar nota" : "Agregar nota general"}
          </button>
        </div>

        {showGeneralNote || notaGeneral ? (
          <textarea
            value={notaGeneral}
            onChange={(event) => setNotaGeneral(event.target.value.toUpperCase())}
            placeholder="Instrucciones generales para todo el pedido..."
            className="app-textarea mt-4"
            autoCorrect="off"
            autoCapitalize="characters"
          />
        ) : (
          <div className="mt-4 rounded-[22px] border border-dashed border-white/10 bg-white/4 px-4 py-4 text-sm text-slate-300">
            Sin nota general por ahora. Puedes agregarla solo cuando la necesites.
          </div>
        )}
      </section>

      <section className="sticky bottom-[calc(88px+env(safe-area-inset-bottom))] z-30 md:hidden">
        <div className="rounded-[28px] border border-white/10 bg-slate-950/84 p-3 shadow-[0_24px_60px_rgba(2,6,23,0.42)] backdrop-blur-2xl">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-slate-400">Pedido {orderPreview}</div>
              <div className="mt-1 truncate text-sm font-black text-white">{destino}</div>
              <div className="text-xs text-slate-300">{lineasListas} listas de {items.length} lineas</div>
            </div>

            <span
              className="app-chip"
              style={{
                borderColor: esStandby ? "rgba(245,158,11,0.28)" : "rgba(56,189,248,0.24)",
                background: esStandby ? "rgba(245,158,11,0.12)" : "rgba(56,189,248,0.12)",
                color: esStandby ? "#fde68a" : "#d7f0ff",
              }}
            >
              {esStandby ? "Standby" : "Directo"}
            </span>
          </div>

          <div className="mt-3 grid grid-cols-[56px_minmax(0,1fr)] gap-2">
            <button
              type="button"
              onClick={() => agregarFila(true)}
              disabled={items.length >= MAX_LINEAS}
              className="app-button-secondary px-0"
            >
              {Icons.plus}
            </button>

            <button
              type="button"
              onClick={enviar}
              disabled={cargando || cargandoId}
              className="app-button-primary text-sm"
              style={{
                background:
                  cargando || cargandoId
                    ? "linear-gradient(135deg, rgba(71,85,105,0.8) 0%, rgba(51,65,85,0.8) 100%)"
                    : esStandby
                      ? "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)"
                      : "linear-gradient(135deg, #38bdf8 0%, #2563eb 100%)",
                boxShadow:
                  cargando || cargandoId
                    ? "none"
                    : esStandby
                      ? "0 18px 34px rgba(245,158,11,0.24)"
                      : "0 18px 34px rgba(37,99,235,0.28)",
              }}
            >
              {cargando ? "Enviando..." : esStandby ? "Guardar standby" : "Enviar pedido"}
            </button>
          </div>
        </div>
      </section>

      <section className="hidden app-panel p-4 md:block sm:p-6">
        <button
          type="button"
          onClick={enviar}
          disabled={cargando || cargandoId}
          className="app-button-primary w-full text-base sm:text-lg"
          style={{
            background:
              cargando || cargandoId
                ? "linear-gradient(135deg, rgba(71,85,105,0.8) 0%, rgba(51,65,85,0.8) 100%)"
                : esStandby
                  ? "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)"
                  : "linear-gradient(135deg, #38bdf8 0%, #2563eb 100%)",
            boxShadow:
              cargando || cargandoId
                ? "none"
                : esStandby
                  ? "0 18px 34px rgba(245,158,11,0.24)"
                  : "0 18px 34px rgba(37,99,235,0.28)",
          }}
        >
          {cargando ? (
            <>
              {Icons.sync}
              Enviando pedido...
            </>
          ) : (
            <>
              {Icons.send}
              {esStandby ? `Guardar pedido en standby para ${destino}` : `Enviar pedido a ${destino}`}
            </>
          )}
        </button>
      </section>
    </div>
  );
}
