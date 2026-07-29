import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { prisma } from "@/lib/prisma";
import { esAdmin } from "@/lib/admin";
import { PanelBusqueda } from "@/components/PanelBusqueda";

export const dynamic = "force-dynamic";
export const metadata = { title: "Panel de leads — JOTA agency", robots: { index: false, follow: false } };

const fecha = (d: Date) =>
  new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" }).format(d);

const diasAtras = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);

export default async function PanelPage() {
  const session = await auth();
  if (!session?.user) redirect("/acceder?next=/panel");
  if (!esAdmin(session.user.email)) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center px-5 text-center gap-4">
        <span className="h-12 w-12 rounded-2xl flex items-center justify-center gold-grad font-display font-bold text-xl" style={{ color: "var(--gold-dark)" }}>J</span>
        <h1 className="font-display" style={{ fontSize: 24 }}>Esta sección es privada</h1>
        <p style={{ color: "var(--dim)", fontSize: 14, maxWidth: 380, lineHeight: 1.7 }}>
          El panel de leads es solo para el equipo de JOTA agency. Estás entrando como{" "}
          <span style={{ color: "var(--gold)" }}>{session.user.email}</span>.
        </p>
        <Link href="/" className="btn-ghost" style={{ marginTop: 8 }}>Volver al inicio</Link>
      </main>
    );
  }

  const [leads, totalDiag, leadsSemana, ultimos] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 500,
      select: {
        id: true, name: true, email: true, empresa: true, password: true, createdAt: true,
        _count: { select: { diagnosticos: true } },
      },
    }),
    prisma.diagnostico.count(),
    prisma.user.count({ where: { createdAt: { gte: diasAtras(7) } } }),
    prisma.diagnostico.findMany({
      orderBy: { createdAt: "desc" },
      take: 25,
      select: { id: true, consulta: true, createdAt: true, idioma: true, user: { select: { name: true, empresa: true, email: true } } },
    }),
  ]);

  const stats = [
    { n: leads.length, label: "Leads capturados" },
    { n: leadsSemana, label: "Nuevos esta semana" },
    { n: totalDiag, label: "Diagnósticos pedidos" },
  ];

  return (
    <main className="min-h-screen px-5 py-10" style={{ background: "radial-gradient(700px 320px at 50% 0%, rgba(227,179,65,0.08), transparent)" }}>
      <div style={{ maxWidth: 1120, margin: "0 auto" }}>
        {/* cabecera */}
        <div className="flex items-center justify-between flex-wrap gap-4 mb-10">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="h-9 w-9 rounded-xl flex items-center justify-center gold-grad font-display font-bold" style={{ color: "var(--gold-dark)" }}>J</span>
            <span className="font-display text-base">Panel de leads</span>
          </Link>
          <div className="flex items-center gap-4">
            <a href="/api/panel/export" className="btn-ghost" style={{ padding: "10px 20px", fontSize: 13 }}>Descargar Excel</a>
            <form action={async () => { "use server"; await signOut({ redirectTo: "/" }); }}>
              <button type="submit" className="text-xs font-mono" style={{ color: "var(--dim)" }}>Salir</button>
            </form>
          </div>
        </div>

        {/* números */}
        <div className="stats" style={{ marginBottom: 48 }}>
          {stats.map((s) => (
            <div className="stat" key={s.label}>
              <div className="n grad-text">{s.n}</div>
              <p>{s.label}</p>
            </div>
          ))}
        </div>

        {leads.length === 0 ? (
          <div className="rounded-3xl p-10 text-center" style={{ background: "var(--panel)", border: "1px solid var(--line)" }}>
            <p className="font-display" style={{ fontSize: 19 }}>Todavía no entró ningún lead</p>
            <p style={{ color: "var(--dim)", fontSize: 14, marginTop: 10, lineHeight: 1.7 }}>
              Cuando alguien cree su cuenta para usar el diagnóstico, va a aparecer acá con su nombre, empresa y lo que le consultó a J.
            </p>
          </div>
        ) : (
          <>
            {/* tabla de leads */}
            <div className="eyebrow" style={{ marginBottom: 20 }}>
              <span className="l" /><span className="t">Contactos</span>
            </div>
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

            {/* consultas recientes */}
            {ultimos.length > 0 && (
              <>
                <div className="eyebrow" style={{ margin: "56px 0 20px" }}>
                  <span className="l" /><span className="t">Qué le consultaron a J</span>
                </div>
                <div style={{ display: "grid", gap: 12 }}>
                  {ultimos.map((d) => (
                    <div key={d.id} className="rounded-2xl p-5" style={{ background: "var(--panel)", border: "1px solid var(--line)" }}>
                      <div className="flex items-baseline justify-between gap-4 flex-wrap">
                        <span style={{ fontSize: 14, fontWeight: 500 }}>
                          {d.user.name || d.user.email}
                          {d.user.empresa ? <span style={{ color: "var(--gold)" }}> · {d.user.empresa}</span> : null}
                        </span>
                        <span className="font-mono" style={{ fontSize: 11, color: "var(--dim)" }}>{fecha(d.createdAt)} · {d.idioma.toUpperCase()}</span>
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
