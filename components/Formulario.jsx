"use client";
import React, { useState, useRef } from 'react';
import { db } from '../firebase'; // Importación desde la raíz
import { ref, push } from "firebase/database";

export default function Formulario({ user, orderId, setOrderId, setView }) {
  const [items, setItems] = useState([{ articulo: '', peso: '', nota: '' }]);
  const [destino, setDestino] = useState('Cedi'); 
  const [pedidoEspecial, setPedidoEspecial] = useState('');
  const [cargando, setCargando] = useState(false);
  const inputsRef = useRef([]);

  const sucursales = ['Granada Gold', 'Masaya Gold', 'Carnes Amparito', 'Cedi'];

  const agregarFila = () => setItems([...items, { articulo: '', peso: '', nota: '' }]);
  
  const eliminarFila = (idx) => {
    if (items.length > 1) setItems(items.filter((_, i) => i !== idx));
    else setItems([{ articulo: '', peso: '', nota: '' }]);
  };

  const handleInputChange = (idx, field, val) => {
    const n = [...items];
    n[idx][field] = field === 'articulo' || field === 'nota' ? val.toUpperCase() : val;
    setItems(n);
  };

  const handleKeyDown = (e, idx, field) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (field === 'articulo') inputsRef.current[idx * 3 + 1]?.focus();
      else if (field === 'peso') inputsRef.current[idx * 3 + 2]?.focus();
      else if (field === 'nota') {
        if (idx === items.length - 1 && items[idx].articulo !== '') {
          agregarFila();
          setTimeout(() => inputsRef.current[(idx + 1) * 3]?.focus(), 10);
        } else {
          inputsRef.current[(idx + 1) * 3]?.focus();
        }
      }
    }
  };

  // --- FUNCIÓN DE ENVÍO CRÍTICA ---
  const enviar = async (e) => {
    if(e) e.preventDefault();
    
    console.log("Iniciando proceso de envío...");
    
    const validos = items.filter(i => i.articulo.trim() !== '');
    if (validos.length === 0) {
      alert("⚠️ Error: El pedido está vacío. Escribe al menos un producto.");
      return;
    }

    if (!db) {
      alert("⚠️ Error: No hay conexión con la base de datos (db es null). Revisa firebase.js");
      return;
    }

    setCargando(true);

    const nuevaOrden = {
      id: orderId,
      origen: user,
      destino: destino,
      fecha: new Date().toLocaleDateString(),
      hora: new Date().toLocaleTimeString(),
      items: validos.map(i => ({ ...i, pesoExacto: '' })),
      especial: pedidoEspecial,
      estado: 'NUEVO',
      preparadoPor: '',
      enviadoCon: ''
    };

    try {
      console.log("Conectando con Firebase...");
      const dbRef = ref(db, 'pedidos_internos');
      
      await push(dbRef, nuevaOrden);
      
      console.log("¡Éxito total!");
      alert(`✅ ¡PEDIDO #${orderId} ENVIADO CON ÉXITO!`);

      setOrderId(prev => (prev >= 100 ? 1 : prev + 1));
      setItems([{ articulo: '', peso: '', nota: '' }]);
      setPedidoEspecial('');
      setCargando(false);
      
      setView('estados');

    } catch (error) {
      console.error("Fallo el envío:", error);
      alert("❌ ERROR DE RED/FIREBASE: " + error.message);
      setCargando(false);
    }
  };

  return (
    <div className="p-4 max-w-4xl mx-auto">
      {/* Header */}
      <div className="bg-white rounded-[2rem] p-6 shadow-xl mb-6 border-2 border-[#004c5c]/5">
        <div className="flex flex-col md:flex-row justify-between gap-6">
          <div className="flex-1">
            <label className="text-[10px] font-black uppercase opacity-40 mb-1 block">Solicita:</label>
            <div className="text-xl font-black text-[#004c5c] uppercase italic">{user}</div>
          </div>
          <div className="flex-1">
            <label className="text-[10px] font-black uppercase text-red-600 mb-1 block">Solicitar Pedido A:</label>
            <select 
              value={destino}
              onChange={(e) => setDestino(e.target.value)}
              className="w-full bg-[#004c5c] text-white p-3 rounded-xl font-black text-sm outline-none shadow-lg cursor-pointer"
            >
              {sucursales.filter(s => s !== user).map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="bg-[#fac85a]/10 px-6 py-2 rounded-2xl border border-[#fac85a]/30 text-center">
            <span className="block text-[10px] font-black opacity-40 uppercase">Orden #</span>
            <span className="text-3xl font-black text-[#004c5c]">{String(orderId).padStart(2, '0')}</span>
          </div>
        </div>
      </div>
      
      {/* Tabla */}
      <div className="bg-white rounded-[2rem] shadow-2xl overflow-hidden border-2 border-[#004c5c]/5">
        <div className="grid grid-cols-12 bg-[#004c5c] p-4 text-[#fef1e7] text-[10px] font-black uppercase text-center">
          <div className="col-span-1">#</div>
          <div className="col-span-4">Artículo</div>
          <div className="col-span-2">Peso</div>
          <div className="col-span-4">Nota</div>
          <div className="col-span-1"></div>
        </div>
        <div className="max-h-[50vh] overflow-y-auto">
          {items.map((item, idx) => (
            <div key={idx} className="grid grid-cols-12 border-b border-[#004c5c]/5 items-center">
              <div className="col-span-1 text-[10px] font-bold text-center opacity-20">{idx + 1}</div>
              <div className="col-span-4 border-r">
                <input ref={el => inputsRef.current[idx * 3] = el} type="text" value={item.articulo} onKeyDown={(e) => handleKeyDown(e, idx, 'articulo')} onChange={(e) => handleInputChange(idx, 'articulo', e.target.value)} className="w-full p-3 outline-none font-bold text-xs uppercase" placeholder="Producto..." />
              </div>
              <div className="col-span-2 border-r">
                <input ref={el => inputsRef.current[idx * 3 + 1] = el} type="number" value={item.peso} onKeyDown={(e) => handleKeyDown(e, idx, 'peso')} onChange={(e) => handleInputChange(idx, 'peso', e.target.value)} className="w-full p-3 outline-none text-center font-black text-[#fac85a] text-xs" placeholder="0" />
              </div>
              <div className="col-span-4 border-r">
                <input ref={el => inputsRef.current[idx * 3 + 2] = el} type="text" value={item.nota} onKeyDown={(e) => handleKeyDown(e, idx, 'nota')} onChange={(e) => handleInputChange(idx, 'nota', e.target.value)} className="w-full p-3 outline-none font-medium text-[10px] uppercase italic text-[#004c5c]/60" placeholder="Nota..." />
              </div>
              <div className="col-span-1 text-center">
                <button onClick={() => eliminarFila(idx)} className="text-red-400 hover:text-red-600 p-2">✕</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* --- NUEVO: CUADRO DE NOTA ESPECIAL GENERAL --- */}
      <div className="mt-6">
        <label className="text-[10px] font-black uppercase opacity-50 ml-2 block mb-1">Nota especial para el pedido completo:</label>
        <textarea 
          value={pedidoEspecial}
          onChange={(e) => setPedidoEspecial(e.target.value.toUpperCase())}
          className="w-full bg-white rounded-2xl p-4 shadow-lg outline-none h-24 font-bold border-2 border-[#004c5c]/5 focus:border-[#fac85a] transition-all text-sm uppercase"
          placeholder="ESCRIBE AQUÍ INSTRUCCIONES GENERALES..."
        />
      </div>

      {/* Botón Principal */}
      <button 
        type="button"
        onClick={enviar} 
        disabled={cargando}
        className={`w-full mt-6 py-5 rounded-[2rem] font-black text-xl shadow-2xl transition-all uppercase ${
          cargando ? 'bg-gray-400 cursor-wait' : 'bg-[#004c5c] text-[#fef1e7] active:scale-95'
        }`}
      >
        {cargando ? '🚀 Enviando...' : `Enviar Pedido a ${destino} 🚀`}
      </button>
    </div>
  );
}