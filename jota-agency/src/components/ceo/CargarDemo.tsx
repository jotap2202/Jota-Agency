"use client";

import { useState, useTransition } from "react";
import { cargarDemo, borrarDemo } from "@/app/ceo/acciones";

/** Botón para cargar o borrar los datos de ejemplo. */
export function CargarDemo({ modo = "cargar" }: { modo?: "cargar" | "borrar" }) {
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const borrando = modo === "borrar";

  const ejecutar = () => {
    if (borrando && !confirm("¿Borrar todos los datos de ejemplo? Lo que hayas cargado vos no se toca.")) return;
    setError(null);
    iniciar(async () => {
      try {
        await (borrando ? borrarDemo() : cargarDemo());
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo completar. Probá de nuevo.");
      }
    });
  };

  return (
    <span style={{ display: "inline-flex", flexDirection: "column", gap: 6 }}>
      <button
        onClick={ejecutar}
        disabled={pendiente}
        className={borrando ? "ceo-btn" : "ceo-btn ceo-btn-gold"}
      >
        {pendiente
          ? borrando ? "Borrando…" : "Cargando…"
          : borrando ? "Borrar datos de ejemplo" : "Cargar datos de ejemplo"}
      </button>
      {error && <span role="alert" style={{ fontSize: 12, color: "var(--c-red)" }}>{error}</span>}
    </span>
  );
}
