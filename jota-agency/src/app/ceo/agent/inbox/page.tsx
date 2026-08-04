import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { fechaHora } from "@/lib/zona";
import { Cabecera, SinNegocios, resolverTenant, enlace, type Params } from "../comun";

export const dynamic = "force-dynamic";
export const metadata = { title: "Live Inbox — JOTA CEO", robots: { index: false, follow: false } };

const FILTROS = [
  { clave: "todas", nombre: "Todas" },
  { clave: "abierta", nombre: "Abiertas" },
  { clave: "esperando_humano", nombre: "Esperan al equipo" },
  { clave: "resuelta", nombre: "Resueltas" },
  { clave: "descartada", nombre: "Spam" },
] as const;

export default async function Pagina({ searchParams }: { searchParams: Promise<Params> }) {
  const sp = await searchParams;
  const { t, todos } = await resolverTenant(sp);
  if (!t) return <div className="ceo-anim"><SinNegocios /></div>;

  const filtro = typeof sp.f === "string" ? sp.f : "todas";

  const [conversaciones, aprobaciones] = await Promise.all([
    prisma.conversation.findMany({
      where: { tenantId: t.id, ...(filtro !== "todas" ? { estado: filtro } : {}) },
      orderBy: { ultimoMensajeAt: "desc" },
      take: 100,
      include: {
        contacto: { select: { nombre: true, apellido: true, email: true } },
        leads: { select: { score: true, estado: true }, orderBy: { createdAt: "desc" }, take: 1 },
        asignado: { select: { nombre: true } },
        _count: { select: { mensajes: true } },
      },
    }),
    prisma.approvalRequest.findMany({
      where: { tenantId: t.id, estado: "pendiente" },
      select: { conversationId: true },
    }),
  ]);

  const conAprobacion = new Set(aprobaciones.map((a) => a.conversationId));

  return (
    <div className="ceo-anim">
      <Cabecera
        titulo="Live Inbox"
        descripcion="Todas las conversaciones, con lo que la IA hizo en cada una."
        tenant={t}
        todos={todos}
        activo="/ceo/agent/inbox"
      />

      <div className="ceo-scroll-x" style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", gap: 6 }}>
          {FILTROS.map((f) => (
            <Link
              key={f.clave}
              href={`/ceo/agent/inbox?n=${t.slug}&f=${f.clave}`}
              className={`ceo-chip ${filtro === f.clave ? "ceo-chip-gold" : "ceo-chip-gris"}`}
              style={{ textDecoration: "none", whiteSpace: "nowrap" }}
            >
              {f.nombre}
            </Link>
          ))}
        </div>
      </div>

      {conversaciones.length === 0 ? (
        <div className="ceo-card">
          <p className="ceo-vacio">
            No hay conversaciones{filtro !== "todas" ? " con ese filtro" : ""}. Probá el agente desde{" "}
            <Link href={enlace("/ceo/agent/settings", t.slug)}>Settings → Probar el agente</Link>.
          </p>
        </div>
      ) : (
        <div className="ceo-card ceo-card-pad-0">
          <div className="ceo-scroll-x">
            <table className="ceo-tabla">
              <thead>
                <tr>
                  <th>Contacto</th>
                  <th>Canal</th>
                  <th>Intención</th>
                  <th>Score</th>
                  <th>IA</th>
                  <th>Estado</th>
                  <th>Último mensaje</th>
                </tr>
              </thead>
              <tbody>
                {conversaciones.map((c) => {
                  const nombre = [c.contacto.nombre, c.contacto.apellido].filter(Boolean).join(" ");
                  const score = c.leads[0]?.score;
                  return (
                    <tr key={c.id}>
                      <td>
                        <Link href={enlace(`/ceo/agent/inbox/${c.id}`, t.slug)} style={{ color: "var(--c-text)" }}>
                          {nombre || c.contacto.email || "Sin identificar"}
                        </Link>
                        {conAprobacion.has(c.id) && (
                          <span className="ceo-chip ceo-chip-gold" style={{ marginLeft: 6 }}>aprobar</span>
                        )}
                        <div style={{ fontSize: 11.5, color: "var(--c-dim)" }}>
                          {c._count.mensajes} mensaje{c._count.mensajes === 1 ? "" : "s"}
                          {c.asignado ? ` · ${c.asignado.nombre}` : ""}
                        </div>
                      </td>
                      <td>{c.canal}</td>
                      <td>{c.intencion ?? "—"}</td>
                      <td>
                        {score === undefined ? (
                          "—"
                        ) : (
                          <span className={`ceo-chip ${score >= 80 ? "ceo-chip-green" : score >= 60 ? "ceo-chip-gold" : "ceo-chip-gris"}`}>
                            {score}
                          </span>
                        )}
                      </td>
                      <td>{c.iaActiva ? "activa" : "pausada"}</td>
                      <td>
                        <span className={`ceo-chip ${c.estado === "esperando_humano" ? "ceo-chip-gold" : c.estado === "resuelta" ? "ceo-chip-green" : "ceo-chip-gris"}`}>
                          {c.estado.replace("_", " ")}
                        </span>
                      </td>
                      <td style={{ whiteSpace: "nowrap" }}>{fechaHora(c.ultimoMensajeAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
