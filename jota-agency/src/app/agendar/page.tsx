import Link from "next/link";
import { horariosLibres, tenantDeJota } from "@/lib/agente/reserva";
import { idiomaActual } from "@/lib/idioma-servidor";
import { EMAIL_CONTACTO } from "@/lib/contenido";
import { FormReserva } from "@/components/FormReserva";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Book a 15-min call — JOTA agency",
  description: "Pick a time for a free 15-minute call with JOTA agency. No commitment.",
  alternates: { canonical: "/agendar" },
};

export default async function AgendarPage() {
  const lang = await idiomaActual();
  const es = lang === "es";
  const t = await tenantDeJota();
  const horarios = t ? await horariosLibres(t) : [];

  return (
    <main className="min-h-screen px-5 py-14" style={{ background: "radial-gradient(700px 320px at 50% 0%, rgba(227,179,65,0.1), transparent)" }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        <Link href="/" className="flex items-center gap-2.5" style={{ marginBottom: 36 }}>
          <span className="h-9 w-9 rounded-xl flex items-center justify-center gold-grad font-display font-bold" style={{ color: "var(--gold-dark)" }}>J</span>
          <span className="font-display text-base">JOTA agency</span>
        </Link>

        <h1 className="font-display" style={{ fontSize: "clamp(28px,5vw,42px)", lineHeight: 1.1 }}>
          {es ? "Agendá una llamada de 15 minutos" : "Book a 15-minute call"}
        </h1>
        <p style={{ color: "var(--dim)", fontSize: 15.5, lineHeight: 1.7, marginTop: 14, maxWidth: 600 }}>
          {es
            ? "Te mostramos cuántas consultas estás perdiendo y cómo contestarlas en menos de un minuto, 24/7. Sin compromiso: si no te sirve, te lo decimos."
            : "We'll show you how many inquiries you're losing and how to answer every one in under a minute, 24/7. No commitment: if it's not a fit, we'll tell you."}
        </p>

        {horarios.length === 0 ? (
          <div className="rounded-3xl p-8" style={{ background: "var(--panel)", border: "1px solid var(--line)", marginTop: 32 }}>
            <p style={{ fontSize: 15, lineHeight: 1.7 }}>
              {es ? "La agenda online no está disponible en este momento. Escribinos y te respondemos el mismo día:" : "Online booking isn't available right now. Email us and we'll reply the same day:"}{" "}
              <a href={`mailto:${EMAIL_CONTACTO}?subject=${encodeURIComponent("15-min call")}`} style={{ color: "var(--gold)" }}>{EMAIL_CONTACTO}</a>
            </p>
          </div>
        ) : (
          <FormReserva horarios={horarios} es={es} zonaNegocio={t!.zonaHoraria} />
        )}
      </div>
    </main>
  );
}
