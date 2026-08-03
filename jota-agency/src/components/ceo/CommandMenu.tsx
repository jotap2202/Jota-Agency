"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { SECCIONES, type ItemBusqueda } from "./navegacion";

/** Buscador global (⌘K / Ctrl+K): secciones + leads, clientes, campañas y tareas. */
export function CommandMenu({ indice, cerrar }: { indice: ItemBusqueda[]; cerrar: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [activo, setActivo] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const todo: ItemBusqueda[] = useMemo(
    () => [
      ...SECCIONES.map((s) => ({
        id: `sec-${s.href}`, titulo: s.nombre, detalle: "Ir a la sección",
        tipo: "Sección" as const, href: s.href,
      })),
      ...indice,
    ],
    [indice],
  );

  const resultados = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return todo.slice(0, 12);
    return todo
      .filter((i) => `${i.titulo} ${i.detalle} ${i.tipo}`.toLowerCase().includes(t))
      .slice(0, 20);
  }, [q, todo]);

  // Al escribir, la lista cambia y el índice seleccionado podría quedar
  // apuntando fuera. Se reinicia en el propio onChange, no en un efecto:
  // mismo resultado sin un render extra por cada tecla.
  const escribir = (v: string) => { setQ(v); setActivo(0); };

  const ir = (i: ItemBusqueda | undefined) => {
    if (!i) return;
    cerrar();
    router.push(i.href);
  };

  return (
    <div
      className="ceo-tapa"
      style={{ display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: "12vh" }}
      onClick={cerrar}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Buscador global"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(560px, 92vw)", background: "var(--c-surface)",
          border: "1px solid var(--c-line)", borderRadius: 14,
          boxShadow: "var(--c-shadow)", overflow: "hidden",
        }}
      >
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => escribir(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setActivo((a) => Math.min(a + 1, resultados.length - 1)); }
            if (e.key === "ArrowUp") { e.preventDefault(); setActivo((a) => Math.max(a - 1, 0)); }
            if (e.key === "Enter") { e.preventDefault(); ir(resultados[Math.min(activo, resultados.length - 1)]); }
          }}
          placeholder="Buscar leads, clientes, campañas, tareas o secciones…"
          aria-label="Buscar"
          style={{
            width: "100%", padding: "15px 18px", fontSize: 14.5,
            background: "transparent", border: "none", outline: "none",
            color: "var(--c-text)", borderBottom: "1px solid var(--c-line)",
            fontFamily: "inherit",
          }}
        />

        <div style={{ maxHeight: "52vh", overflowY: "auto", padding: 6 }}>
          {resultados.length === 0 ? (
            <p style={{ padding: "26px 18px", textAlign: "center", fontSize: 13, color: "var(--c-dim)" }}>
              Nada coincide con “{q}”.
            </p>
          ) : (
            resultados.map((r, i) => (
              <button
                key={r.id}
                onClick={() => ir(r)}
                onMouseEnter={() => setActivo(i)}
                style={{
                  width: "100%", display: "flex", alignItems: "center", gap: 11,
                  padding: "9px 12px", borderRadius: 9, border: "none", cursor: "pointer",
                  textAlign: "left", fontFamily: "inherit",
                  background: i === activo ? "var(--c-surface-2)" : "transparent",
                  color: "var(--c-text)",
                }}
              >
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: 13.5, display: "block" }}>{r.titulo}</span>
                  <span style={{ fontSize: 11.5, color: "var(--c-dim)" }}>{r.detalle}</span>
                </span>
                <span className="ceo-chip ceo-chip-gris">{r.tipo}</span>
              </button>
            ))
          )}
        </div>

        <div style={{ padding: "8px 14px", borderTop: "1px solid var(--c-line)", fontSize: 11, color: "var(--c-dim)", display: "flex", gap: 14 }}>
          <span>↑↓ moverse</span><span>↵ abrir</span><span>esc cerrar</span>
        </div>
      </div>
    </div>
  );
}
