"use client";
import React, { useState, useEffect } from 'react';
import { db } from '../firebase'; 
import { ref, onValue } from "firebase/database";
import Formulario from './Formulario';
import Cocina from './Cocina';
import EstadoPedidos from './EstadoPedidos';
import Historial from './Historial';
import Configuracion from './Configuracion';

// Iconos SVG (mismo estilo que la app de delivery)
const Icons = {
  chef: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 4h12M6 4v16a2 2 0 002 2h8a2 2 0 002-2V4M6 4L4 2m16 2l2-2M12 14v6m-4-4l4 4 4-4"/></svg>,
  clipboard: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 2v2H5v18h14V4h-4V2h-6z"/><path d="M9 12h6M9 16h6"/></svg>,
  truck: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>,
  history: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  settings: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/></svg>,
  logout: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/></svg>,
  lock: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>,
  user: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
};

export default function AppInterna() {
  const [user, setUser] = useState(null); 
  const [view, setView] = useState('formulario'); 
  const [pedidos, setPedidos] = useState([]); 
  const [orderId, setOrderId] = useState(1);
  const [config, setConfig] = useState({
    personalCocina: ["Marcos Ramirez", "Miguel Bustamante", "David", "Roberto Marin"],
    personalTransporte: ["Noel Hernandez", "Noel Bendaña", "Vladimir", "David", "Nelson", "Julio Amador", "Carlos Mora"]
  });

  // Estados para Login
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Tabla de usuarios
  const sucursalesRegistradas = [
    { nombre: 'Granada Gold', pass: 'granada2026' },
    { nombre: 'Masaya Gold', pass: 'masaya2026' },
    { nombre: 'Carnes Amparito', pass: 'amparito2026' },
    { nombre: 'Cedi', pass: 'cedi2026' },
    { nombre: 'Luis Saenz', pass: 'admin123' }
  ];

  const handleLogin = (e) => {
    e.preventDefault();
    const encontrado = sucursalesRegistradas.find(
      s => s.nombre.toLowerCase() === username.toLowerCase() && s.pass === password
    );

    if (encontrado) {
      setUser(encontrado.nombre);
      setError('');
      setPassword('');
    } else {
      setError('Usuario o contraseña incorrectos');
    }
  };

  // Cargar configuración desde localStorage
  useEffect(() => {
    const savedConfig = localStorage.getItem('appConfig');
    if (savedConfig) {
      setConfig(JSON.parse(savedConfig));
    }
  }, []);

  // Sincronización con Firebase
  useEffect(() => {
    if (!user) return;
    
    const pedidosRef = ref(db, 'pedidos_internos');
    const unsubscribe = onValue(pedidosRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const lista = Object.keys(data).map(key => ({
          firebaseId: key,
          ...data[key]
        }));
        // Filtrar pedidos relevantes para el usuario actual
        const pedidosRelevantes = lista.filter(p => 
          p.sucursalOrigen === user || 
          p.sucursalDestino === user ||
          user === 'Luis Saenz' // Admin ve todo
        );
        setPedidos(pedidosRelevantes.reverse());
      } else {
        setPedidos([]);
      }
    });
    return () => unsubscribe();
  }, [user]);

  // --- VISTA DE LOGIN CON DISEÑO DELIVERY ---
  if (!user) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
      }}>
        <style>{`
          @keyframes slideIn {
            from { opacity: 0; transform: translateY(20px) scale(0.95); }
            to { opacity: 1; transform: translateY(0) scale(1); }
          }
          @keyframes shake {
            0%, 100% { transform: translateX(0); }
            25% { transform: translateX(-5px); }
            75% { transform: translateX(5px); }
          }
          .login-card {
            animation: slideIn 0.5s ease-out;
          }
          .error-shake {
            animation: shake 0.4s ease-in-out;
          }
          .input-focus:focus {
            outline: none;
            border-color: #3b82f6;
            box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
          }
        `}</style>

        <div className="login-card" style={{
          background: 'white',
          borderRadius: '28px',
          padding: '40px',
          width: '100%',
          maxWidth: '420px',
          boxShadow: '0 25px 50px rgba(0,0,0,0.3)',
          border: '1px solid rgba(255,255,255,0.1)'
        }}>
          {/* Logo/Header */}
          <div style={{
            textAlign: 'center',
            marginBottom: '32px'
          }}>
            <div style={{
              width: '72px',
              height: '72px',
              borderRadius: '20px',
              background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px',
              boxShadow: '0 10px 25px rgba(59, 130, 246, 0.4)',
              color: 'white'
            }}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
              </svg>
            </div>
            <h1 style={{
              margin: '0 0 8px 0',
              fontSize: '28px',
              fontWeight: 800,
              color: '#1e293b',
              letterSpacing: '-0.5px'
            }}>
              Sistema Interno
            </h1>
            <p style={{
              margin: 0,
              color: '#64748b',
              fontSize: '14px',
              fontWeight: 500
            }}>
              Gestión de Pedidos entre Sucursales
            </p>
          </div>

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Usuario */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: 700,
                color: '#374151',
                marginBottom: '8px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>
                Sucursal
              </label>
              <div style={{ position: 'relative' }}>
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
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Ej: Granada Gold"
                  className="input-focus"
                  style={{
                    width: '100%',
                    padding: '14px 16px 14px 48px',
                    borderRadius: '12px',
                    border: '2px solid #e5e7eb',
                    fontSize: '15px',
                    fontWeight: 600,
                    color: '#1f2937',
                    transition: 'all 0.2s',
                    background: '#f9fafb'
                  }}
                />
              </div>
            </div>

            {/* Contraseña */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: 700,
                color: '#374151',
                marginBottom: '8px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>
                Contraseña
              </label>
              <div style={{ position: 'relative' }}>
                <div style={{
                  position: 'absolute',
                  left: '16px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#9ca3af'
                }}>
                  {Icons.lock}
                </div>
                <input 
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="input-focus"
                  style={{
                    width: '100%',
                    padding: '14px 48px 14px 48px',
                    borderRadius: '12px',
                    border: '2px solid #e5e7eb',
                    fontSize: '15px',
                    fontWeight: 600,
                    color: '#1f2937',
                    transition: 'all 0.2s',
                    background: '#f9fafb'
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: '#6b7280',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: 600,
                    padding: '4px 8px',
                    borderRadius: '6px'
                  }}
                >
                  {showPassword ? 'Ocultar' : 'Ver'}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="error-shake" style={{
                background: '#fee2e2',
                color: '#dc2626',
                padding: '12px 16px',
                borderRadius: '10px',
                fontSize: '13px',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                border: '1px solid #fecaca'
              }}>
                <span>⚠️</span>
                {error}
              </div>
            )}

            {/* Botón Entrar */}
            <button 
              type="submit"
              style={{
                width: '100%',
                padding: '16px',
                borderRadius: '12px',
                border: 'none',
                background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                color: 'white',
                fontSize: '16px',
                fontWeight: 800,
                cursor: 'pointer',
                marginTop: '8px',
                boxShadow: '0 8px 25px rgba(59, 130, 246, 0.4)',
                transition: 'all 0.2s',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}
              onMouseEnter={(e) => {
                e.target.style.transform = 'translateY(-2px)';
                e.target.style.boxShadow = '0 12px 30px rgba(59, 130, 246, 0.5)';
              }}
              onMouseLeave={(e) => {
                e.target.style.transform = 'translateY(0)';
                e.target.style.boxShadow = '0 8px 25px rgba(59, 130, 246, 0.4)';
              }}
            >
              Entrar al Sistema
            </button>
          </form>

          {/* Footer */}
          <div style={{
            marginTop: '24px',
            textAlign: 'center',
            fontSize: '12px',
            color: '#9ca3af',
            fontWeight: 500
          }}>
            Sistema de Gestión Interna v2.0
          </div>
        </div>
      </div>
    );
  }

  // --- VISTA PRINCIPAL CON DISEÑO DELIVERY ---
  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
      fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
      color: '#f8fafc',
      paddingBottom: '100px'
    }}>
      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(20px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .view-enter { animation: slideIn 0.4s ease-out; }
        .btn-hover { transition: all 0.2s ease; }
        .btn-hover:hover { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(0,0,0,0.2); }
      `}</style>

      {/* Header */}
      <header style={{
        background: 'rgba(15, 23, 42, 0.95)',
        backdropFilter: 'blur(10px)',
        padding: '20px 24px',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        borderBottom: '1px solid rgba(255,255,255,0.1)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 10px 25px rgba(59, 130, 246, 0.4)',
            color: 'white'
          }}>
            <span style={{ fontSize: '20px', fontWeight: 900 }}>SR</span>
          </div>
          <div>
            <h1 style={{
              margin: 0,
              fontSize: '20px',
              fontWeight: 800,
              color: 'white',
              letterSpacing: '-0.3px'
            }}>
              {user}
            </h1>
            <p style={{
              margin: '4px 0 0 0',
              fontSize: '12px',
              color: 'rgba(255,255,255,0.5)',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          </div>
        </div>

        <button 
          onClick={() => {setUser(null); setPassword('');}}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 16px',
            borderRadius: '10px',
            border: '1px solid rgba(255,255,255,0.2)',
            background: 'rgba(255,255,255,0.05)',
            color: 'rgba(255,255,255,0.7)',
            fontSize: '13px',
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => {
            e.target.style.background = 'rgba(239, 68, 68, 0.2)';
            e.target.style.color = '#ef4444';
            e.target.style.borderColor = 'rgba(239, 68, 68, 0.3)';
          }}
          onMouseLeave={(e) => {
            e.target.style.background = 'rgba(255,255,255,0.05)';
            e.target.style.color = 'rgba(255,255,255,0.7)';
            e.target.style.borderColor = 'rgba(255,255,255,0.2)';
          }}
        >
          {Icons.logout}
          <span className="hidden sm:inline">Salir</span>
        </button>
      </header>

      {/* Contenido Principal */}
      <main style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
        <div className="view-enter">
          {view === 'formulario' && (
            <Formulario 
              user={user} 
              orderId={orderId} 
              setOrderId={setOrderId} 
              setView={setView}
              sucursales={sucursalesRegistradas.map(s => s.nombre).filter(n => n !== user)}
              productosCSV={config.productos || []}  // <-- AGREGAR ESTA LÍNEA
            />
          )}
          {view === 'cocina' && (
            <Cocina 
              user={user} 
              pedidos={pedidos} 
              personalCocina={config.personalCocina}
            />
          )}
          {view === 'estados' && (
            <EstadoPedidos 
              user={user} 
              pedidos={pedidos} 
              personalTransporte={config.personalTransporte}
            />
          )}
          {view === 'historial' && (
            <Historial 
              user={user} 
              pedidos={pedidos}
            />
          )}
          {view === 'configuracion' && (
            <Configuracion 
              config={config}
              setConfig={setConfig}
            />
          )}
        </div>
      </main>

      {/* Menú Inferior */}
      <nav style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        background: 'rgba(15, 23, 42, 0.98)',
        backdropFilter: 'blur(10px)',
        borderTop: '1px solid rgba(255,255,255,0.1)',
        padding: '12px 24px 24px',
        zIndex: 100,
        display: 'flex',
        justifyContent: 'space-around',
        alignItems: 'flex-start'
      }}>
        {[
          { key: 'formulario', label: 'Nuevo', icon: Icons.clipboard },
          { key: 'cocina', label: 'Cocina', icon: Icons.chef },
          { key: 'estados', label: 'Estados', icon: Icons.truck },
          { key: 'historial', label: 'Historial', icon: Icons.history },
          { key: 'configuracion', label: 'Ajustes', icon: Icons.settings }
        ].map((item) => (
          <button
            key={item.key}
            onClick={() => setView(item.key)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 12px',
              borderRadius: '12px',
              border: 'none',
              background: view === item.key ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
              color: view === item.key ? '#60a5fa' : 'rgba(255,255,255,0.4)',
              cursor: 'pointer',
              transition: 'all 0.2s',
              minWidth: '64px'
            }}
          >
            <div style={{
              color: view === item.key ? '#60a5fa' : 'rgba(255,255,255,0.4)',
              transform: view === item.key ? 'scale(1.1)' : 'scale(1)',
              transition: 'all 0.2s'
            }}>
              {item.icon}
            </div>
            <span style={{
              fontSize: '11px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              color: view === item.key ? '#60a5fa' : 'rgba(255,255,255,0.4)'
            }}>
              {item.label}
            </span>
            {view === item.key && (
              <div style={{
                width: '4px',
                height: '4px',
                borderRadius: '50%',
                background: '#60a5fa',
                marginTop: '2px'
              }} />
            )}
          </button>
        ))}
      </nav>
    </div>
  );
}