"use client";
import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { ref, update } from "firebase/database";

// Iconos SVG estilo delivery
const Icons = {
  truck: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>,
  clock: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>,
  check: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6L9 17l-5-5"/></svg>,
  package: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>,
  alert: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
  refresh: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>,
  scale: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>,
  close: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  calendar: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  arrowRight: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
};

// Configuración de estados visuales
const STATUS_CONFIG = {
  'NUEVO': {
    color: '#3b82f6',
    bg: 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)',
    border: '#60a5fa',
    icon: Icons.clock,
    label: 'Nuevo',
    pulse: true
  },
  'STANDBY_ENTREGA': {
    color: '#f59e0b',
    bg: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
    border: '#fbbf24',
    icon: Icons.alert,
    label: 'Standby',
    pulse: true
  },
  'PREPARACION': {
    color: '#f97316',
    bg: 'linear-gradient(135deg, #ffedd5 0%, #fed7aa 100%)',
    border: '#fb923c',
    icon: Icons.package,
    label: 'En Preparación',
    pulse: false
  },
  'LISTO': {
    color: '#10b981',
    bg: 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)',
    border: '#34d399',
    icon: Icons.check,
    label: 'Listo para Enviar',
    pulse: false
  },
  'ENVIADO': {
    color: '#6366f1',
    bg: 'linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%)',
    border: '#818cf8',
    icon: Icons.truck,
    label: 'Enviado',
    pulse: false
  }
};

export default function EstadoPedidos({ user, pedidos, personalTransporte }) {
  const [filtro, setFiltro] = useState('activos');
  const [modalRepartidor, setModalRepartidor] = useState(null);
  const [repartidorSeleccionado, setRepartidorSeleccionado] = useState(null);
  const [animatingCards, setAnimatingCards] = useState(new Set());
  const [mostrarPesos, setMostrarPesos] = useState({}); // firebaseId: boolean

  // Filtrar pedidos relevantes para el usuario
  const pedidosRelevantes = pedidos.filter(p => 
    p.sucursalOrigen === user || p.sucursalDestino === user
  );

  // Aplicar filtros de pestaña
  const filtrarPedidos = () => {
    switch (filtro) {
      case 'activos':
        return pedidosRelevantes.filter(p => 
          p.estado !== 'ENVIADO' && p.estado !== 'ENTREGADO'
        );
      case 'enviados':
        return pedidosRelevantes.filter(p => p.estado === 'ENVIADO');
      case 'standby':
        return pedidosRelevantes.filter(p => p.estado === 'STANDBY_ENTREGA');
      case 'todos':
        return pedidosRelevantes;
      default:
        return pedidosRelevantes;
    }
  };

  const pedidosFiltrados = filtrarPedidos();

  const despacharPedido = (firebaseId, repartidor) => {
    setAnimatingCards(prev => new Set([...prev, firebaseId]));

    update(ref(db, `pedidos_internos/${firebaseId}`), {
      estado: 'ENVIADO',
      enviadoCon: repartidor,
      timestampEnviado: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
      timestamp: Date.now()
    });

    setTimeout(() => {
      setAnimatingCards(prev => {
        const next = new Set(prev);
        next.delete(firebaseId);
        return next;
      });
    }, 300);

    setModalRepartidor(null);
    setRepartidorSeleccionado(null);
  };

  const cambiarRepartidor = (firebaseId, nuevoRepartidor) => {
    update(ref(db, `pedidos_internos/${firebaseId}`), {
      enviadoCon: nuevoRepartidor,
      timestampCambio: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
      timestamp: Date.now()
    });

    setModalRepartidor(null);
    setRepartidorSeleccionado(null);
  };

  const toggleMostrarPesos = (firebaseId) => {
    setMostrarPesos(prev => ({
      ...prev,
      [firebaseId]: !prev[firebaseId]
    }));
  };

  const getTimeElapsed = (timestamp) => {
    if (!timestamp) return '';
    const diff = Math.floor((Date.now() - timestamp) / 60000);
    if (diff < 1) return 'Ahora';
    if (diff < 60) return `${diff}m`;
    return `${Math.floor(diff / 60)}h ${diff % 60}m`;
  };

  // Contadores para tabs
  const contadores = {
    activos: pedidosRelevantes.filter(p => p.estado !== 'ENVIADO' && p.estado !== 'ENTREGADO').length,
    enviados: pedidosRelevantes.filter(p => p.estado === 'ENVIADO').length,
    standby: pedidosRelevantes.filter(p => p.estado === 'STANDBY_ENTREGA').length,
    todos: pedidosRelevantes.length
  };

  return (
    <div style={{ animation: 'slideIn 0.4s ease-out' }}>
      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse-ring {
          0% { transform: scale(1); opacity: 0.5; }
          50% { transform: scale(1.02); opacity: 0; }
          100% { transform: scale(1); opacity: 0.5; }
        }
        @keyframes modalIn {
          from { opacity: 0; transform: scale(0.9); }
          to { opacity: 1; transform: scale(1); }
        }
        .card-enter { animation: slideIn 0.4s ease-out forwards; }
        .pulse-bg { animation: pulse-ring 2s ease-in-out infinite; }
        .btn-hover { transition: all 0.2s ease; }
        .btn-hover:hover { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(0,0,0,0.2); }
        .card-transition { transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
        .repartidor-card { 
          transition: all 0.2s ease; 
          cursor: pointer;
        }
        .repartidor-card:hover { 
          transform: scale(1.05); 
          box-shadow: 0 8px 25px rgba(0,0,0,0.15); 
        }
        .repartidor-card.selected { 
          background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%) !important; 
          color: white !important;
          border-color: #6366f1 !important;
        }
        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.7);
          backdrop-filter: blur(4px);
          display: flex;
          alignItems: center;
          justifyContent: center;
          z-index: 1000;
          animation: fadeIn 0.2s ease;
        }
        .modal-content {
          animation: modalIn 0.3s ease;
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
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
            background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 10px 25px rgba(99, 102, 241, 0.4)',
            color: 'white'
          }}>
            {Icons.truck}
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 800, color: 'white' }}>
              Estado de Pedidos
            </h1>
            <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>
              {user} • Seguimiento en tiempo real
            </p>
          </div>
        </div>
      </div>

      {/* Tabs de filtro */}
      <div style={{
        display: 'flex',
        gap: '8px',
        marginBottom: '24px',
        overflowX: 'auto',
        paddingBottom: '8px'
      }}>
        {[
          { key: 'activos', label: 'En Proceso', count: contadores.activos, color: '#3b82f6' },
          { key: 'enviados', label: 'Enviados', count: contadores.enviados, color: '#6366f1' },
          { key: 'standby', label: 'Standby', count: contadores.standby, color: '#f59e0b' },
          { key: 'todos', label: 'Todos', count: contadores.todos, color: '#10b981' }
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFiltro(tab.key)}
            style={{
              padding: '12px 20px',
              borderRadius: '12px',
              border: 'none',
              background: filtro === tab.key 
                ? `linear-gradient(135deg, ${tab.color} 0%, ${tab.color}dd 100%)` 
                : 'rgba(255,255,255,0.05)',
              color: filtro === tab.key ? 'white' : 'rgba(255,255,255,0.6)',
              fontWeight: 700,
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.2s',
              whiteSpace: 'nowrap',
              boxShadow: filtro === tab.key ? `0 8px 20px ${tab.color}40` : 'none'
            }}
          >
            {tab.label}
            <span style={{
              background: filtro === tab.key ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.1)',
              padding: '2px 8px',
              borderRadius: '10px',
              fontSize: '11px',
              minWidth: '20px',
              textAlign: 'center'
            }}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Modal Seleccionar Repartidor */}
      {modalRepartidor && (
        <div 
          className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setModalRepartidor(null);
              setRepartidorSeleccionado(null);
            }
          }}
        >
          <div className="modal-content" style={{
            background: 'white',
            borderRadius: '24px',
            padding: '32px',
            width: '90%',
            maxWidth: '500px',
            maxHeight: '90vh',
            overflow: 'auto',
            boxShadow: '0 25px 50px rgba(0,0,0,0.3)'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '24px'
            }}>
              <div>
                <h2 style={{ margin: '0 0 4px 0', fontSize: '22px', fontWeight: 800, color: '#1e293b' }}>
                  {pedidos.find(p => p.firebaseId === modalRepartidor)?.estado === 'ENVIADO' 
                    ? 'Cambiar Repartidor' 
                    : 'Enviar Pedido'}
                </h2>
                <p style={{ margin: 0, color: '#64748b', fontSize: '14px' }}>
                  Pedido #{pedidos.find(p => p.firebaseId === modalRepartidor)?.id}
                </p>
              </div>
              <button
                onClick={() => {
                  setModalRepartidor(null);
                  setRepartidorSeleccionado(null);
                }}
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  border: 'none',
                  background: '#f1f5f9',
                  color: '#64748b',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                {Icons.close}
              </button>
            </div>

            {/* Repartidor actual si es cambio */}
            {pedidos.find(p => p.firebaseId === modalRepartidor)?.enviadoCon && (
              <div style={{
                background: '#f1f5f9',
                borderRadius: '12px',
                padding: '16px',
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}>
                <span style={{ fontSize: '24px' }}>🛵</span>
                <div>
                  <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 700 }}>
                    Repartidor Actual
                  </div>
                  <div style={{ fontSize: '16px', fontWeight: 800, color: '#1e293b' }}>
                    {pedidos.find(p => p.firebaseId === modalRepartidor)?.enviadoCon}
                  </div>
                </div>
              </div>
            )}

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '12px',
              marginBottom: '24px'
            }}>
              {personalTransporte.map((nombre) => (
                <button
                  key={nombre}
                  type="button"
                  onClick={() => setRepartidorSeleccionado(nombre)}
                  className={`repartidor-card ${repartidorSeleccionado === nombre ? 'selected' : ''}`}
                  style={{
                    padding: '20px',
                    borderRadius: '16px',
                    border: '2px solid',
                    borderColor: repartidorSeleccionado === nombre ? '#6366f1' : '#e2e8f0',
                    background: repartidorSeleccionado === nombre 
                      ? 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)' 
                      : '#f8fafc',
                    color: repartidorSeleccionado === nombre ? 'white' : '#475569',
                    fontWeight: repartidorSeleccionado === nombre ? 800 : 700,
                    fontSize: '14px',
                    cursor: 'pointer',
                    textAlign: 'center',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  <span style={{ fontSize: '32px' }}>🛵</span>
                  <span>{nombre}</span>
                </button>
              ))}
            </div>

            <button
              onClick={() => {
                const pedido = pedidos.find(p => p.firebaseId === modalRepartidor);
                if (repartidorSeleccionado) {
                  if (pedido?.estado === 'ENVIADO') {
                    cambiarRepartidor(modalRepartidor, repartidorSeleccionado);
                  } else {
                    despacharPedido(modalRepartidor, repartidorSeleccionado);
                  }
                }
              }}
              disabled={!repartidorSeleccionado}
              style={{
                width: '100%',
                padding: '16px',
                borderRadius: '12px',
                border: 'none',
                background: repartidorSeleccionado 
                  ? 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)' 
                  : '#cbd5e1',
                color: 'white',
                fontWeight: 800,
                fontSize: '16px',
                cursor: repartidorSeleccionado ? 'pointer' : 'not-allowed',
                transition: 'all 0.2s',
                boxShadow: repartidorSeleccionado ? '0 8px 25px rgba(99, 102, 241, 0.4)' : 'none'
              }}
            >
              {repartidorSeleccionado 
                ? (pedidos.find(p => p.firebaseId === modalRepartidor)?.estado === 'ENVIADO' 
                    ? `Cambiar a ${repartidorSeleccionado}` 
                    : `Enviar con ${repartidorSeleccionado}`)
                : 'Selecciona un repartidor'}
            </button>
          </div>
        </div>
      )}

      {/* Lista de Pedidos */}
      {pedidosFiltrados.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '80px 20px',
          background: 'rgba(255,255,255,0.03)',
          borderRadius: '24px',
          border: '2px dashed rgba(255,255,255,0.1)'
        }}>
          <div style={{ fontSize: '64px', marginBottom: '16px' }}>📋</div>
          <h3 style={{ fontSize: '24px', margin: '0 0 8px 0', color: 'white' }}>
            No hay pedidos en este filtro
          </h3>
          <p style={{ margin: 0, color: 'rgba(255,255,255,0.5)' }}>
            Los pedidos aparecerán aquí según su estado
          </p>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(600px, 1fr))',
          gap: '24px'
        }}>
          {pedidosFiltrados.map((pedido, index) => {
            const status = pedido.estado || 'NUEVO';
            const config = STATUS_CONFIG[status] || STATUS_CONFIG['NUEVO'];
            const isAnimating = animatingCards.has(pedido.firebaseId);
            const esOrigen = pedido.sucursalOrigen === user;
            const esDestino = pedido.sucursalDestino === user;
            const mostrarPeso = mostrarPesos[pedido.firebaseId];

            return (
              <div
                key={pedido.firebaseId}
                className={`card-enter card-transition ${isAnimating ? 'card-transition' : ''}`}
                style={{
                  background: config.bg,
                  borderRadius: '28px',
                  border: `4px solid ${config.border}`,
                  overflow: 'hidden',
                  position: 'relative',
                  boxShadow: config.shadow || '0 20px 40px -10px rgba(0,0,0,0.2)',
                  transform: isAnimating ? 'scale(0.98)' : 'scale(1)',
                  opacity: isAnimating ? 0.8 : 1,
                  animationDelay: `${index * 0.05}s`
                }}
              >
                {/* Pulse animation */}
                {config.pulse && (
                  <div
                    className="pulse-bg"
                    style={{
                      position: 'absolute',
                      inset: 0,
                      background: config.color,
                      opacity: 0.15,
                      pointerEvents: 'none'
                    }}
                  />
                )}

                <div style={{ padding: '0', position: 'relative' }}>
                  {/* Header */}
                  <div style={{
                    background: 'rgba(255,255,255,0.95)',
                    padding: '24px 28px',
                    borderBottom: `3px solid ${config.border}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '20px',
                    flexWrap: 'wrap'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <div style={{
                        width: '56px',
                        height: '56px',
                        borderRadius: '16px',
                        background: config.color,
                        color: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: `0 8px 20px ${config.color}50`,
                        fontSize: '24px',
                        fontWeight: 900
                      }}>
                        #{pedido.id}
                      </div>
                      <div>
                        <div style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '8px 16px',
                          borderRadius: '20px',
                          background: config.color,
                          color: 'white',
                          fontSize: '12px',
                          fontWeight: 800,
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px',
                          marginBottom: '6px'
                        }}>
                          {config.icon}
                          {config.label}
                        </div>
                        <div style={{ 
                          fontSize: '14px', 
                          color: '#475569', 
                          fontWeight: 700,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px'
                        }}>
                          {pedido.sucursalOrigen} 
                          <span style={{ color: config.color }}>{Icons.arrowRight}</span>
                          {pedido.sucursalDestino}
                        </div>
                      </div>
                    </div>

                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-end',
                      gap: '4px'
                    }}>
                      <div style={{
                        fontSize: '12px',
                        color: '#64748b',
                        fontWeight: 600
                      }}>
                        {pedido.fechaPedido}
                      </div>
                      {pedido.esStandby && (
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '6px 12px',
                          background: '#fef3c7',
                          borderRadius: '20px',
                          fontSize: '11px',
                          fontWeight: 800,
                          color: '#d97706'
                        }}>
                          {Icons.calendar}
                          Entrega: {pedido.fechaEntrega}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Contenido */}
                  <div style={{ padding: '24px' }}>
                    {/* Nota General */}
                    {pedido.notaGeneral && (
                      <div style={{
                        background: 'rgba(59, 130, 246, 0.1)',
                        border: '2px solid rgba(59, 130, 246, 0.3)',
                        borderRadius: '16px',
                        padding: '16px 20px',
                        marginBottom: '20px',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '12px'
                      }}>
                        <span style={{ fontSize: '20px' }}>📋</span>
                        <div>
                          <div style={{ fontSize: '11px', color: '#3b82f6', fontWeight: 800, textTransform: 'uppercase', marginBottom: '4px' }}>
                            Nota General
                          </div>
                          <div style={{ fontSize: '14px', color: '#1e293b', fontWeight: 700, fontStyle: 'italic' }}>
                            {pedido.notaGeneral}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Info de preparación y envío */}
                    <div style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '12px',
                      marginBottom: '20px'
                    }}>
                      {pedido.preparadoPor && (
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '10px 16px',
                          background: 'white',
                          borderRadius: '12px',
                          border: '2px solid rgba(249, 115, 22, 0.3)',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
                        }}>
                          <span style={{ fontSize: '20px' }}>👨‍🍳</span>
                          <div>
                            <div style={{ fontSize: '10px', color: '#c2410c', fontWeight: 700, textTransform: 'uppercase' }}>
                              Preparado por
                            </div>
                            <div style={{ fontSize: '14px', fontWeight: 800, color: '#1e293b' }}>
                              {pedido.preparadoPor}
                            </div>
                          </div>
                        </div>
                      )}

                      {pedido.enviadoCon && (
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '10px 16px',
                          background: 'white',
                          borderRadius: '12px',
                          border: '2px solid rgba(99, 102, 241, 0.3)',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
                        }}>
                          <span style={{ fontSize: '20px' }}>🛵</span>
                          <div>
                            <div style={{ fontSize: '10px', color: '#4f46e5', fontWeight: 700, textTransform: 'uppercase' }}>
                              Enviado con
                            </div>
                            <div style={{ fontSize: '14px', fontWeight: 800, color: '#1e293b' }}>
                              {pedido.enviadoCon}
                            </div>
                            {pedido.timestampEnviado && (
                              <div style={{ fontSize: '10px', color: '#64748b' }}>
                                {pedido.timestampEnviado}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Botón Ver Pesos Reales (solo si está listo o enviado) */}
                    {(status === 'LISTO' || status === 'ENVIADO') && (
                      <button
                        onClick={() => toggleMostrarPesos(pedido.firebaseId)}
                        className="btn-hover"
                        style={{
                          width: '100%',
                          padding: '14px 20px',
                          borderRadius: '12px',
                          border: '2px solid rgba(16, 185, 129, 0.3)',
                          background: mostrarPeso ? 'rgba(16, 185, 129, 0.2)' : 'white',
                          color: '#059669',
                          fontWeight: 700,
                          fontSize: '14px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '10px',
                          marginBottom: '20px'
                        }}
                      >
                        {Icons.scale}
                        {mostrarPeso ? 'Ocultar Pesos Reales' : 'Ver Pesos Reales'}
                      </button>
                    )}

                    {/* Tabla de Pesos */}
                    {mostrarPeso && (
                      <div style={{
                        background: 'white',
                        borderRadius: '16px',
                        overflow: 'hidden',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                        marginBottom: '20px',
                        border: '2px solid rgba(16, 185, 129, 0.3)'
                      }}>
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: '1fr 100px 100px',
                          gap: '12px',
                          padding: '12px 16px',
                          background: 'rgba(16, 185, 129, 0.1)',
                          fontSize: '10px',
                          fontWeight: 800,
                          color: '#059669',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px'
                        }}>
                          <div>Producto</div>
                          <div style={{ textAlign: 'center' }}>Solicitado</div>
                          <div style={{ textAlign: 'center' }}>Real</div>
                        </div>
                        {pedido.items.map((item, idx) => (
                          <div 
                            key={idx}
                            style={{
                              display: 'grid',
                              gridTemplateColumns: '1fr 100px 100px',
                              gap: '12px',
                              padding: '12px 16px',
                              borderBottom: idx < pedido.items.length - 1 ? '1px solid rgba(0,0,0,0.05)' : 'none',
                              alignItems: 'center'
                            }}
                          >
                            <div>
                              <div style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b' }}>
                                {item.producto}
                              </div>
                              {item.nota && (
                                <div style={{ fontSize: '10px', color: '#d97706', marginTop: '2px' }}>
                                  ⚠️ {item.nota}
                                </div>
                              )}
                            </div>
                            <div style={{ textAlign: 'center', fontSize: '13px', fontWeight: 600, color: '#3b82f6' }}>
                              {item.cantidad} {item.unidad}
                            </div>
                            <div style={{ textAlign: 'center', fontSize: '14px', fontWeight: 800, color: '#16a34a' }}>
                              {item.pesoReal || '-'} lb
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Acciones */}
                    <div style={{ marginTop: '16px' }}>
                      {/* Botón Enviar (solo si es LISTO y soy el destino) */}
                      {status === 'LISTO' && esDestino && (
                        <button
                          onClick={() => {
                            setModalRepartidor(pedido.firebaseId);
                            setRepartidorSeleccionado(null);
                          }}
                          className="btn-hover"
                          style={{
                            width: '100%',
                            padding: '18px 24px',
                            borderRadius: '14px',
                            border: 'none',
                            background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                            color: 'white',
                            fontWeight: 800,
                            fontSize: '16px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '12px',
                            boxShadow: '0 10px 25px rgba(99, 102, 241, 0.4)'
                          }}
                        >
                          <span style={{ fontSize: '24px' }}>🚚</span>
                          Despachar Pedido
                        </button>
                      )}

                      {/* Botón Cambiar Repartidor (solo si es ENVIADO) */}
                      {status === 'ENVIADO' && esDestino && (
                        <div style={{ display: 'flex', gap: '12px' }}>
                          <button
                            onClick={() => {
                              setModalRepartidor(pedido.firebaseId);
                              setRepartidorSeleccionado(null);
                            }}
                            className="btn-hover"
                            style={{
                              flex: 1,
                              padding: '16px 24px',
                              borderRadius: '14px',
                              border: '2px solid #6366f1',
                              background: 'white',
                              color: '#4f46e5',
                              fontWeight: 800,
                              fontSize: '15px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '8px'
                            }}
                          >
                            {Icons.refresh}
                            Cambiar Repartidor
                          </button>
                        </div>
                      )}

                      {/* Info para el origen */}
                      {esOrigen && status !== 'ENVIADO' && (
                        <div style={{
                          padding: '14px 18px',
                          background: 'rgba(59, 130, 246, 0.1)',
                          borderRadius: '12px',
                          border: '2px solid rgba(59, 130, 246, 0.2)',
                          color: '#2563eb',
                          fontSize: '13px',
                          fontWeight: 700,
                          textAlign: 'center'
                        }}>
                          📦 Pedido enviado a {pedido.sucursalDestino} • Estado: {config.label}
                        </div>
                      )}

                      {/* Info enviado para origen */}
                      {esOrigen && status === 'ENVIADO' && (
                        <div style={{
                          padding: '14px 18px',
                          background: 'rgba(99, 102, 241, 0.1)',
                          borderRadius: '12px',
                          border: '2px solid rgba(99, 102, 241, 0.2)',
                          color: '#4f46e5',
                          fontSize: '13px',
                          fontWeight: 700,
                          textAlign: 'center',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '8px'
                        }}>
                          {Icons.check}
                          Pedido enviado con {pedido.enviadoCon}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}