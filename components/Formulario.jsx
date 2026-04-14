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
  unidad: "",
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

export default function Formulario({ user, setView, sucursales = [], productosCSV = [], pedidos = [] }) {
  const MAX_LINEAS = 25;
  const catalogoProductos = productosCSV.length > 0 ? productosCSV : PRODUCTOS_EJEMPLO;
  const hoy = getLocalDateString();
  const userPrefix = getUserOrderPrefix(user);
  const userCounterKey = getUserCounterKey(user);

  const [items, setItems] = useState([createEmptyItem()]);
  const [destino, setDestino] = useState(sucursales[0] || "Cedi");
  const [notaGeneral, setNotaGeneral] = useState("");
  const [notaTemporal, setNotaTemporal] = useState("");
  const [cargando, setCargando] = useState(false);
  const [counterValue, setCounterValue] = useState(0);
  const [cargandoId, setCargandoId] = useState(true);
  const [fechaPedido] = useState(hoy);
  const [fechaEntrega, setFechaEntrega] = useState(hoy);
  const [unitPickerIndex, setUnitPickerIndex] = useState(null);
  const [showNoteModal, setShowNoteModal] = useState(false);

  const productInputRefs = useRef([]);
  const quantityInputRefs = useRef([]);
  const dropdownRefs = useRef({});

  const esStandby = fechaEntrega > hoy;
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

  const abrirSelectorUnidad = (idx) => {
    if (!items[idx]?.producto.trim()) {
      focusProductField(idx);
      return;
    }

    setUnitPickerIndex(idx);
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
      setUnitPickerIndex(null);

      if (!itemActual?.producto.trim()) {
        focusProductField(idx);
        return;
      }

      if (!String(itemActual?.cantidad || "").trim()) {
        focusCantidadField(idx);
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
      abrirSelectorUnidad(idx);
      return;
    }
  };

  const abrirNotaGeneral = () => {
    setNotaTemporal(notaGeneral);
    setShowNoteModal(true);
  };

  const guardarNotaGeneral = () => {
    setNotaGeneral(notaTemporal.toUpperCase());
    setShowNoteModal(false);
  };

  const enviar = async (event) => {
    event.preventDefault();

    const validos = items.filter((item) => item.producto.trim() !== "");
    if (validos.length === 0) {
      alert("Error: el pedido esta vacio. Agrega al menos un producto.");
      return;
    }

    const incompletos = validos.some(
      (item) => String(item.cantidad).trim() === "" || String(item.unidad).trim() === "",
    );
    if (incompletos) {
      alert("Completa cantidad y unidad en todas las lineas antes de enviar.");
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
      setNotaTemporal("");
      setShowNoteModal(false);
      setUnitPickerIndex(null);
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
    <div className="page-enter space-y-4">
      <section className="app-panel p-4 sm:p-5">
        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <FieldLabel icon={Icons.package} label="N. Pedido" />
            <div className="app-card-soft flex min-h-[54px] items-center px-4 text-lg font-black text-white">
              {orderPreview}
            </div>
          </div>

          <div>
            <FieldLabel icon={Icons.send} label="Enviar pedido a" />
            <select className="app-select" value={destino} onChange={(event) => setDestino(event.target.value)}>
              {sucursales.filter((sucursal) => sucursal !== user).map((sucursal) => (
                <option key={sucursal} value={sucursal} style={{ background: "#0f172a" }}>
                  {sucursal}
                </option>
              ))}
            </select>
          </div>

          <div>
            <FieldLabel icon={Icons.calendar} label="Fecha de entrega" />
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
      </section>

      <section className="app-panel p-4 sm:p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="app-title text-2xl font-black text-white">Captura de pedido</h3>
          <button
            type="button"
            onClick={() => agregarFila(true)}
            disabled={items.length >= MAX_LINEAS}
            className="app-icon-button text-sky-200"
          >
            {Icons.plus}
          </button>
        </div>

        <div className="space-y-3">
          {items.map((item, idx) => {
            const productosFiltrados = filtrarProductos(item.producto);

            return (
              <article key={idx} className="app-card p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <span className="app-chip border-white/10 bg-white/5 text-slate-100">
                    Linea {String(idx + 1).padStart(2, "0")}
                  </span>

                  <button type="button" onClick={() => eliminarFila(idx)} className="app-icon-button text-rose-200">
                    {Icons.trash}
                  </button>
                </div>

                <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_140px_170px]">
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
                        placeholder="Elegir producto"
                        className="app-input pl-12 uppercase"
                        autoComplete="off"
                        autoCorrect="off"
                        autoCapitalize="characters"
                        enterKeyHint="search"
                      />
                    </div>

                    {item.mostrarDropdown ? (
                      <div className="app-scroll-y absolute left-0 right-0 top-[calc(100%+6px)] z-30 max-h-64 rounded-[22px] border border-white/10 bg-slate-950/96 p-2 shadow-[0_22px_60px_rgba(2,6,23,0.46)] backdrop-blur-xl">
                        {productosFiltrados.length === 0 ? (
                          <div className="rounded-[18px] px-4 py-5 text-center text-sm text-slate-400">
                            Sin resultados
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
                      className="app-input text-center text-white"
                    />
                  </div>

                  <div>
                    <FieldLabel icon={Icons.package} label="Unidad" />
                    <button
                      type="button"
                      onClick={() => abrirSelectorUnidad(idx)}
                      className="app-button-ghost w-full justify-between px-4 text-sm"
                    >
                      <span>{item.unidad || "Elegir"}</span>
                      <span className="text-slate-400">Abrir</span>
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="app-panel p-4 sm:p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <button type="button" onClick={abrirNotaGeneral} className="app-button-secondary">
            {Icons.note}
            Agregar nota
          </button>

          <button
            type="button"
            onClick={enviar}
            disabled={cargando || cargandoId}
            className="app-button-primary"
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
                Enviar pedido
              </>
            )}
          </button>
        </div>
      </section>

      {unitPickerIndex !== null ? (
        <div
          className="app-modal"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setUnitPickerIndex(null);
            }
          }}
        >
          <div className="app-modal-panel w-full max-w-[420px] p-5 sm:p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="app-title text-2xl font-black text-slate-900">Unidad</h3>
              <button type="button" onClick={() => setUnitPickerIndex(null)} className="app-icon-button text-slate-700">
                {Icons.close}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {UNIDADES.map((unidad) => (
                <button
                  key={unidad.value}
                  type="button"
                  onClick={() => seleccionarUnidad(unitPickerIndex, unidad.value)}
                  className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-4 text-base font-black text-slate-900 transition hover:border-sky-400 hover:bg-sky-50"
                >
                  {unidad.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {showNoteModal ? (
        <div
          className="app-modal"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setShowNoteModal(false);
            }
          }}
        >
          <div className="app-modal-panel w-full max-w-[520px] p-5 sm:p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="app-title text-2xl font-black text-slate-900">Nota</h3>
              <button type="button" onClick={() => setShowNoteModal(false)} className="app-icon-button text-slate-700">
                {Icons.close}
              </button>
            </div>

            <textarea
              value={notaTemporal}
              onChange={(event) => setNotaTemporal(event.target.value.toUpperCase())}
              placeholder="Escribe aqui"
              className="app-textarea"
              autoCorrect="off"
              autoCapitalize="characters"
            />

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <button type="button" onClick={() => setShowNoteModal(false)} className="app-button-ghost">
                Cerrar
              </button>
              <button type="button" onClick={guardarNotaGeneral} className="app-button-primary">
                Aceptar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
