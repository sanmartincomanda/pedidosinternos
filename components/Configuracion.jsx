"use client";

import React, { useEffect, useState } from "react";
import { db } from "../firebase";
import { off, onValue, ref, set } from "firebase/database";

const Icons = {
  settings: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1 7 17M17 7l2.1-2.1" />
    </svg>
  ),
  chef: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M7 10h10v10a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V10Z" />
      <path d="M6 10a4 4 0 1 1 2-7 4.6 4.6 0 0 1 8 2 3.5 3.5 0 1 1 1 6" />
    </svg>
  ),
  truck: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 7h11v8H3z" />
      <path d="M14 10h4l3 3v2h-7z" />
      <circle cx="7.5" cy="18" r="2" />
      <circle cx="17.5" cy="18" r="2" />
    </svg>
  ),
  plus: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
      <path d="M12 5v14M5 12h14" />
    </svg>
  ),
  trash: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 6h18M8 6V4h8v2M19 6l-1 13a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  ),
  save: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 4h12l4 4v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4Z" />
      <path d="M8 4v5h8V4M8 22v-7h8v7" />
    </svg>
  ),
  user: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20 21a8 8 0 0 0-16 0" />
      <circle cx="12" cy="8" r="4" />
    </svg>
  ),
  upload: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 3v12M7 8l5-5 5 5" />
      <path d="M5 21h14" />
    </svg>
  ),
  file: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z" />
      <path d="M14 3v6h6M8 13h8M8 17h5" />
    </svg>
  ),
  download: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 3v12M7 10l5 5 5-5" />
      <path d="M5 21h14" />
    </svg>
  ),
  table: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18M3 15h18M9 9v12M15 9v12" />
    </svg>
  ),
  cloud: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20 17.5a4.5 4.5 0 0 0-.8-8.9A6 6 0 0 0 7.3 7.1 4 4 0 0 0 6 15h14Z" />
    </svg>
  ),
  sync: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 2v6h-6M3 22v-6h6" />
      <path d="M20 8A8 8 0 0 0 6.3 5.3L3 8M4 16a8 8 0 0 0 13.7 2.7L21 16" />
    </svg>
  ),
};

function FieldLabel({ icon, label }) {
  return (
    <label className="app-label flex items-center gap-2">
      <span className="text-slate-400">{icon}</span>
      <span>{label}</span>
    </label>
  );
}

function StatCard({ label, value, helper, accent }) {
  return (
    <div
      className="app-card-soft p-4"
      style={{
        borderColor: `${accent}38`,
        background: `linear-gradient(135deg, ${accent}14 0%, rgba(255,255,255,0.98) 100%)`,
      }}
    >
      <div className="text-xs font-extrabold uppercase tracking-[0.18em] text-slate-500">{label}</div>
      <div className="mt-2 text-2xl font-black text-slate-900">{value}</div>
      {helper ? <div className="mt-1 text-sm text-slate-600">{helper}</div> : null}
    </div>
  );
}

function PersonCard({ name, accent, icon, onDelete }) {
  return (
    <div
      className="app-card-soft flex items-center justify-between gap-3 p-4"
      style={{
        borderColor: `${accent}38`,
        background: `linear-gradient(135deg, ${accent}12 0%, rgba(255,255,255,0.98) 100%)`,
      }}
    >
      <div className="flex min-w-0 items-center gap-3">
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white"
          style={{ background: `linear-gradient(135deg, ${accent} 0%, rgba(35,115,185,0.92) 100%)` }}
        >
          {icon}
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-black text-slate-900">{name}</div>
        </div>
      </div>

      <button type="button" onClick={onDelete} className="app-icon-button text-rose-200">
        {Icons.trash}
      </button>
    </div>
  );
}

export default function Configuracion({ setConfig }) {
  const [activeTab, setActiveTab] = useState("cocina");
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [mensaje, setMensaje] = useState(null);
  const [cocinaLocal, setCocinaLocal] = useState([]);
  const [transporteLocal, setTransporteLocal] = useState([]);
  const [productosCSV, setProductosCSV] = useState([]);
  const [previewCSV, setPreviewCSV] = useState([]);
  const [mostrarPreview, setMostrarPreview] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const mostrarMensaje = (type, text, duration = 3200) => {
    setMensaje({ type, text });
    if (duration > 0) {
      setTimeout(() => setMensaje(null), duration);
    }
  };

  useEffect(() => {
    const configRef = ref(db, "configuracion");

    const unsubscribe = onValue(
      configRef,
      (snapshot) => {
        const data = snapshot.val();
        if (data) {
          setCocinaLocal(data.personalCocina || []);
          setTransporteLocal(data.personalTransporte || []);
          setProductosCSV(data.productos || []);
          if (setConfig) setConfig(data);
        } else {
          setCocinaLocal([]);
          setTransporteLocal([]);
          setProductosCSV([]);
        }
      },
      (error) => {
        console.error("Error cargando configuracion:", error);
        mostrarMensaje("error", "Error al cargar configuracion desde Firebase.", 4000);
      },
    );

    return () => {
      if (typeof unsubscribe === "function") {
        unsubscribe();
      } else {
        off(configRef);
      }
    };
  }, [setConfig]);

  const guardarConfiguracion = async () => {
    setGuardando(true);

    try {
      const nuevaConfig = {
        personalCocina: cocinaLocal,
        personalTransporte: transporteLocal,
        productos: productosCSV,
        ultimaActualizacion: new Date().toISOString(),
      };

      await set(ref(db, "configuracion"), nuevaConfig);
      mostrarMensaje("success", "Configuracion guardada en Firebase.");
    } catch (error) {
      console.error("Error guardando:", error);
      mostrarMensaje("error", `No se pudo guardar: ${error.message}`, 5000);
    } finally {
      setGuardando(false);
    }
  };

  const procesarCSV = (contenido) => {
    const lineas = contenido.split("\n").filter((linea) => linea.trim() !== "");
    const productos = [];

    let inicio = 0;
    const primeraLinea = (lineas[0] || "").toUpperCase();
    if (primeraLinea.includes("CLAVE") || primeraLinea.includes("PRODUCTO") || primeraLinea.includes("NOMBRE")) {
      inicio = 1;
    }

    for (let i = inicio; i < lineas.length; i += 1) {
      const linea = lineas[i].trim();
      if (!linea) continue;

      const partes = linea.includes(";") ? linea.split(";") : linea.split(",");
      if (partes.length < 2) continue;

      const clave = partes[0].trim().toUpperCase();
      const nombre = partes[1].trim().toUpperCase();

      if (clave && nombre) {
        productos.push({ clave, nombre });
      }
    }

    return productos;
  };

  const handleFileUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".csv") && !file.name.endsWith(".txt")) {
      mostrarMensaje("error", "El archivo debe ser .csv o .txt.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      const contenido = loadEvent.target?.result;
      const productos = procesarCSV(contenido || "");

      if (productos.length === 0) {
        mostrarMensaje("error", "No se encontraron productos validos en el archivo.");
        return;
      }

      setPreviewCSV(productos);
      setMostrarPreview(true);
      mostrarMensaje("info", `${productos.length} productos listos para importar.`);
    };
    reader.readAsText(file);
  };

  const confirmarImportacion = () => {
    const clavesExistentes = new Set(productosCSV.map((producto) => producto.clave));
    const nuevosProductos = previewCSV.filter((producto) => !clavesExistentes.has(producto.clave));
    const actualizados = previewCSV.filter((producto) => clavesExistentes.has(producto.clave));

    const productosCombinados = [
      ...productosCSV.map((producto) => actualizados.find((item) => item.clave === producto.clave) || producto),
      ...nuevosProductos,
    ].sort((a, b) => a.nombre.localeCompare(b.nombre));

    setProductosCSV(productosCombinados);
    setMostrarPreview(false);
    setPreviewCSV([]);

    if (nuevosProductos.length > 0 || actualizados.length > 0) {
      mostrarMensaje(
        "success",
        `Importacion completada: ${nuevosProductos.length} nuevos y ${actualizados.length} actualizados.`,
        4000,
      );
    } else {
      mostrarMensaje("info", "No hubo cambios porque todos los productos ya existian.", 4000);
    }
  };

  const cancelarImportacion = () => {
    setMostrarPreview(false);
    setPreviewCSV([]);
  };

  const descargarPlantilla = () => {
    const contenido = "CLAVE,PRODUCTO\nBIS-001,BISTEC DE RES\nBIS-002,BISTEC DE CERDO\nPOL-001,POLLO ENTERO\n";
    const blob = new Blob([contenido], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "plantilla_productos.csv";
    link.click();
    window.URL.revokeObjectURL(url);
  };

  const eliminarProducto = (index) => {
    setProductosCSV((prev) => prev.filter((_, itemIndex) => itemIndex !== index));
  };

  const handleDrag = (event) => {
    event.preventDefault();
    event.stopPropagation();

    if (event.type === "dragenter" || event.type === "dragover") {
      setDragActive(true);
    } else if (event.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(false);

    if (event.dataTransfer.files && event.dataTransfer.files[0]) {
      handleFileUpload({ target: { files: [event.dataTransfer.files[0]] } });
    }
  };

  const agregarPersona = (tipo) => {
    const nombre = nuevoNombre.trim();
    if (!nombre) return;

    if (tipo === "cocina") {
      if (cocinaLocal.includes(nombre)) {
        mostrarMensaje("error", "Esa persona ya existe en cocina.");
        return;
      }
      setCocinaLocal((prev) => [...prev, nombre]);
    } else {
      if (transporteLocal.includes(nombre)) {
        mostrarMensaje("error", "Esa persona ya existe en transporte.");
        return;
      }
      setTransporteLocal((prev) => [...prev, nombre]);
    }

    setNuevoNombre("");
  };

  const eliminarPersona = (tipo, index) => {
    if (tipo === "cocina") {
      setCocinaLocal((prev) => prev.filter((_, itemIndex) => itemIndex !== index));
    } else {
      setTransporteLocal((prev) => prev.filter((_, itemIndex) => itemIndex !== index));
    }
  };

  const handleKeyDown = (event, tipo) => {
    if (event.key === "Enter") {
      event.preventDefault();
      agregarPersona(tipo);
    }
  };

  const messageStyles =
    mensaje?.type === "success"
      ? "border-emerald-400/35 bg-emerald-400/12 text-emerald-100"
      : mensaje?.type === "error"
        ? "border-rose-400/35 bg-rose-500/12 text-rose-100"
        : "border-sky-400/30 bg-sky-400/12 text-sky-100";

  return (
    <div className="page-enter space-y-5">
      <section className="app-panel p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="app-chip mb-3 border-sky-200 bg-sky-50 text-sky-800">
              {Icons.settings}
              Panel administrativo
            </div>
            <h2 className="app-title text-3xl font-black text-slate-900">Configuracion lista para usar en movil</h2>
            <p className="mt-2 max-w-2xl text-sm text-slate-600 sm:text-base">
              Administra personal y catalogo con bloques mas comodos, manteniendo sincronizacion en tiempo real con Firebase.
            </p>
          </div>

          <button type="button" onClick={guardarConfiguracion} disabled={guardando} className="app-button-primary whitespace-nowrap sm:w-auto">
            {guardando ? Icons.sync : Icons.cloud}
            {guardando ? "Guardando..." : "Guardar en Firebase"}
          </button>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Cocina" value={cocinaLocal.length} helper="Personas registradas" accent="#fb923c" />
          <StatCard label="Transporte" value={transporteLocal.length} helper="Repartidores activos" accent="#818cf8" />
          <StatCard label="Catalogo" value={productosCSV.length} helper="Productos cargados" accent="#38bdf8" />
          <StatCard label="Estado" value={guardando ? "Sync" : "Listo"} helper="Firebase conectado" accent="#22c55e" />
        </div>

        {mensaje ? (
          <div className={`mt-5 rounded-[22px] border px-4 py-4 text-sm font-semibold ${messageStyles}`}>{mensaje.text}</div>
        ) : null}
      </section>

      <section className="app-panel p-3 sm:p-4">
        <div className="app-tab-row">
          {[
            { key: "cocina", label: "Cocina", icon: Icons.chef, color: "#fb923c" },
            { key: "transporte", label: "Transporte", icon: Icons.truck, color: "#818cf8" },
            { key: "productos", label: "Catalogo", icon: Icons.table, color: "#38bdf8" },
          ].map((tab) => (
            <button
              type="button"
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className="app-chip min-h-[50px] whitespace-nowrap px-4 transition-all"
              style={{
                borderColor: activeTab === tab.key ? `${tab.color}40` : "rgba(148,163,184,0.18)",
                background: activeTab === tab.key ? `${tab.color}14` : "rgba(247,251,255,0.98)",
                color: activeTab === tab.key ? "#12324e" : "#55718d",
              }}
            >
              <span style={{ color: tab.color }}>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>
      </section>

      {activeTab === "cocina" ? (
        <section className="app-panel space-y-5 p-5 sm:p-6">
          <div>
            <h3 className="app-title text-2xl font-black text-slate-900">Personal de cocina</h3>
            <p className="mt-1 text-sm text-slate-600">Quienes pueden tomar un pedido y pasarlo a preparacion.</p>
          </div>

          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
            <div>
              <FieldLabel icon={Icons.user} label="Nombre del preparador" />
              <input
                type="text"
                value={nuevoNombre}
                onChange={(event) => setNuevoNombre(event.target.value)}
                onKeyDown={(event) => handleKeyDown(event, "cocina")}
                placeholder="Ej. Juan Perez"
                className="app-input"
              />
            </div>

            <div className="flex items-end">
              <button type="button" onClick={() => agregarPersona("cocina")} className="app-button-secondary sm:w-auto">
                {Icons.plus}
                Agregar
              </button>
            </div>
          </div>

          {cocinaLocal.length === 0 ? (
            <div className="app-empty px-4 py-10 text-center text-sm">Todavia no hay personal de cocina registrado.</div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {cocinaLocal.map((nombre, index) => (
                <PersonCard
                  key={nombre}
                  name={nombre}
                  accent="#fb923c"
                  icon={Icons.chef}
                  onDelete={() => eliminarPersona("cocina", index)}
                />
              ))}
            </div>
          )}
        </section>
      ) : null}

      {activeTab === "transporte" ? (
        <section className="app-panel space-y-5 p-5 sm:p-6">
          <div>
            <h3 className="app-title text-2xl font-black text-slate-900">Personal de transporte</h3>
            <p className="mt-1 text-sm text-slate-600">Quienes pueden despachar y mover pedidos entre sucursales.</p>
          </div>

          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
            <div>
              <FieldLabel icon={Icons.user} label="Nombre del repartidor" />
              <input
                type="text"
                value={nuevoNombre}
                onChange={(event) => setNuevoNombre(event.target.value)}
                onKeyDown={(event) => handleKeyDown(event, "transporte")}
                placeholder="Ej. Carlos Lopez"
                className="app-input"
              />
            </div>

            <div className="flex items-end">
              <button type="button" onClick={() => agregarPersona("transporte")} className="app-button-secondary sm:w-auto">
                {Icons.plus}
                Agregar
              </button>
            </div>
          </div>

          {transporteLocal.length === 0 ? (
            <div className="app-empty px-4 py-10 text-center text-sm">Todavia no hay personal de transporte registrado.</div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {transporteLocal.map((nombre, index) => (
                <PersonCard
                  key={nombre}
                  name={nombre}
                  accent="#818cf8"
                  icon={Icons.truck}
                  onDelete={() => eliminarPersona("transporte", index)}
                />
              ))}
            </div>
          )}
        </section>
      ) : null}

      {activeTab === "productos" ? (
        <section className="app-panel space-y-5 p-5 sm:p-6">
          <div>
            <h3 className="app-title text-2xl font-black text-slate-900">Catalogo de productos</h3>
            <p className="mt-1 text-sm text-slate-600">Importa claves y nombres desde CSV o administra el listado actual desde el telefono.</p>
          </div>

          {!mostrarPreview ? (
            <>
              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                className="rounded-[28px] border-2 border-dashed p-6 text-center transition-all sm:p-8"
                style={{
                  borderColor: dragActive ? "rgba(56,189,248,0.68)" : "rgba(148,163,184,0.26)",
                  background: dragActive ? "rgba(56,189,248,0.10)" : "rgba(247,251,255,0.98)",
                }}
              >
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[22px] bg-sky-100 text-sky-700">
                  {Icons.upload}
                </div>
                <h4 className="mt-4 text-xl font-black text-slate-900">Arrastra el archivo aqui</h4>
                <p className="mt-2 text-sm text-slate-600">Acepta .csv y .txt con formato CLAVE,PRODUCTO.</p>

                <input id="csv-upload" type="file" accept=".csv,.txt" onChange={handleFileUpload} className="hidden" />
                <label htmlFor="csv-upload" className="app-button-primary mt-5 inline-flex sm:w-auto">
                  {Icons.file}
                  Seleccionar archivo
                </label>
              </div>

              <button type="button" onClick={descargarPlantilla} className="app-button-ghost sm:w-auto">
                {Icons.download}
                Descargar plantilla
              </button>

              {productosCSV.length === 0 ? (
                <div className="app-empty px-4 py-10 text-center text-sm">
                  No hay productos cargados. Importa un archivo para comenzar.
                </div>
              ) : (
                <div className="space-y-3">
                  {productosCSV.map((producto, index) => (
                    <div key={`${producto.clave}-${index}`} className="app-card-soft flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="app-chip mb-2 w-fit border-sky-200 bg-sky-50 text-sky-700">{producto.clave}</div>
                        <div className="truncate text-base font-black text-slate-900">{producto.nombre}</div>
                      </div>

                      <button type="button" onClick={() => eliminarProducto(index)} className="app-icon-button text-rose-200">
                        {Icons.trash}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="space-y-5">
              <div className="rounded-[24px] border border-amber-200 bg-amber-50 p-4">
                <div className="text-sm font-black uppercase tracking-[0.16em] text-amber-700">Vista previa</div>
                <div className="mt-2 text-base text-amber-900">
                  {previewCSV.length} productos listos para entrar al catalogo.
                </div>
              </div>

              <div className="space-y-3">
                {previewCSV.map((producto) => (
                  <div key={`${producto.clave}-${producto.nombre}`} className="app-card-soft flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="app-chip mb-2 w-fit border-amber-200 bg-amber-50 text-amber-800">{producto.clave}</div>
                      <div className="text-base font-black text-slate-900">{producto.nombre}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <button type="button" onClick={cancelarImportacion} className="app-button-ghost">
                  Cancelar
                </button>
                <button type="button" onClick={confirmarImportacion} className="app-button-primary">
                  {Icons.save}
                  Confirmar importacion
                </button>
              </div>
            </div>
          )}
        </section>
      ) : null}

      <section className="rounded-[26px] border border-sky-400/24 bg-sky-400/10 p-5 text-sm text-sky-100">
        <div className="mb-2 font-black uppercase tracking-[0.16em] text-sky-200">Notas operativas</div>
        <p className="leading-6">
          Los cambios se reflejan en Firebase para todos los usuarios. El archivo CSV debe venir como CLAVE,PRODUCTO;
          por ejemplo: <span className="font-black">BIS-001,BISTEC DE RES</span>.
        </p>
      </section>
    </div>
  );
}
