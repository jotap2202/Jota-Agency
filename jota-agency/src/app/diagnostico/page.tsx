import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { DiagnosticoClient } from "@/components/DiagnosticoClient";

export default async function DiagnosticoPage() {
  const session = await auth();
  if (!session?.user) redirect("/acceder?next=/diagnostico");

  return (
    <main className="min-h-screen px-5 py-16" style={{ background: "radial-gradient(600px 300px at 50% 0%, rgba(227,179,65,0.1), transparent)" }}>
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="h-9 w-9 rounded-xl flex items-center justify-center gold-grad font-display font-bold" style={{ color: "var(--gold-dark)" }}>J</span>
            <span className="font-display text-base">JOTA agency</span>
          </Link>
          <form action={async () => { "use server"; await signOut({ redirectTo: "/" }); }}>
            <button type="submit" className="text-xs font-mono" style={{ color: "var(--dim)" }}>Salir</button>
          </form>
        </div>

        <div className="text-center mb-8">
          <div className="flex items-center gap-3 justify-center">
            <span className="h-px w-8" style={{ background: "var(--gold)" }} />
            <span className="font-mono text-[11px] uppercase" style={{ color: "var(--gold)", letterSpacing: "0.22em" }}>Diagnóstico en vivo</span>
          </div>
          <h1 className="font-display mt-4" style={{ fontSize: "clamp(30px,5vw,44px)", letterSpacing: "-0.02em" }}>Contale a J sobre tu negocio</h1>
          <p className="mt-3 text-sm max-w-lg mx-auto" style={{ color: "var(--dim)", lineHeight: 1.7 }}>
            J es nuestro estratega con IA. Describí tu empresa y te devuelve un mini plan al instante.
          </p>
        </div>

        <DiagnosticoClient email={session.user.email} />
      </div>
    </main>
  );
}
