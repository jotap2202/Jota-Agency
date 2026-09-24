import { auth } from "@/auth";
import { Landing } from "@/components/Landing";
import { googleConfigurado } from "@/lib/config-auth";
import { idiomaActual } from "@/lib/idioma-servidor";
import { faltaEmpresa } from "@/lib/perfil";
import Script from "next/script";
import { tenantDeJota } from "@/lib/agente/reserva";

export default async function Home() {
  const session = await auth();
  const email = session?.user?.email ?? null;

  // El chat de J en la propia web: es el producto que vendemos, funcionando
  // delante del cliente. Solo aparece si el negocio de JOTA está activo en el
  // agente (PROSPECCION_TENANT); si no, la landing queda igual que antes.
  const jota = await tenantDeJota().catch(() => null);

  return (
    <>
      {jota && (
        <Script
          src={`/api/agente/widget?clave=${encodeURIComponent(jota.clavePublica)}`}
          strategy="lazyOnload"
        />
      )}
      <Landing
        userEmail={email}
        google={googleConfigurado()}
        faltaEmpresa={await faltaEmpresa(email)}
        langInicial={await idiomaActual()}
      />
    </>
  );
}
