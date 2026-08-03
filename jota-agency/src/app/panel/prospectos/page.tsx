import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { esAdmin } from "@/lib/admin";
import { PROSPECTOS_MAUI } from "@/lib/prospectos-maui";
import { ProspectosTabla, type ProspectoUI } from "@/components/ProspectosTabla";
import { agregarProspecto, importarMaui } from "./acciones";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Prospectos — JOTA agency",
  robots: { index: false, follow: false },
  alternates: { canonical: "/panel/prospectos" },
};

/** YYYY-MM-DD en la zona horaria de Argentina, que es donde se trabaja. */
const aISO = (d: Date) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(d);

const campo = {
  background: "var(--panel-soft)",
  border: "1px solid var(--line)",
  color: "var(--text)",
  borderRadius: 10,
  padding: "10px 12px",
  fontSize: 13,
  width: "100%",
} as const;

export default async function ProspectosPage() {
  const session = await auth();
  if (!session?.user) redirect("/acceder?next=/panel/prospectos");
  if (!(await esAdmin(session.user.email))) redirect("/panel");

  const prospectos = await prisma.prospecto.findMany({
    orderBy: [{ proximoContacto: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
    take: 1000,
  });

  const hoy = aISO(new Date());
  const filas: ProspectoUI[] = prospectos.map((p) => ({
    id: p.id,
    empresa: p.empresa,
    rubro: p.rubro,
    ciudad: p.ciudad ?? "",
    web: p.web ?? "",
    telefono: p.telefono ?? "",
    email: p.email ?? "",
    estado: p.estado,
    notas: p.notas ?? "",
    proximo: p.proximoContacto ? aISO(p.proximoContacto) : "",
  }));

  const sinContactar = filas.filter((p) => p.estado === "nuevo").length;
  const paraHoy = filas.filter((p) => p.proximo && p.proximo <= hoy).length;
  const enJuego = filas.filter((p) => p.estado === "reunion").length;
  // Cuántas de la lista de Maui todavía no están cargadas, comparando por
  // nombre igual que hace importarMaui().
  const yaCargadas = new Set(filas.map((f) => f.empresa.trim().toLowerCase()));
  const faltanDeMaui = PROSPECTOS_MAUI.filter(
    (p) => !yaCargadas.has(p.empresa.trim().toLowerCase()),
  ).length;

  return (
    <main className="min-h-screen px-5 py-10" style={{ background: "radial-gradient(700px 320px at 50% 0%, rgba(227,179,65,0.08), transparent)" }}>
      <div style={{ maxWidth: 1240, margin: "0 auto" }}>
        <div className="flex items-center justify-between flex-wrap gap-4 mb-10">
          <Link href="/panel" className="flex items-center gap-2.5">
            <span className="h-9 w-9 rounded-xl flex items-center justify-center gold-grad font-display font-bold" style={{ color: "var(--gold-dark)" }}>J</span>
            <span className="font-display text-base">Prospectos</span>
          </Link>
          <Link href="/panel" className="btn-ghost" style={{ padding: "10px 20px", fontSize: 13 }}>
            ← Leads de la web
          </Link>
        </div>

        {/* Lo primero que tenés que ver es qué hacer hoy, no una tabla plana. */}
        <div className="stats" style={{ marginBottom: 40 }}>
          <div className="stat">
            <div className="n grad-text">{sinContactar}</div>
            <p>Sin contactar todavía</p>
          </div>
          <div className="stat">
            <div className="n grad-text">{paraHoy}</div>
            <p>Para seguir hoy</p>
          </div>
          <div className="stat">
            <div className="n grad-text">{enJuego}</div>
            <p>Con reunión agendada</p>
          </div>
        </div>

        {filas.length === 0 ? (
          <div className="rounded-3xl p-10 text-center" style={{ background: "var(--panel)", border: "1px solid var(--line)" }}>
            <p className="font-display" style={{ fontSize: 19 }}>Todavía no cargaste ningún prospecto</p>
            <p style={{ color: "var(--dim)", fontSize: 14, marginTop: 10, lineHeight: 1.7, maxWidth: 520, margin: "10px auto 0" }}>
              Podés arrancar con {PROSPECTOS_MAUI.length} empresas reales de Maui —
              contadores, inmobiliarias, administradoras de propiedades y clínicas— que
              ya están investigadas y listas para trabajar.
            </p>
            <form action={importarMaui} style={{ marginTop: 24 }}>
              <button type="submit" className="btn-gold">
                Cargar las {PROSPECTOS_MAUI.length} empresas de Maui →
              </button>
            </form>
          </div>
        ) : (
          <>
            {faltanDeMaui > 0 && (
              <form action={importarMaui} style={{ marginBottom: 20 }}>
                <button type="submit" className="btn-ghost" style={{ fontSize: 13, padding: "10px 18px" }}>
                  Cargar las empresas de Maui que falten ({PROSPECTOS_MAUI.length} en la lista)
                </button>
              </form>
            )}
            <ProspectosTabla prospectos={filas} hoy={hoy} />
          </>
        )}

        {/* ---------- alta manual ---------- */}
        <div className="eyebrow" style={{ margin: "56px 0 20px" }}>
          <span className="l" /><span className="t">Sumar una empresa</span>
        </div>
        <form
          action={agregarProspecto}
          className="rounded-3xl p-6"
          style={{ background: "var(--panel)", border: "1px solid var(--line)", display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))" }}
        >
          <div>
            <label htmlFor="p-empresa" className="mono" style={{ fontSize: 11, color: "var(--dim)" }}>Empresa *</label>
            <input id="p-empresa" name="empresa" required style={campo} placeholder="Nombre de la empresa" />
          </div>
          <div>
            <label htmlFor="p-rubro" className="mono" style={{ fontSize: 11, color: "var(--dim)" }}>Rubro</label>
            <input id="p-rubro" name="rubro" style={campo} placeholder="Inmobiliaria, clínica…" />
          </div>
          <div>
            <label htmlFor="p-ciudad" className="mono" style={{ fontSize: 11, color: "var(--dim)" }}>Ciudad</label>
            <input id="p-ciudad" name="ciudad" style={campo} placeholder="Kihei, Lahaina…" />
          </div>
          <div>
            <label htmlFor="p-web" className="mono" style={{ fontSize: 11, color: "var(--dim)" }}>Sitio web</label>
            <input id="p-web" name="web" type="url" style={campo} placeholder="https://…" />
          </div>
          <div>
            <label htmlFor="p-contacto" className="mono" style={{ fontSize: 11, color: "var(--dim)" }}>Persona de contacto</label>
            <input id="p-contacto" name="contacto" style={campo} placeholder="Nombre y apellido" />
          </div>
          <div>
            <label htmlFor="p-email" className="mono" style={{ fontSize: 11, color: "var(--dim)" }}>Email</label>
            <input id="p-email" name="email" type="email" style={campo} placeholder="nombre@empresa.com" />
          </div>
          <div>
            <label htmlFor="p-telefono" className="mono" style={{ fontSize: 11, color: "var(--dim)" }}>Teléfono</label>
            <input id="p-telefono" name="telefono" style={campo} placeholder="+1 808…" />
          </div>
          <div style={{ display: "flex", alignItems: "flex-end" }}>
            <button type="submit" className="btn-gold" style={{ width: "100%" }}>Agregar</button>
          </div>
        </form>
      </div>
    </main>
  );
}
