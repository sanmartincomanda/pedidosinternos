"use client";

import React, { forwardRef, useEffect, useState } from "react";
import { createPortal } from "react-dom";

function normalizeNumericValue(value, decimals) {
  const clean = `${value ?? ""}`
    .replace(",", ".")
    .replace(/[^0-9.]/g, "");
  const [whole = "", ...fractionParts] = clean.split(".");
  const fraction = fractionParts.join("").slice(0, decimals);

  if (clean.startsWith(".")) return `0.${fraction}`;
  if (fractionParts.length > 0) return `${whole || "0"}.${fraction}`;
  return whole;
}

function NumericKeypad({ label, initialValue, decimals, onCancel, onConfirm, onOpenBultos, bultosCount }) {
  const [buffer, setBuffer] = useState(() => normalizeNumericValue(initialValue, decimals));

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (/^[0-9]$/.test(event.key)) {
        setBuffer((current) => normalizeNumericValue(`${current}${event.key}`, decimals));
      } else if ((event.key === "." || event.key === ",") && decimals > 0) {
        setBuffer((current) => (current.includes(".") ? current : `${current || "0"}.`));
      } else if (event.key === "Backspace") {
        setBuffer((current) => current.slice(0, -1));
      } else if (event.key === "Escape") {
        onCancel();
      } else if (event.key === "Enter") {
        onConfirm(buffer);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [buffer, decimals, onCancel, onConfirm]);

  const append = (digit) => {
    setBuffer((current) => normalizeNumericValue(`${current}${digit}`, decimals));
  };

  return createPortal(
    <div className="app-modal z-[120] items-end px-3 pb-[calc(12px+env(safe-area-inset-bottom))] sm:items-center sm:p-4">
      <div className="w-full max-w-[340px] rounded-[1.65rem] border border-slate-200 bg-white p-4 shadow-[0_30px_80px_-24px_rgba(15,23,42,0.55)]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Ingresar valor</div>
            <div className="mt-1 text-sm font-black text-slate-800">{label}</div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 text-xl font-bold text-slate-500"
            aria-label="Cerrar teclado"
          >
            x
          </button>
        </div>

        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-950 px-4 py-3 text-right font-mono text-3xl font-black tracking-tight text-white">
          {buffer || "0"}
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          {["7", "8", "9", "4", "5", "6", "1", "2", "3"].map((digit) => (
            <button
              key={digit}
              type="button"
              onClick={() => append(digit)}
              className="min-h-14 rounded-2xl border border-slate-200 bg-slate-50 text-xl font-black text-slate-900 active:scale-95 active:bg-slate-200"
            >
              {digit}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setBuffer("")}
            className="min-h-14 rounded-2xl border border-rose-200 bg-rose-50 text-sm font-black text-rose-700 active:scale-95"
          >
            Limpiar
          </button>
          <button
            type="button"
            onClick={() => append("0")}
            className="min-h-14 rounded-2xl border border-slate-200 bg-slate-50 text-xl font-black text-slate-900 active:scale-95"
          >
            0
          </button>
          <button
            type="button"
            disabled={decimals === 0}
            onClick={() => setBuffer((current) => (current.includes(".") ? current : `${current || "0"}.`))}
            className="min-h-14 rounded-2xl border border-slate-200 bg-slate-50 text-xl font-black text-slate-900 disabled:opacity-35 active:scale-95"
          >
            .
          </button>
        </div>

        <div className={`mt-2 grid gap-2 ${onOpenBultos ? "grid-cols-3" : "grid-cols-[1fr_1.5fr]"}`}>
          <button
            type="button"
            onClick={() => setBuffer((current) => current.slice(0, -1))}
            className="min-h-13 rounded-2xl border border-slate-200 bg-white text-sm font-black text-slate-600"
          >
            Borrar
          </button>
          {onOpenBultos ? (
            <button
              type="button"
              onClick={() => {
                onCancel();
                onOpenBultos();
              }}
              className="min-h-13 rounded-2xl border border-lime-300 bg-lime-50 px-1 text-[11px] font-black text-lime-800"
            >
              Bultos {bultosCount > 0 ? bultosCount : "+"}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => onConfirm(buffer)}
            className="min-h-13 rounded-2xl bg-emerald-600 text-sm font-black text-white shadow-[0_16px_30px_-18px_rgba(5,150,105,0.75)] active:scale-[0.98]"
          >
            Aceptar
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

const TouchNumericInput = forwardRef(function TouchNumericInput(
  {
    value,
    onValueChange,
    label = "Cantidad",
    decimals = 2,
    className = "",
    placeholder = "0",
    onKeyDown,
    onConfirmValue,
    enterKeyHint = "next",
    min = 0,
    onOpenBultos,
    bultosCount = 0,
  },
  ref,
) {
  const [keypadOpen, setKeypadOpen] = useState(false);
  const [coarsePointer, setCoarsePointer] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(pointer: coarse)");
    const syncPointer = () => setCoarsePointer(media.matches);
    syncPointer();
    media.addEventListener?.("change", syncPointer);
    return () => media.removeEventListener?.("change", syncPointer);
  }, []);

  const confirm = (nextValue) => {
    const normalized = normalizeNumericValue(nextValue, decimals);
    onValueChange(normalized);
    setKeypadOpen(false);
    onConfirmValue?.(normalized);
  };

  return (
    <>
      <input
        ref={ref}
        type="text"
        value={value}
        onChange={(event) => onValueChange(normalizeNumericValue(event.target.value, decimals))}
        onKeyDown={onKeyDown}
        onClick={() => coarsePointer && setKeypadOpen(true)}
        onFocus={(event) => {
          event.target.select();
          if (coarsePointer) setKeypadOpen(true);
        }}
        readOnly={coarsePointer}
        inputMode={coarsePointer ? "none" : "decimal"}
        enterKeyHint={enterKeyHint}
        min={min}
        placeholder={placeholder}
        className={className}
      />
      {keypadOpen ? (
        <NumericKeypad
          label={label}
          initialValue={value}
          decimals={decimals}
          onCancel={() => setKeypadOpen(false)}
          onConfirm={confirm}
          onOpenBultos={onOpenBultos}
          bultosCount={bultosCount}
        />
      ) : null}
    </>
  );
});

export default TouchNumericInput;
