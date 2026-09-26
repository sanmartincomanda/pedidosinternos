"use client";

import { getBranchDisplayName } from "@/lib/branchUtils";

function ModuleIcon({ name }) {
  const paths = {
    transfers: (
      <>
        <path d="M3 7h11v8H3zM14 10h4l3 3v2h-7z" />
        <circle cx="7" cy="18" r="2" />
        <circle cx="18" cy="18" r="2" />
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
  };

  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}

const MODULES = [
  {
    key: "internos",
    title: "Traspasos internos",
    description: "Pedidos, preparación, recepción e historial entre sucursales",
    icon: "transfers",
  },
  {
    key: "proveedores",
    title: "Proveedores",
    description: "Recibir mercadería y registrar compras en SICAR",
    icon: "purchases",
  },
  {
    key: "inventario",
    title: "Inventario físico",
    description: "Levantamiento, revisión y ajuste controlado",
    icon: "inventory",
  },
];

export default function ErpModulePanel({ user, companyContext, isOnline, summary, onOpen }) {
  const availableModules = MODULES.filter((module) => companyContext?.modules?.includes(module.key));
  return (
    <div className="csm-home min-w-0">
      <header className="csm-home-header">
        <div className="min-w-0">
          <div className="csm-overline">Sucursal</div>
          <h2 className="csm-home-title">{companyContext?.empresa || getBranchDisplayName(user)}</h2>
        </div>
        <span className={`csm-tag ${isOnline ? "is-ok" : "is-err"}`}>{isOnline ? "En línea" : "Sin conexión"}</span>
      </header>

      <section aria-labelledby="csm-home-modules">
        <h3 id="csm-home-modules" className="csm-section-title">Módulos</h3>
        <ul className="csm-list">
          {availableModules.map((module) => (
            <li key={module.key}>
              <button type="button" onClick={() => onOpen(module.key)} className="csm-list-row csm-home-module">
                <span className="csm-home-module-icon"><ModuleIcon name={module.icon} /></span>
                <span className="min-w-0 flex-1">
                  <span className="csm-list-title">{module.title}</span>
                  <span className="csm-list-meta">{module.description}</span>
                </span>
                <span className="csm-chevron"><ModuleIcon name="arrow" /></span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      {companyContext?.internalTransfers ? (
        <section aria-labelledby="csm-home-activity">
          <h3 id="csm-home-activity" className="csm-section-title">Pedidos internos</h3>
          <dl className="csm-stat-row">
            <div><dt>Activos</dt><dd>{summary.active}</dd></div>
            <div><dt>En preparación</dt><dd>{summary.preparation}</dd></div>
            <div><dt>En camino</dt><dd>{summary.inTransit}</dd></div>
          </dl>
        </section>
      ) : null}
    </div>
  );
}
