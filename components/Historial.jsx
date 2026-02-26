"use client";
import React, { useState, useMemo } from 'react';
import { db } from '../firebase';
import { ref, update } from "firebase/database";

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
  fileText: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
};

// Configuración de estados
const STATUS_COLORS = {
  'NUEVO': '#3b82f6',
  'STANDBY_ENTREGA': '#f59e0b',
  'PREPARACION': '#f97316',
  'LISTO': '#10b981',
  'ENVIADO': '#6366f1',
  'ENTREGADO': '#059669'
};

export default function Historial({ user, pedidos }) {
  const [fechaSeleccionada, setFechaSeleccionada] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [vista, setVista] = useState('ambos'); // 'recibidos', 'enviados', 'ambos'
  const [mostrarConsolidado, setMostrarConsolidado] = useState(false);

  // Filtrar pedidos por fecha seleccionada
  const pedidosDelDia = useMemo(() => {
    return pedidos.filter(p => {
      // Buscar por fechaPedido o fechaEntrega si es standby
      const fechaPedido = p.fechaPedido || '';
      const fechaEntrega = p.fechaEntrega || '';
      return fechaPedido === fechaSeleccionada || fechaEntrega === fechaSeleccionada;
    });
  }, [pedidos, fechaSeleccionada]);

  // Separar recibidos y enviados
  const pedidosRecibidos = pedidosDelDia.filter(p => p.sucursalDestino === user);
  const pedidosEnviados = pedidosDelDia.filter(p => p.sucursalOrigen === user);

  // CONSOLIDADO: Agrupar productos enviados del día
  const consolidadoDia = useMemo(() => {
    // Solo considerar pedidos ENVIADOS (los que salen de la sucursal)
    const productosMap = new Map();

    pedidosEnviados.forEach(pedido => {
      pedido.items.forEach(item => {
        const key = `${item.producto}-${item.unidad}`;
        const pesoReal = parseFloat(item.pesoReal) || 0;
        const cantidad = parseFloat(item.cantidad) || 0;

        if (productosMap.has(key)) {
          const existente = productosMap.get(key);
          productosMap.set(key, {
            ...existente,
            cantidad: existente.cantidad + cantidad,
            pesoReal: existente.pesoReal + pesoReal,
            cantidadPedidos: existente.cantidadPedidos + 1
          });
        } else {
          productosMap.set(key, {
            producto: item.producto,
            unidad: item.unidad,
            cantidad: cantidad,
            pesoReal: pesoReal,
            cantidadPedidos: 1
          });
        }
      });
    });

    // Convertir a array y ordenar por peso real (descendente)
    return Array.from(productosMap.values())
      .sort((a, b) => b.pesoReal - a.pesoReal);
  }, [pedidosEnviados]);

  // Totales del consolidado
  const totalesConsolidado = useMemo(() => {
    return consolidadoDia.reduce((acc, item) => ({
      totalProductos: acc.totalProductos + item.cantidad,
      totalPeso: acc.totalPeso + item.pesoReal,
      totalLineas: acc.totalLineas + 1
    }), { totalProductos: 0, totalPeso: 0, totalLineas: 0 });
  }, [consolidadoDia]);

  // Función para exportar CSV
  const exportarCSV = () => {
    if (consolidadoDia.length === 0) return;

    // Headers
    const headers = ['Producto', 'Unidad', 'Cantidad Total', 'Peso Real Total (lb)', 'Cantidad de Pedidos'];
    
    // Data rows
    const rows = consolidadoDia.map(item => [
      `"${item.producto}"`,
      item.unidad,
      item.cantidad.toFixed(2),
      item.pesoReal.toFixed(2),
      item.cantidadPedidos
    ]);

    // Totales row
    const totalRow = [
      '"TOTALES"',
      '',
      totalesConsolidado.totalProductos.toFixed(2),
      totalesConsolidado.totalPeso.toFixed(2),
      ''
    ];

    // Combine all
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(',')),
      totalRow.join(',')
    ].join('\n');

    // Create download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `Consolidado_${fechaSeleccionada}_${user}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Determinar qué mostrar según la vista seleccionada
  const pedidosMostrar = useMemo(() => {
    switch (vista) {
      case 'recibidos':
        return pedidosRecibidos;
      case 'enviados':
        return pedidosEnviados;
      case 'ambos':
      default:
        return pedidosDelDia;
    }
  }, [vista, pedidosRecibidos, pedidosEnviados, pedidosDelDia]);

  // Estadísticas del día
  const stats = {
    totalRecibidos: pedidosRecibidos.length,
    totalEnviados: pedidosEnviados.length,
    pesoTotalRecibido: pedidosRecibidos.reduce((acc, p) => 
      acc + p.items.reduce((sum, item) => sum + (parseFloat(item.pesoReal) || 0), 0), 0
    ),
    pesoTotalEnviado: pedidosEnviados.reduce((acc, p) => 
      acc + p.items.reduce((sum, item) => sum + (parseFloat(item.pesoReal) || 0), 0), 0
    ),
    completados: pedidosDelDia.filter(p => p.estado === 'ENVIADO' || p.estado === 'ENTREGADO').length,
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
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
        .pulse-animation { animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
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
              Consulta pedidos por fecha
            </p>
          </div>
        </div>

        {/* Botón Consolidado */}
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
          {mostrarConsolidado ? 'Ocultar Consolidado' : 'Ver Consolidado del Día'}
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
          {/* Selector de Fecha */}
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
              onChange={(e) => setFechaSeleccionada(e.target.value)}
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

          {/* Selector de Vista */}
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
                { key: 'recibidos', label: 'Recibidos', icon: Icons.inbox, color: '#10b981' },
                { key: 'enviados', label: 'Enviados', icon: Icons.send, color: '#3b82f6' },
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

        {/* Fecha seleccionada destacada */}
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

      {/* SECCIÓN CONSOLIDADO DEL DÍA */}
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
                {Icons.scale}
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
                  Consolidado del Día
                  <span style={{
                    background: 'rgba(16, 185, 129, 0.2)',
                    color: '#34d399',
                    padding: '4px 12px',
                    borderRadius: '20px',
                    fontSize: '12px'
                  }}>
                    {pedidosEnviados.length} pedidos
                  </span>
                </h2>
                <p style={{ margin: '6px 0 0 0', fontSize: '14px', color: 'rgba(255,255,255,0.6)' }}>
                  Suma de todos los productos enviados con PESO REAL
                </p>
              </div>
            </div>

            <button
              onClick={exportarCSV}
              disabled={consolidadoDia.length === 0}
              style={{
                padding: '14px 24px',
                borderRadius: '12px',
                border: 'none',
                background: consolidadoDia.length === 0 ? 'rgba(255,255,255,0.1)' : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                color: 'white',
                fontWeight: 700,
                fontSize: '14px',
                cursor: consolidadoDia.length === 0 ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                opacity: consolidadoDia.length === 0 ? 0.5 : 1,
                transition: 'all 0.3s ease'
              }}
              className={consolidadoDia.length > 0 ? 'btn-hover' : ''}
            >
              {Icons.download}
              Exportar CSV
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
              <div style={{ fontSize: '48px', marginBottom: '12px' }}>📊</div>
              <p style={{ margin: 0, color: 'rgba(255,255,255,0.6)', fontSize: '16px' }}>
                No hay pedidos enviados para consolidar en esta fecha
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
                  gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr',
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
                  <div style={{ textAlign: 'right' }}>Cantidad Total</div>
                  <div style={{ textAlign: 'right' }}>Peso Real Total</div>
                  <div style={{ textAlign: 'center' }}>En Pedidos</div>
                </div>

                {/* Filas de productos */}
                <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                  {consolidadoDia.map((item, index) => (
                    <div
                      key={index}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr',
                        gap: '16px',
                        padding: '16px 20px',
                        borderBottom: '1px solid rgba(255,255,255,0.05)',
                        background: index % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent',
                        transition: 'background 0.2s',
                        ':hover': {
                          background: 'rgba(255,255,255,0.05)'
                        }
                      }}
                    >
                      <div style={{ 
                        fontWeight: 700, 
                        color: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}>
                        <span style={{ color: '#10b981' }}>•</span>
                        {item.producto}
                      </div>
                      <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.7)' }}>
                        {item.unidad}
                      </div>
                      <div style={{ 
                        textAlign: 'right', 
                        fontWeight: 700, 
                        color: '#60a5fa',
                        fontFamily: 'monospace',
                        fontSize: '15px'
                      }}>
                        {item.cantidad.toFixed(2)}
                      </div>
                      <div style={{ 
                        textAlign: 'right', 
                        fontWeight: 800, 
                        color: '#10b981',
                        fontFamily: 'monospace',
                        fontSize: '16px'
                      }}>
                        {item.pesoReal.toFixed(2)} lb
                      </div>
                      <div style={{ 
                        textAlign: 'center', 
                        color: 'rgba(255,255,255,0.6)',
                        fontSize: '13px'
                      }}>
                        {item.cantidadPedidos} pedido{item.cantidadPedidos > 1 ? 's' : ''}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Footer con totales */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr',
                  gap: '16px',
                  padding: '20px',
                  background: 'rgba(16, 185, 129, 0.15)',
                  borderTop: '2px solid rgba(16, 185, 129, 0.4)',
                  fontWeight: 800
                }}>
                  <div style={{ color: '#10b981', fontSize: '14px' }}>
                    TOTALES DEL DÍA
                  </div>
                  <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.5)' }}>
                    {totalesConsolidado.totalLineas} productos
                  </div>
                  <div style={{ 
                    textAlign: 'right', 
                    color: '#60a5fa',
                    fontFamily: 'monospace',
                    fontSize: '16px'
                  }}>
                    {totalesConsolidado.totalProductos.toFixed(2)}
                  </div>
                  <div style={{ 
                    textAlign: 'right', 
                    color: '#10b981',
                    fontFamily: 'monospace',
                    fontSize: '18px'
                  }}>
                    {totalesConsolidado.totalPeso.toFixed(2)} lb
                  </div>
                  <div></div>
                </div>
              </div>

              {/* Resumen visual */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '16px',
                marginTop: '24px'
              }}>
                <div style={{
                  background: 'rgba(16, 185, 129, 0.1)',
                  borderRadius: '12px',
                  padding: '20px',
                  textAlign: 'center',
                  border: '1px solid rgba(16, 185, 129, 0.2)'
                }}>
                  <div style={{ fontSize: '32px', fontWeight: 800, color: '#10b981' }}>
                    {totalesConsolidado.totalPeso.toFixed(1)}
                  </div>
                  <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', marginTop: '4px' }}>
                    Libras Totales Enviadas
                  </div>
                </div>
                <div style={{
                  background: 'rgba(59, 130, 246, 0.1)',
                  borderRadius: '12px',
                  padding: '20px',
                  textAlign: 'center',
                  border: '1px solid rgba(59, 130, 246, 0.2)'
                }}>
                  <div style={{ fontSize: '32px', fontWeight: 800, color: '#3b82f6' }}>
                    {totalesConsolidado.totalProductos.toFixed(0)}
                  </div>
                  <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', marginTop: '4px' }}>
                    Unidades Totales
                  </div>
                </div>
                <div style={{
                  background: 'rgba(139, 92, 246, 0.1)',
                  borderRadius: '12px',
                  padding: '20px',
                  textAlign: 'center',
                  border: '1px solid rgba(139, 92, 246, 0.2)'
                }}>
                  <div style={{ fontSize: '32px', fontWeight: 800, color: '#8b5cf6' }}>
                    {pedidosEnviados.length}
                  </div>
                  <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', marginTop: '4px' }}>
                    Pedidos Procesados
                  </div>
                </div>
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
        {/* Recibidos */}
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
              {Icons.trendDown}
            </div>
            <div>
              <div style={{ fontSize: '28px', fontWeight: 800, color: '#10b981' }}>
                {stats.totalRecibidos}
              </div>
              <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', fontWeight: 600 }}>
                Pedidos Recibidos
              </div>
              <div style={{ fontSize: '11px', color: '#34d399', marginTop: '4px' }}>
                {stats.pesoTotalRecibido.toFixed(2)} lb total
              </div>
            </div>
          </div>
        )}

        {/* Enviados */}
        {(vista === 'enviados' || vista === 'ambos') && (
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
              {Icons.trendUp}
            </div>
            <div>
              <div style={{ fontSize: '28px', fontWeight: 800, color: '#3b82f6' }}>
                {stats.totalEnviados}
              </div>
              <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', fontWeight: 600 }}>
                Pedidos Enviados
              </div>
              <div style={{ fontSize: '11px', color: '#60a5fa', marginTop: '4px' }}>
                {stats.pesoTotalEnviado.toFixed(2)} lb total
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

        {/* En Proceso */}
        <div style={{
          background: 'rgba(245, 158, 11, 0.1)',
          borderRadius: '16px',
          padding: '20px',
          border: '2px solid rgba(245, 158, 11, 0.3)',
          display: 'flex',
          alignItems: 'center',
          gap: '16px'
        }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '12px',
            background: 'rgba(245, 158, 11, 0.2)',
            color: '#f59e0b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            {Icons.clock}
          </div>
          <div>
            <div style={{ fontSize: '28px', fontWeight: 800, color: '#f59e0b' }}>
              {stats.enProceso}
            </div>
            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', fontWeight: 600 }}>
              En Proceso
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
            Selecciona otra fecha o cambia el tipo de vista
          </p>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(500px, 1fr))',
          gap: '20px'
        }}>
          {pedidosMostrar.map((pedido, index) => {
            const esRecibido = pedido.sucursalDestino === user;
            const esEnviado = pedido.sucursalOrigen === user;
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
                  overflow: 'hidden'
                }}
              >
                {/* Indicador de tipo */}
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: '4px',
                  background: esRecibido 
                    ? 'linear-gradient(90deg, #10b981, #34d399)' 
                    : 'linear-gradient(90deg, #3b82f6, #60a5fa)'
                }} />

                {/* Header */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  marginBottom: '16px'
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
                        background: esRecibido ? 'rgba(16, 185, 129, 0.2)' : 'rgba(59, 130, 246, 0.2)',
                        color: esRecibido ? '#10b981' : '#3b82f6',
                        fontSize: '11px',
                        fontWeight: 800,
                        textTransform: 'uppercase'
                      }}>
                        {esRecibido ? '↙ Recibido' : '↗ Enviado'}
                      </span>
                      <span style={{
                        padding: '4px 12px',
                        borderRadius: '20px',
                        background: `${estadoColor}20`,
                        color: estadoColor,
                        fontSize: '11px',
                        fontWeight: 800,
                        textTransform: 'uppercase'
                      }}>
                        {pedido.estado}
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
                      {pedido.sucursalOrigen} → {pedido.sucursalDestino}
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
                          {item.pesoReal && (
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
                  {pedido.preparadoPor && (
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
                      {pedido.preparadoPor}
                    </div>
                  )}
                  {pedido.enviadoCon && (
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
                      {pedido.enviadoCon}
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