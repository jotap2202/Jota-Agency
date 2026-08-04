import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ultimosDias } from "@/lib/agente/metricas";
import { revisar } from "@/lib/agente/salud";
import { estaAbierto } from "@/lib/agente/tenant";
import { fechaHora } from "@/lib/zona";
import { accionCargarDemo, accionBorrarDemo } from "./acciones";
import { Cabecera, SinNegocios, Kpi, resolverTenant, enlace, num, pct, centavos, type Params } from "./comun";

export const dynamic = "force-dynamic";
export const metadata = { title: "24/7 AI Agent — JOTA CEO", robots: { index: false, follow: false } };

export default async function Pagina({ searchParams }: { searchParams: Promise<Params> }) {
  const sp = await searchParams;
  const { t, todos } = await resolverTenant(sp);

  if (!t) {
    return (
      <div className="ceo-anim">
        <div className="ceo-seccion-head" style={{ marginBottom: 18 }}>
          <div>
            <h1 className="ceo-h2" style={{ fontSize: 20 }}>24/7 AI Agent</h1>
            <p className="ceo-sub">Zero lost inquiries. Ninguna consulta desaparece en silencio.</p>
          </div>
          <form action={accionCargarDemo}>
            <button className="ceo-btn ceo-btn-gold" type="submit">Cargar negocio de demo</button>
          </form>
        </div>
        <SinNegocios />
      </div>
    );
  }

  const [m, salud, recientes, aprobaciones] = await Promise.all([
    ultimosDias(t.id, 30),
    revisar(t.id),
    prisma.conversation.findMany({
      where: { tenantId: t.id },
      orderBy: { ultimoMensajeAt: "desc" },
      take: 8,
      include: { contacto: { select: { nombre: true, email: true } }, leads: { select: { score: true }, take: 1 } },
    }),
    prisma.approvalRequest.count({ where: { tenantId: t.id, estado: "pendiente" } }),
  ]);

  const abierto = estaAbierto(t);

  return (
    <div className="ceo-anim">
      <Cabecera
        titulo="24/7 AI Agent"
        descripcion={`${t.nombreNegocio} · ${abierto ? "abierto ahora" : "cerrado ahora"} · modo ${t.modo}`}
        tenant={t}
        todos={todos}
        activo="/ceo/agent"
        extra={
          t.esDemo ? (
            <form action={accionBorrarDemo}>
              <button className="ceo-btn" type="submit">Borrar demo</button>
            </form>
          ) : (
            <form action={accionCargarDemo}>
              <button className="ceo-btn" type="submit">Cargar demo</button>
            </form>
          )
        }
      />

      {salud.estado !== "ok" && (
        <div
          className="ceo-card"
          style={{
            marginBottom: 16, borderColor: salud.estado === "roto" ? "var(--c-red)" : "var(--c-gold)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
            <div>
              <div className="ceo-label">
                {salud.estado === "roto" ? "El agente no está funcionando completo" : "Hay cosas para revisar"}
              </div>
              <ul style={{ margin: "8px 0 0", paddingLeft: 18, fontSize: 13 }}>
                {salud.chequeos
                  .filter((c) => c.estado !== "ok")
                  .map((c) => (
                    <li key={c.clave} style={{ marginBottom: 3 }}>
                      <strong>{c.titulo}:</strong> {c.detalle}
                      {c.consecuencia && <span style={{ color: "var(--c-dim)" }}> — {c.consecuencia}</span>}
                    </li>
                  ))}
              </ul>
            </div>
            <Link href={enlace("/ceo/agent/health", t.slug)} className="ceo-btn" style={{ textDecoration: "none", whiteSpace: "nowrap" }}>
              Ver salud
            </Link>
          </div>
        </div>
      )}

      <p className="ceo-label" style={{ marginBottom: 8 }}>Últimos 30 días</p>
      <div className="ceo-kpis" style={{ marginBottom: 14 }}>
        <Kpi label="Consultas recibidas" valor={String(m.consultas)} sub={`${m.fueraDeHorario} fuera de horario`} />
        <Kpi label="Respondidas" valor={pct(m.tasaRespuesta)} sub={`${m.respondidas} de ${m.consultas}`} />
        <Kpi
          label="1ª respuesta"
          valor={m.primeraRespuestaMin === null ? "—" : `${num(m.primeraRespuestaMin)} min`}
          sub={m.primeraRespuestaMin === null ? "Sin datos todavía" : "Promedio"}
        />
        <Kpi label="Resueltas por la IA" valor={String(m.resueltasPorIa)} sub={`${m.handoffs} derivadas a una persona`} />
      </div>

      <div className="ceo-kpis" style={{ marginBottom: 14 }}>
        <Kpi label="Leads capturados" valor={String(m.leads)} sub={`${m.leadsCalificados} calificados`} />
        <Kpi label="Hot leads" valor={String(m.hotLeads)} sub="score 80+" />
        <Kpi label="Reuniones agendadas" valor={String(m.reuniones)} />
        <Kpi
          label="Ingreso potencial"
          valor={m.ingresoEstimadoCentavos > 0 ? centavos(m.ingresoEstimadoCentavos) : "—"}
          sub={m.ingresoEstimadoCentavos > 0 ? "Presupuestos que dijeron los contactos" : "Nadie mencionó presupuesto"}
        />
      </div>

      <div className="ceo-kpis" style={{ marginBottom: 22 }}>
        <Kpi
          label="Costo de IA"
          valor={centavos(m.costoIaCentavos)}
          sub={`${(m.tokensEntrada + m.tokensSalida).toLocaleString("en-US")} tokens`}
        />
        <Kpi label="Costo por conversación" valor={centavos(m.costoPorConversacion)} />
        <Kpi label="Costo por lead" valor={centavos(m.costoPorLead)} />
        <Kpi
          label="Emails"
          valor={String(m.emailsEnviados)}
          sub={m.emailsSimulados > 0 ? `${m.emailsSimulados} simulados (sin proveedor)` : `${m.rebotes} rebotes · ${m.bajas} bajas`}
        />
      </div>

      {aprobaciones > 0 && (
        <div className="ceo-card" style={{ marginBottom: 18, borderColor: "var(--c-gold)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <div>
              <div className="ceo-label">Esperando aprobación</div>
              <p className="ceo-sub" style={{ margin: "4px 0 0" }}>
                {aprobaciones} respuesta{aprobaciones === 1 ? "" : "s"} lista{aprobaciones === 1 ? "" : "s"} para revisar antes de salir.
              </p>
            </div>
            <Link href={enlace("/ceo/agent/inbox", t.slug)} className="ceo-btn ceo-btn-gold" style={{ textDecoration: "none" }}>
              Revisar
            </Link>
          </div>
        </div>
      )}

      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))" }}>
        <div className="ceo-card">
          <div className="ceo-label" style={{ marginBottom: 10 }}>Rendimiento por canal</div>
          {m.porCanal.length === 0 ? (
            <p className="ceo-vacio">Todavía no entró ninguna consulta.</p>
          ) : (
            <table className="ceo-tabla">
              <thead>
                <tr><th>Canal</th><th>Consultas</th><th>Leads</th></tr>
              </thead>
              <tbody>
                {m.porCanal.map((c) => (
                  <tr key={c.canal}>
                    <td>{c.canal}</td>
                    <td>{c.consultas}</td>
                    <td>{c.leads}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="ceo-card">
          <div className="ceo-label" style={{ marginBottom: 10 }}>Conversaciones recientes</div>
          {recientes.length === 0 ? (
            <p className="ceo-vacio">Nada todavía.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {recientes.map((c) => (
                <Link
                  key={c.id}
                  href={enlace(`/ceo/agent/inbox/${c.id}`, t.slug)}
                  style={{
                    display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center",
                    padding: "8px 6px", borderRadius: 8, textDecoration: "none", color: "var(--c-text)",
                    borderBottom: "1px solid var(--c-line-soft)",
                  }}
                >
                  <span style={{ minWidth: 0 }}>
                    <span style={{ fontSize: 13.5, display: "block" }}>
                      {c.contacto.nombre ?? c.contacto.email ?? "Contacto sin identificar"}
                    </span>
                    <span style={{ fontSize: 11.5, color: "var(--c-dim)" }}>
                      {c.canal} · {c.intencion ?? "sin clasificar"} · {fechaHora(c.ultimoMensajeAt)}
                    </span>
                  </span>
                  <span className={`ceo-chip ${chip(c.estado)}`}>{c.estado.replace("_", " ")}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function chip(estado: string): string {
  if (estado === "esperando_humano") return "ceo-chip-gold";
  if (estado === "resuelta") return "ceo-chip-green";
  if (estado === "descartada") return "ceo-chip-gris";
  return "ceo-chip-gris";
}
