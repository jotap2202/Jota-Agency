"use client";

import { useState } from "react";

export function DiagnosticoClient({ email }: { email?: string | null }) {
  const [desc, setDesc] = useState("");
  const [resultado, setResultado] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pedir = async () => {
    const consulta = desc.trim();
    if (!consulta || cargando) return;
    setCargando(true);
    setError(null);
    setResultado(null);
    try {
      const res = await fetch("/api/diagnostico", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ consulta, idioma: "es" }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Error");
      }
      // J va escribiendo: mostramos el texto a medida que llega
      const reader = res.body?.getReader();
      if (!reader) throw new Error("Error");
      const decoder = new TextDecoder();
      let acumulado = "";
      setResultado("");
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acumulado += decoder.decode(value, { stream: true });
        setResultado(acumulado);
      }
      if (!acumulado.trim()) throw new Error("Error");
    } catch (e) {
      setResultado(null);
      setError(e instanceof Error ? e.message : "No pude conectar con J. Probá de nuevo.");
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="rounded-3xl p-6" style={{ background: "rgba(15,36,41,0.85)", border: "1px solid var(--line)", boxShadow: "0 30px 80px rgba(0,0,0,0.45)" }}>
      <div className="flex items-center gap-3 mb-5">
        <div className="h-11 w-11 rounded-2xl flex items-center justify-center gold-grad font-display font-bold" aria-hidden style={{ color: "var(--gold-dark)", fontSize: 19 }}>J</div>
        <div>
          <div className="font-display text-[15px]">J</div>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" aria-hidden style={{ background: "var(--green)", animation: "pulse-dot 2s infinite" }} />
            <span className="text-xs" style={{ color: "var(--dim)" }}>Estratega IA · en línea{email ? ` · ${email}` : ""}</span>
          </div>
        </div>
      </div>

      {!resultado ? (
        <>
          <label htmlFor="diag" className="sr-only">Describí tu negocio</label>
          <textarea id="diag" rows={4} value={desc} onChange={(e) => setDesc(e.target.value)}
            placeholder="Ej: Tengo un estudio contable con 6 empleados. Los clientes llegan por recomendación pero hace un año que no crecemos…"
            className="w-full rounded-xl px-4 py-3 text-sm outline-none"
            style={{ background: "var(--panel-soft)", border: "1px solid var(--line)", color: "var(--text)", resize: "vertical" }} />
          <div className="mt-4 flex items-center gap-3 flex-wrap">
            <button onClick={pedir} disabled={cargando || !desc.trim()} className="rounded-full px-6 py-3 text-sm font-semibold gold-grad"
              style={{ color: "var(--gold-dark)", opacity: cargando || !desc.trim() ? 0.55 : 1 }}>
              {cargando ? "J está analizando tu negocio…" : "Diagnosticar mi empresa"}
            </button>
            {cargando && <span className="font-mono text-xs" style={{ color: "var(--gold)", animation: "pulse-dot 1.2s infinite" }}>●●●</span>}
          </div>
          {error && <p className="mt-3 text-sm" role="alert" style={{ color: "var(--red)" }}>{error}</p>}
        </>
      ) : (
        <>
          <div className="flex items-center gap-3">
            <span className="h-px w-8" style={{ background: "var(--gold)" }} />
            <span className="font-mono text-[11px] uppercase" style={{ color: "var(--gold)", letterSpacing: "0.22em" }}>Diagnóstico de J</span>
          </div>
          <p className="mt-4 text-sm whitespace-pre-wrap" aria-live="polite" style={{ lineHeight: 1.8 }}>{resultado}</p>
          <div className="mt-6 flex gap-3 flex-wrap items-center">
            <a href="mailto:hola@jota.agency?subject=Quiero%20agendar%20la%20llamada%20de%2015%20min" className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold gold-grad" style={{ color: "var(--gold-dark)" }}>
              Agendar llamada de 15 min <span aria-hidden>→</span>
            </a>
            <button onClick={() => { setResultado(null); setDesc(""); }} className="text-sm underline" style={{ color: "var(--dim)" }}>Hacer otro diagnóstico</button>
          </div>
        </>
      )}
    </div>
  );
}
