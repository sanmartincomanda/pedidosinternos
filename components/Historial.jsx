"use client";

import React, { useMemo, useState } from "react";
import { getBranchDisplayName } from "@/lib/branchUtils";
import { formatOrderNumber } from "@/lib/orderUtils";
import {
  buildConsolidatedRows,
  buildHistoryStats,
  buildOrderDescriptor,
  filterPedidosByDate,
  formatDateLabel,
  getPhysicalReceiver,
  getPhysicalSender,
  getRealText,
  getRequestedText,
  getStatusMeta,
  isPedidoVacuna,
  matchesSearch,
  matchesStatus,
  sortPedidosDesc,
} from "@/lib/historialUtils";
import {
  downloadConsolidatedHistoryPdf,
  downloadDetailedHistoryPdf,
  downloadTransferRequisitionPdf,
  printTransferRequisition,
} from "@/lib/historialPdf";
import {
  downloadConsolidatedHistoryExcel,
  downloadDetailedHistoryExcel,
} from "@/lib/historialExcel";

const Icons = {
  calendar: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  ),
  list: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  ),
  download: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  ),
  print: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="6 9 6 2 18 2 18 9" />
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
      <rect x="6" y="14" width="12" height="8" />
    </svg>
  ),
  file: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  ),
  package: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
      <polyline points="3.29 7 12 12 20.71 7" />
      <line x1="12" y1="22" x2="12" y2="12" />
    </svg>
  ),
  truck: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="1" y="3" width="15" height="13" />
      <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
      <circle cx="5.5" cy="18.5" r="2.5" />
      <circle cx="18.5" cy="18.5" r="2.5" />
    </svg>
  ),
  inbox: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
      <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11Z" />
    </svg>
  ),
  search: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  ),
};

const STATUS_OPTIONS = [
  { value: "todos", label: "Todos" },
  { value: "NUEVO", label: "Nuevo" },
  { value: "STANDBY_ENTREGA", label: "Standby" },
  { value: "PREPARACION", label: "Preparacion" },
  { value: "LISTO", label: "Listo" },
  { value: "ENVIADO", label: "Enviado" },
  { value: "RECIBIDO_CONFORME", label: "Recibido conforme" },
  { value: "ENTREGADO", label: "Entregado" },
  { value: "ANULADO", label: "Anulado" },
];

const SECTION_TABS = [
  { key: "recibidos", label: "Recibidos" },
  { key: "enviados", label: "Enviados" },
  { key: "reportes", label: "Reportes" },
];

function SectionTabButton({ active, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "12px 16px",
        borderRadius: "14px",
        border: active ? "none" : "1px solid rgba(148, 163, 184, 0.22)",
        background: active ? "linear-gradient(135deg, #2563eb 0%, #0ea5e9 100%)" : "rgba(255,255,255,0.95)",
        color: active ? "#ffffff" : "#475569",
        fontWeight: 800,
        fontSize: "13px",
        cursor: "pointer",
        boxShadow: active ? "0 18px 28px -22px rgba(37, 99, 235, 0.85)" : "none",
        transition: "all 0.2s ease",
      }}
    >
      {label}
    </button>
  );
}

function StatCard({ label, value, helper, accent }) {
  return (
    <div
      style={{
        padding: "18px",
        borderRadius: "18px",
        background: `linear-gradient(180deg, ${accent}12 0%, rgba(255,255,255,0.98) 100%)`,
        border: `1px solid ${accent}2d`,
        boxShadow: "0 20px 36px -30px rgba(15, 23, 42, 0.22)",
      }}
    >
      <div style={{ fontSize: "11px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "#64748b" }}>
        {label}
      </div>
      <div style={{ marginTop: "10px", fontSize: "28px", fontWeight: 900, color: accent }}>
        {value}
      </div>
      {helper ? <div style={{ marginTop: "6px", fontSize: "12px", color: "#475569" }}>{helper}</div> : null}
    </div>
  );
}

function EmptyState({ title, text }) {
  return (
    <div
      style={{
        textAlign: "center",
        padding: "56px 24px",
        borderRadius: "24px",
        background: "rgba(255,255,255,0.82)",
        border: "1px dashed rgba(148, 163, 184, 0.32)",
      }}
    >
      <div style={{ fontSize: "52px", marginBottom: "14px" }}>📦</div>
      <div style={{ fontSize: "22px", fontWeight: 800, color: "#0f172a", marginBottom: "8px" }}>{title}</div>
      <div style={{ fontSize: "14px", color: "#64748b" }}>{text}</div>
    </div>
  );
}

function OrderCard({ pedido, role, isOpen, onToggle, printerSettings }) {
  const counterpart = role === "recibidos" ? getPhysicalSender(pedido) : getPhysicalReceiver(pedido);
  const roleLabel = role === "recibidos" ? "Enviado por" : "Recibe";

  return (
    <article
      style={{
        background: "linear-gradient(180deg, rgba(255,255,255,0.99) 0%, rgba(248,250,252,0.97) 100%)",
        borderRadius: "22px",
        border: "1px solid rgba(148, 163, 184, 0.16)",
        boxShadow: "0 22px 40px -34px rgba(15, 23, 42, 0.24)",
        overflow: "hidden",
      }}
    >
      <div style={{ padding: "20px 20px 14px 20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap", alignItems: "flex-start" }}>
          <div>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "10px" }}>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  padding: "6px 10px",
                  borderRadius: "999px",
                  background: pedido.statusMeta.bg,
                  color: pedido.statusMeta.color,
                  fontSize: "12px",
                  fontWeight: 800,
                }}
              >
                {pedido.statusMeta.label}
              </span>
              {isPedidoVacuna(pedido) ? (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    padding: "6px 10px",
                    borderRadius: "999px",
                    background: "rgba(14, 116, 144, 0.12)",
                    color: "#0f766e",
                    fontSize: "12px",
                    fontWeight: 800,
                  }}
                >
                  Vacuna
                </span>
              ) : null}
            </div>
            <div style={{ fontSize: "24px", fontWeight: 900, color: "#0f172a", lineHeight: 1.05 }}>
              {formatOrderNumber(pedido)}
            </div>
            <div style={{ marginTop: "8px", fontSize: "14px", fontWeight: 700, color: "#334155" }}>
              {roleLabel}: {counterpart || "Sin sucursal"}
            </div>
          </div>

          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "11px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "#94a3b8" }}>
              Fecha
            </div>
            <div style={{ marginTop: "6px", fontSize: "16px", fontWeight: 800, color: "#0f172a" }}>
              {formatDateLabel(pedido.historyDate)}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "16px" }}>
          {[
            { label: "Items", value: pedido.itemsCount },
            { label: "Peso real", value: `${pedido.totalReal.toFixed(2)} lb` },
            { label: "Entrega", value: getPhysicalSender(pedido) || "-" },
            { label: "Recibe", value: getPhysicalReceiver(pedido) || "-" },
          ].map((item) => (
            <div
              key={`${pedido.firebaseId}-${item.label}`}
              style={{
                minWidth: "118px",
                padding: "10px 12px",
                borderRadius: "14px",
                background: "rgba(241, 245, 249, 0.92)",
                border: "1px solid rgba(148, 163, 184, 0.18)",
              }}
            >
              <div style={{ fontSize: "10px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "#94a3b8" }}>
                {item.label}
              </div>
              <div style={{ marginTop: "5px", fontSize: "13px", fontWeight: 800, color: "#0f172a" }}>{item.value}</div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "18px" }}>
          <button
            type="button"
            onClick={onToggle}
            style={{
              padding: "11px 16px",
              borderRadius: "12px",
              border: "1px solid rgba(59, 130, 246, 0.22)",
              background: isOpen ? "rgba(37, 99, 235, 0.12)" : "#ffffff",
              color: "#2563eb",
              fontWeight: 800,
              fontSize: "13px",
              cursor: "pointer",
            }}
          >
            {isOpen ? "Ocultar detalle" : "Ver detalle"}
          </button>
          <button
            type="button"
            onClick={() => downloadTransferRequisitionPdf({ pedido })}
            style={{
              padding: "11px 16px",
              borderRadius: "12px",
              border: "1px solid rgba(5, 150, 105, 0.22)",
              background: "rgba(5, 150, 105, 0.08)",
              color: "#047857",
              fontWeight: 800,
              fontSize: "13px",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            {Icons.file}
            PDF requisa
          </button>
          <button
            type="button"
            onClick={() => printTransferRequisition(pedido, printerSettings)}
            style={{
              padding: "11px 16px",
              borderRadius: "12px",
              border: "1px solid rgba(71, 85, 105, 0.2)",
              background: "rgba(255,255,255,0.98)",
              color: "#334155",
              fontWeight: 800,
              fontSize: "13px",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            {Icons.print}
            Imprimir 80mm
          </button>
        </div>
      </div>

      {isOpen ? (
        <div style={{ borderTop: "1px solid rgba(148, 163, 184, 0.14)", background: "rgba(248,250,252,0.82)" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
              gap: "12px",
              padding: "18px 20px",
            }}
          >
            {[
              { label: "Preparado por", value: pedido.preparadoPor || "-" },
              { label: "Enviado con", value: pedido.enviadoCon || "-" },
              { label: "Recibido por", value: pedido.recibidoPor || "-" },
              { label: "Hora envio", value: pedido.timestampEnviado || "-" },
              { label: "Hora recepcion", value: pedido.horaRecepcion || "-" },
              { label: "Entrega", value: pedido.fechaEntrega || "Sin fecha" },
            ].map((info) => (
              <div
                key={`${pedido.firebaseId}-${info.label}`}
                style={{
                  padding: "12px 14px",
                  borderRadius: "14px",
                  background: "#ffffff",
                  border: "1px solid rgba(148, 163, 184, 0.16)",
                }}
              >
                <div style={{ fontSize: "10px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "#94a3b8" }}>
                  {info.label}
                </div>
                <div style={{ marginTop: "6px", fontSize: "13px", fontWeight: 800, color: "#0f172a" }}>{info.value}</div>
              </div>
            ))}
          </div>

          {(pedido.notaGeneral || "").trim() ? (
            <div
              style={{
                margin: "0 20px 18px 20px",
                padding: "14px 16px",
                borderRadius: "16px",
                background: "rgba(37, 99, 235, 0.08)",
                border: "1px solid rgba(37, 99, 235, 0.16)",
                color: "#1d4ed8",
                fontSize: "13px",
                fontWeight: 700,
              }}
            >
              Nota general: {pedido.notaGeneral}
            </div>
          ) : null}

          <div style={{ padding: "0 20px 20px 20px", overflowX: "auto" }}>
            <table style={{ width: "100%", minWidth: "760px", borderCollapse: "collapse", background: "#ffffff", borderRadius: "18px", overflow: "hidden" }}>
              <thead>
                <tr>
                  {["Clave", "Producto", "Solicitado", "Real", "Nota"].map((header) => (
                    <th
                      key={header}
                      style={{
                        padding: "12px 14px",
                        textAlign: "left",
                        fontSize: "11px",
                        fontWeight: 800,
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                        color: "#475569",
                        background: "rgba(37, 99, 235, 0.08)",
                      }}
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(pedido.items || []).map((item, index) => (
                  <tr key={`${pedido.firebaseId}-item-${index}`}>
                    <td style={{ padding: "13px 14px", borderTop: "1px solid rgba(226, 232, 240, 0.8)", fontFamily: "monospace", fontSize: "12px", color: "#475569" }}>
                      {item?.clave || "-"}
                    </td>
                    <td style={{ padding: "13px 14px", borderTop: "1px solid rgba(226, 232, 240, 0.8)", fontSize: "13px", fontWeight: 800, color: "#0f172a" }}>
                      {item?.producto || "-"}
                    </td>
                    <td style={{ padding: "13px 14px", borderTop: "1px solid rgba(226, 232, 240, 0.8)", fontSize: "13px", color: "#334155" }}>
                      {getRequestedText(pedido, item)}
                    </td>
                    <td style={{ padding: "13px 14px", borderTop: "1px solid rgba(226, 232, 240, 0.8)", fontSize: "13px", fontWeight: 800, color: "#047857" }}>
                      {getRealText(item, pedido)}
                    </td>
                    <td style={{ padding: "13px 14px", borderTop: "1px solid rgba(226, 232, 240, 0.8)", fontSize: "12px", color: item?.nota ? "#b45309" : "#94a3b8", fontWeight: item?.nota ? 700 : 600 }}>
                      {item?.nota || "Sin nota"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </article>
  );
}

function OrderList({ title, pedidos, role, expandedId, onToggle, printerSettings }) {
  if (!pedidos.length) {
    return (
      <EmptyState
        title={`Sin ${title.toLowerCase()}`}
        text="No hay movimientos con este filtro en el periodo seleccionado."
      />
    );
  }

  return (
    <div style={{ display: "grid", gap: "18px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ fontSize: "24px", fontWeight: 900, color: "#0f172a" }}>{title}</div>
        <div style={{ fontSize: "13px", fontWeight: 800, color: "#64748b" }}>{pedidos.length} pedidos</div>
      </div>
      {pedidos.map((pedido) => (
        <OrderCard
          key={pedido.firebaseId}
          pedido={pedido}
          role={role}
          isOpen={expandedId === pedido.firebaseId}
          onToggle={() => onToggle(pedido.firebaseId)}
          printerSettings={printerSettings}
        />
      ))}
    </div>
  );
}

function ReportActionCard({ title, description, accent, onPdfClick, onExcelClick, disabled }) {
  return (
    <div
      style={{
        padding: "20px",
        borderRadius: "20px",
        background: `linear-gradient(180deg, ${accent}10 0%, rgba(255,255,255,0.98) 100%)`,
        border: `1px solid ${accent}24`,
        boxShadow: "0 22px 36px -32px rgba(15, 23, 42, 0.25)",
      }}
    >
      <div style={{ fontSize: "18px", fontWeight: 900, color: "#0f172a", marginBottom: "8px" }}>{title}</div>
      <div style={{ fontSize: "13px", color: "#475569", minHeight: "38px" }}>{description}</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginTop: "18px" }}>
        <button
          type="button"
          onClick={onPdfClick}
          disabled={disabled}
          style={{
            padding: "12px 14px",
            borderRadius: "14px",
            border: "none",
            background: disabled ? "#cbd5e1" : accent,
            color: "#ffffff",
            fontWeight: 800,
            fontSize: "13px",
            cursor: disabled ? "not-allowed" : "pointer",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
          }}
        >
          {Icons.file}
          PDF
        </button>
        <button
          type="button"
          onClick={onExcelClick}
          disabled={disabled}
          style={{
            padding: "12px 14px",
            borderRadius: "14px",
            border: `1px solid ${disabled ? "#cbd5e1" : `${accent}40`}`,
            background: disabled ? "#e2e8f0" : "rgba(255,255,255,0.94)",
            color: disabled ? "#64748b" : accent,
            fontWeight: 800,
            fontSize: "13px",
            cursor: disabled ? "not-allowed" : "pointer",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
          }}
        >
          {Icons.table}
          Excel
        </button>
      </div>
    </div>
  );
}

export default function Historial({ user, pedidos, printerSettings = {} }) {
  const today = new Date().toISOString().split("T")[0];
  const branchLabel = getBranchDisplayName(user);
  const [modoFecha, setModoFecha] = useState("dia");
  const [fechaSeleccionada, setFechaSeleccionada] = useState(today);
  const [fechaDesde, setFechaDesde] = useState(today);
  const [fechaHasta, setFechaHasta] = useState(today);
  const [activeTab, setActiveTab] = useState("recibidos");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedId, setExpandedId] = useState(null);

  const { fechaInicioFiltro, fechaFinFiltro } = useMemo(() => {
    if (modoFecha === "rango") {
      const start = fechaDesde || fechaHasta || today;
      const end = fechaHasta || fechaDesde || start;

      return start <= end
        ? { fechaInicioFiltro: start, fechaFinFiltro: end }
        : { fechaInicioFiltro: end, fechaFinFiltro: start };
    }

    return {
      fechaInicioFiltro: fechaSeleccionada,
      fechaFinFiltro: fechaSeleccionada,
    };
  }, [modoFecha, fechaSeleccionada, fechaDesde, fechaHasta, today]);

  const pedidosDecorados = useMemo(
    () => pedidos.map((pedido) => buildOrderDescriptor(pedido, user)).sort(sortPedidosDesc),
    [pedidos, user],
  );

  const pedidosEnRango = useMemo(
    () => filterPedidosByDate(pedidosDecorados, fechaInicioFiltro, fechaFinFiltro),
    [pedidosDecorados, fechaInicioFiltro, fechaFinFiltro],
  );

  const pedidosRecibidosPeriodo = useMemo(
    () => pedidosEnRango.filter((pedido) => pedido.isReceivedByUser && matchesStatus(pedido, statusFilter)),
    [pedidosEnRango, statusFilter],
  );

  const pedidosEnviadosPeriodo = useMemo(
    () => pedidosEnRango.filter((pedido) => pedido.isSentByUser && matchesStatus(pedido, statusFilter)),
    [pedidosEnRango, statusFilter],
  );

  const pedidosRecibidos = useMemo(
    () => pedidosRecibidosPeriodo.filter((pedido) => matchesSearch(pedido, searchTerm)),
    [pedidosRecibidosPeriodo, searchTerm],
  );

  const pedidosEnviados = useMemo(
    () => pedidosEnviadosPeriodo.filter((pedido) => matchesSearch(pedido, searchTerm)),
    [pedidosEnviadosPeriodo, searchTerm],
  );

  const stats = useMemo(
    () => buildHistoryStats(pedidosRecibidosPeriodo, pedidosEnviadosPeriodo),
    [pedidosRecibidosPeriodo, pedidosEnviadosPeriodo],
  );

  const periodoEtiqueta =
    modoFecha === "rango"
      ? `${formatDateLabel(fechaInicioFiltro)} al ${formatDateLabel(fechaFinFiltro)}`
      : formatDateLabel(fechaSeleccionada);

  const pedidosConfirmadosRecibidos = useMemo(
    () => pedidosRecibidosPeriodo.filter((pedido) => ["RECIBIDO_CONFORME", "ENTREGADO"].includes(pedido.estado)),
    [pedidosRecibidosPeriodo],
  );

  const pedidosConfirmadosEnviados = useMemo(
    () => pedidosEnviadosPeriodo.filter((pedido) => ["ENVIADO", "RECIBIDO_CONFORME", "ENTREGADO"].includes(pedido.estado)),
    [pedidosEnviadosPeriodo],
  );

  const consolidatedRecibidos = useMemo(
    () => buildConsolidatedRows(pedidosConfirmadosRecibidos),
    [pedidosConfirmadosRecibidos],
  );

  const consolidatedEnviados = useMemo(
    () => buildConsolidatedRows(pedidosConfirmadosEnviados),
    [pedidosConfirmadosEnviados],
  );

  const handleToggleOrder = (firebaseId) => {
    setExpandedId((current) => (current === firebaseId ? null : firebaseId));
  };

  return (
    <div style={{ animation: "slideIn 0.35s ease-out" }}>
      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(14px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @media (max-width: 768px) {
          .historial-filter-grid {
            grid-template-columns: 1fr !important;
          }
          .historial-stats-grid {
            grid-template-columns: 1fr 1fr !important;
          }
          .historial-report-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "16px",
          marginBottom: "24px",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <div
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "16px",
              background: "linear-gradient(135deg, #2563eb 0%, #0ea5e9 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#ffffff",
              boxShadow: "0 18px 30px -24px rgba(37, 99, 235, 0.85)",
            }}
          >
            {Icons.list}
          </div>
          <div>
            <div style={{ fontSize: "28px", fontWeight: 900, color: "#0f172a" }}>Historial</div>
            <div style={{ marginTop: "4px", fontSize: "13px", color: "#64748b", fontWeight: 700 }}>
              {branchLabel} · Recibidos, enviados y reportes
            </div>
          </div>
        </div>

        <div
          style={{
            padding: "14px 18px",
            borderRadius: "18px",
            background: "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(241,245,249,0.94) 100%)",
            border: "1px solid rgba(148, 163, 184, 0.18)",
            boxShadow: "0 20px 40px -34px rgba(15, 23, 42, 0.24)",
          }}
        >
          <div style={{ fontSize: "10px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "#94a3b8" }}>
            Periodo
          </div>
          <div style={{ marginTop: "6px", fontSize: "18px", fontWeight: 900, color: "#0f172a" }}>{periodoEtiqueta}</div>
        </div>
      </div>

      <section
        style={{
          background: "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(241,245,249,0.96) 100%)",
          borderRadius: "24px",
          padding: "24px",
          marginBottom: "24px",
          border: "1px solid rgba(148, 163, 184, 0.18)",
          boxShadow: "0 22px 44px -34px rgba(15, 23, 42, 0.28)",
        }}
      >
        <div className="historial-filter-grid" style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: "14px" }}>
          <div>
            <div style={{ fontSize: "11px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "#64748b", marginBottom: "8px" }}>
              Modo
            </div>
            <div style={{ display: "flex", gap: "8px", background: "#e2e8f0", padding: "6px", borderRadius: "14px" }}>
              {[
                { key: "dia", label: "Fecha" },
                { key: "rango", label: "Intervalo" },
              ].map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setModoFecha(option.key)}
                  style={{
                    flex: 1,
                    padding: "10px 12px",
                    borderRadius: "10px",
                    border: "none",
                    background: modoFecha === option.key ? "linear-gradient(135deg, #2563eb 0%, #0ea5e9 100%)" : "transparent",
                    color: modoFecha === option.key ? "#ffffff" : "#475569",
                    fontWeight: 800,
                    fontSize: "13px",
                    cursor: "pointer",
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div style={{ fontSize: "11px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "#64748b", marginBottom: "8px" }}>
              {modoFecha === "rango" ? "Desde" : "Fecha"}
            </div>
            <input
              type="date"
              value={modoFecha === "rango" ? fechaDesde : fechaSeleccionada}
              onChange={(event) => {
                if (modoFecha === "rango") {
                  setFechaDesde(event.target.value);
                } else {
                  setFechaSeleccionada(event.target.value);
                }
              }}
              style={{
                width: "100%",
                padding: "13px 14px",
                borderRadius: "14px",
                border: "1px solid rgba(148, 163, 184, 0.3)",
                background: "#ffffff",
                color: "#0f172a",
                fontSize: "14px",
                fontWeight: 700,
              }}
            />
          </div>

          <div>
            <div style={{ fontSize: "11px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "#64748b", marginBottom: "8px" }}>
              {modoFecha === "rango" ? "Hasta" : "Estado"}
            </div>
            {modoFecha === "rango" ? (
              <input
                type="date"
                value={fechaHasta}
                onChange={(event) => setFechaHasta(event.target.value)}
                style={{
                  width: "100%",
                  padding: "13px 14px",
                  borderRadius: "14px",
                  border: "1px solid rgba(148, 163, 184, 0.3)",
                  background: "#ffffff",
                  color: "#0f172a",
                  fontSize: "14px",
                  fontWeight: 700,
                }}
              />
            ) : (
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                style={{
                  width: "100%",
                  padding: "13px 14px",
                  borderRadius: "14px",
                  border: "1px solid rgba(148, 163, 184, 0.3)",
                  background: "#ffffff",
                  color: "#0f172a",
                  fontSize: "14px",
                  fontWeight: 700,
                }}
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <div style={{ fontSize: "11px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "#64748b", marginBottom: "8px" }}>
              {modoFecha === "rango" ? "Estado" : "Buscar"}
            </div>
            {modoFecha === "rango" ? (
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                style={{
                  width: "100%",
                  padding: "13px 14px",
                  borderRadius: "14px",
                  border: "1px solid rgba(148, 163, 184, 0.3)",
                  background: "#ffffff",
                  color: "#0f172a",
                  fontSize: "14px",
                  fontWeight: 700,
                }}
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            ) : (
              <div style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: "12px", top: "13px", color: "#94a3b8" }}>{Icons.search}</span>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Pedido, producto o sucursal"
                  style={{
                    width: "100%",
                    padding: "13px 14px 13px 40px",
                    borderRadius: "14px",
                    border: "1px solid rgba(148, 163, 184, 0.3)",
                    background: "#ffffff",
                    color: "#0f172a",
                    fontSize: "14px",
                    fontWeight: 700,
                  }}
                />
              </div>
            )}
          </div>

          <div>
            <div style={{ fontSize: "11px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: "#64748b", marginBottom: "8px" }}>
              {modoFecha === "rango" ? "Buscar" : "Periodo"}
            </div>
            {modoFecha === "rango" ? (
              <div style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: "12px", top: "13px", color: "#94a3b8" }}>{Icons.search}</span>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Pedido, producto o sucursal"
                  style={{
                    width: "100%",
                    padding: "13px 14px 13px 40px",
                    borderRadius: "14px",
                    border: "1px solid rgba(148, 163, 184, 0.3)",
                    background: "#ffffff",
                    color: "#0f172a",
                    fontSize: "14px",
                    fontWeight: 700,
                  }}
                />
              </div>
            ) : (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "13px 14px",
                  borderRadius: "14px",
                  border: "1px solid rgba(148, 163, 184, 0.18)",
                  background: "rgba(37, 99, 235, 0.06)",
                  color: "#1d4ed8",
                  fontSize: "14px",
                  fontWeight: 800,
                }}
              >
                {Icons.calendar}
                {periodoEtiqueta}
              </div>
            )}
          </div>
        </div>
      </section>

      <div className="historial-stats-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "14px", marginBottom: "22px" }}>
        <StatCard label="Recibidos" value={stats.recibidos} helper={`${stats.totalRecibido.toFixed(2)} lb confirmados`} accent="#047857" />
        <StatCard label="Enviados" value={stats.enviados} helper={`${stats.totalEnviado.toFixed(2)} lb con movimiento`} accent="#2563eb" />
        <StatCard label="Consolidado recibidos" value={consolidatedRecibidos.length} helper="Productos agrupados" accent="#7c3aed" />
        <StatCard label="Consolidado envios" value={consolidatedEnviados.length} helper="Productos agrupados" accent="#d97706" />
      </div>

      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "24px" }}>
        {SECTION_TABS.map((tab) => (
          <SectionTabButton key={tab.key} active={activeTab === tab.key} label={tab.label} onClick={() => setActiveTab(tab.key)} />
        ))}
      </div>

      {activeTab === "recibidos" ? (
        <OrderList title="Pedidos recibidos" pedidos={pedidosRecibidos} role="recibidos" expandedId={expandedId} onToggle={handleToggleOrder} printerSettings={printerSettings} />
      ) : null}

      {activeTab === "enviados" ? (
        <OrderList title="Pedidos enviados" pedidos={pedidosEnviados} role="enviados" expandedId={expandedId} onToggle={handleToggleOrder} printerSettings={printerSettings} />
      ) : null}

      {activeTab === "reportes" ? (
        <div style={{ display: "grid", gap: "22px" }}>
          <section
            style={{
              padding: "24px",
              borderRadius: "24px",
              background: "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(248,250,252,0.96) 100%)",
              border: "1px solid rgba(148, 163, 184, 0.18)",
              boxShadow: "0 22px 44px -34px rgba(15, 23, 42, 0.28)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: "14px", flexWrap: "wrap", marginBottom: "18px" }}>
              <div>
                <div style={{ fontSize: "24px", fontWeight: 900, color: "#0f172a" }}>Reportes exportables</div>
                <div style={{ marginTop: "6px", fontSize: "13px", color: "#64748b", fontWeight: 700 }}>
                  Periodo activo: {periodoEtiqueta}
                </div>
              </div>
              <div style={{ display: "flex", gap: "10px", alignItems: "center", color: "#475569", fontWeight: 700, fontSize: "13px" }}>
                {Icons.download}
                PDF y Excel listos para descargar
              </div>
            </div>

            <div className="historial-report-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "16px" }}>
              <ReportActionCard
                title="Recibidos detallado"
                description="Pedido por pedido, con solicitado, peso real y estado para firma."
                accent="#047857"
                disabled={!pedidosRecibidosPeriodo.length}
                onPdfClick={() =>
                  downloadDetailedHistoryPdf({
                    title: `Recibidos_${user}`,
                    pedidos: pedidosRecibidosPeriodo,
                    fechaInicio: fechaInicioFiltro,
                    fechaFin: fechaFinFiltro,
                    user,
                    role: "recibidos",
                  })
                }
                onExcelClick={() =>
                  downloadDetailedHistoryExcel({
                    title: `Recibidos_${user}`,
                    pedidos: pedidosRecibidosPeriodo,
                    fechaInicio: fechaInicioFiltro,
                    fechaFin: fechaFinFiltro,
                    user,
                    role: "recibidos",
                  })
                }
              />
              <ReportActionCard
                title="Enviados detallado"
                description="Movimientos enviados por tu sucursal, listos para control y firma."
                accent="#2563eb"
                disabled={!pedidosEnviadosPeriodo.length}
                onPdfClick={() =>
                  downloadDetailedHistoryPdf({
                    title: `Enviados_${user}`,
                    pedidos: pedidosEnviadosPeriodo,
                    fechaInicio: fechaInicioFiltro,
                    fechaFin: fechaFinFiltro,
                    user,
                    role: "enviados",
                  })
                }
                onExcelClick={() =>
                  downloadDetailedHistoryExcel({
                    title: `Enviados_${user}`,
                    pedidos: pedidosEnviadosPeriodo,
                    fechaInicio: fechaInicioFiltro,
                    fechaFin: fechaFinFiltro,
                    user,
                    role: "enviados",
                  })
                }
              />
              <ReportActionCard
                title="Consolidado recibidos"
                description="Agrupado por producto y unidad en el intervalo actual."
                accent="#7c3aed"
                disabled={!pedidosConfirmadosRecibidos.length}
                onPdfClick={() =>
                  downloadConsolidatedHistoryPdf({
                    title: `Consolidado_Recibidos_${user}`,
                    pedidos: pedidosConfirmadosRecibidos,
                    fechaInicio: fechaInicioFiltro,
                    fechaFin: fechaFinFiltro,
                    user,
                  })
                }
                onExcelClick={() =>
                  downloadConsolidatedHistoryExcel({
                    title: `Consolidado_Recibidos_${user}`,
                    pedidos: pedidosConfirmadosRecibidos,
                    fechaInicio: fechaInicioFiltro,
                    fechaFin: fechaFinFiltro,
                    user,
                    sheetName: "Consolidado recibidos",
                  })
                }
              />
              <ReportActionCard
                title="Consolidado envios"
                description="Total por producto de los envios con movimiento real en el periodo."
                accent="#d97706"
                disabled={!pedidosConfirmadosEnviados.length}
                onPdfClick={() =>
                  downloadConsolidatedHistoryPdf({
                    title: `Consolidado_Envios_${user}`,
                    pedidos: pedidosConfirmadosEnviados,
                    fechaInicio: fechaInicioFiltro,
                    fechaFin: fechaFinFiltro,
                    user,
                  })
                }
                onExcelClick={() =>
                  downloadConsolidatedHistoryExcel({
                    title: `Consolidado_Envios_${user}`,
                    pedidos: pedidosConfirmadosEnviados,
                    fechaInicio: fechaInicioFiltro,
                    fechaFin: fechaFinFiltro,
                    user,
                    sheetName: "Consolidado envios",
                  })
                }
              />
            </div>
          </section>

          <section
            style={{
              padding: "24px",
              borderRadius: "24px",
              background: "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(248,250,252,0.96) 100%)",
              border: "1px solid rgba(148, 163, 184, 0.18)",
              boxShadow: "0 22px 44px -34px rgba(15, 23, 42, 0.28)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: "14px", flexWrap: "wrap", marginBottom: "18px" }}>
              <div>
                <div style={{ fontSize: "24px", fontWeight: 900, color: "#0f172a" }}>Vista rapida</div>
                <div style={{ marginTop: "6px", fontSize: "13px", color: "#64748b", fontWeight: 700 }}>
                  Consolidado actual para validar antes de exportar
                </div>
              </div>
            </div>

            {!consolidatedEnviados.length && !consolidatedRecibidos.length ? (
              <EmptyState title="Sin movimientos confirmados" text="Necesitas pedidos con movimiento real para generar consolidados." />
            ) : (
              <div className="historial-report-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "18px" }}>
                <div
                  style={{
                    borderRadius: "20px",
                    border: "1px solid rgba(148, 163, 184, 0.16)",
                    overflow: "hidden",
                    background: "#ffffff",
                  }}
                >
                  <div style={{ padding: "16px 18px", borderBottom: "1px solid rgba(148, 163, 184, 0.12)", fontSize: "16px", fontWeight: 900, color: "#0f172a" }}>
                    Consolidado recibidos
                  </div>
                  <div style={{ maxHeight: "320px", overflow: "auto" }}>
                    {consolidatedRecibidos.slice(0, 10).map((row) => (
                      <div key={`rec-${row.clave}-${row.producto}`} style={{ display: "grid", gridTemplateColumns: "1.4fr 0.5fr 0.8fr", gap: "12px", padding: "14px 16px", borderTop: "1px solid rgba(226, 232, 240, 0.8)" }}>
                        <div>
                          <div style={{ fontSize: "13px", fontWeight: 800, color: "#0f172a" }}>{row.producto}</div>
                          <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "4px" }}>{row.clave || "Sin clave"}</div>
                        </div>
                        <div style={{ fontSize: "13px", fontWeight: 800, color: "#334155", alignSelf: "center" }}>{row.unidad}</div>
                        <div style={{ fontSize: "13px", fontWeight: 900, color: "#047857", alignSelf: "center", textAlign: "right" }}>{row.cantidad.toFixed(2)}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div
                  style={{
                    borderRadius: "20px",
                    border: "1px solid rgba(148, 163, 184, 0.16)",
                    overflow: "hidden",
                    background: "#ffffff",
                  }}
                >
                  <div style={{ padding: "16px 18px", borderBottom: "1px solid rgba(148, 163, 184, 0.12)", fontSize: "16px", fontWeight: 900, color: "#0f172a" }}>
                    Consolidado envios
                  </div>
                  <div style={{ maxHeight: "320px", overflow: "auto" }}>
                    {consolidatedEnviados.slice(0, 10).map((row) => (
                      <div key={`env-${row.clave}-${row.producto}`} style={{ display: "grid", gridTemplateColumns: "1.4fr 0.5fr 0.8fr", gap: "12px", padding: "14px 16px", borderTop: "1px solid rgba(226, 232, 240, 0.8)" }}>
                        <div>
                          <div style={{ fontSize: "13px", fontWeight: 800, color: "#0f172a" }}>{row.producto}</div>
                          <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "4px" }}>{row.clave || "Sin clave"}</div>
                        </div>
                        <div style={{ fontSize: "13px", fontWeight: 800, color: "#334155", alignSelf: "center" }}>{row.unidad}</div>
                        <div style={{ fontSize: "13px", fontWeight: 900, color: "#2563eb", alignSelf: "center", textAlign: "right" }}>{row.cantidad.toFixed(2)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      ) : null}
    </div>
  );
}
