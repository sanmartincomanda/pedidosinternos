"use client";
import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { ref, update } from "firebase/database";

// Iconos SVG estilo delivery
const Icons = {
  chef: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 4h12M6 4v16a2 2 0 002 2h8a2 2 0 002-2V4M6 4L4 2m16 2l2-2M12 14v6m-4-4l4 4 4-4"/></svg>,
  clock: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>,
  check: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6L9 17l-5-5"/></svg>,
  fire: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8.5 14.5A2.5 2.5 0 0011 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 11-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 002.5 2.5z"/></svg>,
  alert: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
  package: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>,
  scale: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>,
  close: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  calendar: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
};

// Configuración de estados visuales
const STATUS_CONFIG = {
  'NUEVO': {
    color: '#3b82f6',
    bg: 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)',
    border: '#60a5fa',
    icon: Icons.clock,
    label: 'Nuevo Pedido',
    pulse: true,
    shadow: '0 20px 40px -10px rgba(59, 130, 246, 0.3)'
  },
  'STANDBY_ENTREGA': {
    color: '#f59e0b',
    bg: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
    border: '#fbbf24',
    icon: Icons.alert,
    label: 'Standby - Entrega Programada',
    pulse: true,
    shadow: '0 20px 40px -10px rgba(245, 158, 11, 0.3)'
  },
  'PREPARACION': {
    color: '#f97316',
    bg: 'linear-gradient(135deg, #ffedd5 0%, #fed7aa 100%)',
    border: '#fb923c',
    icon: Icons.fire,
    label: 'En Preparación',
    pulse: false,
    shadow: '0 20px 40px -10px rgba(249, 115, 22, 0.3)'
  },
  'LISTO': {
    color: '#10b981',
    bg: 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)',
    border: '#34d399',
    icon: Icons.check,
    label: 'Listo para Enviar',
    pulse: false,
    shadow: '0 20px 40px -10px rgba(16, 185, 129, 0.3)'
  }
};

export default function Cocina({ user, pedidos, personalCocina }) {
  const [modalPreparador, setModalPreparador] = useState(null);
  const [preparadorSeleccionado, setPreparadorSeleccionado] = useState(null);
  const [animatingCards, setAnimatingCards] = useState(new Set());
  const [pesosEditando, setPesosEditando] = useState({}); // firebaseId_itemIdx: valor

  // Filtrar pedidos: solo los que van a esta sucursal Y no están enviados
  const pedidosEnProceso = pedidos.filter(p => 
    p.sucursalDestino === user && 
    p.estado !== 'ENVIADO' &&
    p.estado !== 'ENTREGADO'
  );

  const actualizarPesoReal = (firebaseId, itemIdx, valor) => {
    const key = `${firebaseId}_${itemIdx}`;
    setPesosEditando({ ...pesosEditando, [key]: valor });
  };

  const guardarPesoReal = (firebaseId, itemIdx) => {
    const key = `${firebaseId}_${itemIdx}`;
    const valor = pesosEditando[key];
    if (valor === undefined) return;

    const pedido = pedidos.find(p => p.firebaseId === firebaseId);
    if (!pedido) return;

    const nuevosItems = [...pedido.items];
    nuevosItems[itemIdx].pesoReal = valor;

    update(ref(db, `pedidos_internos/${firebaseId}`), {
      items: nuevosItems
    });

    // Limpiar del estado temporal
    const newPesos = { ...pesosEditando };
    delete newPesos[key];
    setPesosEditando(newPesos);
  };

  const iniciarPreparacion = (firebaseId, preparador) => {
    setAnimatingCards(prev => new Set([...prev, firebaseId]));
    
    update(ref(db, `pedidos_internos/${firebaseId}`), {
      estado: 'PREPARACION',
      preparadoPor: preparador,
      timestampPreparacion: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
      timestamp: Date.now()
    });

    setTimeout(() => {
      setAnimatingCards(prev => {
        const next = new Set(prev);
        next.delete(firebaseId);
        return next;
      });
    }, 300);

    setModalPreparador(null);
    setPreparadorSeleccionado(null);
  };

  const marcarListo = (firebaseId) => {
    const pedido = pedidos.find(p => p.firebaseId === firebaseId);
    if (!pedido) return;

    // Verificar que todos los pesos reales estén llenos
    const todosLosPesosLlenos = pedido.items.every(item => 
      item.pesoReal && item.pesoReal !== ""
    );

    if (!todosLosPesosLlenos) {
      alert("⚠️ Debes ingresar el PESO REAL de todos los productos antes de marcar como listo");
      return;
    }

    setAnimatingCards(prev => new Set([...prev, firebaseId]));

    update(ref(db, `pedidos_internos/${firebaseId}`), {
      estado: 'LISTO',
      timestampListo: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
      timestamp: Date.now()
    });

    setTimeout(() => {
      setAnimatingCards(prev => {
        const next = new Set(prev);
        next.delete(firebaseId);
        return next;
      });
    }, 300);
  };

  const getTimeElapsed = (timestamp) => {
    if (!timestamp) return '';
    const diff = Math.floor((Date.now() - timestamp) / 60000);
    if (diff < 1) return 'Ahora';
    if (diff < 60) return `${diff}m`;
    return `${Math.floor(diff / 60)}h ${diff % 60}m`;
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
        @keyframes shake {
          0%, 100% { transform: rotate(0deg); }
          25% { transform: rotate(-3deg); }
          75% { transform: rotate(3deg); }
        }
        .card-enter { animation: slideIn 0.4s ease-out forwards; }
        .pulse-bg { animation: pulse-ring 2s ease-in-out infinite; }
        .shake-icon { animation: shake 0.5s ease-in-out infinite; }
        .btn-hover { transition: all 0.2s ease; }
        .btn-hover:hover { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(0,0,0,0.2); }
        .card-transition { transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
        .card-transition:hover { transform: translateY(-4px); }
        .preparador-card { 
          transition: all 0.2s ease; 
          cursor: pointer;
        }
        .preparador-card:hover { 
          transform: scale(1.05); 
          box-shadow: 0 8px 25px rgba(0,0,0,0.15); 
        }
        .preparador-card.selected { 
          background: linear-gradient(135deg, #f97316 0%, #ea580c 100%) !important; 
          color: white !important;
          border-color: #f97316 !important;
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
            background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 10px 25px rgba(249, 115, 22, 0.4)',
            color: 'white'
          }}>
            {Icons.chef}
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 800, color: 'white' }}>
              Cocina / CEDI
            </h1>
            <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>
              {user} • {pedidosEnProceso.length} pedidos activos
            </p>
          </div>
        </div>
      </div>

      {/* Modal Seleccionar Preparador */}
      {modalPreparador && (
        <div 
          className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setModalPreparador(null);
              setPreparadorSeleccionado(null);
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
                  ¿Quién prepara este pedido?
                </h2>
                <p style={{ margin: 0, color: '#64748b', fontSize: '14px' }}>
                  Pedido #{pedidos.find(p => p.firebaseId === modalPreparador)?.id}
                </p>
              </div>
              <button
                onClick={() => {
                  setModalPreparador(null);
                  setPreparadorSeleccionado(null);
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

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '12px',
              marginBottom: '24px'
            }}>
              {personalCocina.map((nombre) => (
                <button
                  key={nombre}
                  type="button"
                  onClick={() => setPreparadorSeleccionado(nombre)}
                  className={`preparador-card ${preparadorSeleccionado === nombre ? 'selected' : ''}`}
                  style={{
                    padding: '20px',
                    borderRadius: '16px',
                    border: '2px solid',
                    borderColor: preparadorSeleccionado === nombre ? '#f97316' : '#e2e8f0',
                    background: preparadorSeleccionado === nombre 
                      ? 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)' 
                      : '#f8fafc',
                    color: preparadorSeleccionado === nombre ? 'white' : '#475569',
                    fontWeight: preparadorSeleccionado === nombre ? 800 : 700,
                    fontSize: '14px',
                    cursor: 'pointer',
                    textAlign: 'center',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  <span style={{ fontSize: '32px' }}>👨‍🍳</span>
                  <span>{nombre}</span>
                </button>
              ))}
            </div>

            <button
              onClick={() => {
                if (preparadorSeleccionado) {
                  iniciarPreparacion(modalPreparador, preparadorSeleccionado);
                }
              }}
              disabled={!preparadorSeleccionado}
              style={{
                width: '100%',
                padding: '16px',
                borderRadius: '12px',
                border: 'none',
                background: preparadorSeleccionado 
                  ? 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)' 
                  : '#cbd5e1',
                color: 'white',
                fontWeight: 800,
                fontSize: '16px',
                cursor: preparadorSeleccionado ? 'pointer' : 'not-allowed',
                transition: 'all 0.2s',
                boxShadow: preparadorSeleccionado ? '0 8px 25px rgba(249, 115, 22, 0.4)' : 'none'
              }}
            >
              {preparadorSeleccionado ? `Asignar a ${preparadorSeleccionado}` : 'Selecciona un preparador'}
            </button>
          </div>
        </div>
      )}

      {/* Lista de Pedidos */}
      {pedidosEnProceso.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '80px 20px',
          background: 'rgba(255,255,255,0.03)',
          borderRadius: '24px',
          border: '2px dashed rgba(255,255,255,0.1)'
        }}>
          <div style={{ fontSize: '64px', marginBottom: '16px' }}>🍳</div>
          <h3 style={{ fontSize: '24px', margin: '0 0 8px 0', color: 'white' }}>No hay pedidos pendientes</h3>
          <p style={{ margin: 0, color: 'rgba(255,255,255,0.5)' }}>
            Los nuevos pedidos aparecerán aquí automáticamente
          </p>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(600px, 1fr))',
          gap: '24px'
        }}>
          {pedidosEnProceso.map((pedido, index) => {
            const status = pedido.estado || 'NUEVO';
            const config = STATUS_CONFIG[status] || STATUS_CONFIG['NUEVO'];
            const isAnimating = animatingCards.has(pedido.firebaseId);
            const isStandby = status === 'STANDBY_ENTREGA';
            
            // Verificar si todos los pesos están llenos
            const todosPesosLlenos = pedido.items.every(item => 
              item.pesoReal && item.pesoReal !== ""
            );

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
                  boxShadow: config.shadow,
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

                {/* ALERTA STANDBY DESTACADA */}
                {isStandby && (
                  <div style={{
                    background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                    color: 'white',
                    padding: '16px 24px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    fontWeight: 800,
                    fontSize: '14px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>
                    <span style={{ fontSize: '24px' }}>⏰</span>
                    <div>
                      <div style={{ fontSize: '12px', opacity: 0.9 }}>Recuerda entregar pedido</div>
                      <div style={{ fontSize: '16px' }}>
                        Entrega programada: {pedido.fechaEntrega}
                      </div>
                    </div>
                  </div>
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
                      <div 
                        className={config.pulse ? 'shake-icon' : ''}
                        style={{
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
                        }}
                      >
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
                          <span style={{ fontSize: '16px' }}>⏱️</span>
                          {getTimeElapsed(pedido.timestamp)} • {pedido.sucursalOrigen} → {pedido.sucursalDestino}
                        </div>
                      </div>
                    </div>

                    {/* Preparador asignado */}
                    {pedido.preparadoPor && (
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '12px 18px',
                        background: 'white',
                        borderRadius: '14px',
                        border: `2px solid ${config.color}30`,
                        boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
                      }}>
                        <span style={{ fontSize: '28px' }}>👨‍🍳</span>
                        <div>
                          <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                            Preparando
                          </div>
                          <div style={{ fontSize: '16px', fontWeight: 800, color: '#1e293b' }}>
                            {pedido.preparadoPor}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Contenido */}
                  <div style={{ padding: '24px' }}>
                    {/* Nota General del Pedido */}
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
                            Nota General del Pedido
                          </div>
                          <div style={{ fontSize: '14px', color: '#1e293b', fontWeight: 700, fontStyle: 'italic' }}>
                            {pedido.notaGeneral}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Tabla de Productos */}
                    <div style={{
                      background: 'white',
                      borderRadius: '20px',
                      overflow: 'hidden',
                      boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
                      border: `3px solid ${config.border}60`
                    }}>
                      {/* Header de tabla */}
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 100px 140px',
                        gap: '12px',
                        padding: '16px 20px',
                        background: 'rgba(0,0,0,0.03)',
                        borderBottom: '2px solid rgba(0,0,0,0.05)',
                        fontSize: '11px',
                        fontWeight: 800,
                        color: '#64748b',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px'
                      }}>
                        <div>Producto</div>
                        <div style={{ textAlign: 'center' }}>Solicitado</div>
                        <div style={{ textAlign: 'center' }}>Peso Real</div>
                      </div>

                      {/* Filas */}
                      {pedido.items.map((item, idx) => {
                        const pesoKey = `${pedido.firebaseId}_${idx}`;
                        const pesoEditado = pesosEditando[pesoKey] !== undefined ? pesosEditando[pesoKey] : (item.pesoReal || '');
                        
                        return (
                          <div 
                            key={idx}
                            style={{
                              display: 'grid',
                              gridTemplateColumns: '1fr 100px 140px',
                              gap: '12px',
                              padding: '16px 20px',
                              borderBottom: idx < pedido.items.length - 1 ? '1px solid rgba(0,0,0,0.05)' : 'none',
                              alignItems: 'center',
                              background: idx % 2 === 0 ? 'white' : 'rgba(0,0,0,0.01)'
                            }}
                          >
                            {/* Producto + Nota Especial */}
                            <div>
                              <div style={{
                                fontSize: '15px',
                                fontWeight: 800,
                                color: '#1e293b',
                                textTransform: 'uppercase',
                                marginBottom: item.nota ? '8px' : '0'
                              }}>
                                {item.producto}
                              </div>
                              
                              {/* NOTA ESPECIAL POR PRODUCTO - DESTACADA */}
                              {item.nota && (
                                <div style={{
                                  background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
                                  border: '2px solid #fbbf24',
                                  borderRadius: '10px',
                                  padding: '10px 14px',
                                  display: 'flex',
                                  alignItems: 'flex-start',
                                  gap: '8px',
                                  marginTop: '6px'
                                }}>
                                  <span style={{ fontSize: '16px' }}>⚠️</span>
                                  <div>
                                    <div style={{ fontSize: '10px', color: '#d97706', fontWeight: 800, textTransform: 'uppercase' }}>
                                      Nota Especial
                                    </div>
                                    <div style={{ fontSize: '13px', color: '#92400e', fontWeight: 700 }}>
                                      {item.nota}
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Cantidad Solicitada */}
                            <div style={{ textAlign: 'center' }}>
                              <div style={{
                                fontSize: '18px',
                                fontWeight: 800,
                                color: '#3b82f6'
                              }}>
                                {item.cantidad}
                              </div>
                              <div style={{
                                fontSize: '11px',
                                color: '#64748b',
                                fontWeight: 600,
                                textTransform: 'uppercase'
                              }}>
                                {item.unidad}
                              </div>
                            </div>

                            {/* Peso Real - Input */}
                            <div>
                              {status === 'NUEVO' || status === 'STANDBY_ENTREGA' ? (
                                <div style={{
                                  padding: '12px',
                                  background: '#f3f4f6',
                                  borderRadius: '10px',
                                  textAlign: 'center',
                                  color: '#9ca3af',
                                  fontSize: '12px',
                                  fontWeight: 700,
                                  border: '2px dashed #d1d5db'
                                }}>
                                  🔒 BLOQUEADO
                                </div>
                              ) : (
                                <div style={{ position: 'relative' }}>
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={pesoEditado}
                                    onChange={(e) => actualizarPesoReal(pedido.firebaseId, idx, e.target.value)}
                                    onBlur={() => guardarPesoReal(pedido.firebaseId, idx)}
                                    placeholder="0.00"
                                    style={{
                                      width: '100%',
                                      padding: '12px',
                                      background: pesoEditado ? 'rgba(34, 197, 94, 0.1)' : 'white',
                                      border: `2px solid ${pesoEditado ? '#22c55e' : '#e5e7eb'}`,
                                      borderRadius: '10px',
                                      textAlign: 'center',
                                      fontSize: '16px',
                                      fontWeight: 800,
                                      color: pesoEditado ? '#16a34a' : '#374151',
                                      transition: 'all 0.2s'
                                    }}
                                  />
                                  <div style={{
                                    position: 'absolute',
                                    right: '8px',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    fontSize: '10px',
                                    color: '#9ca3af',
                                    fontWeight: 700
                                  }}>
                                    lb
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Botones de Acción */}
                    <div style={{ marginTop: '24px' }}>
                      {(status === 'NUEVO' || status === 'STANDBY_ENTREGA') && (
                        <button
                          onClick={() => {
                            setModalPreparador(pedido.firebaseId);
                            setPreparadorSeleccionado(null);
                          }}
                          className="btn-hover"
                          style={{
                            width: '100%',
                            padding: '18px 24px',
                            borderRadius: '14px',
                            border: '2px dashed #f97316',
                            background: 'rgba(249, 115, 22, 0.1)',
                            color: '#ea580c',
                            fontWeight: 800,
                            fontSize: '16px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '12px',
                            transition: 'all 0.2s'
                          }}
                          onMouseEnter={(e) => {
                            e.target.style.background = 'rgba(249, 115, 22, 0.2)';
                            e.target.style.borderStyle = 'solid';
                          }}
                          onMouseLeave={(e) => {
                            e.target.style.background = 'rgba(249, 115, 22, 0.1)';
                            e.target.style.borderStyle = 'dashed';
                          }}
                        >
                          <span style={{ fontSize: '24px' }}>👨‍🍳</span>
                          {isStandby ? 'Iniciar Preparación (Standby)' : 'Iniciar Preparación'}
                        </button>
                      )}

                      {status === 'PREPARACION' && (
                        <button
                          onClick={() => marcarListo(pedido.firebaseId)}
                          disabled={!todosPesosLlenos}
                          className="btn-hover"
                          style={{
                            width: '100%',
                            padding: '20px 24px',
                            borderRadius: '14px',
                            border: 'none',
                            background: todosPesosLlenos 
                              ? 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)' 
                              : '#e5e7eb',
                            color: todosPesosLlenos ? 'white' : '#9ca3af',
                            fontWeight: 800,
                            fontSize: '17px',
                            cursor: todosPesosLlenos ? 'pointer' : 'not-allowed',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '12px',
                            boxShadow: todosPesosLlenos ? '0 10px 25px rgba(34, 197, 94, 0.4)' : 'none',
                            transition: 'all 0.2s'
                          }}
                        >
                          {todosPesosLlenos ? (
                            <>{Icons.check} Marcar como Listo</>
                          ) : (
                            <>🔒 Completa todos los pesos reales</>
                          )}
                        </button>
                      )}

                      {status === 'LISTO' && (
                        <div style={{
                          padding: '16px 20px',
                          background: 'rgba(34, 197, 94, 0.1)',
                          borderRadius: '12px',
                          border: '2px solid #22c55e',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '12px',
                          color: '#16a34a',
                          fontWeight: 800,
                          fontSize: '16px'
                        }}>
                          {Icons.check}
                          Pedido Listo para Enviar
                        </div>
                      )}
                    </div>

                    {/* Timestamps */}
                    {pedido.timestampPreparacion && (
                      <div style={{
                        marginTop: '16px',
                        display: 'flex',
                        gap: '16px',
                        fontSize: '12px',
                        color: '#64748b',
                        fontWeight: 600
                      }}>
                        <div style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '6px',
                          padding: '8px 12px',
                          background: 'rgba(249, 115, 22, 0.1)',
                          borderRadius: '8px',
                          color: '#c2410c'
                        }}>
                          <span>🕐</span>
                          Inicio: {pedido.timestampPreparacion}
                        </div>
                        {pedido.timestampListo && (
                          <div style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '6px',
                            padding: '8px 12px',
                            background: 'rgba(34, 197, 94, 0.1)',
                            borderRadius: '8px',
                            color: '#16a34a'
                          }}>
                            <span>✅</span>
                            Listo: {pedido.timestampListo}
                          </div>
                        )}
                      </div>
                    )}
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