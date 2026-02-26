"use client";
import React from 'react';
import { db } from '../firebase';
import { ref, update } from "firebase/database";

export default function EstadoPedidos({ user, pedidos, personalTransporte }) {
  
  // Función para asignar repartidor y despachar
  const despacharPedido = async (firebaseId, repartidor) => {
    try {
      await update(ref(db, `pedidos_internos/${firebaseId}`), {
        estado: 'ENVIADO',
        enviadoCon: repartidor,
        horaDespacho: new Date().toLocaleTimeString()
      });
    } catch (error) {
      console.error("Error al despachar:", error);
    }
  };

  // Filtramos: El usuario ve lo que pidió O lo que le pidieron a él
  const misOrdenes = pedidos.filter(p => p.origen === user || p.destino === user);

  // Colores y Estilos dinámicos por estado
  const getEstadoEstilo = (estado) => {
    switch (estado) {
      case 'NUEVO': return 'bg-red-50 border-red-200 text-red-700 shadow-red-100';
      case 'PREPARACION': return 'bg-yellow-50 border-yellow-200 text-yellow-700 shadow-yellow-100';
      case 'LISTO': return 'bg-green-100 border-green-400 text-green-800 shadow-green-200 animate-pulse';
      case 'ENVIADO': return 'bg-white border-gray-100 text-gray-400 shadow-sm opacity-80';
      default: return 'bg-white border-gray-100';
    }
  };

  return (
    <div className="p-4 max-w-4xl mx-auto space-y-6 pb-10 animate-fadeIn">
      <div className="flex justify-between items-center mb-6">
        <h2 className="font-black text-2xl uppercase italic text-[#004c5c]">Seguimiento de Órdenes</h2>
        <span className="text-[10px] font-black opacity-40 uppercase tracking-widest">{misOrdenes.length} movimientos</span>
      </div>

      {misOrdenes.length === 0 && (
        <div className="text-center py-20 opacity-20 font-black uppercase italic">
          No hay actividad registrada
        </div>
      )}

      {misOrdenes.map((p) => (
        <div 
          key={p.firebaseId} 
          className={`rounded-[2.5rem] p-6 border-2 transition-all duration-500 shadow-lg ${getEstadoEstilo(p.estado)}`}
        >
          {/* Cabecera del Card */}
          <div className="flex justify-between items-start mb-4">
            <div>
              <div className="text-[10px] font-black uppercase opacity-60 mb-1">
                {p.fecha} • {p.hora}
              </div>
              <h4 className="font-black text-xl uppercase tracking-tighter leading-none">
                Orden #{p.id} 
              </h4>
              <div className="text-sm font-bold mt-1 uppercase">
                {p.origen} <span className="mx-1 text-[#004c5c]/40">→</span> {p.destino}
              </div>
            </div>
            <div className={`px-4 py-1 rounded-full text-[10px] font-black uppercase border-2 ${getEstadoEstilo(p.estado)}`}>
              {p.estado}
            </div>
          </div>

          {/* Tabla de Pesos (Aparece cuando ya hay trabajo en cocina) */}
          {p.estado !== 'NUEVO' && (
            <div className="bg-white/40 rounded-2xl p-4 mb-4 border border-black/5">
              <p className="text-[9px] font-black uppercase opacity-50 mb-2 italic">Detalle de Pesos Reales:</p>
              <div className="space-y-2">
                {p.items.map((it, idx) => (
                  <div key={idx} className="flex justify-between items-center border-b border-black/5 last:border-0 pb-1">
                    <span className="text-xs font-bold uppercase">{it.articulo}</span>
                    <div className="flex gap-4">
                      <span className="text-[10px] opacity-40 italic">Solicitado: {it.peso} Lb</span>
                      <span className="text-xs font-black text-green-700">Real: {it.pesoExacto || '...'} Lb</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notas y Responsables */}
          <div className="flex flex-wrap gap-4 text-[10px] font-bold uppercase italic opacity-70">
            {p.preparadoPor && <span>👨‍🍳 Prep: {p.preparadoPor}</span>}
            {p.enviadoCon && <span className="text-blue-600">🚚 Despachado: {p.enviadoCon} ({p.horaDespacho})</span>}
          </div>

          {/* Acción: Despachar (Solo visible si está LISTO y eres el origen) */}
          {p.estado === 'LISTO' && p.destino === user && (
            <div className="mt-6 pt-4 border-t border-green-300 animate-slideUp">
              <p className="text-[10px] font-black uppercase text-green-800 mb-3 text-center">Seleccionar Transportista para salida:</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {personalTransporte.map(nom => (
                  <button 
                    key={nom} 
                    onClick={() => despacharPedido(p.firebaseId, nom)}
                    className="py-3 bg-green-600 text-white rounded-xl text-[10px] font-black shadow-md hover:bg-green-800 transition-all active:scale-95 uppercase"
                  >
                    {nom}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}