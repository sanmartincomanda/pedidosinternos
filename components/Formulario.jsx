"use client";

import React, { useEffect, useRef, useState } from "react";
import { db } from "../firebase";
import { off, onValue, push, ref, runTransaction } from "firebase/database";
import {
  buildOrderNumber,
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

const createEmptyItem = () => ({
  clave: "",
  producto: "",
  cantidad: "",
  unidad: "lb",
  nota: "",
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

export default function Formulario({ user, setView, sucursales = [], productosCSV = [] }) {
  const MAX_LINEAS = 25;
  const catalogoProductos = productosCSV.length > 0 ? productosCSV : PRODUCTOS_EJEMPLO;
  const hoy = getLocalDateString();
  const userPrefix = getUserOrderPrefix(user);
  const userCounterKey = getUserCounterKey(user);

  const [items, setItems] = useState([createEmptyItem()]);
  const [destino, setDestino] = useState(sucursales[0] || "Cedi");
  const [notaGeneral, setNotaGeneral] = useState("");
  const [cargando, setCargando] = useState(false);
  const [busquedaActiva, setBusquedaActiva] = useState(null);
  const [orderId, setOrderId] = useState(1);
  const [cargandoId, setCargandoId] = useState(true);
  const [fechaPedido] = useState(hoy);
  const [fechaEntrega, setFechaEntrega] = useState(hoy);

  const inputsRef = useRef([]);
  const dropdownRefs = useRef({});

  const esStandby = fechaEntrega > hoy;
  const lineasUsadas = items.filter((item) => item.producto.trim() !== "").length;
  const orderPreview = cargandoId ? "..." : buildOrderNumber(userPrefix, orderId);

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
        setOrderId(valor >= MAX_ORDER_NUMBER ? MAX_ORDER_NUMBER : valor + 1);
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

      setBusquedaActiva(null);
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
      if (actual >= MAX_ORDER_NUMBER) {
        return;
      }

      return actual + 1;
    });

    if (!resultado.committed) {
      throw new Error("No se pudo generar un nuevo numero de orden para esta sucursal.");
    }

    return resultado.snapshot.val();
  };

  const agregarFila = () => {
    if (items.length >= MAX_LINEAS) {
      alert(`Maximo ${MAX_LINEAS} lineas permitidas`);
      return;
    }

    setItems((prev) => [...prev, createEmptyItem()]);
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

    setBusquedaActiva(null);
    setTimeout(() => inputsRef.current[idx * 5 + 2]?.focus(), 40);
  };

  const filtrarProductos = (busqueda) => {
    if (!busqueda) return catalogoProductos.slice(0, 8);

    const texto = busqueda.toUpperCase();
    return catalogoProductos
      .filter(
        (producto) =>
          producto.nombre.toUpperCase().includes(texto) ||
          producto.clave.toUpperCase().includes(texto),
      )
      .slice(0, 10);
  };

  const abrirDropdown = (idx) => {
    setItems((prev) =>
      prev.map((item, itemIndex) => ({
        ...item,
        mostrarDropdown: itemIndex === idx,
      })),
    );
    setBusquedaActiva(idx);
  };

  const handleKeyDown = (event, idx, field) => {
    if (event.key === "Escape") {
      setItems((prev) =>
        prev.map((item, itemIndex) =>
          itemIndex === idx ? { ...item, mostrarDropdown: false } : item,
        ),
      );
      setBusquedaActiva(null);
      return;
    }

    if (event.key !== "Enter") return;

    event.preventDefault();
    const nextIndex = idx + 1;

    if (field === "producto") {
      if (items[idx].mostrarDropdown) {
        const filtrados = filtrarProductos(items[idx].producto);
        if (filtrados.length > 0) {
          seleccionarProducto(idx, filtrados[0]);
          return;
        }
      }
      inputsRef.current[idx * 5 + 2]?.focus();
      return;
    }

    if (field === "cantidad") {
      inputsRef.current[idx * 5 + 3]?.focus();
      return;
    }

    if (field === "unidad") {
      inputsRef.current[idx * 5 + 4]?.focus();
      return;
    }

    if (field === "nota") {
      if (idx === items.length - 1 && items[idx].producto.trim() !== "" && items.length < MAX_LINEAS) {
        setItems((prev) => [...prev, createEmptyItem()]);
        setTimeout(() => {
          abrirDropdown(idx + 1);
          inputsRef.current[(idx + 1) * 5 + 1]?.focus();
        }, 50);
        return;
      }

      if (nextIndex < items.length) {
        inputsRef.current[nextIndex * 5 + 1]?.focus();
      }
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

      setOrderId(nuevoId + 1);
      alert(`Pedido ${numeroOrden} ${esStandby ? "guardado en standby" : "enviado"} con exito.`);

      setItems([createEmptyItem()]);
      setNotaGeneral("");
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
    <div className="page-enter space-y-5">
      <section className="grid gap-5 xl:grid-cols-[1.35fr_0.85fr]">
        <div className="app-panel p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="app-chip mb-3 border-sky-400/25 bg-sky-400/10 text-sky-200">
                {Icons.package}
                Captura movil
              </div>
              <h2 className="app-title text-3xl font-black text-white">Arma el pedido en tarjetas</h2>
              <p className="mt-2 max-w-2xl text-sm text-slate-300 sm:text-base">
                Todo el flujo de creacion se mantiene, pero ahora cada linea vive en una tarjeta compacta y tactil.
              </p>
            </div>

            <SummaryCard
              label="Pedido"
              value={orderPreview}
              helper={cargandoId ? "Sincronizando consecutivo..." : `Secuencia por sucursal ${userPrefix}`}
              accent="#38bdf8"
            />
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <div>
              <FieldLabel icon={Icons.package} label="Sucursal origen" />
              <div className="app-card-soft p-4 text-base font-black text-white">{user}</div>
            </div>

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

            <div className="app-card-soft flex items-center justify-between p-4">
              <div>
                <div className="text-xs font-extrabold uppercase tracking-[0.18em] text-slate-400">Catalogo</div>
                <div className="mt-1 text-lg font-black text-white">{catalogoProductos.length} productos</div>
              </div>
              <div className="rounded-full bg-sky-400/15 p-3 text-sky-200">{Icons.search}</div>
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div>
              <FieldLabel icon={Icons.calendar} label="Fecha del pedido" />
              <input type="date" value={fechaPedido} disabled className="app-input opacity-70" />
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
        </div>

        <aside className="app-panel flex flex-col gap-4 p-5 sm:p-6">
          <SummaryCard label="Lineas" value={`${items.length}/${MAX_LINEAS}`} helper="Tarjetas disponibles" accent="#2dd4bf" />
          <SummaryCard label="Con contenido" value={lineasUsadas} helper="Productos ya agregados" accent="#818cf8" />
          <SummaryCard label="Destino" value={destino} helper={esStandby ? "Entrega programada" : "Entrega inmediata"} accent={esStandby ? "#f59e0b" : "#38bdf8"} />

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
        </aside>
      </section>

      <section className="app-panel p-4 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="app-title text-2xl font-black text-white">Productos del pedido</h3>
            <p className="mt-1 text-sm text-slate-300">Cada producto se captura en una tarjeta para que sea comodo en pantalla pequena.</p>
          </div>

          <button
            type="button"
            onClick={agregarFila}
            disabled={items.length >= MAX_LINEAS}
            className="app-button-secondary sm:w-auto"
          >
            {Icons.plus}
            Agregar linea
          </button>
        </div>

        <div className="mt-5 space-y-4">
          {items.map((item, idx) => {
            const productosFiltrados = filtrarProductos(item.producto);
            const claveVisible = item.clave || "Sin clave";

            return (
              <article
                key={idx}
                className="app-card app-status-glow p-4 sm:p-5"
                style={{ color: item.clave ? "#38bdf8" : "#64748b" }}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-wrap items-center gap-3">
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

                  <button type="button" onClick={() => eliminarFila(idx)} className="app-icon-button text-rose-200">
                    {Icons.trash}
                  </button>
                </div>

                <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.45fr)_180px_180px]">
                  <div className="relative" ref={(element) => (dropdownRefs.current[idx] = element)}>
                    <FieldLabel icon={Icons.search} label="Producto" />
                    <div className="relative">
                      <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                        {Icons.search}
                      </span>
                      <input
                        ref={(element) => (inputsRef.current[idx * 5 + 1] = element)}
                        type="text"
                        value={item.producto}
                        onChange={(event) => {
                          handleInputChange(idx, "producto", event.target.value.toUpperCase());
                          abrirDropdown(idx);
                        }}
                        onFocus={() => abrirDropdown(idx)}
                        onKeyDown={(event) => handleKeyDown(event, idx, "producto")}
                        placeholder="Buscar por nombre o clave..."
                        className="app-input pl-12 uppercase"
                        autoComplete="off"
                      />
                    </div>

                    {item.mostrarDropdown ? (
                      <div className="app-scroll-y absolute left-0 right-0 top-[calc(100%+6px)] z-30 max-h-64 rounded-[22px] border border-white/10 bg-slate-950/95 p-2 shadow-[0_22px_60px_rgba(2,6,23,0.46)] backdrop-blur-xl">
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
                              <span className="text-sm font-semibold text-white">{producto.nombre}</span>
                            </button>
                          ))
                        )}
                      </div>
                    ) : null}
                  </div>

                  <div>
                    <FieldLabel icon={Icons.package} label="Cantidad" />
                    <input
                      ref={(element) => (inputsRef.current[idx * 5 + 2] = element)}
                      type="number"
                      value={item.cantidad}
                      onChange={(event) => handleInputChange(idx, "cantidad", event.target.value)}
                      onKeyDown={(event) => handleKeyDown(event, idx, "cantidad")}
                      placeholder="0"
                      min="0"
                      step="0.01"
                      className="app-input text-center text-white"
                    />
                  </div>

                  <div>
                    <FieldLabel icon={Icons.package} label="Unidad" />
                    <select
                      ref={(element) => (inputsRef.current[idx * 5 + 3] = element)}
                      value={item.unidad}
                      onChange={(event) => handleInputChange(idx, "unidad", event.target.value)}
                      onKeyDown={(event) => handleKeyDown(event, idx, "unidad")}
                      className="app-select"
                    >
                      {UNIDADES.map((unidad) => (
                        <option key={unidad.value} value={unidad.value} style={{ background: "#0f172a" }}>
                          {unidad.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
                  <div>
                    <FieldLabel icon={Icons.note} label="Nota de la linea" />
                    <input
                      ref={(element) => (inputsRef.current[idx * 5 + 4] = element)}
                      type="text"
                      value={item.nota}
                      onChange={(event) => handleInputChange(idx, "nota", event.target.value)}
                      onKeyDown={(event) => handleKeyDown(event, idx, "nota")}
                      placeholder="Ej. Sin hueso, cortar fino, etc."
                      className="app-input uppercase"
                    />
                  </div>

                  <div className="app-card-soft flex flex-col justify-center p-4">
                    <div className="text-xs font-extrabold uppercase tracking-[0.18em] text-slate-400">Estado de la linea</div>
                    <div className="mt-2 text-base font-black text-white">
                      {item.producto ? "Lista para enviar" : "Pendiente de completar"}
                    </div>
                    <div className="mt-1 text-sm text-slate-300">
                      {item.producto ? `${item.cantidad || "0"} ${item.unidad}` : "Selecciona un producto para continuar."}
                    </div>
                  </div>
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
        <FieldLabel icon={Icons.note} label="Nota general del pedido" />
        <textarea
          value={notaGeneral}
          onChange={(event) => setNotaGeneral(event.target.value.toUpperCase())}
          placeholder="Instrucciones generales para todo el pedido..."
          className="app-textarea"
        />
      </section>

      <section className="app-panel p-4 sm:p-6">
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
