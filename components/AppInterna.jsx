"use client";
import React, { useState, useEffect } from 'react';
import { db } from '../firebase'; 
import { ref, onValue } from "firebase/database";
import Formulario from './Formulario';
import Cocina from './Cocina';
import EstadoPedidos from './EstadoPedidos';

export default function AppInterna() {
  const [user, setUser] = useState(null); 
  const [view, setView] = useState('formulario'); 
  const [pedidos, setPedidos] = useState([]); 
  const [orderId, setOrderId] = useState(1);

  // --- NUEVOS ESTADOS PARA LOGIN ---
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  // --- TABLA DE USUARIOS (Tú controlas esto) ---
  const sucursalesRegistradas = [
    { nombre: 'Granada Gold', pass: 'granada2026' },
    { nombre: 'Masaya Gold', pass: 'masaya2026' },
    { nombre: 'Carnes Amparito', pass: 'amparito2026' },
    { nombre: 'Cedi', pass: 'cedi2026' },
    { nombre: 'Luis Saenz', pass: 'admin123' } // Tu acceso total
  ];

  const handleLogin = (e) => {
    e.preventDefault();
    const encontrado = sucursalesRegistradas.find(
      s => s.nombre.toLowerCase() === username.toLowerCase() && s.pass === password
    );

    if (encontrado) {
      setUser(encontrado.nombre);
      setError('');
    } else {
      setError('❌ Usuario o contraseña incorrectos');
    }
  };

  // Sincronización con Firebase (Igual que antes)
  useEffect(() => {
    const pedidosRef = ref(db, 'pedidos_internos');
    const unsubscribe = onValue(pedidosRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const lista = Object.keys(data).map(key => ({
          firebaseId: key,
          ...data[key]
        }));
        setPedidos(lista.reverse());
      } else {
        setPedidos([]);
      }
    });
    return () => unsubscribe();
  }, []);

  // --- VISTA DE LOGIN CON CONTRASEÑA ---
  if (!user) {
    return (
      <div className="min-h-screen bg-[#004c5c] flex items-center justify-center p-6">
        <div className="bg-[#fef1e7] p-10 rounded-[2.5rem] shadow-2xl w-full max-w-md border-b-8 border-[#fac85a]">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-[#fac85a] rounded-2xl flex items-center justify-center font-black text-[#004c5c] text-3xl mx-auto mb-4 shadow-lg">SR</div>
            <h2 className="text-[#004c5c] font-black text-2xl uppercase italic tracking-tighter">Acceso al Sistema</h2>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-[10px] font-black uppercase opacity-50 ml-2">Usuario (Sucursal):</label>
              <input 
                type="text" 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Ej: Granada Gold"
                className="w-full p-4 rounded-2xl bg-white border-2 border-[#004c5c]/5 outline-none focus:border-[#fac85a] font-bold text-[#004c5c] transition-all"
              />
            </div>

            <div>
              <label className="text-[10px] font-black uppercase opacity-50 ml-2">Contraseña:</label>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full p-4 rounded-2xl bg-white border-2 border-[#004c5c]/5 outline-none focus:border-[#fac85a] font-bold text-[#004c5c] transition-all"
              />
            </div>

            {error && <p className="text-red-600 text-[10px] font-black uppercase text-center animate-bounce">{error}</p>}

            <button 
              type="submit"
              className="w-full py-4 bg-[#004c5c] text-[#fef1e7] rounded-2xl font-black hover:bg-[#fac85a] hover:text-[#004c5c] transition-all active:scale-95 uppercase text-sm shadow-xl"
            >
              Entrar al Sistema 🔑
            </button>
          </form>
        </div>
      </div>
    );
  }

  // --- EL RESTO DE TU CÓDIGO (Navbar y vistas) SE MANTIENE IGUAL ---
  const personalCocina = ["Marcos Ramirez", "Miguel Bustamante", "David", "Roberto Marin"];
  const personalTransporte = ["Noel Hernandez", "Noel Bendaña", "Vladimir", "David", "Nelson", "Julio Amador", "Carlos Mora"];

  return (
    <div className="min-h-screen bg-[#fef1e7] text-[#004c5c] pb-24">
      <nav className="bg-[#004c5c] p-4 text-[#fef1e7] flex justify-between items-center sticky top-0 z-50 shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#fac85a] rounded-xl flex items-center justify-center font-black text-[#004c5c]">SR</div>
          <span className="font-black text-xs uppercase tracking-tight">{user}</span>
        </div>
        <button onClick={() => {setUser(null); setPassword('');}} className="text-[10px] font-black opacity-50 underline uppercase">Cerrar Sesión</button>
      </nav>

      <main>
        {view === 'formulario' && <Formulario user={user} orderId={orderId} setOrderId={setOrderId} setView={setView} />}
        {view === 'cocina' && <Cocina user={user} pedidos={pedidos} personalCocina={personalCocina} />}
        {view === 'estados' && <EstadoPedidos user={user} pedidos={pedidos} personalTransporte={personalTransporte} />}
      </main>

      {/* Menú inferior igual que antes */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#004c5c] p-4 flex justify-around items-center border-t border-white/10 z-50">
        <button onClick={() => setView('formulario')} className={`flex flex-col items-center gap-1 ${view === 'formulario' ? 'text-[#fac85a]' : 'text-white/40'}`}>
          <span className="text-xl">📝</span>
          <span className="text-[10px] font-black uppercase text-center leading-none">Pedido</span>
        </button>
        <button onClick={() => setView('cocina')} className={`flex flex-col items-center gap-1 ${view === 'cocina' ? 'text-[#fac85a]' : 'text-white/40'}`}>
          <span className="text-xl">🍳</span>
          <span className="text-[10px] font-black uppercase text-center leading-none">Cocina</span>
        </button>
        <button onClick={() => setView('estados')} className={`flex flex-col items-center gap-1 ${view === 'estados' ? 'text-[#fac85a]' : 'text-white/40'}`}>
          <span className="text-xl">📊</span>
          <span className="text-[10px] font-black uppercase text-center leading-none">Estados</span>
        </button>
      </div>
    </div>
  );
}