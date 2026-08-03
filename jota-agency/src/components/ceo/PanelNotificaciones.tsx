"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { marcarNotificacionLeida, marcarTodasLeidas } from "@/app/ceo/acciones";

export type NotificacionUI = {
  id: string;
  tipo: string;
  titulo: string;
  detalle: string;
  url: string;
  leida: boolean;
  cuando: string;
};

const COLOR: Record<string, string> = {
  clienteEnRiesgo: "var(--c-red)",
  campaniaBaja: "var(--c-red)",
  objetivoAtrasado: "var(--c-red)",
  seguimientoVencido: "var(--c-gold)",
  propuestaSinRespuesta: "var(--c-gold)",
  facturaPendiente: "var(--c-gold)",
  reunionProxima: "var(--c-green)",
  nuevoLead: "var(--c-green)",
};

export function PanelNotificaciones({
  notificaciones,
  sinLeer,
}: { notificaciones: NotificacionUI[]; sinLeer: number }) {
  const [abierto, setAbierto] = useState(false);
  const [, iniciar] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(false);
    };
    document.addEventListener("mousedown", fuera);
    return () => document.removeEventListener("mousedown", fuera);
  }, [abierto]);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        className="ceo-btn ceo-btn-icon"
        onClick={() => setAbierto((v) => !v)}
        aria-label={sinLeer ? `Notificaciones, ${sinLeer} sin leer` : "Notificaciones"}
        aria-expanded={abierto}
      >
        <span aria-hidden>◔</span>
        {sinLeer > 0 && (
          <span
            aria-hidden
            style={{
              position: "absolute", top: 2, right: 2, minWidth: 15, height: 15,
              borderRadius: 999, background: "var(--c-red)", color: "#fff",
              fontSize: 9.5, display: "flex", alignItems: "center", justifyContent: "center",
              padding: "0 4px", fontWeight: 600,
            }}
          >
            {sinLeer}
          </span>
        )}
      </button>

      {abierto && (
        <div
          style={{
            position: "absolute", right: 0, top: "calc(100% + 8px)", width: "min(370px, 88vw)",
            background: "var(--c-surface)", border: "1px solid var(--c-line)",
            borderRadius: 13, boxShadow: "var(--c-shadow)", zIndex: 50, overflow: "hidden",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 14px", borderBottom: "1px solid var(--c-line)" }}>
            <strong style={{ fontSize: 13 }}>Notificaciones</strong>
            {sinLeer > 0 && (
              <button
                onClick={() => iniciar(() => { void marcarTodasLeidas(); })}
                style={{ background: "none", border: "none", color: "var(--c-gold)", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}
              >
                Marcar todas
              </button>
            )}
          </div>

          <div style={{ maxHeight: "56vh", overflowY: "auto" }}>
            {notificaciones.length === 0 ? (
              <p style={{ padding: "28px 16px", textAlign: "center", fontSize: 13, color: "var(--c-dim)" }}>
                No hay notificaciones. Cuando un lead quede sin responder o un cliente entre en riesgo, aparece acá.
              </p>
            ) : (
              notificaciones.map((n) => (
                <Link
                  key={n.id}
                  href={n.url || "/ceo"}
                  onClick={() => {
                    setAbierto(false);
                    if (!n.leida) iniciar(() => { void marcarNotificacionLeida(n.id); });
                  }}
                  style={{
                    display: "block", padding: "11px 14px",
                    borderBottom: "1px solid var(--c-line-soft)",
                    background: n.leida ? "transparent" : "var(--c-surface-2)",
                  }}
                >
                  <div style={{ display: "flex", gap: 9, alignItems: "flex-start" }}>
                    <span aria-hidden style={{ color: COLOR[n.tipo] ?? "var(--c-dim)", fontSize: 15, lineHeight: 1.2 }}>●</span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: n.leida ? 400 : 500 }}>{n.titulo}</div>
                      {n.detalle && <div style={{ fontSize: 12, color: "var(--c-dim)", marginTop: 2, lineHeight: 1.5 }}>{n.detalle}</div>}
                      <div style={{ fontSize: 10.5, color: "var(--c-dim)", marginTop: 4, fontFamily: "var(--font-mono), monospace" }}>{n.cuando}</div>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
