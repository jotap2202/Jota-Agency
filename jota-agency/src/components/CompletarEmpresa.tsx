"use client";

import { useState } from "react";
import { T, IDIOMA_POR_DEFECTO, type Idioma } from "@/lib/contenido";

/**
 * Paso corto que aparece solo para quien entró con Google: pide la empresa,
 * el único dato del formulario de registro que Google no puede darnos.
 */
export function CompletarEmpresa({ lang = IDIOMA_POR_DEFECTO, onListo }: { lang?: Idioma; onListo?: () => void }) {
  const d = T[lang].diag;
  const [empresa, setEmpresa] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const guardar = async () => {
    setError(null);
    if (!empresa.trim()) return setError(d.empError);

    setGuardando(true);
    try {
      const res = await fetch("/api/perfil", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ empresa: empresa.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setGuardando(false);
        return setError(data.error || d.errorConexion);
      }
      if (onListo) onListo();
      else window.location.reload();
    } catch {
      setGuardando(false);
      setError(d.errorConexion);
    }
  };

  return (
    <div>
      <div style={{ fontFamily: "var(--font-display), sans-serif", fontSize: 19 }}>{d.empTitulo}</div>
      <p style={{ marginTop: 4, marginBottom: 16, fontSize: 14, color: "var(--dim)", lineHeight: 1.7 }}>{d.empSub}</p>

      <label htmlFor="emp-nombre" className="sr-only">{d.empPlaceholder}</label>
      <input
        id="emp-nombre"
        className="jfield"
        autoComplete="organization"
        placeholder={d.empPlaceholder}
        value={empresa}
        onChange={(e) => setEmpresa(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") guardar(); }}
      />

      {error && <p role="alert" style={{ marginTop: 10, fontSize: 13, color: "var(--red)" }}>{error}</p>}

      <button className="btn-gold" style={{ marginTop: 16, opacity: guardando ? 0.6 : 1 }} onClick={guardar} disabled={guardando}>
        {guardando ? "…" : d.empBoton} →
      </button>
    </div>
  );
}
