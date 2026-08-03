import { auth } from "@/auth";
import { Landing } from "@/components/Landing";
import { googleConfigurado } from "@/lib/config-auth";
import { idiomaActual } from "@/lib/idioma-servidor";
import { faltaEmpresa } from "@/lib/perfil";

export default async function Home() {
  const session = await auth();
  const email = session?.user?.email ?? null;

  return (
    <Landing
      userEmail={email}
      google={googleConfigurado()}
      faltaEmpresa={await faltaEmpresa(email)}
      langInicial={await idiomaActual()}
    />
  );
}
