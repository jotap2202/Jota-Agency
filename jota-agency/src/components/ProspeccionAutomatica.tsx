import Link from "next/link";
import { aprobarBorrador, aprobarTodos, correrProspeccion, crearNegocioJota, descartarBorrador } from "@/app/panel/prospectos/acciones";

/**
 * Sección del panel de prospectos para el workflow 21.
 *
 * Lo primero que muestra es lo que FALTA configurar: una automatización que
 * no corre y no lo dice es peor que no tenerla, porque uno cree que está
 * trabajando.
 */

export type BorradorUI = { id: string; empresa: string; rubro: string; email: string; asunto: string; cuerpo: string };

export type ProspeccionUI = {
  activo: boolean;
  avisos: string[];
  modo: "borrador" | "automatico";
  limiteDiario: number;
  enviados24h: number;
  conEmail: number;
  sinEmail: number;
  enCola: number;
  enSecuencia: number;
  respondieron: number;
  borradores: BorradorUI[];
  /** Estado del negocio "jota" en el agente, para guiar la puesta en marcha. */
  negocioJota: "no_existe" | "onboarding" | "activo" | "pausado";
  slugJota: string;
};

const campo = {
  background: "var(--panel-soft)",
  border: "1px solid var(--line)",
  color: "var(--text)",
  borderRadius: 10,
  padding: "10px 12px",
  fontSize: 13,
  width: "100%",
} as const;

export function ProspeccionAutomatica({ d }: { d: ProspeccionUI }) {
  const cifras: [number | string, string][] = [
    [`${d.enviados24h}/${d.limiteDiario}`, "Emails en las últimas 24 h"],
    [d.borradores.length, "Borradores para revisar"],
    [d.enCola, "Aprobados, esperando horario"],
    [d.enSecuencia, "En secuencia de seguimiento"],
    [d.respondieron, "Respondieron"],
    [d.conEmail, "Sin contactar, con email"],
    [d.sinEmail, "Sin email todavía (se buscan solos)"],
  ];

  return (
    <section style={{ marginBottom: 48 }}>
      <div className="eyebrow" style={{ margin: "0 0 20px" }}>
        <span className="l" /><span className="t">Prospección automática</span>
      </div>

      <div className="rounded-3xl p-6" style={{ background: "var(--panel)", border: "1px solid var(--line)" }}>
        <p style={{ color: "var(--dim)", fontSize: 13.5, lineHeight: 1.7, margin: 0 }}>
          Busca el email en la web de cada prospecto, redacta el primer mensaje, lo manda en horario
          hábil de Hawái y hace dos seguimientos en el mismo hilo. Cuando alguien responde, la
          conversación pasa a J en el{" "}
          <Link href="/ceo/agent/inbox" style={{ color: "var(--gold)" }}>inbox del agente</Link>, que
          califica y agenda. Modo actual:{" "}
          <strong style={{ color: "var(--text)" }}>
            {d.modo === "automatico" ? "automático (salen sin revisión)" : "borrador (vos aprobás cada primer email)"}
          </strong>.
        </p>

        {d.avisos.length > 0 && (
          <ul style={{ margin: "16px 0 0", padding: "12px 16px 12px 32px", borderRadius: 12, border: `1px solid ${d.activo ? "var(--line)" : "var(--red)"}`, fontSize: 13, lineHeight: 1.7 }}>
            {d.avisos.map((a) => (
              <li key={a} style={{ color: d.activo ? "var(--dim)" : "var(--text)" }}>{a}</li>
            ))}
          </ul>
        )}

        {d.negocioJota !== "activo" && (
          <div style={{ marginTop: 16, fontSize: 13, lineHeight: 1.7 }}>
            {d.negocioJota === "no_existe" ? (
              <form action={crearNegocioJota} style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                <span style={{ color: "var(--dim)" }}>Paso 1: crear el negocio de JOTA en el agente, con la oferta y los precios del kit de ventas.</span>
                <button type="submit" className="btn-gold" style={{ fontSize: 13, padding: "8px 16px" }}>Crear el negocio de JOTA</button>
              </form>
            ) : (
              <span style={{ color: "var(--dim)" }}>
                Paso 2: el negocio <code>{d.slugJota}</code> existe pero no está activo. Revisalo y activalo en{" "}
                <Link href="/ceo/agent/businesses" style={{ color: "var(--gold)" }}>/ceo/agent/businesses</Link>, y poné{" "}
                <code>PROSPECCION_TENANT={d.slugJota}</code> en Vercel.
              </span>
            )}
          </div>
        )}

        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", marginTop: 20 }}>
          {cifras.map(([n, t]) => (
            <div key={t} style={{ background: "var(--panel-soft)", border: "1px solid var(--line)", borderRadius: 14, padding: "12px 14px" }}>
              <div className="font-display" style={{ fontSize: 20 }}>{n}</div>
              <div style={{ color: "var(--dim)", fontSize: 12, marginTop: 2 }}>{t}</div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 20 }}>
          <form action={correrProspeccion}>
            <button type="submit" className="btn-ghost" style={{ fontSize: 13, padding: "10px 18px" }} disabled={!d.activo}>
              Correr una pasada ahora
            </button>
          </form>
          {d.borradores.length > 1 && (
            <form action={aprobarTodos}>
              <button type="submit" className="btn-gold" style={{ fontSize: 13, padding: "10px 18px" }}>
                Aprobar los {d.borradores.length} borradores
              </button>
            </form>
          )}
        </div>
      </div>

      {d.borradores.map((b) => (
        <form
          key={b.id}
          action={aprobarBorrador}
          className="rounded-3xl p-6"
          style={{ background: "var(--panel)", border: "1px solid var(--line)", marginTop: 14, display: "grid", gap: 10 }}
        >
          <input type="hidden" name="id" value={b.id} />
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", fontSize: 13 }}>
            <span><strong>{b.empresa}</strong> <span style={{ color: "var(--dim)" }}>· {b.rubro}</span></span>
            <span className="mono" style={{ color: "var(--dim)", fontSize: 12 }}>{b.email}</span>
          </div>
          <label htmlFor={`asunto-${b.id}`} className="mono" style={{ fontSize: 11, color: "var(--dim)" }}>Asunto</label>
          <input id={`asunto-${b.id}`} name="asunto" defaultValue={b.asunto} maxLength={80} required style={campo} />
          <label htmlFor={`cuerpo-${b.id}`} className="mono" style={{ fontSize: 11, color: "var(--dim)" }}>Texto</label>
          <textarea id={`cuerpo-${b.id}`} name="cuerpo" defaultValue={b.cuerpo} rows={8} required style={{ ...campo, lineHeight: 1.6, resize: "vertical" }} />
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button type="submit" className="btn-gold" style={{ fontSize: 13, padding: "10px 18px" }}>Aprobar y enviar</button>
            <button type="submit" formAction={descartarBorrador} className="btn-ghost" style={{ fontSize: 13, padding: "10px 18px" }}>
              No escribirle
            </button>
          </div>
        </form>
      ))}
    </section>
  );
}
