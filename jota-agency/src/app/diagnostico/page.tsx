import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { DiagnosticoClient } from "@/components/DiagnosticoClient";
import { CompletarEmpresa } from "@/components/CompletarEmpresa";
import { faltaEmpresa } from "@/lib/perfil";
import { idiomaActual } from "@/lib/idioma-servidor";
import { T } from "@/lib/contenido";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Diagnosis — JOTA agency",
  // Contenido gateado: sin sesión siempre redirige a /acceder, así que no
  // hay nada propio que indexar acá. Sin esto, heredaba el canonical "/" de
  // la raíz, diciéndole a Google que esta URL "es" la home.
  robots: { index: false, follow: false },
  alternates: { canonical: "/diagnostico" },
};

export default async function DiagnosticoPage() {
  const session = await auth();
  if (!session?.user) redirect("/acceder?next=/diagnostico");
  const sinEmpresa = await faltaEmpresa(session.user.email);
  const lang = await idiomaActual();
  const t = T[lang];
  const d = t.diag;

  return (
    <main className="min-h-screen px-5 py-16" style={{ background: "radial-gradient(600px 300px at 50% 0%, rgba(227,179,65,0.1), transparent)" }}>
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="h-9 w-9 rounded-xl flex items-center justify-center gold-grad font-display font-bold" style={{ color: "var(--gold-dark)" }}>J</span>
            <span className="font-display text-base">JOTA agency</span>
          </Link>
          <form action={async () => { "use server"; await signOut({ redirectTo: "/" }); }}>
            <button type="submit" className="text-xs font-mono" style={{ color: "var(--dim)" }}>{t.salir}</button>
          </form>
        </div>

        <div className="text-center mb-8">
          <div className="flex items-center gap-3 justify-center">
            <span className="h-px w-8" style={{ background: "var(--gold)" }} />
            <span className="font-mono text-[11px] uppercase" style={{ color: "var(--gold)", letterSpacing: "0.22em" }}>{d.eyebrow}</span>
          </div>
          <h1 className="font-display mt-4" style={{ fontSize: "clamp(30px,5vw,44px)", letterSpacing: "-0.02em" }}>{d.titulo}</h1>
          <p className="mt-3 text-sm max-w-lg mx-auto" style={{ color: "var(--dim)", lineHeight: 1.7 }}>{d.sub}</p>
        </div>

        {sinEmpresa ? (
          <div className="rounded-3xl p-6" style={{ background: "var(--panel)", border: "1px solid var(--line)" }}>
            <CompletarEmpresa lang={lang} />
          </div>
        ) : (
          <DiagnosticoClient email={session.user.email} lang={lang} />
        )}
      </div>
    </main>
  );
}
