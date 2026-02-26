"use client";
import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { ref, set, onValue, off } from "firebase/database";

// Iconos SVG
const Icons = {
  settings: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/></svg>,
  chef: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 4h12M6 4v16a2 2 0 002 2h8a2 2 0 002-2V4M6 4L4 2m16 2l2-2M12 14v6m-4-4l4 4 4-4"/></svg>,
  truck: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>,
  plus: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  trash: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>,
  save: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>,
  user: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  upload: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>,
  file: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>,
  download: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
  table: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="9" x2="9" y2="21"/><line x1="15" y1="9" x2="15" y2="21"/></svg>,
  cloud: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 10h-1.26A8 8 0 109 20h9a5 5 0 000-10z"/></svg>,
  sync: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>
};

export default function Configuracion({ config, setConfig }) {
  const [activeTab, setActiveTab] = useState('cocina');
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [cocinaLocal, setCocinaLocal] = useState([]);
  const [transporteLocal, setTransporteLocal] = useState([]);
  const [productosCSV, setProductosCSV] = useState([]);
  const [previewCSV, setPreviewCSV] = useState([]);
  const [mostrarPreview, setMostrarPreview] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [guardando, setGuardando] = useState(false);

  // Cargar configuración desde Firebase al montar
  useEffect(() => {
    const configRef = ref(db, 'configuracion');
    
    const unsubscribe = onValue(configRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setCocinaLocal(data.personalCocina || []);
        setTransporteLocal(data.personalTransporte || []);
        setProductosCSV(data.productos || []);
        
        // Actualizar también el prop config si existe
        if (setConfig) {
          setConfig(data);
        }
      } else {
        // Si no hay datos en Firebase, inicializar vacío
        setCocinaLocal([]);
        setTransporteLocal([]);
        setProductosCSV([]);
      }
    }, (error) => {
      console.error("Error cargando configuración:", error);
      setMensaje('⚠️ Error al cargar configuración de Firebase');
      setTimeout(() => setMensaje(''), 3000);
    });

    return () => off(configRef, 'value', unsubscribe);
  }, [setConfig]);

  // Guardar configuración en Firebase
  const guardarConfiguracion = async () => {
    setGuardando(true);
    
    try {
      const nuevaConfig = {
        personalCocina: cocinaLocal,
        personalTransporte: transporteLocal,
        productos: productosCSV,
        ultimaActualizacion: new Date().toISOString()
      };
      
      // Guardar en Firebase
      await set(ref(db, 'configuracion'), nuevaConfig);
      
      setMensaje('✅ Configuración guardada en Firebase');
      setTimeout(() => setMensaje(''), 3000);
    } catch (error) {
      console.error("Error guardando:", error);
      setMensaje('❌ Error al guardar: ' + error.message);
      setTimeout(() => setMensaje(''), 5000);
    } finally {
      setGuardando(false);
    }
  };

  // ========== FUNCIONES CSV DE PRODUCTOS ==========

  const procesarCSV = (contenido) => {
    const lineas = contenido.split('\n').filter(l => l.trim() !== '');
    const productos = [];
    
    let inicio = 0;
    const primeraLinea = lineas[0].toUpperCase();
    if (primeraLinea.includes('CLAVE') || primeraLinea.includes('PRODUCTO') || primeraLinea.includes('NOMBRE')) {
      inicio = 1;
    }
    
    for (let i = inicio; i < lineas.length; i++) {
      const linea = lineas[i].trim();
      if (!linea) continue;
      
      const partes = linea.includes(';') ? linea.split(';') : linea.split(',');
      
      if (partes.length >= 2) {
        const clave = partes[0].trim().toUpperCase();
        const nombre = partes[1].trim().toUpperCase();
        
        if (clave && nombre) {
          productos.push({ clave, nombre });
        }
      }
    }
    
    return productos;
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    if (!file.name.endsWith('.csv') && !file.name.endsWith('.txt')) {
      setMensaje('⚠️ El archivo debe ser .csv o .txt');
      setTimeout(() => setMensaje(''), 3000);
      return;
    }
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const contenido = event.target.result;
      const productos = procesarCSV(contenido);
      
      if (productos.length === 0) {
        setMensaje('⚠️ No se encontraron productos válidos en el archivo');
        setTimeout(() => setMensaje(''), 3000);
        return;
      }
      
      setPreviewCSV(productos);
      setMostrarPreview(true);
      setMensaje(`📄 Archivo cargado: ${productos.length} productos encontrados`);
    };
    reader.readAsText(file);
  };

  const confirmarImportacion = () => {
    const clavesExistentes = new Set(productosCSV.map(p => p.clave));
    const nuevosProductos = previewCSV.filter(p => !clavesExistentes.has(p.clave));
    const actualizados = previewCSV.filter(p => clavesExistentes.has(p.clave));
    
    const productosCombinados = [
      ...productosCSV.map(p => {
        const actualizado = actualizados.find(a => a.clave === p.clave);
        return actualizado || p;
      }),
      ...nuevosProductos
    ].sort((a, b) => a.nombre.localeCompare(b.nombre));
    
    setProductosCSV(productosCombinados);
    setMostrarPreview(false);
    setPreviewCSV([]);
    
    const msg = nuevosProductos.length > 0 || actualizados.length > 0
      ? `✅ Importados: ${nuevosProductos.length} nuevos, ${actualizados.length} actualizados`
      : 'ℹ️ No hay cambios (todos los productos ya existían)';
    
    setMensaje(msg);
    setTimeout(() => setMensaje(''), 4000);
  };

  const cancelarImportacion = () => {
    setMostrarPreview(false);
    setPreviewCSV([]);
  };

  const descargarPlantilla = () => {
    const contenido = 'CLAVE,PRODUCTO\nBIS-001,BISTEC DE RES\nBIS-002,BISTEC DE CERDO\nPOL-001,POLLO ENTERO\n';
    const blob = new Blob([contenido], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'plantilla_productos.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const eliminarProducto = (index) => {
    setProductosCSV(productosCSV.filter((_, i) => i !== index));
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      const input = { target: { files: [file] } };
      handleFileUpload(input);
    }
  };

  // ========== FUNCIONES PERSONAL ==========

  const agregarPersona = (tipo) => {
    if (!nuevoNombre.trim()) return;
    
    const nombreFormateado = nuevoNombre.trim();
    
    if (tipo === 'cocina') {
      if (cocinaLocal.includes(nombreFormateado)) {
        setMensaje('⚠️ Esta persona ya existe en cocina');
        setTimeout(() => setMensaje(''), 3000);
        return;
      }
      setCocinaLocal([...cocinaLocal, nombreFormateado]);
    } else {
      if (transporteLocal.includes(nombreFormateado)) {
        setMensaje('⚠️ Esta persona ya existe en transporte');
        setTimeout(() => setMensaje(''), 3000);
        return;
      }
      setTransporteLocal([...transporteLocal, nombreFormateado]);
    }
    
    setNuevoNombre('');
    setMensaje('');
  };

  const eliminarPersona = (tipo, index) => {
    if (tipo === 'cocina') {
      setCocinaLocal(cocinaLocal.filter((_, i) => i !== index));
    } else {
      setTransporteLocal(transporteLocal.filter((_, i) => i !== index));
    }
  };

  const handleKeyDown = (e, tipo) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      agregarPersona(tipo);
    }
  };

  return (
    <div style={{ animation: 'slideIn 0.4s ease-out' }}>
      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .card-enter { animation: slideIn 0.4s ease-out forwards; }
        .fade-in { animation: fadeIn 0.3s ease-out; }
        .btn-hover { transition: all 0.2s ease; }
        .btn-hover:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(0,0,0,0.2); }
        .drag-active { border-color: #3b82f6 !important; background: rgba(59, 130, 246, 0.1) !important; }
        .spin { animation: spin 1s linear infinite; }
      `}</style>

      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '24px',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, #64748b 0%, #475569 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 10px 25px rgba(100, 116, 139, 0.4)',
            color: 'white'
          }}>
            {Icons.settings}
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 800, color: 'white' }}>
              Configuración
            </h1>
            <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>
              Gestión de personal y catálogo de productos • Firebase
            </p>
          </div>
        </div>

        <button
          onClick={guardarConfiguracion}
          disabled={guardando}
          className="btn-hover"
          style={{
            padding: '14px 24px',
            borderRadius: '12px',
            border: 'none',
            background: guardando ? '#9ca3af' : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            color: 'white',
            fontWeight: 800,
            fontSize: '14px',
            cursor: guardando ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: guardando ? 'none' : '0 8px 20px rgba(16, 185, 129, 0.4)',
            opacity: guardando ? 0.7 : 1
          }}
        >
          {guardando ? (
            <>
              <span className="spin">{Icons.sync}</span>
              Guardando...
            </>
          ) : (
            <>
              {Icons.cloud}
              Guardar en Firebase
            </>
          )}
        </button>
      </div>

      {/* Mensaje */}
      {mensaje && (
        <div className="fade-in" style={{
          padding: '16px 20px',
          borderRadius: '12px',
          marginBottom: '20px',
          background: mensaje.includes('✅') ? 'rgba(16, 185, 129, 0.2)' : 
                       mensaje.includes('⚠️') || mensaje.includes('❌') ? 'rgba(239, 68, 68, 0.2)' : 
                       'rgba(59, 130, 246, 0.2)',
          border: `1px solid ${mensaje.includes('✅') ? 'rgba(16, 185, 129, 0.4)' : 
                               mensaje.includes('⚠️') || mensaje.includes('❌') ? 'rgba(239, 68, 68, 0.4)' : 
                               'rgba(59, 130, 246, 0.4)'}`,
          color: mensaje.includes('✅') ? '#34d399' : 
                 mensaje.includes('⚠️') || mensaje.includes('❌') ? '#f87171' : '#60a5fa',
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          {mensaje}
        </div>
      )}

      {/* Tabs */}
      <div style={{
        display: 'flex',
        gap: '8px',
        marginBottom: '24px'
      }}>
        {[
          { key: 'cocina', label: 'Cocina', icon: Icons.chef, color: '#f97316' },
          { key: 'transporte', label: 'Transporte', icon: Icons.truck, color: '#6366f1' },
          { key: 'productos', label: 'Catálogo Productos', icon: Icons.table, color: '#3b82f6' }
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              flex: 1,
              padding: '16px 20px',
              borderRadius: '12px',
              border: 'none',
              background: activeTab === tab.key 
                ? `linear-gradient(135deg, ${tab.color} 0%, ${tab.color}dd 100%)` 
                : 'rgba(255,255,255,0.05)',
              color: activeTab === tab.key ? 'white' : 'rgba(255,255,255,0.6)',
              fontWeight: 700,
              fontSize: '14px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              transition: 'all 0.2s',
              boxShadow: activeTab === tab.key ? `0 8px 20px ${tab.color}40` : 'none'
            }}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* CONTENIDO: COCINA */}
      {activeTab === 'cocina' && (
        <div className="card-enter" style={{
          background: 'rgba(255,255,255,0.05)',
          borderRadius: '24px',
          padding: '32px',
          border: '1px solid rgba(255,255,255,0.1)'
        }}>
          <h2 style={{
            margin: '0 0 8px 0',
            fontSize: '20px',
            fontWeight: 800,
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <span style={{ color: '#f97316' }}>{Icons.chef}</span>
            Personal de Cocina
          </h2>
          <p style={{ margin: '0 0 24px 0', fontSize: '14px', color: 'rgba(255,255,255,0.5)' }}>
            Gestiona quién puede preparar pedidos • {cocinaLocal.length} personas registradas
          </p>

          <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <div style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }}>
                {Icons.user}
              </div>
              <input
                type="text"
                value={nuevoNombre}
                onChange={(e) => setNuevoNombre(e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, 'cocina')}
                placeholder="Nombre del preparador..."
                style={{
                  width: '100%',
                  padding: '14px 16px 14px 48px',
                  background: 'rgba(255,255,255,0.1)',
                  border: '2px solid rgba(255,255,255,0.2)',
                  borderRadius: '12px',
                  color: 'white',
                  fontSize: '15px',
                  fontWeight: 600
                }}
              />
            </div>
            <button
              onClick={() => agregarPersona('cocina')}
              className="btn-hover"
              style={{
                padding: '14px 24px',
                borderRadius: '12px',
                border: 'none',
                background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
                color: 'white',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              {Icons.plus}
              Agregar
            </button>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
            gap: '12px'
          }}>
            {cocinaLocal.map((nombre, index) => (
              <div key={index} style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px 20px',
                background: 'rgba(249, 115, 22, 0.1)',
                borderRadius: '12px',
                border: '2px solid rgba(249, 115, 22, 0.2)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontWeight: 700, color: '#fdba74', fontSize: '15px' }}>
                  <span style={{ fontSize: '24px' }}>👨‍🍳</span>
                  {nombre}
                </div>
                <button
                  onClick={() => eliminarPersona('cocina', index)}
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '10px',
                    border: 'none',
                    background: 'rgba(239, 68, 68, 0.2)',
                    color: '#ef4444',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  {Icons.trash}
                </button>
              </div>
            ))}
          </div>

          {cocinaLocal.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px', color: 'rgba(255,255,255,0.4)', fontStyle: 'italic' }}>
              No hay personal de cocina registrado
            </div>
          )}
        </div>
      )}

      {/* CONTENIDO: TRANSPORTE */}
      {activeTab === 'transporte' && (
        <div className="card-enter" style={{
          background: 'rgba(255,255,255,0.05)',
          borderRadius: '24px',
          padding: '32px',
          border: '1px solid rgba(255,255,255,0.1)'
        }}>
          <h2 style={{
            margin: '0 0 8px 0',
            fontSize: '20px',
            fontWeight: 800,
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <span style={{ color: '#6366f1' }}>{Icons.truck}</span>
            Personal de Transporte
          </h2>
          <p style={{ margin: '0 0 24px 0', fontSize: '14px', color: 'rgba(255,255,255,0.5)' }}>
            Gestiona quién puede transportar pedidos • {transporteLocal.length} personas registradas
          </p>

          <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <div style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }}>
                {Icons.user}
              </div>
              <input
                type="text"
                value={nuevoNombre}
                onChange={(e) => setNuevoNombre(e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, 'transporte')}
                placeholder="Nombre del transportista..."
                style={{
                  width: '100%',
                  padding: '14px 16px 14px 48px',
                  background: 'rgba(255,255,255,0.1)',
                  border: '2px solid rgba(255,255,255,0.2)',
                  borderRadius: '12px',
                  color: 'white',
                  fontSize: '15px',
                  fontWeight: 600
                }}
              />
            </div>
            <button
              onClick={() => agregarPersona('transporte')}
              className="btn-hover"
              style={{
                padding: '14px 24px',
                borderRadius: '12px',
                border: 'none',
                background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                color: 'white',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              {Icons.plus}
              Agregar
            </button>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
            gap: '12px'
          }}>
            {transporteLocal.map((nombre, index) => (
              <div key={index} style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px 20px',
                background: 'rgba(99, 102, 241, 0.1)',
                borderRadius: '12px',
                border: '2px solid rgba(99, 102, 241, 0.2)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontWeight: 700, color: '#a5b4fc', fontSize: '15px' }}>
                  <span style={{ fontSize: '24px' }}>🛵</span>
                  {nombre}
                </div>
                <button
                  onClick={() => eliminarPersona('transporte', index)}
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '10px',
                    border: 'none',
                    background: 'rgba(239, 68, 68, 0.2)',
                    color: '#ef4444',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  {Icons.trash}
                </button>
              </div>
            ))}
          </div>

          {transporteLocal.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px', color: 'rgba(255,255,255,0.4)', fontStyle: 'italic' }}>
              No hay personal de transporte registrado
            </div>
          )}
        </div>
      )}

      {/* CONTENIDO: PRODUCTOS (CSV) */}
      {activeTab === 'productos' && (
        <div className="card-enter" style={{
          background: 'rgba(255,255,255,0.05)',
          borderRadius: '24px',
          padding: '32px',
          border: '1px solid rgba(255,255,255,0.1)'
        }}>
          <h2 style={{
            margin: '0 0 8px 0',
            fontSize: '20px',
            fontWeight: 800,
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <span style={{ color: '#3b82f6' }}>{Icons.table}</span>
            Catálogo de Productos
          </h2>
          <p style={{ margin: '0 0 24px 0', fontSize: '14px', color: 'rgba(255,255,255,0.5)' }}>
            Importa productos masivamente desde CSV (Clave, Producto) • {productosCSV.length} productos
          </p>

          {/* Área de carga de archivo */}
          {!mostrarPreview && (
            <>
              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                style={{
                  border: `2px dashed ${dragActive ? '#3b82f6' : 'rgba(255,255,255,0.3)'}`,
                  borderRadius: '16px',
                  padding: '40px',
                  textAlign: 'center',
                  background: dragActive ? 'rgba(59, 130, 246, 0.1)' : 'rgba(255,255,255,0.02)',
                  transition: 'all 0.2s',
                  marginBottom: '24px'
                }}
              >
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>📁</div>
                <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: 700, color: 'white' }}>
                  Arrastra tu archivo CSV aquí
                </h3>
                <p style={{ margin: '0 0 20px 0', fontSize: '14px', color: 'rgba(255,255,255,0.5)' }}>
                  o haz clic para seleccionar archivo
                </p>
                <input
                  type="file"
                  accept=".csv,.txt"
                  onChange={handleFileUpload}
                  style={{ display: 'none' }}
                  id="csv-upload"
                />
                <label
                  htmlFor="csv-upload"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '14px 28px',
                    borderRadius: '12px',
                    background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                    color: 'white',
                    fontWeight: 800,
                    fontSize: '14px',
                    cursor: 'pointer',
                    boxShadow: '0 8px 20px rgba(59, 130, 246, 0.4)'
                  }}
                >
                  {Icons.upload}
                  Seleccionar Archivo
                </label>
              </div>

              {/* Botón descargar plantilla */}
              <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                <button
                  onClick={descargarPlantilla}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '12px 20px',
                    borderRadius: '10px',
                    border: '1px solid rgba(255,255,255,0.2)',
                    background: 'transparent',
                    color: 'rgba(255,255,255,0.7)',
                    fontWeight: 600,
                    fontSize: '13px',
                    cursor: 'pointer'
                  }}
                >
                  {Icons.download}
                  Descargar plantilla CSV
                </button>
              </div>

              {/* Lista actual de productos */}
              <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: 700, color: 'white' }}>
                Productos en catálogo: {productosCSV.length}
              </h3>

              {productosCSV.length > 0 ? (
                <div style={{
                  maxHeight: '300px',
                  overflowY: 'auto',
                  background: 'rgba(0,0,0,0.2)',
                  borderRadius: '12px',
                  border: '1px solid rgba(255,255,255,0.1)'
                }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead style={{ position: 'sticky', top: 0, background: 'rgba(59, 130, 246, 0.2)' }}>
                      <tr>
                        <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 800, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase' }}>Clave</th>
                        <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 800, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase' }}>Producto</th>
                        <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '11px', fontWeight: 800, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', width: '60px' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {productosCSV.map((prod, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                          <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 700, color: '#60a5fa' }}>{prod.clave}</td>
                          <td style={{ padding: '12px 16px', fontSize: '14px', fontWeight: 600, color: 'white' }}>{prod.nombre}</td>
                          <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                            <button
                              onClick={() => eliminarProducto(idx)}
                              style={{
                                width: '28px',
                                height: '28px',
                                borderRadius: '6px',
                                border: 'none',
                                background: 'rgba(239, 68, 68, 0.2)',
                                color: '#ef4444',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                            >
                              {Icons.trash}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '40px', color: 'rgba(255,255,255,0.4)', fontStyle: 'italic' }}>
                  No hay productos en el catálogo. Importa un CSV para comenzar.
                </div>
              )}
            </>
          )}

          {/* Preview de importación */}
          {mostrarPreview && (
            <div className="fade-in">
              <div style={{
                background: 'rgba(245, 158, 11, 0.1)',
                borderRadius: '12px',
                padding: '16px 20px',
                marginBottom: '20px',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 800, color: '#fbbf24', marginBottom: '4px' }}>
                    📋 Vista previa de importación
                  </div>
                  <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)' }}>
                    {previewCSV.length} productos listos para importar
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button
                    onClick={cancelarImportacion}
                    style={{
                      padding: '12px 20px',
                      borderRadius: '10px',
                      border: '1px solid rgba(255,255,255,0.2)',
                      background: 'transparent',
                      color: 'rgba(255,255,255,0.7)',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={confirmarImportacion}
                    className="btn-hover"
                    style={{
                      padding: '12px 24px',
                      borderRadius: '10px',
                      border: 'none',
                      background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                      color: 'white',
                      fontWeight: 800,
                      cursor: 'pointer',
                      boxShadow: '0 8px 20px rgba(16, 185, 129, 0.4)'
                    }}
                  >
                    {Icons.save}
                    Confirmar Importación
                  </button>
                </div>
              </div>

              <div style={{
                maxHeight: '400px',
                overflowY: 'auto',
                background: 'rgba(0,0,0,0.2)',
                borderRadius: '12px',
                border: '1px solid rgba(255,255,255,0.1)'
              }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead style={{ position: 'sticky', top: 0, background: 'rgba(245, 158, 11, 0.2)' }}>
                    <tr>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 800, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase' }}>Clave</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 800, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase' }}>Producto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewCSV.map((prod, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 700, color: '#fbbf24' }}>{prod.clave}</td>
                        <td style={{ padding: '12px 16px', fontSize: '14px', fontWeight: 600, color: 'white' }}>{prod.nombre}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Info adicional */}
      <div style={{
        marginTop: '24px',
        padding: '20px',
        background: 'rgba(59, 130, 246, 0.1)',
        borderRadius: '12px',
        border: '1px solid rgba(59, 130, 246, 0.2)',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px'
      }}>
        <span style={{ fontSize: '20px' }}>💡</span>
        <div>
          <div style={{ fontSize: '14px', fontWeight: 700, color: '#93c5fd', marginBottom: '4px' }}>
            Sincronización con Firebase
          </div>
          <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)' }}>
            Los datos se guardan automáticamente en Firebase Realtime Database. 
            Todos los usuarios verán los cambios en tiempo real. 
            El CSV debe tener formato: CLAVE,PRODUCTO (ej: BIS-001,BISTEC DE RES).
          </div>
        </div>
      </div>
    </div>
  );
}