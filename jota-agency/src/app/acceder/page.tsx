import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AuthForm } from "@/components/AuthForm";
import { googleConfigurado } from "@/lib/config-auth";
import { idiomaActual } from "@/lib/idioma-servidor";
import type { Idioma } from "@/lib/contenido";

export const metadata = {
  title: "Sign in — JOTA agency",
  // Formulario de login/registro: sin contenido propio que indexar, y su
  // contenido cambia según ?next=. Sin esto heredaba el canonical "/" de la
  // raíz.
  robots: { index: false, follow: false },
  alternates: { canonical: "/acceder" },
};

/** Traduce los códigos de error de Auth.js a algo que se entienda. */
const MENSAJES: Record<Idioma, Record<string, string>> = {
  en: {
    Configuration: "Signing in with Google isn't set up correctly. You can use your email and password in the meantime.",
    OAuthSignin: "We couldn't start the Google sign-in. Try your email and password instead.",
    OAuthCallback: "Google rejected the sign-in. This usually means the site's credentials don't match the ones in Google.",
    OAuthAccountNotLinked: "That email already has an account created with a password. Sign in with your email and password.",
    AccessDenied: "You cancelled the Google sign-in, or that account doesn't have permission.",
    Callback: "Something broke on the way back from Google. Please try again.",
    Verification: "That link has expired. Request a new one.",
  },
  es: {
    Configuration: "El acceso con Google no está bien configurado. Podés entrar con tu email y contraseña mientras tanto.",
    OAuthSignin: "No pudimos empezar el acceso con Google. Probá con tu email y contraseña.",
    OAuthCallback: "Google rechazó el acceso. Suele ser porque las credenciales de la web no coinciden con las de Google.",
    OAuthAccountNotLinked: "Ese email ya tiene una cuenta creada con contraseña. Entrá con tu email y contraseña.",
    AccessDenied: "Cancelaste el acceso con Google, o esa cuenta no tiene permiso.",
    Callback: "Algo se cortó al volver de Google. Intentá de nuevo.",
    Verification: "El enlace ya venció. Pedí uno nuevo.",
  },
};

const UI: Record<Idioma, { generico: string; estado: string; volver: string }> = {
  en: {
    generico: "We couldn't complete the sign-in. Please try again.",
    estado: "See configuration status →",
    volver: "← Back to home",
  },
  es: {
    generico: "No pudimos completar el acceso. Probá de nuevo.",
    estado: "Ver estado de la configuración →",
    volver: "← Volver al inicio",
  },
};

export default async function AccederPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const session = await auth();
  const { next, error } = await searchParams;
  const destino = typeof next === "string" && next.startsWith("/") ? next : "/diagnostico";

  if (session?.user) redirect(destino);

  const lang = await idiomaActual();
  const ui = UI[lang];
  const aviso = typeof error === "string" ? (MENSAJES[lang][error] ?? ui.generico) : null;

  return (
    <main className="min-h-screen px-5 py-16 flex flex-col items-center justify-center">
      <div className="w-full max-w-md">
        <Link href="/" className="flex items-center gap-2.5 mb-8 justify-center">
          <span className="h-9 w-9 rounded-xl flex items-center justify-center gold-grad font-display font-bold" style={{ color: "var(--gold-dark)" }}>J</span>
          <span className="font-display text-base">JOTA agency</span>
        </Link>

        {aviso && (
          <div
            role="alert"
            className="rounded-2xl p-4 mb-5"
            style={{ background: "rgba(220,80,80,0.08)", border: "1px solid rgba(220,80,80,0.3)" }}
          >
            <p style={{ fontSize: 13, lineHeight: 1.6, color: "var(--red)" }}>{aviso}</p>
            <Link href="/acceder/estado" className="underline" style={{ display: "inline-block", marginTop: 8, fontSize: 12, color: "var(--dim)" }}>
              {ui.estado}
            </Link>
          </div>
        )}

        <AuthForm next={destino} google={googleConfigurado()} lang={lang} />
        <p className="mt-6 text-center text-xs" style={{ color: "var(--dim)" }}>
          <Link href="/" className="underline">{ui.volver}</Link>
        </p>
      </div>
    </main>
  );
}
