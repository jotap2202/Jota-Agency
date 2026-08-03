"use client";

import { useRef, useState, useTransition } from "react";
import { agregarLead, registrarIngreso } from "@/app/ceo/acciones";
import { SERVICIOS, CANALES, ETIQUETA_CANAL } from "@/lib/ceo/demo";

/** Alta rápida desde la barra superior: un lead o un ingreso. */
export function ModalesRapidos({ tipo, cerrar }: { tipo: "lead" | "ingreso"; cerrar: () => void }) {
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const enviar = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const datos = new FormData(e.currentTarget);
    iniciar(async () => {
      try {
        if (tipo === "lead") await agregarLead(datos);
        else await registrarIngreso(datos);
        cerrar();
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo guardar. Probá de nuevo.");
      }
    });
  };

  const esLead = tipo === "lead";

  return (
    <div
      className="ceo-tapa"
      style={{ display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: "8vh", overflowY: "auto" }}
      onClick={cerrar}
      role="presentation"
    >
      <form
        ref={formRef}
        onSubmit={enviar}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={esLead ? "Agregar lead" : "Registrar ingreso"}
        style={{
          width: "min(540px, 92vw)", background: "var(--c-surface)",
          border: "1px solid var(--c-line)", borderRadius: 14,
          boxShadow: "var(--c-shadow)", padding: 22, marginBottom: 40,
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 18 }}>
          <h2 className="ceo-h2">{esLead ? "Nuevo lead" : "Registrar ingreso"}</h2>
          <button type="button" onClick={cerrar} className="ceo-btn ceo-btn-icon" aria-label="Cerrar">×</button>
        </div>

        {esLead ? (
          <div style={{ display: "grid", gap: 13, gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))" }}>
            <div style={{ gridColumn: "1 / -1" }}>
              <label className="ceo-label" htmlFor="l-empresa">Empresa *</label>
              <input id="l-empresa" name="empresa" required className="ceo-input" placeholder="Kihei Coast Realty" />
            </div>
            <div>
              <label className="ceo-label" htmlFor="l-contacto">Contacto</label>
              <input id="l-contacto" name="contacto" className="ceo-input" placeholder="Nombre y apellido" />
            </div>
            <div>
              <label className="ceo-label" htmlFor="l-cargo">Cargo</label>
              <input id="l-cargo" name="cargo" className="ceo-input" placeholder="Owner, CEO, Director…" />
            </div>
            <div>
              <label className="ceo-label" htmlFor="l-industria">Industria</label>
              <input id="l-industria" name="industria" className="ceo-input" placeholder="Inmobiliaria, clínica…" />
            </div>
            <div>
              <label className="ceo-label" htmlFor="l-ciudad">Ciudad</label>
              <input id="l-ciudad" name="ciudad" className="ceo-input" placeholder="Kihei" />
            </div>
            <div>
              <label className="ceo-label" htmlFor="l-email">Email</label>
              <input id="l-email" name="email" type="email" className="ceo-input" placeholder="nombre@empresa.com" />
            </div>
            <div>
              <label className="ceo-label" htmlFor="l-telefono">Teléfono</label>
              <input id="l-telefono" name="telefono" className="ceo-input" placeholder="+1 808…" />
            </div>
            <div>
              <label className="ceo-label" htmlFor="l-web">Sitio web</label>
              <input id="l-web" name="web" type="url" className="ceo-input" placeholder="https://…" />
            </div>
            <div>
              <label className="ceo-label" htmlFor="l-empleados">Empleados</label>
              <input id="l-empleados" name="empleados" type="number" min="0" className="ceo-input" placeholder="12" />
            </div>
            <div>
              <label className="ceo-label" htmlFor="l-servicio">Servicio que podría necesitar</label>
              <select id="l-servicio" name="servicio" className="ceo-input">
                <option value="">Sin definir</option>
                {SERVICIOS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="ceo-label" htmlFor="l-fuente">Fuente</label>
              <select id="l-fuente" name="fuente" className="ceo-input">
                {CANALES.map((c) => <option key={c} value={c}>{ETIQUETA_CANAL[c]}</option>)}
              </select>
            </div>
            <div>
              <label className="ceo-label" htmlFor="l-valor">Valor estimado (USD/mes)</label>
              <input id="l-valor" name="valor" className="ceo-input" placeholder="2400" inputMode="decimal" />
            </div>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 13, gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))" }}>
            <div style={{ gridColumn: "1 / -1" }}>
              <label className="ceo-label" htmlFor="i-concepto">Concepto *</label>
              <input id="i-concepto" name="concepto" required className="ceo-input" placeholder="B2B Prospecting — Wailea Luxury Rentals" />
            </div>
            <div>
              <label className="ceo-label" htmlFor="i-monto">Monto (USD) *</label>
              <input id="i-monto" name="monto" required className="ceo-input" placeholder="3200" inputMode="decimal" />
            </div>
            <div>
              <label className="ceo-label" htmlFor="i-fecha">Fecha</label>
              <input id="i-fecha" name="fecha" type="date" className="ceo-input" defaultValue={new Date().toISOString().slice(0, 10)} />
            </div>
            <div>
              <label className="ceo-label" htmlFor="i-servicio">Servicio</label>
              <select id="i-servicio" name="servicio" className="ceo-input">
                {SERVICIOS.map((s) => <option key={s} value={s}>{s}</option>)}
                <option value="Custom Service">Custom Service</option>
              </select>
            </div>
            <div>
              <label className="ceo-label" htmlFor="i-canal">Canal de adquisición</label>
              <select id="i-canal" name="canal" className="ceo-input">
                <option value="">Sin definir</option>
                {CANALES.map((c) => <option key={c} value={c}>{ETIQUETA_CANAL[c]}</option>)}
              </select>
            </div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 8, paddingBottom: 8 }}>
              <input id="i-recurrente" name="recurrente" type="checkbox" style={{ accentColor: "var(--c-gold)" }} />
              <label htmlFor="i-recurrente" style={{ fontSize: 13 }}>Es recurrente (MRR)</label>
            </div>
          </div>
        )}

        {error && (
          <p role="alert" style={{ marginTop: 14, fontSize: 13, color: "var(--c-red)" }}>{error}</p>
        )}

        <div style={{ display: "flex", gap: 10, marginTop: 20, justifyContent: "flex-end" }}>
          <button type="button" className="ceo-btn" onClick={cerrar}>Cancelar</button>
          <button type="submit" className="ceo-btn ceo-btn-gold" disabled={pendiente}>
            {pendiente ? "Guardando…" : esLead ? "Agregar lead" : "Registrar ingreso"}
          </button>
        </div>
      </form>
    </div>
  );
}
