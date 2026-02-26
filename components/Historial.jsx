"use client";
import React, { useState, useMemo, useEffect } from 'react';
import { db } from '../firebase';
import { ref, onValue } from "firebase/database";

// Iconos SVG
const Icons = {
  calendar: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  inbox: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z"/></svg>,
  send: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>,
  trendUp: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>,
  trendDown: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/></svg>,
  package: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>,
  scale: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>,
  check: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6L9 17l-5-5"/></svg>,
  clock: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>,
  download: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
  fileText: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>,
  truck: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>,
  filter: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
};

// Configuración de estados
const STATUS_COLORS = {
  'NUEVO': '#3b82f6',
  'STANDBY_ENTREGA': '#f59e0b',
  'PREPARACION': '#f97316',
  'LISTO': '#10b981',
  'ENVIADO': '#6366f1',
  'RECIBIDO_CONFORME': '#059669',
  'ENTREGADO': '#059669'
};

export default function Historial({ user, pedidos }) {
  const [fechaSeleccionada, setFechaSeleccionada] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [vista, setVista] = useState('ambos');
  const [mostrarConsolidado, setMostrarConsolidado] = useState(false);
  
  // 🆕 Filtro de sucursal para el consolidado
  const [sucursalFiltro, setSucursalFiltro] = useState('todas');
  
  // Catálogo de productos
  const [catalogoProductos, setCatalogoProductos] = useState({});
  const [cargandoCatalogo, setCargandoCatalogo] = useState(true);

  // Cargar catálogo
  useEffect(() => {
    const configRef = ref(db, 'configuracion/productos');
    
    const unsubscribe = onValue(configRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const mapaClaves = {};
        
        Object.entries(data).forEach(([key, value]) => {
          const nombreProducto = value.nombre || value.producto || value.descripcion || key;
          const claveProducto = value.clave || value.codigo || value.sku || value.id || value.claveProducto;
          
          if (nombreProducto && claveProducto) {
            mapaClaves[nombreProducto.toString().trim().toLowerCase()] = claveProducto.toString().trim();
          }
        });
        
        setCatalogoProductos(mapaClaves);
      }
      setCargandoCatalogo(false);
    }, (error) => {
      console.error("Error cargando catálogo:", error);
      setCargandoCatalogo(false);
    });

    return () => unsubscribe();
  }, []);

  // Filtrar pedidos por fecha
  const pedidosDelDia = useMemo(() => {
    return pedidos.filter(p => {
      const fechaPedido = p.fechaPedido || '';
      const fechaEntrega = p.fechaEntrega || '';
      return fechaPedido === fechaSeleccionada || fechaEntrega === fechaSeleccionada;
    });
  }, [pedidos, fechaSeleccionada]);

  // Pedidos recibidos y solicitados
  const pedidosRecibidos = pedidosDelDia.filter(p => p.sucursalDestino === user);
  const pedidosSolicitados = pedidosDelDia.filter(p => p.sucursalOrigen === user);

  // 🆕 Obtener lista de sucursales únicas para el filtro (solo las que me hicieron pedidos)
  const sucursalesDisponibles = useMemo(() => {
    const pedidosEnviadosPorMi = pedidosDelDia.filter(p => 
      p.sucursalDestino === user && 
      (p.estado === 'ENVIADO' || p.estado === 'RECIBIDO_CONFORME')
    );
    
    const sucursales = [...new Set(pedidosEnviadosPorMi.map(p => p.sucursalOrigen))];
    return sucursales.sort();
  }, [pedidosDelDia, user]);

  // 🎯 CONSOLIDADO CON FILTRO DE SUCURSAL
  const consolidadoDia = useMemo(() => {
    // Pedidos donde yo soy el destino y ya los envié
    let pedidosEnviadosPorMi = pedidosDelDia.filter(p => 
      p.sucursalDestino === user && 
      (p.estado === 'ENVIADO' || p.estado === 'RECIBIDO_CONFORME')
    );

    // 🆕 Aplicar filtro por sucursal si no es "todas"
    if (sucursalFiltro !== 'todas') {
      pedidosEnviadosPorMi = pedidosEnviadosPorMi.filter(p => 
        p.sucursalOrigen === sucursalFiltro
      );
    }

    const productosMap = new Map();

    pedidosEnviadosPorMi.forEach(pedido => {
      pedido.items.forEach(item => {
        const key = `${item.producto}-${item.unidad}`;
        const pesoReal = parseFloat(item.pesoReal) || parseFloat(item.cantidad) || 0;

        if (productosMap.has(key)) {
          const existente = productosMap.get(key);
          productosMap.set(key, {
            ...existente,
            cantidad: existente.cantidad + pesoReal,
            cantidadPedidos: existente.cantidadPedidos + 1,
            sucursales: [...existente.sucursales, pedido.sucursalOrigen]
          });
        } else {
          productosMap.set(key, {
            producto: item.producto,
            unidad: item.unidad,
            cantidad: pesoReal,
            cantidadPedidos: 1,
            sucursales: [pedido.sucursalOrigen]
          });
        }
      });
    });

    return Array.from(productosMap.values())
      .sort((a, b) => b.cantidad - a.cantidad);
  }, [pedidosDelDia, user, sucursalFiltro]);

  // Totales
  const totalesConsolidado = useMemo(() => {
    return consolidadoDia.reduce((acc, item) => ({
      totalCantidad: acc.totalCantidad + item.cantidad,
      totalLineas: acc.totalLineas + 1
    }), { totalCantidad: 0, totalLineas: 0 });
  }, [consolidadoDia]);

  // Contador de pedidos
  const pedidosFisicamenteEnviados = useMemo(() => {
    let filtrados = pedidosDelDia.filter(p => 
      p.sucursalDestino === user && 
      (p.estado === 'ENVIADO' || p.estado === 'RECIBIDO_CONFORME')
    );
    
    if (sucursalFiltro !== 'todas') {
      filtrados = filtrados.filter(p => p.sucursalOrigen === sucursalFiltro);
    }
    
    return filtrados;
  }, [pedidosDelDia, user, sucursalFiltro]);

  // Obtener clave del catálogo
  const obtenerClaveProducto = (nombreProducto) => {
    if (!nombreProducto) return '';
    const clave = catalogoProductos[nombreProducto.toString().trim().toLowerCase()];
    return clave || '';
  };

  // 📝 Exportar Excel con CLAVE como TEXTO (agregando apostrofo)
  const exportarExcel = () => {
    if (consolidadoDia.length === 0) return;

    const productosSinClave = consolidadoDia.filter(item => !obtenerClaveProducto(item.producto));
    
    if (productosSinClave.length > 0) {
      const nombres = productosSinClave.map(p => p.producto).join(', ');
      const confirmar = window.confirm(
        `Los siguientes productos no tienen clave en el catálogo:\n${nombres}\n\n` +
        `Se exportarán con CLAVE vacía. ¿Deseas continuar?`
      );
      if (!confirmar) return;
    }

    const headers = ['CLAVE', 'CANTIDAD'];
    
    const rows = consolidadoDia.map(item => {
      const claveReal = obtenerClaveProducto(item.producto);
      // 🆕 Forzar formato TEXTO agregando apostrofo al inicio
      // El apostrofo hace que Excel trate la celda como texto incluso si son solo números
      const claveComoTexto = claveReal ? `'${claveReal}` : '';
      
      return [
        claveComoTexto, // CLAVE como TEXTO (con apostrofo)
        item.cantidad.toFixed(2) // CANTIDAD
      ];
    });

    const xlsContent = [
      headers.join('\t'),
      ...rows.map(row => row.join('\t'))
    ].join('\r\n');

    const blob = new Blob([xlsContent], { 
      type: 'application/vnd.ms-excel;charset=utf-8;' 
    });
    
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    // 🆕 Nombre de archivo incluye sucursal si hay filtro
    const nombreSucursal = sucursalFiltro === 'todas' ? 'TODAS' : sucursalFiltro;
    link.setAttribute('href', url);
    link.setAttribute('download', `Consolidado_${fechaSeleccionada}_${nombreSucursal}_${user}.xls`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Determinar qué mostrar según vista
  const pedidosMostrar = useMemo(() => {
    switch (vista) {
      case 'recibidos':
        return pedidosRecibidos;
      case 'enviados':
        return pedidosSolicitados;
      case 'ambos':
      default:
        return pedidosDelDia;
    }
  }, [vista, pedidosRecibidos, pedidosSolicitados, pedidosDelDia]);

  // Estadísticas
  const stats = {
    totalRecibidos: pedidosRecibidos.length,
    totalSolicitados: pedidosSolicitados.length,
    totalEnviadosPorMi: pedidosFisicamenteEnviados.length,
    pesoTotalEnviado: pedidosFisicamenteEnviados.reduce((acc, p) => 
      acc + p.items.reduce((sum, item) => sum + (parseFloat(item.pesoReal) || 0), 0), 0
    ),
    completados: pedidosDelDia.filter(p => p.estado === 'RECIBIDO_CONFORME' || p.estado === 'ENTREGADO').length,
    enProceso: pedidosDelDia.filter(p => ['NUEVO', 'PREPARACION', 'LISTO'].includes(p.estado)).length
  };

  const formatearFecha = (fechaStr) => {
    if (!fechaStr) return '';
    const [year, month, day] = fechaStr.split('-');
    return `${day}/${month}/${year}`;
  };

  const getEstadoColor = (estado) => STATUS_COLORS[estado] || '#6b7280';

  return (
    <div style={{ animation: 'slideIn 0.4s ease-out' }}>
      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .card-enter { animation: slideIn 0.4s ease-out forwards; }
        .btn-hover { transition: all 0.2s ease; }
        .btn-hover:hover { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(0,0,0,0.2); }
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
            background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 10px 25px rgba(139, 92, 246, 0.4)',
            color: 'white'
          }}>
            {Icons.calendar}
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 800, color: 'white' }}>
              Historial
            </h1>
            <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>
              {user} • Centro de Distribución
            </p>
          </div>
        </div>

        <button
          onClick={() => setMostrarConsolidado(!mostrarConsolidado)}
          style={{
            padding: '14px 24px',
            borderRadius: '14px',
            border: 'none',
            background: mostrarConsolidado 
              ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' 
              : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            color: 'white',
            fontWeight: 700,
            fontSize: '14px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            boxShadow: mostrarConsolidado 
              ? '0 10px 25px rgba(245, 158, 11, 0.4)' 
              : '0 10px 25px rgba(16, 185, 129, 0.4)',
            transition: 'all 0.3s ease'
          }}
          className="btn-hover"
        >
          {Icons.fileText}
          {mostrarConsolidado ? 'Ocultar Consolidado' : 'Ver Consolidado de Envíos'}
          {consolidadoDia.length > 0 && !mostrarConsolidado && (
            <span style={{
              background: 'rgba(255,255,255,0.2)',
              padding: '2px 8px',
              borderRadius: '10px',
              fontSize: '12px'
            }}>
              {consolidadoDia.length}
            </span>
          )}
        </button>
      </div>

      {/* Selector de Fecha y Vista */}
      <div style={{
        background: 'rgba(255,255,255,0.05)',
        borderRadius: '20px',
        padding: '24px',
        marginBottom: '24px',
        border: '1px solid rgba(255,255,255,0.1)'
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '20px',
          marginBottom: '20px'
        }}>
          <div>
            <label style={{
              fontSize: '11px',
              fontWeight: 700,
              color: 'rgba(255,255,255,0.5)',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              marginBottom: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              {Icons.calendar}
              Seleccionar Fecha
            </label>
            <input
              type="date"
              value={fechaSeleccionada}
              onChange={(e) => {
                setFechaSeleccionada(e.target.value);
                setSucursalFiltro('todas'); // Resetear filtro al cambiar fecha
              }}
              style={{
                width: '100%',
                padding: '14px 16px',
                background: 'rgba(255,255,255,0.1)',
                border: '2px solid rgba(255,255,255,0.2)',
                borderRadius: '12px',
                color: 'white',
                fontWeight: 700,
                fontSize: '15px',
                cursor: 'pointer'
              }}
            />
          </div>

          <div>
            <label style={{
              fontSize: '11px',
              fontWeight: 700,
              color: 'rgba(255,255,255,0.5)',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              marginBottom: '8px',
              display: 'block'
            }}>
              Tipo de Vista
            </label>
            <div style={{
              display: 'flex',
              gap: '8px',
              background: 'rgba(0,0,0,0.2)',
              padding: '6px',
              borderRadius: '12px'
            }}>
              {[
                { key: 'recibidos', label: 'Me pidieron', icon: Icons.inbox, color: '#10b981' },
                { key: 'enviados', label: 'Yo pedí', icon: Icons.send, color: '#3b82f6' },
                { key: 'ambos', label: 'Ambos', icon: Icons.package, color: '#8b5cf6' }
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setVista(tab.key)}
                  style={{
                    flex: 1,
                    padding: '12px 16px',
                    borderRadius: '10px',
                    border: 'none',
                    background: vista === tab.key 
                      ? `linear-gradient(135deg, ${tab.color} 0%, ${tab.color}dd 100%)` 
                      : 'transparent',
                    color: vista === tab.key ? 'white' : 'rgba(255,255,255,0.5)',
                    fontWeight: 700,
                    fontSize: '13px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    transition: 'all 0.2s'
                  }}
                >
                  {tab.icon}
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px',
          padding: '16px',
          background: 'rgba(139, 92, 246, 0.2)',
          borderRadius: '12px',
          border: '1px solid rgba(139, 92, 246, 0.3)'
        }}>
          <span style={{ fontSize: '24px' }}>📅</span>
          <span style={{
            fontSize: '20px',
            fontWeight: 800,
            color: '#a78bfa'
          }}>
            {formatearFecha(fechaSeleccionada)}
          </span>
        </div>
      </div>

      {/* 🎯 SECCIÓN CONSOLIDADO */}
      {mostrarConsolidado && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(5, 150, 105, 0.1) 100%)',
          borderRadius: '24px',
          padding: '28px',
          marginBottom: '32px',
          border: '2px solid rgba(16, 185, 129, 0.3)',
          boxShadow: '0 20px 40px rgba(0,0,0,0.3)'
        }}>
          {/* Header */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '24px',
            flexWrap: 'wrap',
            gap: '16px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{
                width: '56px',
                height: '56px',
                borderRadius: '16px',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 10px 25px rgba(16, 185, 129, 0.4)',
                color: 'white'
              }}>
                {Icons.truck}
              </div>
              <div>
                <h2 style={{ 
                  margin: 0, 
                  fontSize: '22px', 
                  fontWeight: 800, 
                  color: '#10b981',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px'
                }}>
                  Consolidado de Productos Enviados
                  <span style={{
                    background: 'rgba(16, 185, 129, 0.2)',
                    color: '#34d399',
                    padding: '4px 12px',
                    borderRadius: '20px',
                    fontSize: '12px'
                  }}>
                    {pedidosFisicamenteEnviados.length} pedidos
                  </span>
                </h2>
                <p style={{ margin: '6px 0 0 0', fontSize: '14px', color: 'rgba(255,255,255,0.6)' }}>
                  {sucursalFiltro === 'todas' 
                    ? `Todos los pedidos recibidos en ${user}` 
                    : `Solo pedidos de: ${sucursalFiltro}`}
                </p>
              </div>
            </div>

            <button
              onClick={exportarExcel}
              disabled={consolidadoDia.length === 0 || cargandoCatalogo}
              style={{
                padding: '14px 24px',
                borderRadius: '12px',
                border: 'none',
                background: consolidadoDia.length === 0 || cargandoCatalogo ? 'rgba(255,255,255,0.1)' : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                color: 'white',
                fontWeight: 700,
                fontSize: '14px',
                cursor: consolidadoDia.length === 0 || cargandoCatalogo ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                opacity: consolidadoDia.length === 0 || cargandoCatalogo ? 0.5 : 1,
                transition: 'all 0.3s ease'
              }}
              className={consolidadoDia.length > 0 && !cargandoCatalogo ? 'btn-hover' : ''}
            >
              {Icons.download}
              {cargandoCatalogo ? 'Cargando...' : 'Exportar Excel (.xls)'}
            </button>
          </div>

          {/* 🆕 FILTRO POR SUCURSAL */}
          {sucursalesDisponibles.length > 0 && (
            <div style={{
              background: 'rgba(0,0,0,0.2)',
              borderRadius: '12px',
              padding: '16px',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              flexWrap: 'wrap'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                color: 'rgba(255,255,255,0.7)',
                fontSize: '14px',
                fontWeight: 600
              }}>
                {Icons.filter}
                Filtrar por sucursal:
              </div>
              
              <select
                value={sucursalFiltro}
                onChange={(e) => setSucursalFiltro(e.target.value)}
                style={{
                  flex: 1,
                  minWidth: '200px',
                  padding: '10px 14px',
                  background: 'rgba(255,255,255,0.1)',
                  border: '2px solid rgba(255,255,255,0.2)',
                  borderRadius: '8px',
                  color: 'white',
                  fontWeight: 700,
                  fontSize: '14px',
                  cursor: 'pointer'
                }}
              >
                <option value="todas" style={{ background: '#1e293b' }}>
                  Todas las sucursales ({pedidosDelDia.filter(p => p.sucursalDestino === user && (p.estado === 'ENVIADO' || p.estado === 'RECIBIDO_CONFORME')).length} pedidos)
                </option>
                {sucursalesDisponibles.map(sucursal => {
                  const count = pedidosDelDia.filter(p => 
                    p.sucursalDestino === user && 
                    (p.estado === 'ENVIADO' || p.estado === 'RECIBIDO_CONFORME') &&
                    p.sucursalOrigen === sucursal
                  ).length;
                  return (
                    <option key={sucursal} value={sucursal} style={{ background: '#1e293b' }}>
                      {sucursal} ({count} pedidos)
                    </option>
                  );
                })}
              </select>

              {sucursalFiltro !== 'todas' && (
                <button
                  onClick={() => setSucursalFiltro('todas')}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '6px',
                    border: '1px solid rgba(255,255,255,0.3)',
                    background: 'transparent',
                    color: 'rgba(255,255,255,0.7)',
                    fontSize: '12px',
                    cursor: 'pointer'
                  }}
                >
                  Limpiar filtro
                </button>
              )}
            </div>
          )}

          {/* Tabla de Consolidado */}
          {consolidadoDia.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '40px',
              background: 'rgba(0,0,0,0.2)',
              borderRadius: '16px'
            }}>
              <div style={{ fontSize: '48px', marginBottom: '12px' }}>📭</div>
              <p style={{ margin: 0, color: 'rgba(255,255,255,0.6)', fontSize: '16px', fontWeight: 600 }}>
                {sucursalFiltro === 'todas' 
                  ? 'No has enviado productos en esta fecha' 
                  : `No hay envíos para ${sucursalFiltro} en esta fecha`}
              </p>
              <p style={{ margin: '8px 0 0 0', color: 'rgba(255,255,255,0.4)', fontSize: '14px' }}>
                Los pedidos deben estar marcados como "Enviado" o "Recibido Conforme"
              </p>
            </div>
          ) : (
            <>
              <div style={{
                background: 'rgba(0,0,0,0.3)',
                borderRadius: '16px',
                overflow: 'hidden',
                border: '1px solid rgba(255,255,255,0.1)'
              }}>
                {/* Header de tabla */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '2fr 1fr 1fr 1fr',
                  gap: '16px',
                  padding: '16px 20px',
                  background: 'rgba(16, 185, 129, 0.2)',
                  borderBottom: '2px solid rgba(16, 185, 129, 0.3)',
                  fontSize: '12px',
                  fontWeight: 800,
                  color: '#34d399',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>
                  <div>Producto</div>
                  <div style={{ textAlign: 'center' }}>Unidad</div>
                  <div style={{ textAlign: 'center' }}>Clave Catálogo</div>
                  <div style={{ textAlign: 'right' }}>Cantidad (Peso Real)</div>
                </div>

                {/* Filas */}
                <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                  {consolidadoDia.map((item, index) => {
                    const claveProducto = obtenerClaveProducto(item.producto);
                    return (
                      <div
                        key={index}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '2fr 1fr 1fr 1fr',
                          gap: '16px',
                          padding: '16px 20px',
                          borderBottom: '1px solid rgba(255,255,255,0.05)',
                          background: index % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent',
                          transition: 'all 0.2s',
                          cursor: 'default'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = index % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent';
                        }}
                      >
                        <div style={{ 
                          fontWeight: 700, 
                          color: 'white',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px'
                        }}>
                          <span style={{ color: '#10b981', fontSize: '20px' }}>•</span>
                          {item.producto}
                        </div>
                        <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.7)' }}>
                          {item.unidad}
                        </div>
                        <div style={{ 
                          textAlign: 'center', 
                          color: claveProducto ? '#60a5fa' : '#ef4444',
                          fontWeight: claveProducto ? 600 : 700,
                          fontSize: '13px',
                          fontFamily: 'monospace'
                        }}>
                          {claveProducto || '⚠️ Sin clave'}
                        </div>
                        <div style={{ 
                          textAlign: 'right', 
                          fontWeight: 800, 
                          color: '#10b981',
                          fontFamily: 'monospace',
                          fontSize: '16px'
                        }}>
                          {item.cantidad.toFixed(2)} lb
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Footer */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '2fr 1fr 1fr 1fr',
                  gap: '16px',
                  padding: '20px',
                  background: 'rgba(16, 185, 129, 0.15)',
                  borderTop: '2px solid rgba(16, 185, 129, 0.4)',
                  fontWeight: 800
                }}>
                  <div style={{ color: '#10b981', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {Icons.truck}
                    TOTALES
                  </div>
                  <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.5)' }}>
                    {totalesConsolidado.totalLineas} productos
                  </div>
                  <div></div>
                  <div style={{ 
                    textAlign: 'right', 
                    color: '#10b981',
                    fontFamily: 'monospace',
                    fontSize: '18px'
                  }}>
                    {totalesConsolidado.totalCantidad.toFixed(2)} lb
                  </div>
                </div>
              </div>

              {/* Info del Excel */}
              <div style={{
                marginTop: '16px',
                padding: '12px 16px',
                background: 'rgba(59, 130, 246, 0.1)',
                borderRadius: '10px',
                border: '1px solid rgba(59, 130, 246, 0.2)',
                fontSize: '13px',
                color: '#93c5fd',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <span>ℹ️</span>
                El archivo Excel contendrá CLAVE (formato TEXTO) y CANTIDAD. 
                La columna CLAVE lleva apostrofo (') para forzar formato texto en Excel.
              </div>
            </>
          )}
        </div>
      )}
      {/* 🎯 SECCIÓN CONSOLIDADO: Productos que YO envié (como centro de distribución) */}
      {mostrarConsolidado && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(5, 150, 105, 0.1) 100%)',
          borderRadius: '24px',
          padding: '28px',
          marginBottom: '32px',
          border: '2px solid rgba(16, 185, 129, 0.3)',
          boxShadow: '0 20px 40px rgba(0,0,0,0.3)'
        }}>
          {/* Header del Consolidado */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '24px',
            flexWrap: 'wrap',
            gap: '16px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{
                width: '56px',
                height: '56px',
                borderRadius: '16px',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 10px 25px rgba(16, 185, 129, 0.4)',
                color: 'white'
              }}>
                {Icons.truck}
              </div>
              <div>
                <h2 style={{ 
                  margin: 0, 
                  fontSize: '22px', 
                  fontWeight: 800, 
                  color: '#10b981',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px'
                }}>
                  Consolidado de Productos Enviados
                  <span style={{
                    background: 'rgba(16, 185, 129, 0.2)',
                    color: '#34d399',
                    padding: '4px 12px',
                    borderRadius: '20px',
                    fontSize: '12px'
                  }}>
                    {pedidosFisicamenteEnviados.length} pedidos
                  </span>
                </h2>
                <p style={{ margin: '6px 0 0 0', fontSize: '14px', color: 'rgba(255,255,255,0.6)' }}>
                  Productos que salieron físicamente de {user} hacia otras sucursales
                </p>
              </div>
            </div>

            <button
              onClick={exportarExcel}
              disabled={consolidadoDia.length === 0 || cargandoCatalogo}
              style={{
                padding: '14px 24px',
                borderRadius: '12px',
                border: 'none',
                background: consolidadoDia.length === 0 || cargandoCatalogo ? 'rgba(255,255,255,0.1)' : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                color: 'white',
                fontWeight: 700,
                fontSize: '14px',
                cursor: consolidadoDia.length === 0 || cargandoCatalogo ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                opacity: consolidadoDia.length === 0 || cargandoCatalogo ? 0.5 : 1,
                transition: 'all 0.3s ease'
              }}
              className={consolidadoDia.length > 0 && !cargandoCatalogo ? 'btn-hover' : ''}
            >
              {Icons.download}
              {cargandoCatalogo ? 'Cargando catálogo...' : 'Exportar Excel (.xls)'}
            </button>
          </div>

          {/* Tabla de Consolidado */}
          {consolidadoDia.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '40px',
              background: 'rgba(0,0,0,0.2)',
              borderRadius: '16px'
            }}>
              <div style={{ fontSize: '48px', marginBottom: '12px' }}>📭</div>
              <p style={{ margin: 0, color: 'rgba(255,255,255,0.6)', fontSize: '16px', fontWeight: 600 }}>
                No has enviado productos en esta fecha
              </p>
              <p style={{ margin: '8px 0 0 0', color: 'rgba(255,255,255,0.4)', fontSize: '14px' }}>
                Los pedidos deben estar marcados como "Enviado" o "Recibido Conforme"
              </p>
            </div>
          ) : (
            <>
              <div style={{
                background: 'rgba(0,0,0,0.3)',
                borderRadius: '16px',
                overflow: 'hidden',
                border: '1px solid rgba(255,255,255,0.1)'
              }}>
                {/* Header de tabla */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '2fr 1fr 1fr 1fr',
                  gap: '16px',
                  padding: '16px 20px',
                  background: 'rgba(16, 185, 129, 0.2)',
                  borderBottom: '2px solid rgba(16, 185, 129, 0.3)',
                  fontSize: '12px',
                  fontWeight: 800,
                  color: '#34d399',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>
                  <div>Producto</div>
                  <div style={{ textAlign: 'center' }}>Unidad</div>
                  <div style={{ textAlign: 'center' }}>Clave Catálogo</div>
                  <div style={{ textAlign: 'right' }}>Cantidad (Peso Real)</div>
                </div>

                {/* Filas de productos */}
                <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                  {consolidadoDia.map((item, index) => {
                    const claveProducto = obtenerClaveProducto(item.producto);
                    return (
                      <div
                        key={index}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '2fr 1fr 1fr 1fr',
                          gap: '16px',
                          padding: '16px 20px',
                          borderBottom: '1px solid rgba(255,255,255,0.05)',
                          background: index % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent',
                          transition: 'all 0.2s',
                          cursor: 'default'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = index % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent';
                        }}
                      >
                        <div style={{ 
                          fontWeight: 700, 
                          color: 'white',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px'
                        }}>
                          <span style={{ color: '#10b981', fontSize: '20px' }}>•</span>
                          {item.producto}
                        </div>
                        <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.7)' }}>
                          {item.unidad}
                        </div>
                        <div style={{ 
                          textAlign: 'center', 
                          color: claveProducto ? '#60a5fa' : '#ef4444',
                          fontWeight: claveProducto ? 600 : 700,
                          fontSize: '13px'
                        }}>
                          {claveProducto || '⚠️ Sin clave'}
                        </div>
                        <div style={{ 
                          textAlign: 'right', 
                          fontWeight: 800, 
                          color: '#10b981',
                          fontFamily: 'monospace',
                          fontSize: '16px'
                        }}>
                          {item.cantidad.toFixed(2)} lb
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Footer con totales */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '2fr 1fr 1fr 1fr',
                  gap: '16px',
                  padding: '20px',
                  background: 'rgba(16, 185, 129, 0.15)',
                  borderTop: '2px solid rgba(16, 185, 129, 0.4)',
                  fontWeight: 800
                }}>
                  <div style={{ color: '#10b981', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {Icons.truck}
                    TOTALES
                  </div>
                  <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.5)' }}>
                    {totalesConsolidado.totalLineas} productos
                  </div>
                  <div></div>
                  <div style={{ 
                    textAlign: 'right', 
                    color: '#10b981',
                    fontFamily: 'monospace',
                    fontSize: '18px'
                  }}>
                    {totalesConsolidado.totalCantidad.toFixed(2)} lb
                  </div>
                </div>
              </div>

              {/* Info del Excel */}
              <div style={{
                marginTop: '16px',
                padding: '12px 16px',
                background: 'rgba(59, 130, 246, 0.1)',
                borderRadius: '10px',
                border: '1px solid rgba(59, 130, 246, 0.2)',
                fontSize: '13px',
                color: '#93c5fd',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <span>ℹ️</span>
                El archivo Excel exportado contendrá 2 columnas: CLAVE (desde catálogo) y CANTIDAD (peso real). 
                Los productos sin clave aparecerán con celda vacía.
              </div>
            </>
          )}
        </div>
      )}

      {/* Estadísticas del Día */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '16px',
        marginBottom: '24px'
      }}>
        {/* Pedidos que me hicieron a mí */}
        {(vista === 'recibidos' || vista === 'ambos') && (
          <div style={{
            background: 'rgba(16, 185, 129, 0.1)',
            borderRadius: '16px',
            padding: '20px',
            border: '2px solid rgba(16, 185, 129, 0.3)',
            display: 'flex',
            alignItems: 'center',
            gap: '16px'
          }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              background: 'rgba(16, 185, 129, 0.2)',
              color: '#10b981',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              {Icons.inbox}
            </div>
            <div>
              <div style={{ fontSize: '28px', fontWeight: 800, color: '#10b981' }}>
                {stats.totalRecibidos}
              </div>
              <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', fontWeight: 600 }}>
                Pedidos Recibidos
              </div>
              <div style={{ fontSize: '11px', color: '#34d399', marginTop: '4px' }}>
                Me pidieron {stats.totalRecibidos} pedidos
              </div>
            </div>
          </div>
        )}

        {/* Pedidos que yo envié físicamente */}
        {(vista === 'recibidos' || vista === 'ambos') && (
          <div style={{
            background: 'rgba(59, 130, 246, 0.1)',
            borderRadius: '16px',
            padding: '20px',
            border: '2px solid rgba(59, 130, 246, 0.3)',
            display: 'flex',
            alignItems: 'center',
            gap: '16px'
          }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              background: 'rgba(59, 130, 246, 0.2)',
              color: '#3b82f6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              {Icons.send}
            </div>
            <div>
              <div style={{ fontSize: '28px', fontWeight: 800, color: '#3b82f6' }}>
                {stats.totalEnviadosPorMi}
              </div>
              <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', fontWeight: 600 }}>
                Pedidos Enviados por Mí
              </div>
              <div style={{ fontSize: '11px', color: '#60a5fa', marginTop: '4px' }}>
                {stats.pesoTotalEnviado.toFixed(2)} lb total
              </div>
            </div>
          </div>
        )}

        {/* Pedidos que yo hice a otros */}
        {(vista === 'enviados' || vista === 'ambos') && (
          <div style={{
            background: 'rgba(139, 92, 246, 0.1)',
            borderRadius: '16px',
            padding: '20px',
            border: '2px solid rgba(139, 92, 246, 0.3)',
            display: 'flex',
            alignItems: 'center',
            gap: '16px'
          }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              background: 'rgba(139, 92, 246, 0.2)',
              color: '#8b5cf6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              {Icons.package}
            </div>
            <div>
              <div style={{ fontSize: '28px', fontWeight: 800, color: '#8b5cf6' }}>
                {stats.totalSolicitados}
              </div>
              <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', fontWeight: 600 }}>
                Pedidos que Hice
              </div>
              <div style={{ fontSize: '11px', color: '#a78bfa', marginTop: '4px' }}>
                A otras sucursales
              </div>
            </div>
          </div>
        )}

        {/* Completados */}
        <div style={{
          background: 'rgba(99, 102, 241, 0.1)',
          borderRadius: '16px',
          padding: '20px',
          border: '2px solid rgba(99, 102, 241, 0.3)',
          display: 'flex',
          alignItems: 'center',
          gap: '16px'
        }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '12px',
            background: 'rgba(99, 102, 241, 0.2)',
            color: '#6366f1',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            {Icons.check}
          </div>
          <div>
            <div style={{ fontSize: '28px', fontWeight: 800, color: '#6366f1' }}>
              {stats.completados}
            </div>
            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', fontWeight: 600 }}>
              Completados
            </div>
          </div>
        </div>
      </div>

      {/* Lista de Pedidos */}
      {pedidosMostrar.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '80px 20px',
          background: 'rgba(255,255,255,0.03)',
          borderRadius: '24px',
          border: '2px dashed rgba(255,255,255,0.1)'
        }}>
          <div style={{ fontSize: '64px', marginBottom: '16px' }}>📭</div>
          <h3 style={{ fontSize: '24px', margin: '0 0 8px 0', color: 'white' }}>
            No hay pedidos para esta fecha
          </h3>
          <p style={{ margin: 0, color: 'rgba(255,255,255,0.5)' }}>
            No tienes actividad registrada en esta fecha
          </p>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(500px, 1fr))',
          gap: '20px'
        }}>
          {pedidosMostrar.map((pedido, index) => {
            const meHicieronElPedido = pedido.sucursalDestino === user;
            const yoHiceElPedido = pedido.sucursalOrigen === user;
            const estadoColor = getEstadoColor(pedido.estado);
            
            return (
              <div
                key={pedido.firebaseId}
                className="card-enter"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  borderRadius: '20px',
                  padding: '24px',
                  border: '1px solid rgba(255,255,255,0.1)',
                  animationDelay: `${index * 0.05}s`,
                  position: 'relative',
                  overflow: 'hidden',
                  borderLeft: `4px solid ${meHicieronElPedido ? '#10b981' : '#8b5cf6'}`
                }}
              >
                {/* Badge de rol */}
                <div style={{
                  position: 'absolute',
                  top: '12px',
                  right: '12px',
                  padding: '4px 12px',
                  borderRadius: '20px',
                  fontSize: '11px',
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  background: meHicieronElPedido ? 'rgba(16, 185, 129, 0.2)' : 'rgba(139, 92, 246, 0.2)',
                  color: meHicieronElPedido ? '#10b981' : '#8b5cf6',
                  border: `1px solid ${meHicieronElPedido ? 'rgba(16, 185, 129, 0.4)' : 'rgba(139, 92, 246, 0.4)'}`
                }}>
                  {meHicieronElPedido ? '↙ Me pidieron' : '↗ Yo pedí'}
                </div>

                {/* Badge de enviado físicamente */}
                {meHicieronElPedido && (pedido.estado === 'ENVIADO' || pedido.estado === 'RECIBIDO_CONFORME') && (
                  <div style={{
                    position: 'absolute',
                    top: '12px',
                    right: meHicieronElPedido ? '140px' : '12px',
                    padding: '4px 12px',
                    background: 'rgba(16, 185, 129, 0.2)',
                    border: '1px solid rgba(16, 185, 129, 0.4)',
                    borderRadius: '20px',
                    color: '#10b981',
                    fontSize: '11px',
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    {Icons.check}
                    Enviado Físicamente
                  </div>
                )}

                {/* Header */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  marginBottom: '16px',
                  marginTop: '8px'
                }}>
                  <div>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      marginBottom: '8px'
                    }}>
                      <span style={{
                        padding: '4px 12px',
                        borderRadius: '20px',
                        background: `${estadoColor}20`,
                        color: estadoColor,
                        fontSize: '11px',
                        fontWeight: 800,
                        textTransform: 'uppercase'
                      }}>
                        {pedido.estado === 'RECIBIDO_CONFORME' ? 'Recibido Conf.' : pedido.estado}
                      </span>
                    </div>
                    <h3 style={{
                      margin: 0,
                      fontSize: '20px',
                      fontWeight: 800,
                      color: 'white'
                    }}>
                      Pedido #{pedido.id}
                    </h3>
                    <p style={{
                      margin: '4px 0 0 0',
                      fontSize: '13px',
                      color: 'rgba(255,255,255,0.6)'
                    }}>
                      {meHicieronElPedido ? (
                        <><strong>{pedido.sucursalOrigen}</strong> me pidió → Yo ({user}) preparé y envié</>
                      ) : (
                        <>Yo ({user}) pedí → <strong>{pedido.sucursalDestino}</strong> me enviará</>
                      )}
                    </p>
                  </div>
                  <div style={{
                    textAlign: 'right',
                    fontSize: '12px',
                    color: 'rgba(255,255,255,0.5)'
                  }}>
                    <div>{pedido.fechaPedido}</div>
                    <div style={{ marginTop: '4px', fontWeight: 600 }}>{pedido.hora}</div>
                  </div>
                </div>

                {/* Items resumidos */}
                <div style={{
                  background: 'rgba(0,0,0,0.2)',
                  borderRadius: '12px',
                  padding: '16px',
                  marginBottom: '16px'
                }}>
                  <div style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    color: 'rgba(255,255,255,0.5)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    marginBottom: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}>
                    {Icons.package}
                    {pedido.items.length} productos
                  </div>
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px'
                  }}>
                    {pedido.items.slice(0, 3).map((item, idx) => (
                      <div key={idx} style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: '13px'
                      }}>
                        <span style={{ color: 'rgba(255,255,255,0.8)', fontWeight: 600 }}>
                          {item.producto}
                        </span>
                        <span style={{ color: '#60a5fa', fontWeight: 700 }}>
                          {item.cantidad} {item.unidad}
                          {item.pesoReal && meHicieronElPedido && (
                            <span style={{ color: '#10b981', marginLeft: '8px' }}>
                              (Real: {item.pesoReal} lb)
                            </span>
                          )}
                        </span>
                      </div>
                    ))}
                    {pedido.items.length > 3 && (
                      <div style={{
                        fontSize: '12px',
                        color: 'rgba(255,255,255,0.4)',
                        fontStyle: 'italic',
                        textAlign: 'center',
                        marginTop: '4px'
                      }}>
                        +{pedido.items.length - 3} productos más...
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer con info adicional */}
                <div style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '12px',
                  fontSize: '12px'
                }}>
                  {meHicieronElPedido && pedido.preparadoPor && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '8px 12px',
                      background: 'rgba(249, 115, 22, 0.1)',
                      borderRadius: '8px',
                      color: '#fbbf24'
                    }}>
                      <span>👨‍🍳</span>
                      Preparado: {pedido.preparadoPor}
                    </div>
                  )}
                  {meHicieronElPedido && pedido.enviadoCon && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '8px 12px',
                      background: 'rgba(99, 102, 241, 0.1)',
                      borderRadius: '8px',
                      color: '#a78bfa'
                    }}>
                      <span>🛵</span>
                      Enviado con: {pedido.enviadoCon}
                    </div>
                  )}
                  {pedido.esStandby && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '8px 12px',
                      background: 'rgba(245, 158, 11, 0.1)',
                      borderRadius: '8px',
                      color: '#fbbf24'
                    }}>
                      {Icons.clock}
                      Entrega: {pedido.fechaEntrega}
                    </div>
                  )}
                </div>

                {/* Nota general */}
                {pedido.notaGeneral && (
                  <div style={{
                    marginTop: '16px',
                    padding: '12px 16px',
                    background: 'rgba(59, 130, 246, 0.1)',
                    borderRadius: '10px',
                    border: '1px solid rgba(59, 130, 246, 0.2)',
                    fontSize: '13px',
                    color: '#93c5fd',
                    fontStyle: 'italic'
                  }}>
                    📝 {pedido.notaGeneral}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}