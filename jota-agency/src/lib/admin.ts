import { prisma } from "@/lib/prisma";

/**
 * Quién puede entrar al panel de leads y al CEO Command Center.
 *
 * EN PRODUCCIÓN: manda `ADMIN_EMAILS` y NADA MÁS. Si esa variable no está
 * configurada, no entra nadie.
 *
 * Antes había un modo cómodo: sin ADMIN_EMAILS entraba un mail por defecto y,
 * además, la PRIMERA cuenta creada en el sitio. Eso significaba que si la
 * variable se borraba, se escribía mal o no se copiaba a un entorno nuevo, el
 * sistema no fallaba: le daba acceso de administrador a quien se hubiera
 * registrado primero. Un fallo de configuración terminaba en un desconocido
 * viendo los leads, los clientes y las conversaciones de todos los negocios.
 *
 * Ahora falla cerrado: sin configuración no hay acceso. Es molesto una vez
 * (hay que setear la variable) y seguro siempre.
 *
 * EN DESARROLLO se conserva la comodidad, porque ahí el costo de equivocarse
 * es cero y el de no poder entrar es alto: sin ADMIN_EMAILS entra el mail por
 * defecto y la primera cuenta creada.
 */

const POR_DEFECTO = "jotanico17@gmail.com";

export function esProduccion(): boolean {
  return process.env.NODE_ENV === "production";
}

function configurados(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Diagnóstico del control de acceso, para que el panel de salud pueda avisar
 * en vez de que alguien descubra el problema el día que no puede entrar.
 */
export function estadoAdmin(): {
  ok: boolean;
  modo: "configurado" | "desarrollo" | "bloqueado";
  detalle: string;
  cantidad: number;
} {
  const lista = configurados();
  if (lista.length > 0) {
    return {
      ok: true,
      modo: "configurado",
      detalle: `${lista.length} administrador(es) en ADMIN_EMAILS`,
      cantidad: lista.length,
    };
  }
  if (esProduccion()) {
    return {
      ok: false,
      modo: "bloqueado",
      detalle:
        "ADMIN_EMAILS no está configurada en producción: el acceso al panel está cerrado para todos.",
      cantidad: 0,
    };
  }
  return {
    ok: true,
    modo: "desarrollo",
    detalle: `Sin ADMIN_EMAILS. En desarrollo entra ${POR_DEFECTO} y la primera cuenta creada.`,
    cantidad: 0,
  };
}

let avisado = false;

export async function esAdmin(email?: string | null): Promise<boolean> {
  const e = email?.trim().toLowerCase();
  if (!e) return false;

  const lista = configurados();

  // --- Camino normal: hay lista explícita. Solo entra quien está en ella. ---
  if (lista.length > 0) return lista.includes(e);

  // --- Sin lista. En producción esto es un error de configuración. ---
  if (esProduccion()) {
    if (!avisado) {
      avisado = true;
      console.error(
        "[admin] ADMIN_EMAILS no está configurada en producción. " +
          "El acceso al panel queda cerrado para todos hasta que se defina. " +
          'Seteala en Vercel → Settings → Environment Variables, por ejemplo: ADMIN_EMAILS="vos@jotaagency.org"',
      );
    }
    return false;
  }

  // --- Desarrollo: comodidad para levantar el proyecto sin configurar nada. ---
  if (e === POR_DEFECTO) return true;
  try {
    const primero = await prisma.user.findFirst({
      orderBy: { createdAt: "asc" },
      select: { email: true },
    });
    return primero?.email.toLowerCase() === e;
  } catch {
    return false;
  }
}
