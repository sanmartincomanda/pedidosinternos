"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";

const iconPaths = {
  back: <path d="m15 18-6-6 6-6" />,
  chevron: <path d="m9 18 6-6-6-6" />,
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  trash: <path d="M3 6h18M8 6V4h8v2M19 6l-1 13a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6" />,
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" />
    </>
  ),
  invoice: (
    <>
      <path d="M6 3h9l3 3v15H6z" />
      <path d="M14 3v4h4M9 12h6M9 16h6" />
    </>
  ),
  camera: (
    <>
      <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
      <circle cx="12" cy="13" r="3.5" />
    </>
  ),
  file: (
    <>
      <path d="M6 3h9l3 3v15H6z" />
      <path d="M14 3v4h4" />
    </>
  ),
  scale: <path d="M12 3v4M5 7h14M7 7l-4 8h8L7 7Zm10 0-4 8h8l-4-8ZM12 7v14M8 21h8" />,
  check: <path d="m5 12 4 4L19 6" />,
  refresh: (
    <>
      <path d="M20 7v5h-5M4 17v-5h5" />
      <path d="M6.1 9a7 7 0 0 1 11.8-2L20 12M4 12l2.1 5a7 7 0 0 0 11.8-2" />
    </>
  ),
  more: (
    <>
      <circle cx="5" cy="12" r="1.3" />
      <circle cx="12" cy="12" r="1.3" />
      <circle cx="19" cy="12" r="1.3" />
    </>
  ),
  history: (
    <>
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4v5h5M12 7v5l3 2" />
    </>
  ),
};

export function Icon({ name, size = 20, strokeWidth = 1.8 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {iconPaths[name]}
    </svg>
  );
}

export function useMediaQuery(query) {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const media = window.matchMedia(query);
    const sync = () => setMatches(media.matches);
    sync();
    media.addEventListener?.("change", sync);
    return () => media.removeEventListener?.("change", sync);
  }, [query]);
  return matches;
}

/**
 * Internal screen stack for a mobile flow, wired to the browser/Android back button.
 * Only one history entry is ever pushed (a "guard"); every hardware back pops one
 * screen and re-arms the guard while there is still somewhere to go back to.
 */
export function useScreenStack(initial, { enabled = true, onBackRequest } = {}) {
  const [stack, setStack] = useState([initial]);
  const [guardTick, setGuardTick] = useState(0);
  const guardActive = useRef(false);
  const ignoreNextPop = useRef(false);
  const stackRef = useRef(stack);
  const backRequestRef = useRef(onBackRequest);
  useEffect(() => {
    stackRef.current = stack;
    backRequestRef.current = onBackRequest;
  });

  const push = useCallback((screen) => setStack((current) => [...current, screen]), []);
  const replaceTop = useCallback((screen) => setStack((current) => [...current.slice(0, -1), screen]), []);
  const reset = useCallback((next) => setStack(Array.isArray(next) ? next : [next]), []);

  const back = useCallback(() => {
    const current = stackRef.current;
    if (current.length <= 1) return;
    if (backRequestRef.current?.(current[current.length - 1]) === false) return;
    setStack((rows) => (rows.length > 1 ? rows.slice(0, -1) : rows));
  }, []);

  useEffect(() => {
    if (!enabled) return undefined;
    const handlePop = () => {
      if (ignoreNextPop.current) {
        ignoreNextPop.current = false;
        return;
      }
      if (!guardActive.current) return;
      guardActive.current = false;
      back();
      setGuardTick((tick) => tick + 1);
    };
    window.addEventListener("popstate", handlePop);
    return () => window.removeEventListener("popstate", handlePop);
  }, [back, enabled]);

  useEffect(() => {
    if (!enabled) return;
    if (stack.length > 1 && !guardActive.current) {
      window.history.pushState({ ...(window.history.state || {}), csmFlowGuard: true }, "");
      guardActive.current = true;
    } else if (stack.length === 1 && guardActive.current) {
      guardActive.current = false;
      ignoreNextPop.current = true;
      window.history.back();
    }
  }, [enabled, guardTick, stack.length]);

  useEffect(() => () => {
    if (guardActive.current) {
      guardActive.current = false;
      window.history.back();
    }
  }, []);

  return { stack, screen: stack[stack.length - 1], depth: stack.length, push, back, replaceTop, reset };
}

/** Full-height mobile screen: sticky "← Title" header, scrolling body, optional fixed footer. */
export function MobileScreen({ title, subtitle, onBack, backLabel = "Volver", actions, footer, children, direction = "forward" }) {
  return (
    <div className={`csm-screen ${direction === "back" ? "is-back" : ""}`}>
      <header className="csm-screen-header">
        {onBack ? (
          <button type="button" onClick={onBack} className="csm-screen-back" aria-label={backLabel}>
            <Icon name="back" size={24} strokeWidth={2} />
          </button>
        ) : (
          <span className="w-3" aria-hidden="true" />
        )}
        <div className="min-w-0 flex-1">
          <h2 className="csm-screen-title">{title}</h2>
          {subtitle ? <div className="csm-screen-subtitle">{subtitle}</div> : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-1">{actions}</div> : null}
      </header>
      <div className={`csm-screen-body ${footer ? "has-footer" : ""}`}>{children}</div>
      {footer ? <div className="csm-screen-footer">{footer}</div> : null}
    </div>
  );
}

export function articleUnit(article) {
  return `${article?.unidadCompra || article?.unidadVenta || article?.unidad || ""}`.trim();
}

/**
 * The primary way to identify a product. The full name is never truncated:
 * similar names ("POSTA DE CERDO" / "POSTA DE CERDO (E) (+20 LB)") must stay distinguishable.
 */
export function ProductIdentity({ article, size = "md", as: Tag = "div", extra, hideMeta = false }) {
  const unit = articleUnit(article);
  const tax = Number(article?.taxPercent || 0);
  return (
    <Tag className={`csm-product csm-product-${size}`}>
      <span className="csm-product-name">{article?.descripcion || "Producto sin nombre"}</span>
      {hideMeta ? null : (
      <span className="csm-product-meta">
        <span className="csm-product-code">{article?.clave || "Sin clave"}</span>
        {unit ? <span>{unit}</span> : null}
        {tax > 0 ? <span>IVA {tax}%</span> : null}
        {extra}
      </span>
      )}
    </Tag>
  );
}

export function ConfirmSheet({ title, children, actions, onClose, labelledBy = "csm-confirm-title" }) {
  return (
    <div
      className="app-modal z-[140] px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose?.();
      }}
    >
      <div className="app-modal-panel w-full max-w-md p-5">
        <h3 id={labelledBy} className="csm-dialog-title">{title}</h3>
        <div className="mt-2 text-sm text-[var(--gray-700)]">{children}</div>
        <div className="csm-dialog-actions">{actions}</div>
      </div>
    </div>
  );
}
