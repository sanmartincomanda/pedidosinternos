"use client";
import React from 'react';
import { db } from '../firebase'; 
import { ref, update } from "firebase/database";

export default function Cocina({ user, pedidos, personalCocina }) {
  
  const actualizarPesoExacto = (firebaseId, itemIdx, valor) => {
    const pedido = pedidos.find(p => p.firebaseId === firebaseId);
    if (!pedido) return;

    const nuevosItems = [...pedido.items];
    nuevosItems[itemIdx].pesoExacto = valor;

    update(ref(db, `pedidos_internos/${firebaseId}`), {
      items: nuevosItems
    });
  };

  const cambiarEstado = (firebaseId, estado, extra = {}) => {
    update(ref(db, `pedidos_internos/${firebaseId}`), {
      estado,
      ...extra
    });
  };

  const pedidosEnProceso = pedidos.filter(p => p.destino === user && p.estado !== 'ENVIADO');

  return (
    <div className="p-4 max-w-5xl mx-auto space-y-8 animate-fadeIn">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h2 className="font-black text-3xl uppercase italic text-[#004c5c]">Panel de Cocina / Cedi</h2>
          <p className="text-xs font-bold opacity-60 uppercase tracking-widest italic text-[#004c5c]">Gestionando pedidos para: {user}</p>
        </div>
        <div className="text-right text-[10px] font-black opacity-40 uppercase">
          {pedidosEnProceso.length} Pedidos pendientes
        </div>
      </div>

      {pedidosEnProceso.length === 0 && (
        <div className="text-center py-20 bg-white rounded-[3rem] border-4 border-dashed border-[#004c5c]/10">
          <span className="text-5xl block mb-4">🥩</span>
          <p className="font-black opacity-30 uppercase italic">No hay órdenes para preparar</p>
        </div>
      )}
      
      {pedidosEnProceso.map((p) => (
        <div key={p.firebaseId} className={`rounded-[2.5rem] shadow-2xl overflow-hidden border-4 transition-all duration-500 ${
          p.estado === 'NUEVO' ? 'bg-[#fee2e2] border-red-200' : 'bg-[#fef9c3] border-yellow-200'
        }`}>
          
          <div className="p-6 md:p-8">
            <div className="flex flex-col md:flex-row justify-between items-start gap-4 mb-6">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="bg-[#004c5c] text-[#fef1e7] px-3 py-1 rounded-full text-[10px] font-black uppercase shadow-sm">
                    Orden #{String(p.id).padStart(2, '0')}
                  </span>
                  <span className="text-[10px] font-black text-[#004c5c]/40 uppercase italic">
                    {p.fecha} • {p.hora}
                  </span>
                </div>
                <h3 className="text-2xl font-black text-[#004c5c] uppercase tracking-tighter">
                  {p.origen} <span className="text-red-600">→</span> {p.destino}
                </h3>
              </div>
              
              <div className={`px-6 py-2 rounded-2xl text-xs font-black uppercase shadow-sm ${
                p.estado === 'NUEVO' ? 'bg-red-500 text-white animate-pulse' : 'bg-yellow-500 text-[#004c5c]'
              }`}>
                {p.estado === 'NUEVO' ? '🔴 Pedido Nuevo' : '🟡 En Preparación'}
              </div>
            </div>

            {/* --- NOTA ESPECIAL QUE VIENE DEL FORMULARIO --- */}
            {p.especial && (
              <div className="mb-6 bg-white p-4 rounded-2xl border-l-8 border-[#004c5c] shadow-sm">
                <span className="text-[10px] font-black text-red-600 uppercase block mb-1 underline">Nota Especial de la Orden:</span>
                <p className="text-sm font-black text-[#004c5c] italic">"{p.especial}"</p>
              </div>
            )}

            <div className="bg-white/60 backdrop-blur-sm rounded-[2rem] overflow-hidden border border-black/5 mb-6 shadow-inner">
              <div className="grid grid-cols-12 bg-[#004c5c]/5 p-3 text-[10px] font-black uppercase opacity-60 border-b border-black/5 text-center">
                <div className="col-span-6 text-left ml-4">Descripción del Producto</div>
                <div className="col-span-2">Pedido</div>
                <div className="col-span-4">Peso Exacto (Lb)</div>
              </div>
              
              {p.items.map((it, itIdx) => (
                <div key={itIdx} className="grid grid-cols-12 items-center border-b border-black/5 last:border-0 p-4">
                  <div className="col-span-6">
                    <div className="font-black text-sm text-[#004c5c] uppercase">{it.articulo}</div>
                    {it.note && <div className="text-[10px] text-red-600 font-bold italic mt-1 leading-none">⚠️ NOTA: {it.note}</div>}
                  </div>
                  <div className="col-span-2 text-center font-black text-xs text-[#004c5c]/30">
                    {it.peso} LB
                  </div>
                  <div className="col-span-4 px-2">
                    <input 
                      type="number" 
                      placeholder={p.estado === 'NUEVO' ? "BLOQUEADO" : "0.00"} 
                      disabled={p.estado === 'NUEVO'}
                      value={it.pesoExacto || ''} 
                      onChange={(e) => actualizarPesoExacto(p.firebaseId, itIdx, e.target.value)}
                      className={`w-full p-3 rounded-xl text-center font-black text-sm outline-none transition-all shadow-md ${
                        p.estado === 'NUEVO' 
                        ? 'bg-gray-200 text-gray-400 cursor-not-allowed border-dashed border-2 border-gray-300' 
                        : 'bg-[#22c55e] text-white focus:ring-4 ring-green-500/20'
                      }`} 
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-6 border-t border-black/5">
              {p.estado === 'NUEVO' ? (
                <div>
                  <p className="text-[10px] font-black uppercase opacity-60 mb-3 italic">1. Selecciona responsable para desbloquear pesos:</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {personalCocina.map(nombre => (
                      <button 
                        key={nombre} 
                        onClick={() => cambiarEstado(p.firebaseId, 'PREPARACION', { preparadoPor: nombre })}
                        className="py-3 bg-white hover:bg-[#004c5c] hover:text-white rounded-xl text-[10px] font-black shadow-sm transition-all uppercase active:scale-95 border border-black/10"
                      >
                        {nombre}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                  <div className="flex items-center gap-3 bg-white/50 px-5 py-2 rounded-xl border border-black/5 shadow-sm">
                    <span className="text-xl">👨‍🍳</span>
                    <div className="text-sm font-black uppercase text-[#004c5c]">
                      Preparando: <span className="text-red-600 underline">{p.preparadoPor}</span>
                    </div>
                  </div>
                  
                  <button 
                    disabled={p.items.some(i => !i.pesoExacto || i.pesoExacto === "")} 
                    onClick={() => cambiarEstado(p.firebaseId, 'LISTO')}
                    className={`w-full md:w-auto px-12 py-4 rounded-[1.5rem] font-black text-sm shadow-xl transition-all uppercase ${
                      p.items.some(i => !i.pesoExacto || i.pesoExacto === "") 
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed opacity-50' 
                      : 'bg-[#22c55e] text-white hover:bg-[#16a34a] active:scale-95 hover:scale-105'
                    }`}
                  >
                    {p.items.some(i => !i.pesoExacto || i.pesoExacto === "") ? 'Faltan Pesos Exactos 🔒' : 'Pedido Listo ✅'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}