"use client";

import { getBranchDisplayName } from "@/lib/branchUtils";

function ModuleIcon({ name }) {
  const paths = {
    transfers: (
      <>
        <path d="M3 7h11v8H3zM14 10h4l3 3v2h-7z" />
        <circle cx="7" cy="18" r="2" />
        <circle cx="18" cy="18" r="2" />
        <path d="m7 4 2-2 2 2M9 2v5" />
      </>
    ),
    purchases: (
      <>
        <path d="M4 21V7l8-4 8 4v14M2 21h20" />
        <path d="M8 9h2v2H8zM14 9h2v2h-2zM8 14h2v2H8zM14 14h2v2h-2z" />
      </>
    ),
    inventory: (
      <>
        <path d="M4 5h16v15H4zM8 2h8v6H8z" />
        <path d="M8 12h8M8 16h5" />
      </>
    ),
    arrow: <path d="m9 18 6-6-6-6" />,
    chart: (
      <>
        <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
      </>
    ),
  };

  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {paths[name]}
    </svg>
  );
}

const MODULES = [
  {
    key: "internos",
    title: "Traspasos internos",
    description: "Pedidos, preparación, recepción e historial entre sucursales.",
    action: "Abrir traspasos",
    icon: "transfers",
    tone: "emerald",
  },
  {
    key: "proveedores",
    title: "Proveedores externos",
    description: "Recepción de compras y actualización segura en SICAR.",
    action: "Abrir proveedores",
    icon: "purchases",
    tone: "sky",
  },
  {
    key: "inventario",
    title: "Inventario físico",
    description: "Levantamiento por producto, revisión y ajuste controlado.",
    action: "Iniciar conteo",
    icon: "inventory",
    tone: "lime",
  },
];

const toneClasses = {
  emerald: {
    card: "border-emerald-200/80 hover:border-emerald-400",
    icon: "bg-emerald-100 text-emerald-700",
    action: "text-emerald-700",
    glow: "bg-emerald-300/30",
  },
  sky: {
    card: "border-sky-200/80 hover:border-sky-400",
    icon: "bg-sky-100 text-sky-700",
    action: "text-sky-700",
    glow: "bg-sky-300/30",
  },
  lime: {
    card: "border-lime-200/80 hover:border-lime-400",
    icon: "bg-lime-100 text-lime-800",
    action: "text-lime-800",
    glow: "bg-lime-300/30",
  },
};

export default function ErpModulePanel({ user, companyContext, isOnline, summary, onOpen }) {
  const availableModules = MODULES.filter((module) => companyContext?.modules?.includes(module.key));
  return (
    <div className="min-w-0 space-y-5 pb-24 lg:pb-8">
      <section className="relative overflow-hidden rounded-[2rem] border border-emerald-950/10 bg-[linear-gradient(125deg,#09150f_0%,#10291d_54%,#1f4429_100%)] p-6 text-white shadow-[0_28px_75px_-42px_rgba(5,46,22,0.82)] sm:p-8">
        <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full border border-lime-200/10 bg-lime-300/8" />
        <div className="absolute -bottom-32 right-28 h-64 w-64 rounded-full bg-emerald-300/8 blur-3xl" />
        <div className="relative grid gap-7 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.3em] text-lime-300">CSM Operaciones</div>
            <h2 className="mt-3 max-w-2xl text-3xl font-black tracking-[-0.045em] sm:text-4xl">Panel de la sucursal</h2>
            <p className="mt-3 max-w-xl text-sm font-semibold leading-6 text-emerald-50/70 sm:text-base">
              Selecciona el proceso que vas a trabajar. Cada módulo conserva sus permisos y su conexión local.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-black/15 p-2 backdrop-blur-sm">
            <div className="min-w-32 rounded-xl bg-white/7 px-4 py-3">
              <div className="text-[9px] font-black uppercase tracking-[0.17em] text-emerald-100/50">Sucursal</div>
              <div className="mt-1 truncate text-sm font-black text-white">{companyContext?.empresa || getBranchDisplayName(user)}</div>
            </div>
            <div className="min-w-28 rounded-xl bg-white/7 px-4 py-3">
              <div className="text-[9px] font-black uppercase tracking-[0.17em] text-emerald-100/50">Estado</div>
              <div className={`mt-1 flex items-center gap-2 text-sm font-black ${isOnline ? "text-lime-300" : "text-rose-300"}`}>
                <span className={`h-2 w-2 rounded-full ${isOnline ? "bg-lime-300" : "bg-rose-300"}`} />
                {isOnline ? "En línea" : "Sin conexión"}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-end justify-between gap-3 px-1">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-700">Módulos</div>
            <h3 className="mt-1 text-xl font-black tracking-[-0.025em] text-slate-950">¿Qué vas a realizar?</h3>
          </div>
          <div className="hidden text-xs font-bold text-slate-400 sm:block">{availableModules.length} procesos disponibles</div>
        </div>
        <div className="grid gap-3 lg:grid-cols-3">
          {availableModules.map((module) => {
            const tone = toneClasses[module.tone];
            return (
              <button
                key={module.key}
                type="button"
                onClick={() => onOpen(module.key)}
                className={`group relative min-h-56 overflow-hidden rounded-[1.65rem] border bg-white p-5 text-left shadow-[0_18px_45px_-34px_rgba(15,23,42,0.55)] transition duration-200 hover:-translate-y-1 hover:shadow-[0_26px_55px_-32px_rgba(15,23,42,0.45)] ${tone.card}`}
              >
                <span className={`absolute -right-10 -top-10 h-36 w-36 rounded-full blur-2xl transition group-hover:scale-125 ${tone.glow}`} />
                <span className={`relative grid h-12 w-12 place-items-center rounded-2xl ${tone.icon}`}>
                  <span className="h-6 w-6"><ModuleIcon name={module.icon} /></span>
                </span>
                <span className="relative mt-7 block text-xl font-black tracking-[-0.035em] text-slate-950">{module.title}</span>
                <span className="relative mt-2 block max-w-sm text-sm font-semibold leading-5 text-slate-500">{module.description}</span>
                <span className={`relative mt-6 flex items-center justify-between text-xs font-black uppercase tracking-[0.1em] ${tone.action}`}>
                  {module.action}
                  <span className="h-5 w-5 transition group-hover:translate-x-1"><ModuleIcon name="arrow" /></span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {companyContext?.internalTransfers ? <section className="grid gap-3 md:grid-cols-[1fr_1.45fr]">
        <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-slate-950 text-lime-300"><span className="h-5 w-5"><ModuleIcon name="chart" /></span></span>
            <div><div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Actividad interna</div><div className="text-base font-black text-slate-900">Pedidos de la sucursal</div></div>
          </div>
          <div className="mt-5 grid grid-cols-3 gap-2">
            <div className="rounded-xl bg-slate-50 p-3"><div className="text-[9px] font-black uppercase text-slate-400">Activos</div><div className="mt-1 text-2xl font-black text-slate-950">{summary.active}</div></div>
            <div className="rounded-xl bg-amber-50 p-3"><div className="text-[9px] font-black uppercase text-amber-600">Preparación</div><div className="mt-1 text-2xl font-black text-amber-800">{summary.preparation}</div></div>
            <div className="rounded-xl bg-sky-50 p-3"><div className="text-[9px] font-black uppercase text-sky-600">En camino</div><div className="mt-1 text-2xl font-black text-sky-800">{summary.inTransit}</div></div>
          </div>
        </div>
        <div className="rounded-[1.5rem] border border-slate-200 bg-[linear-gradient(135deg,#ffffff,#f5f9f5)] p-5 shadow-sm">
          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Plataforma ERP</div>
          <div className="mt-2 text-lg font-black text-slate-950">Una sola entrada para la operación</div>
          <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">Inventario se incorpora sin alterar los flujos actuales. Ventas, compras ampliadas e inventario en tiempo real podrán agregarse como módulos independientes.</p>
          <div className="mt-4 flex flex-wrap gap-2"><span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.1em] text-slate-500">Ventas · Próximamente</span><span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.1em] text-slate-500">Existencias · Próximamente</span></div>
        </div>
      </section> : null}
    </div>
  );
}
