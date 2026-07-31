import { redirect } from "next/navigation";
import { haySesion, cerrarSesion } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PanelBusqueda } from "@/components/PanelBusqueda";

export const dynamic = "force-dynamic";

const fecha = (d: Date) =>
  new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" }).format(d);

const diasAtras = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);

export default async function PanelPage() {
  if (!(await haySesion())) redirect("/login");

  const LIMITE_LEADS = 500;
  const [leads, totalLeads, totalDiag, leadsSemana, ultimos] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take: LIMITE_LEADS,
      select: {
        id: true, name: true, email: true, empresa: true, password: true, createdAt: true,
        _count: { select: { diagnosticos: true } },
      },
    }),
    prisma.user.count(),
    prisma.diagnostico.count(),
    prisma.user.count({ where: { createdAt: { gte: diasAtras(7) } } }),
    prisma.diagnostico.findMany({
      orderBy: { createdAt: "desc" },
      take: 25,
      select: { id: true, consulta: true, createdAt: true, idioma: true, user: { select: { name: true, empresa: true, email: true } } },
    }),
  ]);
  const truncado = totalLeads > leads.length;

  const stats = [
    { n: totalLeads, label: "Leads capturados" },
    { n: leadsSemana, label: "Nuevos esta semana" },
    { n: totalDiag, label: "Diagnósticos pedidos" },
  ];

  return (
    <main style={{ minHeight: "100vh", padding: "40px 20px", background: "radial-gradient(700px 320px at 50% 0%, rgba(227,179,65,0.08), transparent)" }}>
      <div style={{ maxWidth: 1120, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16, marginBottom: 40 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span className="badge" aria-hidden>J</span>
            <span style={{ fontSize: 16, fontWeight: 600 }}>Panel de JOTA agency</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <a href="/api/export" className="btn-ghost">Descargar Excel</a>
            <form action={async () => { "use server"; await cerrarSesion(); redirect("/login"); }}>
              <button type="submit" className="mono" style={{ background: "none", border: "none", color: "var(--dim)", fontSize: 12 }}>Salir</button>
            </form>
          </div>
        </div>

        <div className="stats" style={{ marginBottom: 48 }}>
          {stats.map((s) => (
            <div className="stat" key={s.label}>
              <div className="n grad-text">{s.n}</div>
              <p>{s.label}</p>
            </div>
          ))}
        </div>

        {leads.length === 0 ? (
          <div style={{ borderRadius: 24, padding: 40, textAlign: "center", background: "var(--panel)", border: "1px solid var(--line)" }}>
            <p style={{ fontSize: 19 }}>Todavía no entró ningún lead</p>
            <p style={{ color: "var(--dim)", fontSize: 14, marginTop: 10, lineHeight: 1.7 }}>
              Cuando alguien cree su cuenta en jota-agency para usar el diagnóstico, va a aparecer acá.
            </p>
          </div>
        ) : (
          <>
            <div className="eyebrow" style={{ marginBottom: 20 }}>
              <span className="l" /><span className="t">Contactos</span>
            </div>
            {truncado && (
              <p role="status" style={{ marginBottom: 16, fontSize: 13, color: "var(--gold)" }}>
                Mostrando los últimos {LIMITE_LEADS} de {totalLeads} leads totales. Descargá el Excel para ver la lista completa.
              </p>
            )}
            <PanelBusqueda
              leads={leads.map((l) => ({
                id: l.id,
                nombre: l.name || "—",
                empresa: l.empresa || "—",
                email: l.email,
                origen: l.password ? "Email" : "Google",
                fecha: fecha(l.createdAt),
                diagnosticos: l._count.diagnosticos,
              }))}
            />

            {ultimos.length > 0 && (
              <>
                <div className="eyebrow" style={{ margin: "56px 0 20px" }}>
                  <span className="l" /><span className="t">Qué le consultaron a J</span>
                </div>
                <div style={{ display: "grid", gap: 12 }}>
                  {ultimos.map((d) => (
                    <div key={d.id} style={{ borderRadius: 16, padding: 20, background: "var(--panel)", border: "1px solid var(--line)" }}>
                      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 14, fontWeight: 500 }}>
                          {d.user.name || d.user.email}
                          {d.user.empresa ? <span style={{ color: "var(--gold)" }}> · {d.user.empresa}</span> : null}
                        </span>
                        <span className="mono" style={{ fontSize: 11, color: "var(--dim)" }}>{fecha(d.createdAt)} · {d.idioma.toUpperCase()}</span>
                      </div>
                      <p style={{ marginTop: 10, fontSize: 14, color: "var(--dim)", lineHeight: 1.7 }}>{d.consulta}</p>
                      <a href={`mailto:${d.user.email}?subject=${encodeURIComponent("Tu diagnóstico con JOTA agency")}`}
                        style={{ display: "inline-block", marginTop: 12, fontSize: 13, color: "var(--gold)", textDecoration: "underline" }}>
                        Responderle →
                      </a>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </main>
  );
}
