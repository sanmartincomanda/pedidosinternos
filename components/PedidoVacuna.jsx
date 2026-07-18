"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { db } from "../firebase";
import { off, onValue, push, ref, runTransaction, update } from "firebase/database";
import { syncPedidoToAccounting } from "@/lib/accountingTransferSync";
import { getBranchDisplayName, getCanonicalBranchId } from "@/lib/branchUtils";
import { printTransferRequisition } from "@/lib/historialPdf";
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
  note: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z" />
      <path d="M14 3v6h6M8 13h8M8 17h5" />
    </svg>
  ),
  search: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  ),
  scale: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <path d="M16 10a4 4 0 0 1-8 0" />
    </svg>
  ),
  sync: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 2v6h-6M3 22v-6h6" />
      <path d="M20 8A8 8 0 0 0 6.3 5.3L3 8M4 16a8 8 0 0 0 13.7 2.7L21 16" />
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
};

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
    .replace(/[^A-Z0-9\s]/gi, " ")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

function compactCatalogSearch(value = "") {
  return normalizeCatalogSearch(value).replace(/\s+/g, "");
}

function splitCatalogTokens(value = "") {
  return normalizeCatalogSearch(value).split(" ").filter(Boolean);
}

function getBoundedEditDistance(source = "", target = "", maxDistance = 2) {
  if (!source) return target.length;
  if (!target) return source.length;
  if (Math.abs(source.length - target.length) > maxDistance) return maxDistance + 1;

  const previous = Array.from({ length: target.length + 1 }, (_, index) => index);

  for (let sourceIndex = 1; sourceIndex <= source.length; sourceIndex += 1) {
    const current = [sourceIndex];
    let rowMin = current[0];

    for (let targetIndex = 1; targetIndex <= target.length; targetIndex += 1) {
      const cost = source[sourceIndex - 1] === target[targetIndex - 1] ? 0 : 1;
      const value = Math.min(
        previous[targetIndex] + 1,
        current[targetIndex - 1] + 1,
        previous[targetIndex - 1] + cost,
      );

      current[targetIndex] = value;
      rowMin = Math.min(rowMin, value);
    }

    if (rowMin > maxDistance) return maxDistance + 1;

    for (let index = 0; index < current.length; index += 1) {
      previous[index] = current[index];
    }
  }

  return previous[target.length];
}

function getTokenMatchQuality(queryToken, candidateToken) {
  if (!queryToken || !candidateToken) return null;
  if (candidateToken === queryToken) return 0;
  if (candidateToken.startsWith(queryToken)) return 1;
  if (candidateToken.includes(queryToken)) return 2;

  if (queryToken.length >= 3) {
    const prefixDistance = getBoundedEditDistance(queryToken, candidateToken.slice(0, queryToken.length), 1);
    if (prefixDistance <= 1) return 3;
  }

  if (queryToken.length >= 4) {
    const fullDistance = getBoundedEditDistance(queryToken, candidateToken, 2);
    if (fullDistance <= 2) return 4;
  }

  return null;
}

function getTokenGroupScore(queryTokens = [], candidateTokens = []) {
  if (queryTokens.length === 0 || candidateTokens.length === 0) return null;

  const scores = [];

  for (const queryToken of queryTokens) {
    let bestScore = null;

    for (const candidateToken of candidateTokens) {
      const quality = getTokenMatchQuality(queryToken, candidateToken);
      if (quality === null) continue;

      if (bestScore === null || quality < bestScore) {
        bestScore = quality;
      }
    }

    if (bestScore === null) return null;
    scores.push(bestScore);
  }

  return Math.max(...scores);
}

function isSubsequenceMatch(query = "", candidate = "") {
  if (!query || !candidate) return false;

  let queryIndex = 0;

  for (let candidateIndex = 0; candidateIndex < candidate.length; candidateIndex += 1) {
    if (candidate[candidateIndex] === query[queryIndex]) {
      queryIndex += 1;
      if (queryIndex === query.length) return true;
    }
  }

  return false;
}

const createEmptyItem = () => ({
  clave: "",
  producto: "",
  pesoReal: "",
  bultos: [],
  nota: "",
  mostrarDropdown: false,
});

function parseBultoWeight(value) {
  const normalized = String(value ?? "").trim().replace(",", ".");
  const parsed = Number.parseFloat(normalized);

  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.round(parsed * 10000) / 10000;
}

function formatBultoWeight(value) {
  return String(Math.round(Number(value) * 10000) / 10000);
}

function FieldLabel({ icon, label }) {
  return (
    <label className="app-label flex items-center gap-2">
      <span className="text-slate-400">{icon}</span>
      <span>{label}</span>
    </label>
  );
}

export default function PedidoVacuna({
  user,
  setView,
  sucursales = [],
  productosCSV = [],
  pedidos = [],
  printerSettings = {},
}) {
  const MAX_LINEAS = 25;
  const catalogoProductos = productosCSV.length > 0 ? productosCSV : PRODUCTOS_EJEMPLO;
  const catalogoBusqueda = useMemo(
    () =>
      catalogoProductos.map((producto) => ({
        producto,
        nombreNormalizado: normalizeCatalogSearch(producto.nombre),
        claveNormalizada: normalizeCatalogSearch(producto.clave),
        nombreCompacto: compactCatalogSearch(producto.nombre),
        claveCompacta: compactCatalogSearch(producto.clave),
        tokensNombre: splitCatalogTokens(producto.nombre),
        tokensClave: splitCatalogTokens(producto.clave),
      })),
    [catalogoProductos],
  );
  const hoy = getLocalDateString();
  const userPrefix = getUserOrderPrefix(user);
  const userCounterKey = getUserCounterKey(user);

  const [items, setItems] = useState([createEmptyItem()]);
  const [destino, setDestino] = useState(getCanonicalBranchId(sucursales[0] || "Nindiri"));
  const [notaGeneral, setNotaGeneral] = useState("");
  const [notaTemporal, setNotaTemporal] = useState("");
  const [cargando, setCargando] = useState(false);
  const [counterValue, setCounterValue] = useState(0);
  const [cargandoId, setCargandoId] = useState(true);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [itemNoteModalIndex, setItemNoteModalIndex] = useState(null);
  const [itemNoteTemporal, setItemNoteTemporal] = useState("");
  const [bultosModalIndex, setBultosModalIndex] = useState(null);
  const [bultosTemporal, setBultosTemporal] = useState([]);
  const [bultoTemporal, setBultoTemporal] = useState("");
  const [bultoError, setBultoError] = useState("");

  const productInputRefs = useRef([]);
  const pesoInputRefs = useRef([]);
  const bultoInputRef = useRef(null);
  const dropdownRefs = useRef({});

  const highestBranchSequence = getHighestBranchSequence(pedidos, user);
  const nextOrderSequence = Math.min(MAX_ORDER_NUMBER, Math.max(counterValue, highestBranchSequence) + 1);
  const orderPreview = cargandoId ? "..." : buildOrderNumber(userPrefix, nextOrderSequence);

  useEffect(() => {
    if (!sucursales.includes(destino)) {
      setDestino(getCanonicalBranchId(sucursales[0] || "Nindiri"));
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
      () => {
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

  const focusPesoField = (idx) => {
    setTimeout(() => focusElement(pesoInputRefs.current[idx], { select: true }), 50);
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
    setItemNoteModalIndex((prev) => {
      if (prev === null) return null;
      if (prev === idx) return null;
      return prev > idx ? prev - 1 : prev;
    });

    setBultosModalIndex((prev) => {
      if (prev === null) return null;
      if (prev === idx) return null;
      return prev > idx ? prev - 1 : prev;
    });

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
        const textoNormalizado = normalizeCatalogSearch(value);
        const productoEncontrado = catalogoProductos.find(
          (producto) =>
            normalizeCatalogSearch(producto.nombre) === textoNormalizado ||
            normalizeCatalogSearch(producto.clave) === textoNormalizado,
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

  const handlePesoChange = (idx, value) => {
    setItems((prev) =>
      prev.map((item, itemIndex) =>
        itemIndex === idx
          ? {
              ...item,
              pesoReal: value,
              bultos: [],
            }
          : item,
      ),
    );
  };

  const cerrarSumaBultos = () => {
    setBultosModalIndex(null);
    setBultosTemporal([]);
    setBultoTemporal("");
    setBultoError("");
  };

  const abrirSumaBultos = (idx) => {
    const guardados = Array.isArray(items[idx]?.bultos)
      ? items[idx].bultos.map(parseBultoWeight).filter((peso) => peso !== null)
      : [];

    setBultosModalIndex(idx);
    setBultosTemporal(guardados);
    setBultoTemporal("");
    setBultoError("");
    setTimeout(() => focusElement(bultoInputRef.current, { select: true }), 80);
  };

  const agregarBulto = () => {
    const peso = parseBultoWeight(bultoTemporal);

    if (peso === null) {
      setBultoError("Ingresa un peso mayor que cero.");
      setTimeout(() => focusElement(bultoInputRef.current, { select: true }), 30);
      return false;
    }

    setBultosTemporal((prev) => [...prev, peso]);
    setBultoTemporal("");
    setBultoError("");
    setTimeout(() => focusElement(bultoInputRef.current), 30);
    return true;
  };

  const quitarBulto = (idx) => {
    setBultosTemporal((prev) => prev.filter((_, itemIndex) => itemIndex !== idx));
    setBultoError("");
    setTimeout(() => focusElement(bultoInputRef.current), 30);
  };

  const finalizarSumaBultos = () => {
    let pesosFinales = bultosTemporal;

    if (String(bultoTemporal).trim() !== "") {
      const ultimoPeso = parseBultoWeight(bultoTemporal);
      if (ultimoPeso === null) {
        setBultoError("Revisa el ultimo peso antes de finalizar.");
        setTimeout(() => focusElement(bultoInputRef.current, { select: true }), 30);
        return;
      }
      pesosFinales = [...pesosFinales, ultimoPeso];
    }

    if (pesosFinales.length === 0) {
      setBultoError("Agrega al menos un peso.");
      setTimeout(() => focusElement(bultoInputRef.current), 30);
      return;
    }

    const total = Math.round(pesosFinales.reduce((sum, peso) => sum + peso, 0) * 10000) / 10000;
    setItems((prev) =>
      prev.map((item, itemIndex) =>
        itemIndex === bultosModalIndex
          ? {
              ...item,
              pesoReal: formatBultoWeight(total),
              bultos: pesosFinales,
            }
          : item,
      ),
    );
    cerrarSumaBultos();
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

    focusPesoField(idx);
  };

  const filtrarProductos = (busqueda) => {
    const texto = normalizeCatalogSearch(busqueda);
    const textoCompacto = compactCatalogSearch(busqueda);
    const tokensBusqueda = splitCatalogTokens(busqueda);

    if (!texto) {
      return catalogoProductos.slice(0, 8);
    }

    return catalogoBusqueda
      .map((entry) => {
        const {
          producto,
          nombreNormalizado,
          claveNormalizada,
          nombreCompacto,
          claveCompacta,
          tokensNombre,
          tokensClave,
        } = entry;

        let prioridad = null;
        let detalle = 0;

        if (claveNormalizada === texto) prioridad = 0;
        else if (nombreNormalizado === texto) prioridad = 1;
        else if (claveNormalizada.startsWith(texto)) prioridad = 2;
        else if (nombreNormalizado.startsWith(texto)) prioridad = 3;
        else if (claveNormalizada.includes(texto)) prioridad = 4;
        else if (nombreNormalizado.includes(texto)) prioridad = 5;
        else {
          const clavePorTokens = getTokenGroupScore(tokensBusqueda, tokensClave);
          const nombrePorTokens = getTokenGroupScore(tokensBusqueda, tokensNombre);

          if (clavePorTokens !== null) {
            prioridad = 6 + clavePorTokens;
            detalle = claveNormalizada.length;
          } else if (nombrePorTokens !== null) {
            prioridad = 12 + nombrePorTokens;
            detalle = nombreNormalizado.length;
          } else if (isSubsequenceMatch(textoCompacto, claveCompacta)) {
            prioridad = 18;
            detalle = claveCompacta.length;
          } else if (isSubsequenceMatch(textoCompacto, nombreCompacto)) {
            prioridad = 19;
            detalle = nombreCompacto.length;
          }
        }

        if (prioridad === null) return null;

        return { producto, prioridad, detalle };
      })
      .filter(Boolean)
      .sort(
        (a, b) =>
          a.prioridad - b.prioridad ||
          a.detalle - b.detalle ||
          a.producto.nombre.localeCompare(b.producto.nombre),
      )
      .slice(0, 10)
      .map((entry) => entry.producto);
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

      focusPesoField(idx);
      return;
    }

    moverASiguienteLinea(idx);
  };

  const abrirNotaGeneral = () => {
    setNotaTemporal(notaGeneral);
    setShowNoteModal(true);
  };

  const abrirNotaArticulo = (idx) => {
    setItemNoteTemporal(items[idx]?.nota || "");
    setItemNoteModalIndex(idx);
  };

  const cerrarNotaArticulo = () => {
    setItemNoteModalIndex(null);
    setItemNoteTemporal("");
  };

  const guardarNotaArticulo = () => {
    if (itemNoteModalIndex === null) return;

    setItems((prev) =>
      prev.map((item, itemIndex) =>
        itemIndex === itemNoteModalIndex
          ? { ...item, nota: itemNoteTemporal.toUpperCase().trim() }
          : item,
      ),
    );

    cerrarNotaArticulo();
  };

  const guardarNotaGeneral = () => {
    setNotaGeneral(notaTemporal.toUpperCase());
    setShowNoteModal(false);
  };

  const sincronizarContabilidad = async (pedido, firebaseId, mirrorId = "") => {
    try {
      const syncResult = await syncPedidoToAccounting({ ...pedido, firebaseId }, mirrorId);
      await update(ref(db, `pedidos_internos/${firebaseId}`), {
        contabilidadSync: {
          ...syncResult,
          error: null,
        },
      });
    } catch (error) {
      console.error("Fallo la sincronizacion contable de vacuna:", error);
      await update(ref(db, `pedidos_internos/${firebaseId}`), {
        contabilidadSync: {
          status: "error",
          mirrorId,
          syncedAt: new Date().toISOString(),
          error: error.message,
        },
      });
    }
  };

  const enviarVacuna = async () => {
    const validos = items.filter((item) => item.producto.trim() !== "");
    if (validos.length === 0) {
      alert("Agrega al menos un producto para enviar.");
      return;
    }

    const incompletos = validos.some((item) => String(item.pesoReal).trim() === "");
    if (incompletos) {
      alert("Completa el peso real en todas las lineas antes de enviar.");
      return;
    }

    if (!db) {
      alert("Error: no hay conexion con la base de datos.");
      return;
    }

    setCargando(true);

    try {
      const nuevoId = await obtenerSiguienteId();
      const ahora = new Date();
      const horaActual = ahora.toLocaleTimeString("es-ES", {
        hour: "2-digit",
        minute: "2-digit",
      });
      const numeroOrden = buildOrderNumber(userPrefix, nuevoId);

      const nuevaOrden = {
        id: numeroOrden,
        numeroOrden,
        consecutivoOrden: nuevoId,
        prefijoOrden: userPrefix,
        sucursalOrigen: getCanonicalBranchId(destino),
        sucursalDestino: getCanonicalBranchId(user),
        sucursalCreadora: getCanonicalBranchId(user),
        tipoPedido: "VACUNA",
        fechaPedido: hoy,
        fechaEntrega: hoy,
        esStandby: false,
        fechaCreacion: ahora.toISOString(),
        hora: horaActual,
        items: validos.map((item) => {
          const bultos = Array.isArray(item.bultos)
            ? item.bultos.map(parseBultoWeight).filter((peso) => peso !== null)
            : [];

          return {
            clave: item.clave,
            producto: item.producto,
            cantidad: item.pesoReal,
            unidad: "lb",
            nota: item.nota,
            pesoReal: item.pesoReal,
            ...(bultos.length > 0
              ? {
                  bultos,
                  cantidadBultos: bultos.length,
                }
              : {}),
            preparadoPor: "",
            listo: true,
          };
        }),
        notaGeneral,
        estado: "ENVIADO",
        preparadoPor: "",
        enviadoCon: "VACUNA DIRECTA",
        timestampEnviado: horaActual,
        timestamp: Date.now(),
      };

      const pedidoCreadoRef = await push(ref(db, "pedidos_internos"), nuevaOrden);
      await sincronizarContabilidad(nuevaOrden, pedidoCreadoRef.key);

      if (printerSettings?.impresionAutomaticaEnvio !== false) {
        printTransferRequisition(
          {
            ...nuevaOrden,
            historyDate: nuevaOrden.fechaEntrega || nuevaOrden.fechaPedido,
            statusMeta: { label: "Enviado" },
          },
          printerSettings,
        );
      }

      setCounterValue(nuevoId);
      alert(`Pedido vacuna ${numeroOrden} enviado con exito.`);

      setItems([createEmptyItem()]);
      setNotaGeneral("");
      setNotaTemporal("");
      setShowNoteModal(false);
      cerrarNotaArticulo();
      setView("estados");
    } catch (error) {
      console.error("Fallo el envio de vacuna:", error);
      alert(`Error: ${error.message}`);
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="page-enter space-y-4">
      <section className="app-panel p-4 sm:p-5">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="app-chip border-amber-200 bg-amber-50 text-amber-700">
              {Icons.spark}
              Directo
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <FieldLabel icon={Icons.package} label="N. Pedido" />
              <div className="app-card-soft flex min-h-[54px] items-center px-4 text-lg font-black text-slate-900">
                {orderPreview}
              </div>
            </div>

            <div>
              <FieldLabel icon={Icons.send} label="Destino" />
              <select className="app-select" value={destino} onChange={(event) => setDestino(event.target.value)}>
                {sucursales.filter((sucursal) => sucursal !== user).map((sucursal) => (
                  <option key={sucursal} value={sucursal} style={{ background: "#ffffff", color: "#12324e" }}>
                    {getBranchDisplayName(sucursal)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <FieldLabel icon={Icons.calendar} label="Fecha" />
              <div className="app-card-soft flex min-h-[54px] items-center px-4 text-base font-bold text-slate-700">
                {hoy}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="app-panel p-4 sm:p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="app-title text-2xl font-black text-slate-900">Detalle</h3>
          <button
            type="button"
            onClick={() => agregarFila(true)}
            disabled={items.length >= MAX_LINEAS}
            className="app-icon-button text-emerald-600"
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
                  <div className="flex items-center gap-2">
                    <span className="app-chip border-slate-200 bg-slate-50 text-slate-700">
                      #{String(idx + 1).padStart(2, "0")}
                    </span>
                    <span className="app-chip border-amber-200 bg-amber-50 text-amber-700">LB</span>
                  </div>

                  <button type="button" onClick={() => eliminarFila(idx)} className="app-icon-button text-rose-500">
                    {Icons.trash}
                  </button>
                </div>

                <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
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
                      <div className="app-scroll-y absolute left-0 right-0 top-[calc(100%+6px)] z-30 max-h-64 rounded-[22px] border border-slate-200 bg-white p-2 shadow-[0_18px_44px_rgba(60,90,122,0.16)] backdrop-blur-xl">
                        {productosFiltrados.length === 0 ? (
                          <div className="rounded-[18px] px-4 py-5 text-center text-sm text-slate-400">
                            Sin coincidencias
                          </div>
                        ) : (
                          productosFiltrados.map((producto) => (
                            <button
                              type="button"
                              key={`${producto.clave}-${producto.nombre}`}
                              onClick={() => seleccionarProducto(idx, producto)}
                              className="mb-2 flex w-full items-start gap-3 rounded-[18px] border border-transparent bg-slate-50 px-4 py-3 text-left transition hover:border-emerald-300 hover:bg-emerald-50"
                            >
                              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black tracking-[0.16em] text-emerald-700">
                                {producto.clave}
                              </span>
                              <span className="text-sm font-semibold text-slate-800">{producto.nombre}</span>
                            </button>
                          ))
                        )}
                      </div>
                    ) : null}
                  </div>

                  <div>
                    <FieldLabel icon={Icons.scale} label="Peso real (lb)" />
                    <input
                      ref={(element) => (pesoInputRefs.current[idx] = element)}
                      type="number"
                      value={item.pesoReal}
                      onChange={(event) => handlePesoChange(idx, event.target.value)}
                      onKeyDown={(event) => handleKeyDown(event, idx, "pesoReal")}
                      onFocus={(event) => event.target.select()}
                      placeholder="0.00"
                      min="0"
                      step="0.01"
                      inputMode="decimal"
                      enterKeyHint="next"
                      className="app-input text-center text-slate-900"
                    />

                    <button
                      type="button"
                      onClick={() => abrirSumaBultos(idx)}
                      className="app-button-ghost mt-2 w-full justify-between px-4 text-sm"
                    >
                      <span className="flex items-center gap-2">
                        {Icons.scale}
                        Suma de bultos
                      </span>
                      <span className={item.bultos?.length ? "text-emerald-600" : "text-slate-400"}>
                        {item.bultos?.length ? `${item.bultos.length}` : "Abrir"}
                      </span>
                    </button>
                  </div>
                </div>

                <div className="mt-3">
                  <button
                    type="button"
                    onClick={() => abrirNotaArticulo(idx)}
                    className="app-button-ghost w-full justify-between px-4 text-sm"
                  >
                    <span className="flex items-center gap-2">
                      {Icons.note}
                      Nota
                    </span>
                    <span className={item.nota ? "text-amber-500" : "text-slate-400"}>
                      {item.nota ? "Lista" : "Abrir"}
                    </span>
                  </button>

                  {item.nota ? (
                    <div className="mt-2 rounded-[18px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
                      {item.nota}
                    </div>
                  ) : null}
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
            Nota
          </button>

          <button
            type="button"
            onClick={enviarVacuna}
            disabled={cargando || cargandoId}
            className="app-button-primary"
            style={{
              background:
                cargando || cargandoId
                  ? "linear-gradient(135deg, rgba(71,85,105,0.8) 0%, rgba(51,65,85,0.8) 100%)"
                  : "linear-gradient(135deg, #14b8a6 0%, #0f766e 100%)",
              boxShadow:
                cargando || cargandoId
                  ? "none"
                  : "0 18px 34px rgba(15,118,110,0.24)",
            }}
          >
            {cargando ? (
              <>
                {Icons.sync}
                Enviando...
              </>
            ) : (
              <>
                {Icons.send}
                Enviar vacuna
              </>
            )}
          </button>
        </div>
      </section>

      {bultosModalIndex !== null && typeof document !== "undefined"
        ? createPortal(
            <div
              className="app-modal"
              onClick={(event) => {
                if (event.target === event.currentTarget) {
                  cerrarSumaBultos();
                }
              }}
            >
          <div className="app-modal-panel w-full max-w-[560px] p-5 sm:p-6">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="app-title text-2xl font-black text-slate-900">Suma de bultos</h3>
                <p className="mt-1 text-sm font-semibold text-slate-500">
                  {items[bultosModalIndex]?.producto || `Producto ${bultosModalIndex + 1}`}
                </p>
              </div>

              <button type="button" onClick={cerrarSumaBultos} className="app-icon-button text-slate-700">
                {Icons.close}
              </button>
            </div>

            <div className="mb-4 rounded-[22px] border border-emerald-200 bg-emerald-50 px-5 py-4">
              <div className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">Peso total</div>
              <div className="mt-1 flex items-end gap-2 text-slate-900">
                <span className="font-mono text-4xl font-black">
                  {formatBultoWeight(bultosTemporal.reduce((sum, peso) => sum + peso, 0))}
                </span>
                <span className="pb-1 text-base font-black text-emerald-700">lb</span>
              </div>
              <div className="mt-1 text-sm font-semibold text-emerald-700">
                {bultosTemporal.length} {bultosTemporal.length === 1 ? "bulto" : "bultos"}
              </div>
            </div>

            <FieldLabel icon={Icons.scale} label="Peso del bulto (lb)" />
            <div className="grid grid-cols-[minmax(0,1fr)_52px] gap-2">
              <input
                ref={bultoInputRef}
                type="text"
                value={bultoTemporal}
                onChange={(event) => {
                  setBultoTemporal(event.target.value);
                  setBultoError("");
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    agregarBulto();
                  }
                }}
                onFocus={(event) => event.target.select()}
                placeholder="0.00"
                inputMode="decimal"
                enterKeyHint="done"
                className="app-input font-mono text-center text-xl font-black text-slate-900"
                autoComplete="off"
              />
              <button
                type="button"
                onClick={agregarBulto}
                className="app-button-primary min-h-[52px] px-0"
                aria-label="Agregar peso"
              >
                {Icons.plus}
              </button>
            </div>

            <p className={`mt-2 min-h-5 text-sm font-semibold ${bultoError ? "text-rose-600" : "text-slate-500"}`}>
              {bultoError || "Escribe un peso y presiona Enter."}
            </p>

            {bultosTemporal.length > 0 ? (
              <div className="app-scroll-y mt-3 max-h-56 space-y-2 overflow-y-auto pr-1">
                {[...bultosTemporal].reverse().map((peso, reverseIndex) => {
                  const originalIndex = bultosTemporal.length - 1 - reverseIndex;
                  return (
                    <div
                      key={`${originalIndex}-${peso}`}
                      className="flex items-center justify-between gap-3 rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3"
                    >
                      <span className="text-sm font-black text-slate-500">Bulto {originalIndex + 1}</span>
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-lg font-black text-slate-900">{formatBultoWeight(peso)} lb</span>
                        <button
                          type="button"
                          onClick={() => quitarBulto(originalIndex)}
                          className="app-icon-button h-9 w-9 text-rose-500"
                          aria-label={`Quitar bulto ${originalIndex + 1}`}
                        >
                          {Icons.trash}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : null}

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <button type="button" onClick={cerrarSumaBultos} className="app-button-ghost">
                Cancelar
              </button>
              <button type="button" onClick={finalizarSumaBultos} className="app-button-primary">
                Finalizar
              </button>
            </div>
              </div>
            </div>,
            document.body,
          )
        : null}

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

      {itemNoteModalIndex !== null ? (
        <div
          className="app-modal"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              cerrarNotaArticulo();
            }
          }}
        >
          <div className="app-modal-panel w-full max-w-[520px] p-5 sm:p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h3 className="app-title text-2xl font-black text-slate-900">Nota especial</h3>
                <p className="mt-1 text-sm text-slate-500">
                  {items[itemNoteModalIndex]?.producto || `Linea ${itemNoteModalIndex + 1}`}
                </p>
              </div>

              <button type="button" onClick={cerrarNotaArticulo} className="app-icon-button text-slate-700">
                {Icons.close}
              </button>
            </div>

            <textarea
              value={itemNoteTemporal}
              onChange={(event) => setItemNoteTemporal(event.target.value.toUpperCase())}
              placeholder="Escribe la nota especial"
              className="app-textarea"
              autoCorrect="off"
              autoCapitalize="characters"
            />

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <button type="button" onClick={cerrarNotaArticulo} className="app-button-ghost">
                Cerrar
              </button>
              <button type="button" onClick={guardarNotaArticulo} className="app-button-primary">
                Aceptar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
