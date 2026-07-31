import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AuthForm } from "@/components/AuthForm";
import { googleConfigurado } from "@/lib/config-auth";

export const metadata = {
  title: "Acceder — JOTA agency",
  // Formulario de login/registro: sin contenido propio que indexar, y su
  // contenido cambia según ?next=. Sin esto heredaba el canonical "/" de la
  // raíz.
  robots: { index: false, follow: false },
  alternates: { canonical: "/acceder" },
};

/** Traduce los códigos de error de Auth.js a algo que se entienda. */
const MENSAJES: Record<string, string> = {
  Configuration: "El acceso con Google no está bien configurado. Podés entrar con tu email y contraseña mientras tanto.",
  OAuthSignin: "No pudimos empezar el acceso con Google. Probá con tu email y contraseña.",
  OAuthCallback: "Google rechazó el acceso. Suele ser porque las credenciales de la web no coinciden con las de Google.",
  OAuthAccountNotLinked: "Ese email ya tiene una cuenta creada con contraseña. Entrá con tu email y contraseña.",
  AccessDenied: "Cancelaste el acceso con Google, o esa cuenta no tiene permiso.",
  Callback: "Algo se cortó al volver de Google. Intentá de nuevo.",
  Verification: "El enlace ya venció. Pedí uno nuevo.",
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

  const aviso = typeof error === "string" ? (MENSAJES[error] ?? "No pudimos completar el acceso. Probá de nuevo.") : null;

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
              Ver estado de la configuración →
            </Link>
          </div>
        )}

        <AuthForm next={destino} google={googleConfigurado()} />
        <p className="mt-6 text-center text-xs" style={{ color: "var(--dim)" }}>
          <Link href="/" className="underline">← Volver al inicio</Link>
        </p>
      </div>
    </main>
  );
}
