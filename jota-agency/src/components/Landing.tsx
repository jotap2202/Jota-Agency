"use client";

import { useEffect, useRef, useState } from "react";
import { signIn, signOut } from "next-auth/react";
import { T, EMAIL_CONTACTO, type Idioma } from "@/lib/contenido";
import { CompletarEmpresa } from "@/components/CompletarEmpresa";

/** Link de mail con el asunto ya escrito, para que la consulta llegue ordenada. */
const mailto = (asunto: string) => `mailto:${EMAIL_CONTACTO}?subject=${encodeURIComponent(asunto)}`;

const IMG_HERO = "https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?auto=format&fit=crop&w=1800&q=80";
const IMG_1 = "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=1400&q=80";
const IMG_2 = "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1400&q=80";

/**
 * Arma un srcset variando el ancho (w=) de una URL de Unsplash ya armada,
 * para que un celular no baje la misma imagen que un monitor de escritorio.
 */
function unsplashSrcSet(url: string, anchos: number[]): string {
  return anchos.map((w) => `${url.replace(/([?&])w=\d+/, `$1w=${w}`)} ${w}w`).join(", ");
}
const HERO_SRCSET = unsplashSrcSet(IMG_HERO, [800, 1200, 1800, 2400]);
const FRAME_SRCSET_1 = unsplashSrcSet(IMG_1, [480, 768, 1000, 1400]);
const FRAME_SRCSET_2 = unsplashSrcSet(IMG_2, [480, 768, 1000, 1400]);

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
  </svg>
);

export function Landing({
  userEmail,
  google = true,
  faltaEmpresa = false,
}: { userEmail?: string | null; google?: boolean; faltaEmpresa?: boolean }) {
  const [lang, setLang] = useState<Idioma>("es");
  const rootRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const t = T[lang];

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  /* ---------- animación de entrada + barra de progreso + nav ---------- */
  useEffect(() => {
    mainRef.current?.classList.add("loaded"); // dispara la animación de entrada
    const onScroll = () => {
      const h = document.documentElement;
      const pct = (h.scrollTop / (h.scrollHeight - h.clientHeight)) * 100;
      const bar = document.getElementById("progress");
      if (bar) bar.style.width = `${pct}%`;
      const nav = document.getElementById("jnav");
      if (nav) nav.classList.toggle("scrolled", h.scrollTop > 20);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /* ---------- reveal al hacer scroll + contadores ---------- */
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const els = Array.from(document.querySelectorAll<HTMLElement>(".reveal:not(.in)"));
    if (reduce) {
      els.forEach((el) => el.classList.add("in"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          e.target.classList.add("in");
          const n = e.target.querySelector<HTMLElement>("[data-count]");
          if (n && !n.dataset.done) {
            n.dataset.done = "1";
            const target = Number(n.dataset.count || 0);
            const suf = n.dataset.suf || "";
            const t0 = performance.now();
            const tick = (now: number) => {
              const p = Math.min((now - t0) / 1200, 1);
              const eased = 1 - Math.pow(1 - p, 3);
              n.textContent = Math.round(target * eased) + suf;
              if (p < 1) requestAnimationFrame(tick);
            };
            requestAnimationFrame(tick);
          }
          io.unobserve(e.target);
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -60px 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [lang]);

  /* ---------- PARALLAX con GSAP + ScrollTrigger ---------- */
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let ctx: { revert: () => void } | undefined;
    let cancelled = false;

    (async () => {
      const [{ default: gsap }, { ScrollTrigger }] = await Promise.all([
        import("gsap"),
        import("gsap/ScrollTrigger"),
      ]);
      if (cancelled) return;
      gsap.registerPlugin(ScrollTrigger);

      ctx = gsap.context(() => {
        // HERO: la foto se desplaza y hace zoom suave mientras scrolleás
        gsap.fromTo(
          ".hero-img",
          { yPercent: -6, scale: 1.15 },
          {
            yPercent: 8,
            scale: 1.28,
            ease: "none",
            scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true },
          },
        );

        // MARCOS: cada imagen se expande suavemente al recorrer la pantalla
        gsap.utils.toArray<HTMLElement>(".frame-img").forEach((img) => {
          gsap.fromTo(
            img,
            { yPercent: -5, scale: 1.12 },
            {
              yPercent: 5,
              scale: 1.26,
              ease: "none",
              scrollTrigger: { trigger: img.closest(".frame"), start: "top bottom", end: "bottom top", scrub: 0.6 },
            },
          );
        });
      }, rootRef);

      const refresh = () => ScrollTrigger.refresh();
      window.addEventListener("load", refresh);
      setTimeout(refresh, 400);
    })();

    return () => {
      cancelled = true;
      ctx?.revert();
    };
  }, []);

  return (
    <div className="landing" ref={rootRef}>
      <a href="#contenido" className="skip-link">{t.skip}</a>
      <div id="progress" />
      <div id="grain" aria-hidden />

      {/* ---------------- NAV ---------------- */}
      <nav id="jnav" className="jnav">
        <div className="nav-in">
          <a href="#contenido" className="logo">
            <span className="badge" aria-hidden>J</span>
            <span style={{ fontFamily: "var(--font-display), sans-serif", fontSize: 16, letterSpacing: "-.01em" }}>JOTA agency</span>
          </a>
          <div className="nav-links">
            <a href="#servicios">{t.nav.servicios}</a>
            <a href="#proceso">{t.nav.proceso}</a>
            <a href="#diagnostico">{t.nav.diagnostico}</a>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div className="lang" role="group" aria-label="Idioma">
              {(["es", "en"] as const).map((l) => (
                <button key={l} aria-pressed={lang === l} aria-label={l === "es" ? "Español" : "English"} onClick={() => setLang(l)}>
                  {l.toUpperCase()}
                </button>
              ))}
            </div>
            <a href="#diagnostico" className="nav-cta">{t.nav.cta}</a>
          </div>
        </div>
      </nav>

      <main id="contenido" ref={mainRef}>
        {/* ---------------- HERO ---------------- */}
        <header className="hero">
          <div className="hero-bg" aria-hidden>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="hero-img" src={IMG_HERO} srcSet={HERO_SRCSET} sizes="100vw" alt="" fetchPriority="high" decoding="async" />
            <div className="hero-shade" />
          </div>
          <div className="hero-in">
            <div className="col">
              <div className="line-mask"><span style={{ animationDelay: ".1s" }}>
                <div className="eyebrow"><span className="l" /><span className="t">{t.hero.eyebrow}</span></div>
              </span></div>

              <h1 className="hero-title">
                {t.hero.lineas.map((l, i) => (
                  <span className="line-mask" key={`${lang}-${i}`}>
                    <span style={{ animationDelay: `${0.25 + i * 0.13}s` }}>
                      {i === t.hero.lineas.length - 1 ? <span className="grad-text">{l}</span> : l}
                    </span>
                  </span>
                ))}
              </h1>

              <div className="line-mask"><span style={{ animationDelay: ".75s" }}>
                <p className="hero-sub">{t.hero.sub}</p>
              </span></div>

              <div className="line-mask"><span style={{ animationDelay: ".9s" }}>
                <div className="hero-cta">
                  <a href="#diagnostico" className="btn-gold">{t.hero.cta1} <span aria-hidden>→</span></a>
                  <a href="#proceso" className="btn-ghost">{t.hero.cta2}</a>
                </div>
              </span></div>
            </div>
          </div>
          <div className="marquee-wrap" aria-hidden>
            <div className="marquee">
              <span>{t.marquee.repeat(4)}</span>
              <span>{t.marquee.repeat(4)}</span>
            </div>
          </div>
        </header>

        {/* ---------------- STATS ---------------- */}
        <section aria-label="Números clave">
          <div className="wrap stats">
            {t.stats.map((s, i) => (
              <div className="reveal stat" key={`${lang}-${i}`} style={{ animationDelay: `${i * 110}ms` }}>
                <div className="n grad-text" data-count={s.n} data-suf={s.suf}>0{s.suf}</div>
                <p>{s.label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ---------------- RUBROS ---------------- */}
        <section className="band">
          <div className="wrap">
            <div className="reveal center-col">
              <div className="eyebrow center"><span className="l" /><span className="t">{t.sectores.cap}</span></div>
              <h3>{t.sectores.titulo}</h3>
              <div className="rubros">
                {t.sectores.items.map((s) => <span className="chip" key={s}>{s}</span>)}
              </div>
            </div>
          </div>
        </section>

        {/* ---------------- MANIFIESTO 1 (imagen con parallax) ---------------- */}
        <section>
          <div className="wrap mani">
            <div className="reveal c3">
              <div className="eyebrow"><span className="l" /><span className="t">{t.manif.cap}</span></div>
              <h2>{t.manif.titulo}</h2>
              <p className="body">{t.manif.texto}</p>
            </div>
            <div className="reveal c2">
              <div className="frame">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="frame-img" src={IMG_1} srcSet={FRAME_SRCSET_1} sizes="(max-width: 768px) 100vw, 50vw" alt="Un teléfono de noche: la consulta que espera respuesta" loading="lazy" decoding="async" />
                <div className="ph">JOTA</div>
                <div className="cap"><p>{t.manif.imgCap}</p></div>
              </div>
            </div>
          </div>
        </section>

        {/* ---------------- SERVICIOS ---------------- */}
        <section id="servicios" className="band" style={{ paddingTop: 96, paddingBottom: 96 }}>
          <div className="wrap">
            <div className="reveal"><div className="eyebrow"><span className="l" /><span className="t">{t.serviciosCap}</span></div></div>
            <div className="reveal"><h2 className="sec-h">{t.servTitulo}</h2></div>
            <div className="reveal"><p style={{ marginTop: 12, fontSize: 14, color: "var(--dim)" }}>{t.servSub}</p></div>
            <div style={{ marginTop: 48 }}>
              {t.servicios.map((s, i) => (
                <div className="reveal" key={`${lang}-${i}`}>
                  <div className="serv">
                    <div className="num">{String(i + 1).padStart(2, "0")}</div>
                    <div className="name">
                      <div className="nm">{s.nombre}</div>
                      <div className="cap">{s.cap}</div>
                    </div>
                    <p className="desc">{s.desc}</p>
                    <div className="arr" aria-hidden>→</div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ borderTop: "1px solid var(--line)" }} />
          </div>
        </section>

        {/* ---------------- MANIFIESTO 2 (imagen con parallax) ---------------- */}
        <section>
          <div className="wrap mani">
            <div className="reveal c2" style={{ order: 2 }}>
              <div className="frame n2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="frame-img" src={IMG_2} srcSet={FRAME_SRCSET_2} sizes="(max-width: 768px) 100vw, 50vw" alt="Un mundo conectado las 24 horas" loading="lazy" decoding="async" />
                <div className="ph">24/7</div>
                <div className="cap"><p>{t.manif2.imgCap}</p></div>
              </div>
            </div>
            <div className="reveal c3" style={{ order: 1 }}>
              <div className="eyebrow"><span className="l" /><span className="t">{t.manif2.cap}</span></div>
              <h2>{t.manif2.titulo}</h2>
              <p className="body">{t.manif2.texto}</p>
            </div>
          </div>
        </section>

        {/* ---------------- MÉTODO ---------------- */}
        <section id="proceso" className="band" style={{ paddingTop: 96, paddingBottom: 96 }}>
          <div className="wrap">
            <div className="reveal"><div className="eyebrow center"><span className="l" /><span className="t">{t.procTitulo}</span></div></div>
            <div className="reveal"><p style={{ textAlign: "center", marginTop: 12, fontSize: 14, color: "var(--dim)" }}>{t.procSub}</p></div>
            <div className="steps">
              {t.pasos.map((p, i) => (
                <div className="reveal" key={`${lang}-${i}`} style={{ animationDelay: `${i * 130}ms` }}>
                  <div className="step">
                    <div className="big" aria-hidden>{i + 1}</div>
                    <div className="st">{p.titulo}</div>
                    <p>{p.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="reveal guarantee">
              <div className="eyebrow center"><span className="l" /><span className="t">{t.garantia.cap}</span></div>
              <p className="q">“{t.garantia.texto}”</p>
              <p className="sig">{t.garantia.firma}</p>
            </div>
          </div>
        </section>

        {/* ---------------- TESTIMONIOS ---------------- */}
        <section>
          <div className="wrap">
            <div className="reveal"><div className="eyebrow center"><span className="l" /><span className="t">{t.testCap}</span></div></div>
            <div className="reveal">
              <h2 style={{ textAlign: "center", marginTop: 20, maxWidth: "42rem", marginLeft: "auto", marginRight: "auto", fontSize: "clamp(28px,4.4vw,44px)", lineHeight: 1.15, letterSpacing: "-.025em" }}>{t.testTitulo}</h2>
            </div>
            <div className="reveal">
              <p style={{ textAlign: "center", marginTop: 12, fontSize: 14, color: "var(--dim)", maxWidth: "32rem", marginLeft: "auto", marginRight: "auto", lineHeight: 1.7 }}>{t.testSub}</p>
            </div>
            <div className="tgrid">
              {t.testimonios.map((x, i) => (
                <div className="reveal" key={`${lang}-${i}`} style={{ animationDelay: `${i * 120}ms` }}>
                  <figure className="tcard">
                    <div className="quote" aria-hidden>“</div>
                    <blockquote>{x.q}</blockquote>
                    <figcaption>
                      <span className="av" aria-hidden>{x.quien.trim().charAt(0)}</span>
                      <span>
                        <span className="who">{x.quien}</span>
                        <span className="role">{x.rol}</span>
                      </span>
                    </figcaption>
                  </figure>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ---------------- DIAGNÓSTICO (con portón de acceso) ---------------- */}
        <section id="diagnostico" className="diag" style={{ paddingTop: 96, paddingBottom: 96 }}>
          <div className="glow" aria-hidden />
          <div className="diag-in">
            <div className="reveal"><div className="eyebrow center"><span className="l" /><span className="t">{t.diag.eyebrow}</span></div></div>
            <div className="reveal"><h2 style={{ textAlign: "center", marginTop: 16, fontSize: "clamp(30px,5vw,44px)", letterSpacing: "-.02em" }}>{t.diag.titulo}</h2></div>
            <div className="reveal"><p style={{ textAlign: "center", fontSize: 14, marginTop: 12, maxWidth: "32rem", marginLeft: "auto", marginRight: "auto", color: "var(--dim)", lineHeight: 1.7 }}>{t.diag.sub}</p></div>
            <div className="reveal chat">
              <div className="head">
                <div className="javatar" aria-hidden>J</div>
                <div>
                  <div style={{ fontFamily: "var(--font-display), sans-serif", fontSize: 15 }}>J</div>
                  <div className="status">
                    <span className="dot" aria-hidden />
                    <span style={{ fontSize: 12, color: "var(--dim)" }}>{t.diag.online}</span>
                  </div>
                </div>
              </div>
              {!userEmail ? (
                <AuthGate lang={lang} google={google} />
              ) : faltaEmpresa ? (
                <CompletarEmpresa lang={lang} />
              ) : (
                <DiagChat lang={lang} email={userEmail} />
              )}
            </div>
          </div>
        </section>

        {/* ---------------- CIERRE ---------------- */}
        <section id="contacto" className="cierre">
          <h2>
            {t.cierre.lineas.map((l, i) => (
              <span className="reveal" key={`${lang}-${i}`} style={{ display: "block", animationDelay: `${i * 120}ms` }}>
                {i === t.cierre.lineas.length - 1 ? <span className="grad-text">{l}</span> : l}
              </span>
            ))}
          </h2>
          <p className="reveal" style={{ marginTop: 20, fontSize: 14, color: "var(--dim)" }}>{t.cierre.sub}</p>
          <div className="reveal" style={{ marginTop: 32 }}>
            <a href="#diagnostico" className="btn-gold">{t.cierre.cta} <span aria-hidden>→</span></a>
          </div>
          <p className="reveal" style={{ marginTop: 20, fontSize: 14, color: "var(--dim)" }}>
            {t.cierre.oEscribinos}{" "}
            <a href={mailto(t.asuntoMail)} style={{ color: "var(--gold)", textDecoration: "underline" }}>{EMAIL_CONTACTO}</a>
          </p>
          <p className="reveal mono" style={{ marginTop: 12, fontSize: 12, color: "var(--dim)" }}>{t.cierre.nota}</p>
        </section>
      </main>

      <footer className="jfooter">
        <div className="wrap">
          <div className="foot-big" aria-hidden>JOTA</div>
          <div className="foot-row">
            {/* Acceso al panel de leads. Solo entra el equipo; al resto le avisa que es privado. */}
            <a href="/panel" className="badge" title="Acceso al panel" aria-label="Acceso al panel de leads">J</a>
            <a href={mailto(t.asuntoMail)} className="mono" style={{ color: "var(--gold)", fontSize: 13 }}>{EMAIL_CONTACTO}</a>
            <span className="mono">{t.footer}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ============================================================
   Portón de acceso — Google + email/contraseña
   ============================================================ */
function AuthGate({ lang, google = true }: { lang: Idioma; google?: boolean }) {
  const d = T[lang].diag;
  const [tab, setTab] = useState<"signup" | "login">("signup");
  const [nombre, setNombre] = useState("");
  const [empresa, setEmpresa] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const isSignup = tab === "signup";

  const submit = async () => {
    setError(null);
    const e = email.trim().toLowerCase();
    if (!e.includes("@") || !e.includes(".")) return setError(d.emailError);
    if (password.length < 6) return setError(d.passError);
    if (isSignup && (!nombre.trim() || !empresa.trim())) return setError(d.regError);

    setCargando(true);
    try {
      if (isSignup) {
        const res = await fetch("/api/registro", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: nombre.trim(), empresa: empresa.trim(), email: e, password }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setCargando(false);
          return setError(data.error || d.loginError);
        }
      }
      const result = await signIn("credentials", { email: e, password, redirect: false });
      if (result?.error) {
        setCargando(false);
        return setError(d.loginError);
      }
      window.location.href = "/#diagnostico";
    } catch {
      setCargando(false);
      setError(T[lang].diag.errorConexion);
    }
  };

  return (
    <>
      <div style={{ fontFamily: "var(--font-display), sans-serif", fontSize: 19 }}>{d.authTitulo}</div>
      <p style={{ marginTop: 4, fontSize: 14, color: "var(--dim)" }}>{d.authSub}</p>

      {google && (
        <>
          <button className="gbtn" onClick={() => signIn("google", { callbackUrl: "/#diagnostico" })}>
            <GoogleIcon /> <span>{d.googleBtn}</span>
          </button>

          <div className="sep"><span /><em>{d.orSep}</em><span /></div>
        </>
      )}

      <div className="tabs" role="tablist">
        {(["signup", "login"] as const).map((x) => (
          <button key={x} role="tab" aria-selected={tab === x} className={`tab${tab === x ? " on" : ""}`} onClick={() => { setTab(x); setError(null); }}>
            {x === "signup" ? d.tabSignup : d.tabLogin}
          </button>
        ))}
      </div>

      <div style={{ marginTop: 14 }}>
        {isSignup && (
          <>
            <label htmlFor="g-nombre" className="sr-only">{d.regNombre}</label>
            <input id="g-nombre" className="jfield" autoComplete="name" placeholder={d.regNombre} value={nombre} onChange={(e) => setNombre(e.target.value)} />
            <label htmlFor="g-empresa" className="sr-only">{d.regEmpresa}</label>
            <input id="g-empresa" className="jfield" autoComplete="organization" placeholder={d.regEmpresa} value={empresa} onChange={(e) => setEmpresa(e.target.value)} />
          </>
        )}
        <label htmlFor="g-email" className="sr-only">{d.regEmail}</label>
        <input id="g-email" className="jfield" type="email" inputMode="email" autoComplete="email" placeholder={d.regEmail} value={email} onChange={(e) => setEmail(e.target.value)} />
        <label htmlFor="g-pass" className="sr-only">{d.regPass}</label>
        <input id="g-pass" className="jfield" type="password" autoComplete={isSignup ? "new-password" : "current-password"} placeholder={d.regPass}
          value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") submit(); }} />
      </div>

      {error && <p className="err" role="alert">{error}</p>}

      <button className="send" style={{ width: "100%" }} onClick={submit} disabled={cargando}>
        {cargando ? "…" : isSignup ? d.signupBtn : d.loginBtn} →
      </button>

      <p style={{ marginTop: 14, fontSize: 12, color: "var(--dim)" }}>{d.regNota}</p>
    </>
  );
}

/* ============================================================
   Chat con J — solo con sesión iniciada
   ============================================================ */
function DiagChat({ lang, email }: { lang: Idioma; email: string }) {
  const d = T[lang].diag;
  const [desc, setDesc] = useState("");
  const [resultado, setResultado] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [esDemo, setEsDemo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pedir = async () => {
    const consulta = desc.trim();
    if (!consulta || cargando) return;
    setCargando(true);
    setError(null);
    setResultado(null);
    setEsDemo(false);
    try {
      const res = await fetch("/api/diagnostico", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ consulta, idioma: lang }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || d.errorConexion);
      }

      setEsDemo(res.headers.get("X-Diagnostico-Modo") === "demo");

      // J va escribiendo: mostramos el texto a medida que llega
      const reader = res.body?.getReader();
      if (!reader) throw new Error(d.errorConexion);
      const decoder = new TextDecoder();
      let acumulado = "";
      setResultado("");
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acumulado += decoder.decode(value, { stream: true });
        setResultado(acumulado);
      }
      if (!acumulado.trim()) throw new Error(d.errorConexion);
    } catch (e) {
      setResultado(null);
      setError(e instanceof Error ? e.message : d.errorConexion);
    } finally {
      setCargando(false);
    }
  };

  return (
    <>
      <div className="authok">
        ✓ {d.conectado} {email}
        <button onClick={() => signOut({ callbackUrl: "/" })} style={{ color: "var(--dim)", textDecoration: "underline", background: "none", border: "none", fontSize: 11 }}>
          {T[lang].salir}
        </button>
      </div>

      {!resultado ? (
        <div style={{ marginTop: 12 }}>
          <label htmlFor="diag-desc" className="sr-only">{d.descLabel}</label>
          <textarea id="diag-desc" className="jfield" rows={4} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder={d.placeholder} />
          <div style={{ marginTop: 4, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <button className="send" onClick={pedir} disabled={cargando || !desc.trim()}>
              {cargando ? d.analizando : d.boton}
            </button>
            {cargando && <span className="mono" style={{ fontSize: 12, color: "var(--gold)", animation: "pulse-dot 1.2s infinite" }}>●●●</span>}
          </div>
          {error && <p className="err" role="alert">{error}</p>}
        </div>
      ) : (
        <div style={{ marginTop: 12 }}>
          <div className="eyebrow"><span className="l" /><span className="t">{d.resultado}</span></div>
          <p className="result" aria-live="polite" aria-busy={cargando}>
            {resultado}
            {cargando && <span className="caret" aria-hidden />}
          </p>

          {esDemo && (
            <p className="demo-note" role="status">
              ⚠︎ {lang === "es"
                ? "Modo demo: falta configurar ANTHROPIC_API_KEY en Vercel. Con la clave, J genera un diagnóstico único para cada visitante."
                : "Demo mode: ANTHROPIC_API_KEY is not set in Vercel. With the key, J writes a unique diagnosis for every visitor."}
            </p>
          )}

          {!cargando && (
            <div style={{ marginTop: 24, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
              <a href={mailto(T[lang].asuntoMail)} className="btn-gold">
                {d.ctaLlamada} <span aria-hidden>→</span>
              </a>
              <button onClick={() => { setResultado(null); setDesc(""); setEsDemo(false); }} style={{ fontSize: 14, color: "var(--dim)", textDecoration: "underline", background: "none", border: "none" }}>
                {d.denuevo}
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
