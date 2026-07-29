import Link from "next/link";
import { auth } from "@/auth";

const servicios = [
  { n: "01", nombre: "Prospección B2B", cap: "Reuniones calificadas", desc: "Buscamos, contactamos y calificamos potenciales clientes uno por uno. Tu equipo solo se sienta con alguien que ya quiere escucharte." },
  { n: "02", nombre: "LinkedIn del fundador", cap: "Autoridad que atrae", desc: "Convertimos el perfil del dueño en un imán de clientes: contenido y conversaciones que hacen que te escriban a vos." },
  { n: "03", nombre: "Email en frío", cap: "Puertas que se abren", desc: "Campañas hacia empresas que hoy no saben que existís, con seguimiento automático hasta conseguir la respuesta." },
  { n: "04", nombre: "Agente IA 24/7", cap: "Cero consultas perdidas", desc: "Ningún interesado se queda sin respuesta, ni a las 3 de la mañana. Atiende, califica y captura cada lead." },
  { n: "05", nombre: "Reseñas y reputación", cap: "Confianza al instante", desc: "Cuando te googlean, encuentran una empresa impecable: más reseñas, mejores respuestas, cero descuido." },
  { n: "06", nombre: "Publicidad paga", cap: "Alcance medible", desc: "Campañas donde cada peso invertido se traduce en consultas de gente que busca lo que vendés." },
];

const stats = [
  { n: "24/7", label: "Cada interesado atendido, sin importar la hora" },
  { n: "78%", label: "de los compradores le compra a quien responde primero" },
  { n: "15 min", label: "Es lo que dura la llamada que puede cambiar tu negocio" },
];

const rubros = ["Estudios contables", "Clínicas y salud", "Inmobiliarias", "Servicios profesionales", "Software / SaaS", "Agencias y estudios"];

// NOTA: testimonios de ejemplo. Reemplazá por clientes reales antes de publicar.
const testimonios = [
  { q: "En dos meses pasamos de esperar recomendaciones a tener reuniones agendadas todas las semanas.", quien: "Martín Gómez", rol: "Socio · Estudio contable" },
  { q: "El agente que responde 24/7 nos cambió el negocio. Dejamos de perder consultas de noche y los fines de semana.", quien: "Carolina Suárez", rol: "Directora · Clínica" },
  { q: "Antes nadie nos conocía. Hoy nos escriben a nosotros. La prospección nos puso en el radar correcto.", quien: "Diego Ramírez", rol: "Fundador · Software B2B" },
];

export default async function Home() {
  const session = await auth();

  return (
    <div className="min-h-screen">
      {/* NAV */}
      <nav className="sticky top-0 z-30 px-5 py-4" style={{ background: "rgba(8,22,25,0.92)", backdropFilter: "blur(12px)", borderBottom: "1px solid var(--line)" }}>
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl flex items-center justify-center gold-grad font-display font-bold" style={{ color: "var(--gold-dark)" }}>J</div>
            <span className="font-display text-base" style={{ letterSpacing: "-0.01em" }}>JOTA agency</span>
          </div>
          <div className="hidden md:flex items-center gap-7 text-sm" style={{ color: "var(--dim)" }}>
            <a href="#servicios" className="hover:text-[var(--gold)] transition-colors">Servicios</a>
            <a href="#proceso" className="hover:text-[var(--gold)] transition-colors">Método</a>
          </div>
          <div className="flex items-center gap-3">
            {session?.user ? (
              <Link href="/diagnostico" className="rounded-full px-4 py-2 text-xs font-semibold gold-grad" style={{ color: "var(--gold-dark)" }}>
                Ir al diagnóstico
              </Link>
            ) : (
              <>
                <Link href="/acceder" className="text-sm hidden sm:inline" style={{ color: "var(--dim)" }}>Entrar</Link>
                <Link href="/diagnostico" className="rounded-full px-4 py-2 text-xs font-semibold gold-grad" style={{ color: "var(--gold-dark)" }}>
                  Hablar con J
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* HERO */}
      <header className="relative px-5 overflow-hidden" style={{ minHeight: "88vh", display: "flex", alignItems: "center" }}>
        <div className="absolute inset-0" aria-hidden style={{ background: "radial-gradient(900px 500px at 70% 15%, rgba(227,179,65,0.14), transparent 60%), linear-gradient(180deg, rgba(8,22,25,0.6), #081619 90%), linear-gradient(135deg, #0d2a30, #081619)" }} />
        <div className="relative max-w-6xl mx-auto w-full py-24">
          <div className="max-w-3xl">
            <div className="flex items-center gap-3">
              <span className="h-px w-8" style={{ background: "var(--gold)" }} />
              <span className="font-mono text-[11px] uppercase" style={{ color: "var(--gold)", letterSpacing: "0.22em" }}>Agencia de generación de clientes B2B</span>
            </div>
            <h1 className="font-display mt-6" style={{ fontSize: "clamp(38px,7.5vw,76px)", lineHeight: 1.04, letterSpacing: "-0.03em" }}>
              Convertimos empresas desconocidas en <span className="gold-grad-text">empresas buscadas.</span>
            </h1>
            <p className="mt-7 max-w-lg text-base" style={{ color: "#B9CFCD", lineHeight: 1.75 }}>
              Nos dedicamos a una sola cosa: conseguirte clientes. Reuniones calificadas en tu agenda, todos los meses.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link href="/diagnostico" className="inline-flex items-center gap-2 rounded-full px-7 py-3.5 text-sm font-semibold gold-grad" style={{ color: "var(--gold-dark)", boxShadow: "0 10px 30px rgba(227,179,65,0.25)" }}>
                Diagnóstico gratis con J <span aria-hidden>→</span>
              </Link>
              <a href="#proceso" className="inline-flex items-center rounded-full px-7 py-3.5 text-sm font-medium" style={{ border: "1px solid var(--line)" }}>Ver el método</a>
            </div>
          </div>
        </div>
      </header>

      {/* STATS */}
      <section className="px-5 py-20">
        <div className="max-w-6xl mx-auto grid gap-10 sm:grid-cols-3">
          {stats.map((s) => (
            <div key={s.n} style={{ borderLeft: "1px solid var(--line)", paddingLeft: 24 }}>
              <div className="font-display gold-grad-text" style={{ fontSize: "clamp(44px,6vw,68px)", lineHeight: 1, letterSpacing: "-0.03em" }}>{s.n}</div>
              <p className="mt-4 text-sm max-w-xs" style={{ color: "var(--dim)", lineHeight: 1.65 }}>{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* RUBROS */}
      <section className="px-5 py-12" style={{ background: "var(--bg-alt)", borderTop: "1px solid var(--line)", borderBottom: "1px solid var(--line)" }}>
        <div className="max-w-6xl mx-auto flex flex-col items-center text-center gap-5">
          <span className="font-mono text-[11px] uppercase" style={{ color: "var(--gold)", letterSpacing: "0.22em" }}>Confianza</span>
          <p className="font-display" style={{ fontSize: "clamp(18px,2.6vw,24px)" }}>Sistemas de captación pensados para tu rubro</p>
          <div className="flex flex-wrap justify-center gap-2.5">
            {rubros.map((r) => (
              <span key={r} className="font-mono rounded-full px-4 py-2 text-xs" style={{ color: "var(--dim)", background: "var(--panel)", border: "1px solid var(--line)" }}>{r}</span>
            ))}
          </div>
        </div>
      </section>

      {/* SERVICIOS */}
      <section id="servicios" className="px-5 py-24">
        <div className="max-w-6xl mx-auto">
          <span className="font-mono text-[11px] uppercase" style={{ color: "var(--gold)", letterSpacing: "0.22em" }}>Servicios</span>
          <h2 className="font-display mt-5" style={{ fontSize: "clamp(30px,5vw,52px)", letterSpacing: "-0.025em" }}>Cómo conseguimos clientes</h2>
          <p className="mt-3 text-sm" style={{ color: "var(--dim)" }}>Seis piezas. Un solo objetivo: que tu agenda se llene.</p>
          <div className="mt-12">
            {servicios.map((s) => (
              <div key={s.n} className="grid gap-3 md:grid-cols-12 items-baseline py-6" style={{ borderTop: "1px solid var(--line)" }}>
                <div className="md:col-span-1 font-display" style={{ fontSize: 24, color: "transparent", WebkitTextStroke: "1px rgba(227,179,65,0.45)" }}>{s.n}</div>
                <div className="md:col-span-4">
                  <div className="font-display" style={{ fontSize: 22, letterSpacing: "-0.015em" }}>{s.nombre}</div>
                  <div className="font-mono mt-1 text-[10px] uppercase" style={{ color: "var(--gold)", letterSpacing: "0.18em" }}>{s.cap}</div>
                </div>
                <p className="md:col-span-7 text-sm" style={{ color: "var(--dim)", lineHeight: 1.7 }}>{s.desc}</p>
              </div>
            ))}
            <div style={{ borderTop: "1px solid var(--line)" }} />
          </div>
        </div>
      </section>

      {/* MÉTODO / GARANTÍA */}
      <section id="proceso" className="px-5 py-24" style={{ background: "var(--bg-alt)", borderTop: "1px solid var(--line)" }}>
        <div className="max-w-6xl mx-auto">
          <div className="text-center">
            <span className="font-mono text-[11px] uppercase" style={{ color: "var(--gold)", letterSpacing: "0.22em" }}>El método</span>
            <p className="mt-3 text-sm" style={{ color: "var(--dim)" }}>Tres pasos. Vos solo aparecés en el último.</p>
          </div>
          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {[
              { t: "Diagnóstico", d: "Contanos tu negocio (podés empezar ahora con J). Definimos juntos tu cliente ideal." },
              { t: "Sistema en marcha", d: "En la primera semana armamos prospección, mensajes y automatización. Empezamos a contactar." },
              { t: "Reuniones en tu agenda", d: "Recibís reuniones calificadas y un reporte semanal claro. Escalamos lo que funciona." },
            ].map((p, i) => (
              <div key={p.t} className="rounded-3xl p-7 relative overflow-hidden" style={{ background: "var(--panel)", border: "1px solid var(--line)" }}>
                <div className="font-display" style={{ fontSize: 88, lineHeight: 1, position: "absolute", top: -8, right: 10, color: "transparent", WebkitTextStroke: "1px rgba(227,179,65,0.25)" }}>{i + 1}</div>
                <div className="font-display relative" style={{ fontSize: 20, color: "var(--gold)" }}>{p.t}</div>
                <p className="mt-3 text-sm relative" style={{ color: "var(--dim)", lineHeight: 1.7 }}>{p.d}</p>
              </div>
            ))}
          </div>
          <div className="mt-14 rounded-3xl p-8 md:p-12 text-center" style={{ border: "1px solid var(--gold)", background: "rgba(227,179,65,0.1)" }}>
            <span className="font-mono text-[11px] uppercase" style={{ color: "var(--gold)", letterSpacing: "0.22em" }}>Nuestra garantía</span>
            <p className="font-display mt-5 mx-auto max-w-2xl" style={{ fontSize: "clamp(20px,3.4vw,30px)", lineHeight: 1.35 }}>
              &ldquo;Acordamos un mínimo de reuniones por mes. Si no llegamos, el mes siguiente trabajamos gratis.&rdquo;
            </p>
            <p className="font-mono mt-4 text-sm" style={{ color: "var(--gold)" }}>Así de seguros estamos del método.</p>
          </div>
        </div>
      </section>

      {/* TESTIMONIOS */}
      <section className="px-5 py-24">
        <div className="max-w-6xl mx-auto">
          <div className="text-center">
            <span className="font-mono text-[11px] uppercase" style={{ color: "var(--gold)", letterSpacing: "0.22em" }}>Testimonios</span>
            <h2 className="font-display mt-5 mx-auto max-w-2xl" style={{ fontSize: "clamp(28px,4.4vw,44px)", lineHeight: 1.15 }}>Lo que dicen quienes ya trabajan con nosotros</h2>
          </div>
          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {testimonios.map((t) => (
              <figure key={t.quien} className="rounded-3xl p-7 flex flex-col" style={{ background: "var(--panel)", border: "1px solid var(--line)" }}>
                <div className="font-display" style={{ fontSize: 44, lineHeight: 0.6, color: "var(--gold)" }}>&ldquo;</div>
                <blockquote className="mt-3 text-sm flex-1" style={{ lineHeight: 1.75 }}>{t.q}</blockquote>
                <figcaption className="mt-6 flex items-center gap-3" style={{ borderTop: "1px solid var(--line)", paddingTop: 16 }}>
                  <span className="h-10 w-10 rounded-full flex items-center justify-center gold-grad font-display font-bold" style={{ color: "var(--gold-dark)" }}>{t.quien.charAt(0)}</span>
                  <span>
                    <span className="block text-sm font-medium">{t.quien}</span>
                    <span className="font-mono block text-xs" style={{ color: "var(--gold)" }}>{t.rol}</span>
                  </span>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* CIERRE */}
      <section id="contacto" className="px-5 py-28 text-center" style={{ background: "radial-gradient(700px 400px at 50% 30%, rgba(227,179,65,0.1), transparent), linear-gradient(180deg,#0a1e23,#081619)" }}>
        <h2 className="font-display mx-auto max-w-3xl" style={{ fontSize: "clamp(34px,6vw,58px)", lineHeight: 1.08, letterSpacing: "-0.03em" }}>
          ¿Listo para que <span className="gold-grad-text">te busquen a vos?</span>
        </h2>
        <p className="mt-5 text-sm" style={{ color: "var(--dim)" }}>Una llamada de 15 minutos alcanza para saber si podemos ayudarte. Sin compromiso.</p>
        <div className="mt-8">
          <Link href="/diagnostico" className="inline-flex items-center gap-2 rounded-full px-7 py-3.5 text-sm font-semibold gold-grad" style={{ color: "var(--gold-dark)", boxShadow: "0 10px 30px rgba(227,179,65,0.25)" }}>
            Empezar con J <span aria-hidden>→</span>
          </Link>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="px-5 pt-16 pb-10" style={{ borderTop: "1px solid var(--line)", background: "var(--bg)" }}>
        <div className="max-w-6xl mx-auto">
          <div className="font-display" style={{ fontSize: "clamp(56px,12vw,140px)", lineHeight: 0.95, letterSpacing: "-0.04em", color: "transparent", WebkitTextStroke: "1px rgba(227,179,65,0.3)", userSelect: "none" }}>JOTA</div>
          <div className="mt-8 flex items-center justify-between flex-wrap gap-4">
            <Link href="/acceder" className="text-xs font-mono" style={{ color: "var(--dim)" }}>Acceso / Crear cuenta</Link>
            <span className="font-mono text-xs" style={{ color: "var(--dim)" }}>Generación de clientes B2B · Español / English</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
