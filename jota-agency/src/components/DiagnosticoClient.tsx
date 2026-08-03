"use client";

import { EMAIL_CONTACTO, T, IDIOMA_POR_DEFECTO, type Idioma } from "@/lib/contenido";
import { useDiagnostico } from "@/lib/useDiagnostico";

export function DiagnosticoClient({ email, lang = IDIOMA_POR_DEFECTO }: { email?: string | null; lang?: Idioma }) {
  const t = T[lang];
  const d = t.diag;
  const { desc, setDesc, resultado, cargando, esDemo, error, pedir, reiniciar } =
    useDiagnostico(lang, { error: d.errorConexion });

  return (
    <div className="rounded-3xl p-6" style={{ background: "rgba(15,36,41,0.85)", border: "1px solid var(--line)", boxShadow: "0 30px 80px rgba(0,0,0,0.45)" }}>
      <div className="flex items-center gap-3 mb-5">
        <div className="h-11 w-11 rounded-2xl flex items-center justify-center gold-grad font-display font-bold" aria-hidden style={{ color: "var(--gold-dark)", fontSize: 19 }}>J</div>
        <div>
          <div className="font-display text-[15px]">J</div>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" aria-hidden style={{ background: "var(--green)", animation: "pulse-dot 2s infinite" }} />
            <span className="text-xs" style={{ color: "var(--dim)" }}>{d.online}{email ? ` · ${email}` : ""}</span>
          </div>
        </div>
      </div>

      {!resultado ? (
        <>
          <label htmlFor="diag" className="sr-only">{d.descLabel}</label>
          <textarea id="diag" rows={4} value={desc} onChange={(e) => setDesc(e.target.value)}
            placeholder={d.placeholder}
            className="w-full rounded-xl px-4 py-3 text-sm outline-none"
            style={{ background: "var(--panel-soft)", border: "1px solid var(--line)", color: "var(--text)", resize: "vertical" }} />
          <div className="mt-4 flex items-center gap-3 flex-wrap">
            <button onClick={pedir} disabled={cargando || !desc.trim()} className="rounded-full px-6 py-3 text-sm font-semibold gold-grad"
              style={{ color: "var(--gold-dark)", opacity: cargando || !desc.trim() ? 0.55 : 1 }}>
              {cargando ? d.analizando : d.boton}
            </button>
            {cargando && <span className="font-mono text-xs" style={{ color: "var(--gold)", animation: "pulse-dot 1.2s infinite" }}>●●●</span>}
          </div>
          {error && <p className="mt-3 text-sm" role="alert" style={{ color: "var(--red)" }}>{error}</p>}
        </>
      ) : (
        <>
          <div className="flex items-center gap-3">
            <span className="h-px w-8" style={{ background: "var(--gold)" }} />
            <span className="font-mono text-[11px] uppercase" style={{ color: "var(--gold)", letterSpacing: "0.22em" }}>{d.resultado}</span>
          </div>
          {/* Mismo criterio que en la landing: el párrafo visible no es la
              live region (anunciaría cada token del streaming). Se anuncia
              una vez, ya completo, desde la copia sr-only. */}
          <p className="mt-4 text-sm whitespace-pre-wrap" aria-hidden="true" aria-busy={cargando} style={{ lineHeight: 1.8 }}>{resultado}</p>
          <p className="sr-only" role="status">{cargando ? d.analizando : resultado}</p>

          {esDemo && (
            <p className="mt-3 text-xs" role="status" style={{ color: "var(--dim)" }}>
              ⚠︎ {lang === "es"
                ? "Modo demo: falta configurar ANTHROPIC_API_KEY en Vercel. Con la clave, J genera un diagnóstico único para cada visitante."
                : "Demo mode: ANTHROPIC_API_KEY is not set in Vercel. With the key, J writes a unique diagnosis for every visitor."}
            </p>
          )}

          <div className="mt-6 flex gap-3 flex-wrap items-center">
            <a href={`mailto:${EMAIL_CONTACTO}?subject=${encodeURIComponent(t.asuntoMail)}`} className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold gold-grad" style={{ color: "var(--gold-dark)" }}>
              {d.ctaLlamada} <span aria-hidden>→</span>
            </a>
            <button onClick={reiniciar} className="text-sm underline" style={{ color: "var(--dim)" }}>{d.denuevo}</button>
          </div>
        </>
      )}
    </div>
  );
}
