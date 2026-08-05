import { prisma } from "@/lib/prisma";
import { fechaHora } from "@/lib/zona";
import { revisar } from "@/lib/agente/salud";
import { Cabecera, SinNegocios, resolverTenant, type Params } from "../comun";
import { accionDespachar, accionRecuperar, accionSuprimir } from "../acciones";

export const dynamic = "force-dynamic";
export const metadata = { title: "Workflow Health — JOTA CEO", robots: { index: false, follow: false } };

export default async function Pagina({ searchParams }: { searchParams: Promise<Params> }) {
  const sp = await searchParams;
  const { t, todos } = await resolverTenant(sp);
  if (!t) return <div className="ceo-anim"><SinNegocios /></div>;

  const [salud, outbox, dlq, auditoria, supresiones, sinCerrar] = await Promise.all([
    revisar(t.id),
    prisma.emailOutbox.findMany({
      where: { tenantId: t.id },
      orderBy: { createdAt: "desc" },
      take: 25,
      select: { id: true, para: true, asunto: true, plantilla: true, estado: true, intentos: true, ultimoError: true, createdAt: true },
    }),
    prisma.workflowEvent.findMany({
      where: { tenantId: t.id, tipo: { in: ["dlq", "reintento"] } },
      orderBy: { createdAt: "desc" },
      take: 25,
    }),
    prisma.auditLog.findMany({
      where: { tenantId: t.id },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    prisma.suppression.findMany({ where: { tenantId: t.id }, orderBy: { createdAt: "desc" }, take: 25 }),
    prisma.message.count({ where: { tenantId: t.id, direccion: "entrante", estadoFinal: null } }),
  ]);

  return (
    <div className="ceo-anim">
      <Cabecera
        titulo="Salud y recuperación"
        descripcion="Qué funciona, qué se rompió y qué consulta quedó sin cerrar."
        tenant={t}
        todos={todos}
        activo="/ceo/agent/health"
        extra={
          <span className={`ceo-chip ${salud.estado === "ok" ? "ceo-chip-green" : salud.estado === "roto" ? "ceo-chip-red" : "ceo-chip-gold"}`}>
            {salud.estado}
          </span>
        }
      />

      <div className="ceo-card" style={{ marginBottom: 16 }}>
        <div className="ceo-label" style={{ marginBottom: 10 }}>Chequeos</div>
        <table className="ceo-tabla">
          <thead><tr><th>Qué</th><th>Estado</th><th>Detalle</th></tr></thead>
          <tbody>
            {salud.chequeos.map((c) => (
              <tr key={c.clave}>
                <td>{c.titulo}</td>
                <td>
                  <span className={`ceo-chip ${c.estado === "ok" ? "ceo-chip-green" : c.estado === "roto" ? "ceo-chip-red" : "ceo-chip-gold"}`}>
                    {c.estado}
                  </span>
                </td>
                <td>
                  {c.detalle}
                  {c.consecuencia && (
                    <div style={{ fontSize: 11.5, color: "var(--c-dim)" }}>{c.consecuencia}</div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="ceo-card" style={{ marginBottom: 16 }}>
        <div className="ceo-label" style={{ marginBottom: 8 }}>Correr a mano</div>
        <p className="ceo-sub" style={{ margin: "0 0 10px", fontSize: 12.5 }}>
          Lo mismo que hace el cron cada 15 minutos. Hay {sinCerrar} consulta{sinCerrar === 1 ? "" : "s"} entrante
          {sinCerrar === 1 ? "" : "s"} sin estado final.
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <form action={accionDespachar}>
            <input type="hidden" name="tenantId" value={t.id} />
            <button className="ceo-btn" type="submit">Despachar bandeja de salida</button>
          </form>
          <form action={accionRecuperar}>
            <input type="hidden" name="tenantId" value={t.id} />
            <button className="ceo-btn" type="submit">Recuperar consultas sin cerrar</button>
          </form>
        </div>
      </div>

      <div className="ceo-card ceo-card-pad-0" style={{ marginBottom: 16 }}>
        <div style={{ padding: "14px 16px 0" }}>
          <div className="ceo-label">Bandeja de salida</div>
        </div>
        <div className="ceo-scroll-x">
          {outbox.length === 0 ? (
            <p className="ceo-vacio" style={{ padding: 16 }}>Todavía no se encoló ningún email.</p>
          ) : (
            <table className="ceo-tabla">
              <thead><tr><th>Para</th><th>Asunto</th><th>Plantilla</th><th>Estado</th><th>Cuándo</th></tr></thead>
              <tbody>
                {outbox.map((e) => (
                  <tr key={e.id}>
                    <td>{e.para}</td>
                    <td>{e.asunto}</td>
                    <td>{e.plantilla}</td>
                    <td>
                      <span className={`ceo-chip ${e.estado === "enviado" ? "ceo-chip-green" : e.estado === "fallido" ? "ceo-chip-red" : "ceo-chip-gris"}`}>
                        {e.estado}
                      </span>
                      {e.ultimoError && <div style={{ fontSize: 11, color: "var(--c-dim)" }}>{e.ultimoError}</div>}
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>{fechaHora(e.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
        <div className="ceo-card">
          <div className="ceo-label" style={{ marginBottom: 10 }}>Errores y reintentos (DLQ)</div>
          {dlq.length === 0 ? (
            <p className="ceo-vacio">Nada en la cola de errores.</p>
          ) : (
            <table className="ceo-tabla">
              <thead><tr><th>Workflow</th><th>Tipo</th><th>Error</th><th>Cuándo</th></tr></thead>
              <tbody>
                {dlq.map((e) => (
                  <tr key={e.id}>
                    <td>{e.workflow}</td>
                    <td>
                      <span className={`ceo-chip ${e.tipo === "dlq" ? "ceo-chip-red" : "ceo-chip-gold"}`}>{e.tipo}</span>
                    </td>
                    <td style={{ fontSize: 12 }}>{e.mensajeError ?? "—"}</td>
                    <td style={{ whiteSpace: "nowrap" }}>{fechaHora(e.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="ceo-card">
          <div className="ceo-label" style={{ marginBottom: 6 }}>Supresiones</div>
          <p className="ceo-sub" style={{ margin: "0 0 10px", fontSize: 12 }}>
            Bajas y rebotes. Se consulta antes de cada envío, siempre.
          </p>
          <form action={accionSuprimir} style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <input type="hidden" name="tenantId" value={t.id} />
            <input name="email" type="email" required className="ceo-input" placeholder="email@ejemplo.com" aria-label="Email a suprimir" style={{ flex: 1 }} />
            <button className="ceo-btn" type="submit">Suprimir</button>
          </form>
          {supresiones.length === 0 ? (
            <p className="ceo-vacio">Ninguna.</p>
          ) : (
            <table className="ceo-tabla">
              <thead><tr><th>Email</th><th>Motivo</th><th>Cuándo</th></tr></thead>
              <tbody>
                {supresiones.map((s) => (
                  <tr key={s.id}>
                    <td>{s.email}</td>
                    <td>{s.motivo}</td>
                    <td style={{ whiteSpace: "nowrap" }}>{fechaHora(s.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="ceo-card" style={{ marginTop: 16 }}>
        <div className="ceo-label" style={{ marginBottom: 6 }}>Auditoría</div>
        <p className="ceo-sub" style={{ margin: "0 0 10px", fontSize: 12 }}>
          Quién hizo qué. La IA también figura como actor: si mandó un email o creó una cita,
          queda escrito que lo hizo ella.
        </p>
        {auditoria.length === 0 ? (
          <p className="ceo-vacio">Sin registros todavía.</p>
        ) : (
          <div className="ceo-scroll-x">
            <table className="ceo-tabla">
              <thead><tr><th>Actor</th><th>Acción</th><th>Entidad</th><th>Cuándo</th></tr></thead>
              <tbody>
                {auditoria.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <span className={`ceo-chip ${a.actorTipo === "ia" ? "ceo-chip-gold" : "ceo-chip-gris"}`}>{a.actorTipo}</span>
                      {a.actorId && <div style={{ fontSize: 11, color: "var(--c-dim)" }}>{a.actorId}</div>}
                    </td>
                    <td>{a.accion}</td>
                    <td style={{ fontSize: 12 }}>{a.entidad}</td>
                    <td style={{ whiteSpace: "nowrap" }}>{fechaHora(a.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
