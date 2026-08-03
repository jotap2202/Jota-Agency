"use client";

import { signIn } from "next-auth/react";
import { T, IDIOMA_POR_DEFECTO, type Idioma } from "@/lib/contenido";
import { useAuthSubmit } from "@/lib/useAuthSubmit";

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
  </svg>
);

const inputCls = "w-full rounded-xl px-4 py-3 text-sm outline-none";
const inputStyle = { background: "var(--panel-soft)", border: "1px solid var(--line)", color: "var(--text)" } as const;

export function AuthForm({
  next = "/diagnostico",
  google = true,
  lang = IDIOMA_POR_DEFECTO,
}: { next?: string; google?: boolean; lang?: Idioma }) {
  // Los textos salen de contenido.ts, igual que el portón de la landing:
  // antes este formulario tenía su propia copia en castellano y no seguía el
  // toggle de idioma.
  const d = T[lang].diag;
  const {
    tab, setTab, isSignup,
    nombre, setNombre,
    empresa, setEmpresa,
    email, setEmail,
    password, setPassword,
    error, setError,
    cargando,
    submit,
  } = useAuthSubmit({
    email: d.emailError,
    password: d.passError,
    campos: d.regError,
    login: d.loginError,
    cuentaCreadaSinLogin: d.loginError,
    conexion: d.errorConexion,
  });

  return (
    <div className="rounded-3xl p-6" style={{ background: "rgba(15,36,41,0.85)", border: "1px solid var(--line)", boxShadow: "0 30px 80px rgba(0,0,0,0.45)" }}>
      <div className="flex items-center gap-3 mb-5">
        <div className="h-11 w-11 rounded-2xl flex items-center justify-center gold-grad font-display font-bold" aria-hidden style={{ color: "var(--gold-dark)", fontSize: 19 }}>J</div>
        <div>
          <div className="font-display text-[15px]">{d.authTitulo}</div>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" aria-hidden style={{ background: "var(--green)", animation: "pulse-dot 2s infinite" }} />
            <span className="text-xs" style={{ color: "var(--dim)" }}>{d.online}</span>
          </div>
        </div>
      </div>

      {google && (
        <>
          <button
            onClick={() => signIn("google", { callbackUrl: next })}
            className="w-full flex items-center justify-center gap-2.5 rounded-xl px-4 py-3 text-sm font-semibold"
            style={{ background: "#fff", color: "#1f2328", border: "1px solid #dadce0" }}
          >
            <GoogleIcon /> {d.googleBtn}
          </button>

          <div className="flex items-center gap-3 my-4 text-xs" style={{ color: "var(--dim)" }}>
            <span className="flex-1 h-px" style={{ background: "var(--line)" }} />
            <span className="font-mono uppercase" style={{ letterSpacing: "0.12em" }}>{d.orSep}</span>
            <span className="flex-1 h-px" style={{ background: "var(--line)" }} />
          </div>
        </>
      )}

      <div className="flex gap-1.5 rounded-xl p-1 mb-4" style={{ background: "var(--panel-soft)", border: "1px solid var(--line)" }} role="tablist">
        {(["signup", "login"] as const).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => { setTab(t); setError(null); }}
            className="flex-1 rounded-lg py-2 text-[13px] font-semibold"
            style={tab === t ? { color: "var(--gold-dark)", background: "linear-gradient(135deg,#f0c75e,#c99427)" } : { color: "var(--dim)" }}>
            {t === "signup" ? d.tabSignup : d.tabLogin}
          </button>
        ))}
      </div>

      <div className="space-y-2.5">
        {isSignup && (
          <>
            <label htmlFor="af-nombre" className="sr-only">{d.regNombre}</label>
            <input id="af-nombre" className={inputCls} style={inputStyle} autoComplete="name" placeholder={d.regNombre} value={nombre} onChange={(e) => setNombre(e.target.value)} />
            <label htmlFor="af-empresa" className="sr-only">{d.regEmpresa}</label>
            <input id="af-empresa" className={inputCls} style={inputStyle} autoComplete="organization" placeholder={d.regEmpresa} value={empresa} onChange={(e) => setEmpresa(e.target.value)} />
          </>
        )}
        <label htmlFor="af-email" className="sr-only">{d.regEmail}</label>
        <input id="af-email" className={inputCls} style={inputStyle} type="email" autoComplete="email" inputMode="email" placeholder={d.regEmail} value={email} onChange={(e) => setEmail(e.target.value)} />
        <label htmlFor="af-pass" className="sr-only">{d.regPass}</label>
        <input id="af-pass" className={inputCls} style={inputStyle} type="password" autoComplete={isSignup ? "new-password" : "current-password"} placeholder={d.regPass} value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") submit(next); }} />
      </div>

      {error && <p className="mt-3 text-sm" role="alert" style={{ color: "var(--red)" }}>{error}</p>}

      <button onClick={() => submit(next)} disabled={cargando} className="mt-5 w-full rounded-full px-6 py-3 text-sm font-semibold gold-grad" style={{ color: "var(--gold-dark)", opacity: cargando ? 0.6 : 1 }}>
        {cargando ? "…" : isSignup ? d.signupBtn : d.loginBtn} →
      </button>

      <p className="mt-4 text-xs" style={{ color: "var(--dim)" }}>{d.regNota}</p>
    </div>
  );
}
