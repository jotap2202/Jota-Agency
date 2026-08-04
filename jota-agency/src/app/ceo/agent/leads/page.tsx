import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { fechaHora } from "@/lib/zona";
import { Cabecera, SinNegocios, Kpi, resolverTenant, enlace, type Params } from "../comun";
import { accionEstadoLead, accionSincronizarCrm } from "../acciones";

export const dynamic = "force-dynamic";
export const metadata = { title: "Agent Leads — JOTA CEO", robots: { index: false, follow: false } };

const BANDAS = [
  { clave: "todos", nombre: "Todos" },
  { clave: "hot", nombre: "Hot (80+)" },
  { clave: "qualified", nombre: "Qualified (60-79)" },
  { clave: "nurture", nombre: "Nurture (40-59)" },
  { clave: "low", nombre: "Low (0-39)" },
] as const;

const RANGOS: Record<string, { gte?: number; lte?: number }> = {
  hot: { gte: 80 },
  qualified: { gte: 60, lte: 79 },
  nurture: { gte: 40, lte: 59 },
  low: { lte: 39 },
};

export default async function Pagina({ searchParams }: { searchParams: Promise<Params> }) {
  const sp = await searchParams;
  const { t, todos } = await resolverTenant(sp);
  if (!t) return <div className="ceo-anim"><SinNegocios /></div>;

  const banda = typeof sp.b === "string" && sp.b in RANGOS ? sp.b : "todos";

  const [leads, resumen] = await Promise.all([
    prisma.lead.findMany({
      where: { tenantId: t.id, ...(banda !== "todos" ? { score: RANGOS[banda] } : {}) },
      orderBy: [{ score: "desc" }, { createdAt: "desc" }],
      take: 200,
      include: {
        contacto: { select: { nombre: true, apellido: true, email: true, telefono: true, empresa: true } },
        conversacion: { select: { id: true, canal: true } },
        _count: { select: { citas: true, seguimientos: true } },
      },
    }),
    prisma.lead.groupBy({ by: ["estado"], where: { tenantId: t.id }, _count: true }),
  ]);

  const cuenta = (e: string) => resumen.find((r) => r.estado === e)?._count ?? 0;

  return (
    <div className="ceo-anim">
      <Cabecera
        titulo="Leads del agente"
        descripcion="Oportunidades capturadas por la IA, con el score explicado."
        tenant={t}
        todos={todos}
        activo="/ceo/agent/leads"
      />

      <div className="ceo-kpis" style={{ marginBottom: 14 }}>
        <Kpi label="Calificados" valor={String(cuenta("calificado"))} />
        <Kpi label="A nutrir" valor={String(cuenta("nutrir"))} />
        <Kpi label="Ganados" valor={String(cuenta("ganado"))} />
        <Kpi label="Descartados" valor={String(cuenta("descartado") + cuenta("baja_prioridad"))} />
      </div>

      <div className="ceo-scroll-x" style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", gap: 6 }}>
          {BANDAS.map((b) => (
            <Link
              key={b.clave}
              href={`/ceo/agent/leads?n=${t.slug}&b=${b.clave}`}
              className={`ceo-chip ${banda === b.clave ? "ceo-chip-gold" : "ceo-chip-gris"}`}
              style={{ textDecoration: "none", whiteSpace: "nowrap" }}
            >
              {b.nombre}
            </Link>
          ))}
        </div>
      </div>

      {leads.length === 0 ? (
        <div className="ceo-card"><p className="ceo-vacio">Todavía no hay leads con ese filtro.</p></div>
      ) : (
        <div className="ceo-card ceo-card-pad-0">
          <div className="ceo-scroll-x">
            <table className="ceo-tabla">
              <thead>
                <tr>
                  <th>Score</th>
                  <th>Contacto</th>
                  <th>Servicio</th>
                  <th>Plazo</th>
                  <th>Presupuesto</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                  <th>Creado</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((l) => (
                  <tr key={l.id}>
                    <td>
                      <span className={`ceo-chip ${l.score >= 80 ? "ceo-chip-green" : l.score >= 60 ? "ceo-chip-gold" : "ceo-chip-gris"}`}>
                        {l.score}
                      </span>
                      <div style={{ fontSize: 11, color: "var(--c-dim)" }}>conf. {l.confianza}</div>
                    </td>
                    <td>
                      {l.conversacion ? (
                        <Link href={enlace(`/ceo/agent/inbox/${l.conversacion.id}`, t.slug)} style={{ color: "var(--c-text)" }}>
                          {[l.contacto.nombre, l.contacto.apellido].filter(Boolean).join(" ") || l.contacto.email || "Sin nombre"}
                        </Link>
                      ) : (
                        [l.contacto.nombre, l.contacto.apellido].filter(Boolean).join(" ") || l.contacto.email || "Sin nombre"
                      )}
                      <div style={{ fontSize: 11.5, color: "var(--c-dim)" }}>
                        {l.contacto.email ?? l.contacto.telefono ?? "sin contacto"}
                        {l.conversacion ? ` · ${l.conversacion.canal}` : ""}
                      </div>
                    </td>
                    <td>{l.servicio ?? "—"}</td>
                    <td>{l.plazo ?? "—"}</td>
                    <td>{l.presupuesto ? `US$ ${(l.presupuesto / 100).toLocaleString("en-US")}` : "no lo dijo"}</td>
                    <td>
                      <form action={accionEstadoLead} style={{ display: "flex", gap: 4 }}>
                        <input type="hidden" name="tenantId" value={t.id} />
                        <input type="hidden" name="leadId" value={l.id} />
                        <select name="estado" defaultValue={l.estado} className="ceo-input" aria-label="Estado del lead" style={{ fontSize: 12, padding: "4px 6px" }}>
                          <option value="nuevo">Nuevo</option>
                          <option value="calificado">Calificado</option>
                          <option value="nutrir">Nutrir</option>
                          <option value="baja_prioridad">Baja prioridad</option>
                          <option value="ganado">Ganado</option>
                          <option value="perdido">Perdido</option>
                          <option value="descartado">Descartado</option>
                        </select>
                        <button className="ceo-btn" type="submit" style={{ fontSize: 12, padding: "4px 8px" }}>OK</button>
                      </form>
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      <div style={{ fontSize: 11.5, color: "var(--c-dim)", marginBottom: 4 }}>
                        {l._count.citas > 0 ? `${l._count.citas} reunión(es)` : "sin reunión"} ·{" "}
                        {l._count.seguimientos > 0 ? `${l._count.seguimientos} seguimiento(s)` : "sin seguimiento"}
                      </div>
                      <form action={accionSincronizarCrm}>
                        <input type="hidden" name="tenantId" value={t.id} />
                        <input type="hidden" name="leadId" value={l.id} />
                        <button className="ceo-btn" type="submit" style={{ fontSize: 12, padding: "4px 8px" }}>
                          Sincronizar CRM
                        </button>
                      </form>
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>{fechaHora(l.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
