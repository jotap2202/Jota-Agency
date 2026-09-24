"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { reservar, type EstadoReserva } from "@/app/agendar/acciones";

type Horario = { inicio: string; etiqueta: string };

const campo = {
  background: "var(--panel-soft)",
  border: "1px solid var(--line)",
  color: "var(--text)",
  borderRadius: 10,
  padding: "11px 12px",
  fontSize: 14,
  width: "100%",
} as const;

const ERRORES: Record<string, [string, string]> = {
  nombre: ["Poné tu nombre.", "Please enter your name."],
  email: ["Revisá el email.", "Please check your email."],
  empresa: ["Poné el nombre de tu empresa.", "Please enter your company."],
  horario: ["Elegí un horario.", "Please pick a time."],
  ocupado: ["Ese horario se acaba de ocupar. Elegí otro.", "That time was just taken. Please pick another."],
  fuera_de_horario: ["Ese horario ya no está disponible. Elegí otro.", "That time is no longer available. Please pick another."],
  pasado: ["Ese horario ya pasó. Elegí otro.", "That time has passed. Please pick another."],
  demasiadas: ["Ya tenés dos llamadas agendadas. Te escribimos por email.", "You already have two calls booked. We'll email you."],
  cerrado: ["La agenda no está disponible ahora. Escribinos por email.", "Booking is unavailable right now. Please email us."],
};

export function FormReserva({ horarios, es, zonaNegocio }: { horarios: Horario[]; es: boolean; zonaNegocio: string }) {
  const [estado, accion, enviando] = useActionState<EstadoReserva, FormData>(reservar, { estado: "inicial" });
  const [elegido, setElegido] = useState("");
  // Los horarios se muestran en la hora de QUIEN MIRA. Un cliente de
  // California no tiene por qué hacer la cuenta desde Hawái. El servidor no
  // sabe esa zona: pinta la del negocio y el navegador la cambia al montar
  // (si se calculara en el render, servidor y navegador no coincidirían).
  const [zona, setZona] = useState(zonaNegocio);
  useEffect(() => {
    setZona(Intl.DateTimeFormat().resolvedOptions().timeZone || zonaNegocio);
  }, [zonaNegocio]);

  const porDia = useMemo(() => {
    const dia = new Intl.DateTimeFormat(es ? "es" : "en-US", { weekday: "long", month: "long", day: "numeric", timeZone: zona });
    const hora = new Intl.DateTimeFormat(es ? "es" : "en-US", { hour: "numeric", minute: "2-digit", timeZone: zona });
    const grupos = new Map<string, { inicio: string; hora: string }[]>();
    for (const h of horarios) {
      const d = new Date(h.inicio);
      const clave = dia.format(d);
      if (!grupos.has(clave)) grupos.set(clave, []);
      grupos.get(clave)!.push({ inicio: h.inicio, hora: hora.format(d) });
    }
    return [...grupos.entries()];
  }, [horarios, es, zona]);

  if (estado.estado === "ok") {
    return (
      <div className="rounded-3xl p-8" style={{ background: "var(--panel)", border: "1px solid var(--green)", marginTop: 32 }}>
        <p className="font-display" style={{ fontSize: 22 }}>{es ? "¡Listo! Llamada agendada." : "You're booked!"}</p>
        <p style={{ color: "var(--dim)", fontSize: 15, lineHeight: 1.7, marginTop: 10 }}>
          {estado.cuando && <>{estado.cuando}. </>}
          {es ? "Te mandamos la confirmación por email. Si necesitás cambiarla, respondé ese email." : "We've emailed you a confirmation. Need to change it? Just reply to that email."}
        </p>
      </div>
    );
  }

  const error = estado.estado === "error" ? ERRORES[estado.motivo]?.[es ? 0 : 1] ?? (es ? "Algo falló. Probá de nuevo." : "Something went wrong. Please try again.") : null;

  return (
    <form action={accion} style={{ marginTop: 32, display: "grid", gap: 22 }}>
      <div className="rounded-3xl p-6" style={{ background: "var(--panel)", border: "1px solid var(--line)" }}>
        <p className="mono" style={{ fontSize: 11, color: "var(--dim)", margin: "0 0 14px" }}>
          {es ? "1. ELEGÍ UN HORARIO" : "1. PICK A TIME"} · {es ? "tu hora" : "your time"} ({zona})
        </p>
        <div style={{ display: "grid", gap: 16, maxHeight: 420, overflowY: "auto", paddingRight: 4 }}>
          {porDia.map(([dia, lista]) => (
            <fieldset key={dia} style={{ border: 0, padding: 0, margin: 0 }}>
              <legend style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, textTransform: "capitalize" }}>{dia}</legend>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {lista.map((h) => {
                  const activo = elegido === h.inicio;
                  return (
                    <label
                      key={h.inicio}
                      style={{
                        cursor: "pointer", borderRadius: 999, padding: "8px 14px", fontSize: 13.5,
                        border: `1px solid ${activo ? "var(--gold)" : "var(--line)"}`,
                        background: activo ? "rgba(227,179,65,0.14)" : "var(--panel-soft)",
                      }}
                    >
                      <input
                        type="radio" name="inicio" value={h.inicio} required
                        checked={activo} onChange={() => setElegido(h.inicio)}
                        style={{ position: "absolute", opacity: 0, width: 1, height: 1 }}
                      />
                      {h.hora}
                    </label>
                  );
                })}
              </div>
            </fieldset>
          ))}
        </div>
      </div>

      <div className="rounded-3xl p-6" style={{ background: "var(--panel)", border: "1px solid var(--line)", display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))" }}>
        <p className="mono" style={{ fontSize: 11, color: "var(--dim)", margin: 0, gridColumn: "1 / -1" }}>
          {es ? "2. TUS DATOS" : "2. YOUR DETAILS"}
        </p>
        <input name="nombre" required placeholder={es ? "Tu nombre *" : "Your name *"} autoComplete="name" style={campo} />
        <input name="email" type="email" required placeholder={es ? "Tu email *" : "Your email *"} autoComplete="email" style={campo} />
        <input name="empresa" required placeholder={es ? "Tu empresa *" : "Your company *"} autoComplete="organization" style={campo} />
        <input name="web" placeholder={es ? "Sitio web" : "Website"} autoComplete="url" style={campo} />
        <input name="telefono" type="tel" placeholder={es ? "Teléfono (opcional)" : "Phone (optional)"} autoComplete="tel" style={campo} />
        <textarea
          name="mensaje" rows={3} style={{ ...campo, gridColumn: "1 / -1", resize: "vertical" }}
          placeholder={es ? "¿Qué vendés y cuánto vale un cliente nuevo para vos? (opcional)" : "What do you sell, and what's a new client worth to you? (optional)"}
        />
        {/* Trampa para bots: fuera de la vista y del tab. */}
        <input name="sitio_alternativo" tabIndex={-1} autoComplete="off" aria-hidden style={{ position: "absolute", left: -9999, width: 1, height: 1 }} />
      </div>

      {error && <p role="alert" style={{ color: "var(--red)", fontSize: 14, margin: 0 }}>{error}</p>}

      <button type="submit" className="btn-gold" disabled={enviando} style={{ justifySelf: "start" }}>
        {enviando ? (es ? "Agendando…" : "Booking…") : es ? "Confirmar llamada →" : "Confirm call →"}
      </button>
    </form>
  );
}
