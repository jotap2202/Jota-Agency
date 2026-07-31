import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/auth";
import { esAdmin } from "@/lib/admin";
import { revisarClientId, revisarClientSecret, revisarAuthSecret, envLimpio } from "@/lib/config-auth";
import { CopiarUri } from "@/components/CopiarUri";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Estado del login — JOTA agency",
  robots: { index: false, follow: false },
  alternates: { canonical: "/acceder/estado" },
};

const panel = { background: "var(--panel)", border: "1px solid var(--line)" } as const;

function Fila({ titulo, ok, detalle }: { titulo: string; ok: boolean; detalle: string }) {
  return (
    <div className="rounded-2xl p-5 flex gap-4 items-start" style={panel}>
      <span aria-hidden style={{ fontSize: 20, lineHeight: 1.2 }}>{ok ? "✅" : "❌"}</span>
      <div>
        <p style={{ fontSize: 15, fontWeight: 500 }}>{titulo}</p>
        <p style={{ marginTop: 4, fontSize: 13, color: ok ? "var(--dim)" : "var(--red)", lineHeight: 1.6 }}>{detalle}</p>
      </div>
    </div>
  );
}

export default async function EstadoLoginPage() {
  // Página de diagnóstico interno: expone si las credenciales están cargadas
  // (nunca su valor secreto) y el ID de cliente de Google en uso. No es apta
  // para visitantes anónimos, así que se restringe igual que /panel.
  const session = await auth();
  if (!session?.user) redirect("/acceder?next=/acceder/estado");
  if (!(await esAdmin(session.user.email))) redirect("/");

  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host") || "";
  const proto = h.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  const origen = `${proto}://${host}`;
  const uriRetorno = `${origen}/api/auth/callback/google`;

  const clientId = revisarClientId();
  const clientSecret = revisarClientSecret();
  const authSecret = revisarAuthSecret();
  const baseDatos = { ok: Boolean(envLimpio("DATABASE_URL")), detalle: envLimpio("DATABASE_URL") ? "Conectada." : "No está cargada: no se pueden guardar las cuentas." };

  const idVisible = envLimpio("AUTH_GOOGLE_ID");
  const todoOk = clientId.ok && clientSecret.ok && authSecret.ok && baseDatos.ok;

  return (
    <main className="min-h-screen px-5 py-14">
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <Link href="/" className="flex items-center gap-2.5 mb-8">
          <span className="h-9 w-9 rounded-xl flex items-center justify-center gold-grad font-display font-bold" style={{ color: "var(--gold-dark)" }}>J</span>
          <span className="font-display text-base">Estado del login</span>
        </Link>

        <p style={{ color: "var(--dim)", fontSize: 14, lineHeight: 1.7, marginBottom: 28 }}>
          Esta página revisa sola la configuración del acceso con Google. No muestra ninguna contraseña ni clave secreta.
        </p>

        <div style={{ display: "grid", gap: 12 }}>
          <Fila titulo="ID de cliente de Google (AUTH_GOOGLE_ID)" {...clientId} />
          <Fila titulo="Clave secreta de Google (AUTH_GOOGLE_SECRET)" {...clientSecret} />
          <Fila titulo="Clave de sesiones (AUTH_SECRET)" {...authSecret} />
          <Fila titulo="Base de datos (DATABASE_URL)" {...baseDatos} />
        </div>

        {/* Lo que hay que pegar en Google Cloud */}
        <div className="rounded-3xl p-6 mt-8" style={panel}>
          <p className="font-display" style={{ fontSize: 17 }}>Pegá esto en Google Cloud</p>
          <p style={{ color: "var(--dim)", fontSize: 13, lineHeight: 1.7, margin: "10px 0 14px" }}>
            En <strong>Credenciales → tu cliente de OAuth</strong>, dentro de <em>URIs de redireccionamiento autorizados</em>.
            Tiene que quedar idéntico, sin barra al final.
          </p>
          <CopiarUri valor={uriRetorno} />

          <p style={{ color: "var(--dim)", fontSize: 13, lineHeight: 1.7, marginTop: 20 }}>
            Y en <em>Orígenes autorizados de JavaScript</em>:
          </p>
          <div style={{ marginTop: 10 }}>
            <CopiarUri valor={origen} />
          </div>
        </div>

        {/* Comparación del ID */}
        {idVisible && (
          <div className="rounded-3xl p-6 mt-4" style={panel}>
            <p className="font-display" style={{ fontSize: 17 }}>Compará el ID de cliente</p>
            <p style={{ color: "var(--dim)", fontSize: 13, lineHeight: 1.7, margin: "10px 0 14px" }}>
              Este es el ID que está usando tu web. Tiene que ser exactamente el mismo que figura en Google Cloud
              junto a tu cliente. Si no coincide, Google responde <strong>401</strong>.
            </p>
            <p className="font-mono" style={{ fontSize: 12, wordBreak: "break-all", color: "var(--gold)", background: "var(--panel-soft)", padding: "12px 14px", borderRadius: 12, border: "1px solid var(--line)" }}>
              {idVisible}
            </p>
          </div>
        )}

        <div className="rounded-3xl p-6 mt-4" style={panel}>
          <p className="font-display" style={{ fontSize: 17 }}>{todoOk ? "Configuración completa" : "Falta algo"}</p>
          <p style={{ color: "var(--dim)", fontSize: 13, lineHeight: 1.7, marginTop: 10 }}>
            {todoOk
              ? "Todas las variables están bien cargadas. Si Google sigue dando 401, el ID de arriba no coincide con el de la consola, o el cliente fue borrado: creá uno nuevo y volvé a cargar las dos variables en Vercel."
              : "Corregí lo marcado en rojo en Vercel → Settings → Environment Variables, y después hacé Redeploy (los cambios no se aplican hasta redesplegar)."}
          </p>
        </div>

        <p className="mt-8 text-xs" style={{ color: "var(--dim)" }}>
          <Link href="/acceder" className="underline">← Volver al acceso</Link>
        </p>
      </div>
    </main>
  );
}
