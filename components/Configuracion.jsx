"use client";
import React, { useState, useEffect } from 'react';

// Iconos SVG
const Icons = {
  settings: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/></svg>,
  chef: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 4h12M6 4v16a2 2 0 002 2h8a2 2 0 002-2V4M6 4L4 2m16 2l2-2M12 14v6m-4-4l4 4 4-4"/></svg>,
  truck: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>,
  plus: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  trash: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>,
  save: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>,
  user: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
};

export default function Configuracion({ config, setConfig }) {
  const [activeTab, setActiveTab] = useState('cocina');
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [cocinaLocal, setCocinaLocal] = useState(config?.personalCocina || []);
  const [transporteLocal, setTransporteLocal] = useState(config?.personalTransporte || []);

  // Sincronizar con props cuando cambien
  useEffect(() => {
    if (config) {
      setCocinaLocal(config.personalCocina || []);
      setTransporteLocal(config.personalTransporte || []);
    }
  }, [config]);

  const guardarConfiguracion = () => {
    const nuevaConfig = {
      personalCocina: cocinaLocal,
      personalTransporte: transporteLocal
    };
    
    // Guardar en localStorage
    localStorage.setItem('appConfig', JSON.stringify(nuevaConfig));
    
    // Actualizar estado padre
    if (setConfig) {
      setConfig(nuevaConfig);
    }
    
    setMensaje('✅ Configuración guardada exitosamente');
    setTimeout(() => setMensaje(''), 3000);
  };

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

  // Si no hay config, mostrar mensaje
  if (!config) {
    return (
      <div style={{ color: 'white', padding: '40px', textAlign: 'center' }}>
        <h2>Cargando configuración...</h2>
      </div>
    );
  }

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
        .card-enter { animation: slideIn 0.4s ease-out forwards; }
        .fade-in { animation: fadeIn 0.3s ease-out; }
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
              Gestión de personal y ajustes
            </p>
          </div>
        </div>

        {/* Botón Guardar */}
        <button
          onClick={guardarConfiguracion}
          className="btn-hover"
          style={{
            padding: '14px 24px',
            borderRadius: '12px',
            border: 'none',
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            color: 'white',
            fontWeight: 800,
            fontSize: '14px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 8px 20px rgba(16, 185, 129, 0.4)'
          }}
        >
          {Icons.save}
          Guardar Cambios
        </button>
      </div>

      {/* Mensaje de confirmación */}
      {mensaje && (
        <div className="fade-in" style={{
          padding: '16px 20px',
          borderRadius: '12px',
          marginBottom: '20px',
          background: mensaje.includes('✅') ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)',
          border: `1px solid ${mensaje.includes('✅') ? 'rgba(16, 185, 129, 0.4)' : 'rgba(245, 158, 11, 0.4)'}`,
          color: mensaje.includes('✅') ? '#34d399' : '#fbbf24',
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
          { key: 'cocina', label: 'Personal de Cocina', icon: Icons.chef, color: '#f97316' },
          { key: 'transporte', label: 'Personal de Transporte', icon: Icons.truck, color: '#6366f1' }
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

      {/* Contenido según tab activa */}
      <div className="card-enter" style={{
        background: 'rgba(255,255,255,0.05)',
        borderRadius: '24px',
        padding: '32px',
        border: '1px solid rgba(255,255,255,0.1)'
      }}>
        {activeTab === 'cocina' && (
          <div>
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
            <p style={{
              margin: '0 0 24px 0',
              fontSize: '14px',
              color: 'rgba(255,255,255,0.5)'
            }}>
              Gestiona quién puede preparar pedidos en tu sucursal
            </p>

            {/* Agregar nuevo */}
            <div style={{
              display: 'flex',
              gap: '12px',
              marginBottom: '24px'
            }}>
              <div style={{ flex: 1, position: 'relative' }}>
                <div style={{
                  position: 'absolute',
                  left: '16px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#9ca3af'
                }}>
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

            {/* Lista de personal */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
              gap: '12px'
            }}>
              {cocinaLocal.map((nombre, index) => (
                <div
                  key={index}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '16px 20px',
                    background: 'rgba(249, 115, 22, 0.1)',
                    borderRadius: '12px',
                    border: '2px solid rgba(249, 115, 22, 0.2)'
                  }}
                >
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    fontWeight: 700,
                    color: '#fdba74',
                    fontSize: '15px'
                  }}>
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
                      justifyContent: 'center',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(239, 68, 68, 0.3)';
                      e.currentTarget.style.transform = 'scale(1.1)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)';
                      e.currentTarget.style.transform = 'scale(1)';
                    }}
                  >
                    {Icons.trash}
                  </button>
                </div>
              ))}
            </div>

            {cocinaLocal.length === 0 && (
              <div style={{
                textAlign: 'center',
                padding: '40px',
                color: 'rgba(255,255,255,0.4)',
                fontStyle: 'italic'
              }}>
                No hay personal de cocina registrado
              </div>
            )}
          </div>
        )}

        {activeTab === 'transporte' && (
          <div>
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
            <p style={{
              margin: '0 0 24px 0',
              fontSize: '14px',
              color: 'rgba(255,255,255,0.5)'
            }}>
              Gestiona quién puede transportar pedidos entre sucursales
            </p>

            {/* Agregar nuevo */}
            <div style={{
              display: 'flex',
              gap: '12px',
              marginBottom: '24px'
            }}>
              <div style={{ flex: 1, position: 'relative' }}>
                <div style={{
                  position: 'absolute',
                  left: '16px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#9ca3af'
                }}>
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

            {/* Lista de personal */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
              gap: '12px'
            }}>
              {transporteLocal.map((nombre, index) => (
                <div
                  key={index}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '16px 20px',
                    background: 'rgba(99, 102, 241, 0.1)',
                    borderRadius: '12px',
                    border: '2px solid rgba(99, 102, 241, 0.2)'
                  }}
                >
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    fontWeight: 700,
                    color: '#a5b4fc',
                    fontSize: '15px'
                  }}>
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
                      justifyContent: 'center',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(239, 68, 68, 0.3)';
                      e.currentTarget.style.transform = 'scale(1.1)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)';
                      e.currentTarget.style.transform = 'scale(1)';
                    }}
                  >
                    {Icons.trash}
                  </button>
                </div>
              ))}
            </div>

            {transporteLocal.length === 0 && (
              <div style={{
                textAlign: 'center',
                padding: '40px',
                color: 'rgba(255,255,255,0.4)',
                fontStyle: 'italic'
              }}>
                No hay personal de transporte registrado
              </div>
            )}
          </div>
        )}
      </div>

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
            Tip de configuración
          </div>
          <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)' }}>
            Los cambios se guardan localmente en este dispositivo. Cada sucursal puede tener su propia configuración de personal. 
            Presiona "Guardar Cambios" para aplicar los ajustes.
          </div>
        </div>
      </div>
    </div>
  );
}