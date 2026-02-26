"use client";
import React, { useState, useRef, useEffect } from 'react';
import { db } from '../firebase';
import { ref, push } from "firebase/database";

// Iconos SVG estilo delivery
const Icons = {
  plus: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  trash: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>,
  calendar: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  note: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>,
  send: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>,
  package: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>,
  alert: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
  search: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  key: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.778 7.778 5.5 5.5 0 017.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>
};

const UNIDADES = [
  { value: 'lb', label: 'lb', icon: '⚖️' },
  { value: 'cajas', label: 'Cajas', icon: '📦' },
  { value: 'paquetes_vp', label: 'Paquetes VP', icon: '📋' },
  { value: 'unidades', label: 'Unidades', icon: '🔢' },
  { value: 'kg', label: 'Kg', icon: '⚖️' },
  { value: 'sacos', label: 'Sacos', icon: '🎯' }
];

// Productos por defecto (fallback si no hay CSV)
const PRODUCTOS_EJEMPLO = [
  { clave: 'BIS-001', nombre: 'BISTEC DE RES' },
  { clave: 'BIS-002', nombre: 'BISTEC DE CERDO' },
  { clave: 'POL-001', nombre: 'POLLO ENTERO' },
  { clave: 'POL-002', nombre: 'PECHUGA DE POLLO' },
  { clave: 'CAR-001', nombre: 'CARNE MOLIDA' },
  { clave: 'CER-001', nombre: 'COSTILLA DE CERDO' },
  { clave: 'RES-001', nombre: 'CHULETA DE RES' },
  { clave: 'EMB-001', nombre: 'JAMON EMBUTIDO' },
  { clave: 'EMB-002', nombre: 'SALCHICHAS' },
  { clave: 'MAR-001', nombre: 'CAMARON' }
];

export default function Formulario({ user, orderId, setOrderId, setView, sucursales = [], productosCSV = [] }) {
  const MAX_LINEAS = 25;
  
  // USAR productos del CSV si existen, sino los de ejemplo
  const catalogoProductos = productosCSV && productosCSV.length > 0 ? productosCSV : PRODUCTOS_EJEMPLO;
  
  // Debug: mostrar en consola qué catálogo se está usando
  console.log('Catálogo usado:', catalogoProductos.length, 'productos');
  console.log('ProductosCSV recibidos:', productosCSV?.length || 0);
  
  const [items, setItems] = useState([{ 
    clave: '',
    producto: '', 
    cantidad: '', 
    unidad: 'lb', 
    nota: '',
    mostrarDropdown: false
  }]);
  
  const [destino, setDestino] = useState(sucursales[0] || 'Cedi');
  const [notaGeneral, setNotaGeneral] = useState('');
  const [cargando, setCargando] = useState(false);
  const [busquedaActiva, setBusquedaActiva] = useState(null);
  
  const hoy = new Date().toISOString().split('T')[0];
  const [fechaPedido, setFechaPedido] = useState(hoy);
  const [fechaEntrega, setFechaEntrega] = useState(hoy);
  
  const inputsRef = useRef([]);
  const dropdownRefs = useRef({}); // Refs para cada dropdown

  const esStandby = fechaEntrega > hoy;

  // Cerrar dropdown al hacer click fuera
  useEffect(() => {
    const handleClickOutside = (event) => {
      let clickedInsideDropdown = false;
      
      // Verificar si el click fue dentro de algún dropdown
      Object.values(dropdownRefs.current).forEach(ref => {
        if (ref && ref.contains(event.target)) {
          clickedInsideDropdown = true;
        }
      });
      
      if (!clickedInsideDropdown) {
        setBusquedaActiva(null);
        setItems(prev => prev.map((item) => ({
          ...item,
          mostrarDropdown: false
        })));
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const agregarFila = () => {
    if (items.length >= MAX_LINEAS) {
      alert(`Máximo ${MAX_LINEAS} líneas permitidas`);
      return;
    }
    setItems([...items, { 
      clave: '',
      producto: '', 
      cantidad: '', 
      unidad: 'lb', 
      nota: '',
      mostrarDropdown: false
    }]);
  };

  const eliminarFila = (idx) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== idx));
    } else {
      setItems([{ 
        clave: '',
        producto: '', 
        cantidad: '', 
        unidad: 'lb', 
        nota: '',
        mostrarDropdown: false
      }]);
    }
  };

  const handleInputChange = (idx, field, val) => {
    const nuevosItems = [...items];
    nuevosItems[idx][field] = val;
    
    // Si cambia el producto manualmente, buscar clave
    if (field === 'producto') {
      const productoEncontrado = catalogoProductos.find(
        p => p.nombre.toUpperCase() === val.toUpperCase()
      );
      if (productoEncontrado) {
        nuevosItems[idx].clave = productoEncontrado.clave;
        nuevosItems[idx].mostrarDropdown = false;
      }
    }
    
    setItems(nuevosItems);
  };

  const seleccionarProducto = (idx, producto) => {
    const nuevosItems = [...items];
    nuevosItems[idx].producto = producto.nombre;
    nuevosItems[idx].clave = producto.clave;
    nuevosItems[idx].mostrarDropdown = false;
    setItems(nuevosItems);
    setBusquedaActiva(null);
    
    // Mover foco a cantidad
    setTimeout(() => inputsRef.current[idx * 5 + 2]?.focus(), 50);
  };

  const filtrarProductos = (busqueda) => {
    if (!busqueda) return catalogoProductos.slice(0, 8);
    
    const busquedaUpper = busqueda.toUpperCase();
    return catalogoProductos.filter(p => 
      p.nombre.toUpperCase().includes(busquedaUpper) ||
      p.clave.toUpperCase().includes(busquedaUpper)
    ).slice(0, 10); // Mostrar hasta 10 resultados
  };

  const handleKeyDown = (e, idx, field) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const nextIndex = idx + 1;
      
      if (field === 'producto') {
        // Si hay dropdown abierto y hay resultados, seleccionar el primero
        if (items[idx].mostrarDropdown) {
          const filtrados = filtrarProductos(items[idx].producto);
          if (filtrados.length > 0) {
            seleccionarProducto(idx, filtrados[0]);
            return;
          }
        }
        // Ir a cantidad
        inputsRef.current[idx * 5 + 2]?.focus();
      } else if (field === 'cantidad') {
        inputsRef.current[idx * 5 + 3]?.focus();
      } else if (field === 'unidad') {
        inputsRef.current[idx * 5 + 4]?.focus();
      } else if (field === 'nota') {
        if (idx === items.length - 1 && items[idx].producto.trim() !== '') {
          if (items.length < MAX_LINEAS) {
            agregarFila();
            setTimeout(() => {
              const nuevoInput = inputsRef.current[(idx + 1) * 5 + 1];
              if (nuevoInput) {
                nuevoInput.focus();
                const nuevosItems = [...items];
                nuevosItems[idx + 1] = { ...nuevosItems[idx + 1], mostrarDropdown: true };
                setItems(nuevosItems);
                setBusquedaActiva(idx + 1);
              }
            }, 50);
          }
        } else if (nextIndex < items.length) {
          inputsRef.current[nextIndex * 5 + 1]?.focus();
        }
      }
    } else if (e.key === 'Escape') {
      const nuevosItems = [...items];
      nuevosItems[idx].mostrarDropdown = false;
      setItems(nuevosItems);
      setBusquedaActiva(null);
    }
  };

  const enviar = async (e) => {
    e.preventDefault();
    
    const validos = items.filter(i => i.producto.trim() !== '');
    if (validos.length === 0) {
      alert("⚠️ Error: El pedido está vacío. Escribe al menos un producto.");
      return;
    }

    if (!db) {
      alert("⚠️ Error: No hay conexión con la base de datos.");
      return;
    }

    setCargando(true);

    let estadoInicial = 'NUEVO';
    if (esStandby) {
      estadoInicial = 'STANDBY_ENTREGA';
    }

    const nuevaOrden = {
      id: orderId,
      sucursalOrigen: user,
      sucursalDestino: destino,
      fechaPedido: fechaPedido,
      fechaEntrega: fechaEntrega,
      esStandby: esStandby,
      fechaCreacion: new Date().toISOString(),
      hora: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
      items: validos.map(i => ({ 
        clave: i.clave,
        producto: i.producto, 
        cantidad: i.cantidad,
        unidad: i.unidad,
        nota: i.nota,
        pesoReal: '',
        preparadoPor: '',
        listo: false
      })),
      notaGeneral: notaGeneral,
      estado: estadoInicial,
      preparadoPor: '',
      enviadoCon: '',
      timestamp: Date.now()
    };

    try {
      const dbRef = ref(db, 'pedidos_internos');
      await push(dbRef, nuevaOrden);
      
      alert(`✅ ¡PEDIDO #${orderId} ${esStandby ? 'GUARDADO (STANDBY)' : 'ENVIADO'} CON ÉXITO!`);

      setOrderId(prev => (prev >= 999 ? 1 : prev + 1));
      setItems([{ 
        clave: '',
        producto: '', 
        cantidad: '', 
        unidad: 'lb', 
        nota: '',
        mostrarDropdown: false
      }]);
      setNotaGeneral('');
      setFechaEntrega(hoy);
      setCargando(false);
      
      setView('estados');

    } catch (error) {
      console.error("Fallo el envío:", error);
      alert("❌ ERROR: " + error.message);
      setCargando(false);
    }
  };

  return (
    <div style={{ animation: 'slideIn 0.4s ease-out' }}>
      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
        .input-focus:focus {
          outline: none;
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
        }
        .dropdown-item:hover {
          background: rgba(59, 130, 246, 0.2);
        }
        /* Scrollbar personalizado para el dropdown */
        .dropdown-scroll::-webkit-scrollbar {
          width: 8px;
        }
        .dropdown-scroll::-webkit-scrollbar-track {
          background: rgba(255,255,255,0.05);
          border-radius: 4px;
        }
        .dropdown-scroll::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.2);
          border-radius: 4px;
        }
        .dropdown-scroll::-webkit-scrollbar-thumb:hover {
          background: rgba(255,255,255,0.3);
        }
      `}</style>

      {/* Header */}
      <div style={{
        background: 'rgba(255,255,255,0.05)',
        borderRadius: '24px',
        padding: '24px',
        marginBottom: '24px',
        border: '1px solid rgba(255,255,255,0.1)',
        backdropFilter: 'blur(10px)'
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '20px',
          alignItems: 'end'
        }}>
          {/* Origen */}
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
              Sucursal Origen
            </label>
            <div style={{
              padding: '14px 16px',
              background: 'rgba(59, 130, 246, 0.2)',
              borderRadius: '12px',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              color: '#60a5fa',
              fontWeight: 800,
              fontSize: '16px'
            }}>
              {user}
            </div>
          </div>

          {/* Destino */}
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
              Enviar Pedido A
            </label>
            <select 
              value={destino}
              onChange={(e) => setDestino(e.target.value)}
              className="input-focus"
              style={{
                width: '100%',
                padding: '14px 16px',
                background: 'rgba(245, 158, 11, 0.2)',
                border: '2px solid rgba(245, 158, 11, 0.4)',
                borderRadius: '12px',
                color: '#fbbf24',
                fontWeight: 800,
                fontSize: '15px',
                cursor: 'pointer',
                appearance: 'none',
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23fbbf24' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 12px center',
                paddingRight: '36px'
              }}
            >
              {sucursales.filter(s => s !== user).map(s => (
                <option key={s} value={s} style={{ background: '#1e293b', color: '#fbbf24' }}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          {/* Número de Orden */}
          <div style={{
            background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
            borderRadius: '16px',
            padding: '16px',
            textAlign: 'center',
            boxShadow: '0 10px 25px rgba(59, 130, 246, 0.3)'
          }}>
            <div style={{
              fontSize: '11px',
              fontWeight: 700,
              color: 'rgba(255,255,255,0.8)',
              textTransform: 'uppercase',
              letterSpacing: '1px',
              marginBottom: '4px'
            }}>
              Pedido #
            </div>
            <div style={{
              fontSize: '32px',
              fontWeight: 900,
              color: 'white',
              lineHeight: 1
            }}>
              {String(orderId).padStart(3, '0')}
            </div>
          </div>
        </div>

        {/* Fechas */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '20px',
          marginTop: '20px',
          paddingTop: '20px',
          borderTop: '1px solid rgba(255,255,255,0.1)'
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
              Fecha de Pedido
            </label>
            <input
              type="date"
              value={fechaPedido}
              disabled
              style={{
                width: '100%',
                padding: '12px 16px',
                background: 'rgba(255,255,255,0.05)',
                border: '2px solid rgba(255,255,255,0.1)',
                borderRadius: '12px',
                color: 'rgba(255,255,255,0.5)',
                fontWeight: 700,
                fontSize: '15px',
                cursor: 'not-allowed'
              }}
            />
          </div>

          <div>
            <label style={{
              fontSize: '11px',
              fontWeight: 700,
              color: esStandby ? '#fbbf24' : 'rgba(255,255,255,0.5)',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              marginBottom: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              {Icons.calendar}
              Fecha de Entrega
              {esStandby && (
                <span style={{
                  background: '#fbbf24',
                  color: '#1e293b',
                  padding: '2px 8px',
                  borderRadius: '10px',
                  fontSize: '9px',
                  marginLeft: '8px'
                }}>
                  STANDBY
                </span>
              )}
            </label>
            <input
              type="date"
              value={fechaEntrega}
              min={hoy}
              onChange={(e) => setFechaEntrega(e.target.value)}
              className="input-focus"
              style={{
                width: '100%',
                padding: '12px 16px',
                background: esStandby ? 'rgba(245, 158, 11, 0.15)' : 'rgba(255,255,255,0.1)',
                border: `2px solid ${esStandby ? '#fbbf24' : 'rgba(255,255,255,0.2)'}`,
                borderRadius: '12px',
                color: esStandby ? '#fbbf24' : 'white',
                fontWeight: 700,
                fontSize: '15px',
                cursor: 'pointer'
              }}
            />
            {esStandby && (
              <div style={{
                marginTop: '8px',
                padding: '10px 14px',
                background: 'rgba(245, 158, 11, 0.15)',
                borderRadius: '8px',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '12px',
                color: '#fbbf24',
                fontWeight: 600
              }}>
                {Icons.alert}
                Este pedido quedará en STANDBY hasta la fecha de entrega
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Info de catálogo */}
      <div style={{
        padding: '12px 16px',
        background: 'rgba(59, 130, 246, 0.1)',
        borderRadius: '10px',
        marginBottom: '16px',
        border: '1px solid rgba(59, 130, 246, 0.2)',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        fontSize: '13px',
        color: '#60a5fa'
      }}>
        {Icons.package}
        <span>
          <strong>{catalogoProductos.length}</strong> productos en catálogo 
          {productosCSV.length > 0 ? ' (desde CSV)' : ' (por defecto)'}
        </span>
      </div>

      {/* Tabla de Productos - SIN overflow:hidden para que el dropdown se vea */}
      <div style={{
        background: 'rgba(255,255,255,0.03)',
        borderRadius: '24px',
        border: '1px solid rgba(255,255,255,0.1)',
        marginBottom: '24px'
      }}>
        {/* Header de tabla */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '50px 100px 1fr 100px 140px 1fr 50px',
          gap: '8px',
          padding: '16px 20px',
          background: 'rgba(59, 130, 246, 0.2)',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          fontSize: '10px',
          fontWeight: 800,
          color: 'rgba(255,255,255,0.6)',
          textTransform: 'uppercase',
          letterSpacing: '0.5px'
        }}>
          <div>#</div>
          <div>Clave</div>
          <div>Producto</div>
          <div style={{ textAlign: 'center' }}>Cant.</div>
          <div style={{ textAlign: 'center' }}>Unidad</div>
          <div>Nota</div>
          <div></div>
        </div>

        {/* Filas - sin maxHeight para evitar corte del dropdown */}
        <div style={{ padding: '8px 0' }}>
          {items.map((item, idx) => (
            <div 
              key={idx}
              style={{
                display: 'grid',
                gridTemplateColumns: '50px 100px 1fr 100px 140px 1fr 50px',
                gap: '8px',
                padding: '8px 20px',
                borderBottom: idx < items.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                alignItems: 'center',
                background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)',
                position: 'relative' // Importante para posicionar el dropdown
              }}
            >
              {/* Número */}
              <div style={{
                fontSize: '12px',
                fontWeight: 700,
                color: 'rgba(255,255,255,0.3)',
                textAlign: 'center'
              }}>
                {String(idx + 1).padStart(2, '0')}
              </div>

              {/* Clave - Automática */}
              <div style={{
                padding: '10px',
                background: 'rgba(16, 185, 129, 0.1)',
                borderRadius: '8px',
                border: '1px solid rgba(16, 185, 129, 0.2)',
                textAlign: 'center',
                fontSize: '12px',
                fontWeight: 700,
                color: item.clave ? '#10b981' : 'rgba(255,255,255,0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
                minHeight: '44px'
              }}>
                {Icons.key}
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {item.clave || '-'}
                </span>
              </div>

              {/* Producto con Dropdown de búsqueda - POSICIONAMIENTO FIJO */}
              <div 
                style={{ position: 'relative' }}
                ref={el => dropdownRefs.current[idx] = el}
              >
                <div style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#9ca3af',
                  zIndex: 1
                }}>
                  {Icons.search}
                </div>
                <input
                  ref={el => inputsRef.current[idx * 5 + 1] = el}
                  type="text"
                  value={item.producto}
                  onChange={(e) => {
                    handleInputChange(idx, 'producto', e.target.value);
                    const nuevosItems = [...items];
                    nuevosItems[idx].mostrarDropdown = true;
                    setItems(nuevosItems);
                    setBusquedaActiva(idx);
                  }}
                  onFocus={() => {
                    const nuevosItems = [...items];
                    nuevosItems[idx].mostrarDropdown = true;
                    setItems(nuevosItems);
                    setBusquedaActiva(idx);
                  }}
                  onKeyDown={(e) => handleKeyDown(e, idx, 'producto')}
                  placeholder="Buscar producto..."
                  className="input-focus"
                  style={{
                    width: '100%',
                    padding: '12px 12px 12px 40px',
                    background: 'rgba(255,255,255,0.05)',
                    border: '2px solid rgba(255,255,255,0.1)',
                    borderRadius: '10px',
                    color: 'white',
                    fontWeight: 700,
                    fontSize: '14px',
                    textTransform: 'uppercase'
                  }}
                  autoComplete="off"
                />
                
                {/* Dropdown de productos - POSICION ABSOLUTA CON Z-INDEX ALTO */}
                {item.mostrarDropdown && (
                  <div style={{
                    position: 'absolute',
                    top: 'calc(100% + 4px)',
                    left: 0,
                    right: 0,
                    background: '#1e293b',
                    borderRadius: '12px',
                    border: '1px solid rgba(255,255,255,0.2)',
                    boxShadow: '0 20px 50px rgba(0,0,0,0.8)',
                    zIndex: 9999,
                    maxHeight: '280px',
                    overflowY: 'auto'
                  }} className="dropdown-scroll">
                    {filtrarProductos(item.producto).length === 0 ? (
                      <div style={{
                        padding: '16px',
                        textAlign: 'center',
                        color: 'rgba(255,255,255,0.5)',
                        fontSize: '13px'
                      }}>
                        No se encontraron productos
                      </div>
                    ) : (
                      filtrarProductos(item.producto).map((prod, pidx) => (
                        <div
                          key={pidx}
                          onClick={() => seleccionarProducto(idx, prod)}
                          className="dropdown-item"
                          style={{
                            padding: '14px 16px',
                            cursor: 'pointer',
                            borderBottom: pidx < filtrarProductos(item.producto).length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            transition: 'background 0.15s'
                          }}
                        >
                          <span style={{
                            padding: '6px 10px',
                            background: 'rgba(59, 130, 246, 0.2)',
                            borderRadius: '8px',
                            fontSize: '12px',
                            fontWeight: 800,
                            color: '#60a5fa',
                            minWidth: '70px',
                            textAlign: 'center',
                            flexShrink: 0
                          }}>
                            {prod.clave}
                          </span>
                          <span style={{
                            fontSize: '14px',
                            fontWeight: 600,
                            color: 'white',
                            textTransform: 'uppercase',
                            lineHeight: '1.3'
                          }}>
                            {prod.nombre}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Cantidad */}
              <input
                ref={el => inputsRef.current[idx * 5 + 2] = el}
                type="number"
                value={item.cantidad}
                onChange={(e) => handleInputChange(idx, 'cantidad', e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, idx, 'cantidad')}
                placeholder="0"
                min="0"
                step="0.01"
                className="input-focus"
                style={{
                  width: '100%',
                  padding: '12px',
                  background: 'rgba(255,255,255,0.05)',
                  border: '2px solid rgba(255,255,255,0.1)',
                  borderRadius: '10px',
                  color: '#fbbf24',
                  fontWeight: 800,
                  fontSize: '14px',
                  textAlign: 'center'
                }}
              />

              {/* Unidad - Select */}
              <select
                ref={el => inputsRef.current[idx * 5 + 3] = el}
                value={item.unidad}
                onChange={(e) => handleInputChange(idx, 'unidad', e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, idx, 'unidad')}
                className="input-focus"
                style={{
                  width: '100%',
                  padding: '12px',
                  background: 'rgba(255,255,255,0.05)',
                  border: '2px solid rgba(255,255,255,0.1)',
                  borderRadius: '10px',
                  color: '#60a5fa',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer',
                  appearance: 'none',
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2360a5fa' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 8px center',
                  paddingRight: '28px'
                }}
              >
                {UNIDADES.map(u => (
                  <option key={u.value} value={u.value} style={{ background: '#1e293b' }}>
                    {u.icon} {u.label}
                  </option>
                ))}
              </select>

              {/* Nota especial por producto */}
              <input
                ref={el => inputsRef.current[idx * 5 + 4] = el}
                type="text"
                value={item.nota}
                onChange={(e) => handleInputChange(idx, 'nota', e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, idx, 'nota')}
                placeholder="Nota..."
                className="input-focus"
                style={{
                  width: '100%',
                  padding: '12px',
                  background: 'rgba(16, 185, 129, 0.1)',
                  border: '2px solid rgba(16, 185, 129, 0.2)',
                  borderRadius: '10px',
                  color: '#34d399',
                  fontWeight: 600,
                  fontSize: '13px',
                  fontStyle: 'italic'
                }}
              />

              {/* Eliminar */}
              <button
                onClick={() => eliminarFila(idx)}
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  border: 'none',
                  background: 'rgba(239, 68, 68, 0.1)',
                  color: '#ef4444',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)';
                  e.currentTarget.style.transform = 'scale(1.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
                  e.currentTarget.style.transform = 'scale(1)';
                }}
              >
                {Icons.trash}
              </button>
            </div>
          ))}
        </div>

        {/* Footer de tabla */}
        <div style={{
          padding: '16px 20px',
          borderTop: '1px solid rgba(255,255,255,0.1)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{
            fontSize: '12px',
            color: 'rgba(255,255,255,0.4)',
            fontWeight: 600
          }}>
            {items.length} de {MAX_LINEAS} líneas
          </div>
          
          <button
            onClick={agregarFila}
            disabled={items.length >= MAX_LINEAS}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 20px',
              borderRadius: '12px',
              border: '2px dashed rgba(59, 130, 246, 0.4)',
              background: items.length >= MAX_LINEAS ? 'rgba(255,255,255,0.02)' : 'rgba(59, 130, 246, 0.1)',
              color: items.length >= MAX_LINEAS ? 'rgba(255,255,255,0.3)' : '#60a5fa',
              fontWeight: 700,
              fontSize: '14px',
              cursor: items.length >= MAX_LINEAS ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              if (items.length < MAX_LINEAS) {
                e.currentTarget.style.background = 'rgba(59, 130, 246, 0.2)';
                e.currentTarget.style.borderStyle = 'solid';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = items.length >= MAX_LINEAS ? 'rgba(255,255,255,0.02)' : 'rgba(59, 130, 246, 0.1)';
              e.currentTarget.style.borderStyle = 'dashed';
            }}
          >
            {Icons.plus}
            Agregar Línea
          </button>
        </div>
      </div>

      {/* Nota General */}
      <div style={{ marginBottom: '24px' }}>
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
          {Icons.note}
          Nota General del Pedido
        </label>
        <textarea
          value={notaGeneral}
          onChange={(e) => setNotaGeneral(e.target.value.toUpperCase())}
          placeholder="Instrucciones especiales para todo el pedido..."
          style={{
            width: '100%',
            minHeight: '100px',
            padding: '16px',
            background: 'rgba(255,255,255,0.05)',
            border: '2px solid rgba(255,255,255,0.1)',
            borderRadius: '16px',
            color: 'white',
            fontWeight: 600,
            fontSize: '14px',
            resize: 'vertical',
            fontFamily: 'inherit'
          }}
        />
      </div>

      {/* Botón Enviar */}
      <button
        onClick={enviar}
        disabled={cargando}
        style={{
          width: '100%',
          padding: '20px',
          borderRadius: '16px',
          border: 'none',
          background: cargando ? 'rgba(255,255,255,0.1)' : esStandby ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
          color: 'white',
          fontWeight: 800,
          fontSize: '18px',
          cursor: cargando ? 'wait' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px',
          boxShadow: cargando ? 'none' : esStandby ? '0 10px 25px rgba(245, 158, 11, 0.4)' : '0 10px 25px rgba(59, 130, 246, 0.4)',
          transition: 'all 0.2s',
          textTransform: 'uppercase',
          letterSpacing: '0.5px'
        }}
        onMouseEnter={(e) => {
          if (!cargando) {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = esStandby ? '0 15px 35px rgba(245, 158, 11, 0.5)' : '0 15px 35px rgba(59, 130, 246, 0.5)';
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = cargando ? 'none' : esStandby ? '0 10px 25px rgba(245, 158, 11, 0.4)' : '0 10px 25px rgba(59, 130, 246, 0.4)';
        }}
      >
        {cargando ? (
          <>
            <div style={{
              width: '20px',
              height: '20px',
              border: '3px solid rgba(255,255,255,0.3)',
              borderTop: '3px solid white',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }} />
            Enviando...
          </>
        ) : (
          <>
            {Icons.send}
            {esStandby ? 'Guardar Pedido (Standby)' : `Enviar Pedido a ${destino}`}
          </>
        )}
      </button>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}