import { prisma } from "@/lib/prisma";

/**
 * Quién puede entrar al panel de leads.
 *
 * Hay dos formas de tener acceso:
 *
 * 1. Estar en la lista ADMIN_EMAILS (separada por comas). Si definís esta
 *    variable en Vercel, manda solo ella y nadie más entra:
 *      ADMIN_EMAILS="vos@jota.agency,socio@jota.agency"
 *
 * 2. Sin ADMIN_EMAILS definida: entra el mail por defecto y, además, la
 *    PRIMERA cuenta creada en el sitio — que es la del dueño, porque es
 *    quien probó la web antes de publicarla. Así el panel funciona sin
 *    configurar nada.
 */
const POR_DEFECTO = "jotanico17@gmail.com";

function lista(): string[] {
  return (process.env.ADMIN_EMAILS || POR_DEFECTO)
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/** ¿Se configuró una lista explícita? Si sí, no se usa el modo "primer usuario". */
const listaExplicita = () => Boolean(process.env.ADMIN_EMAILS?.trim());

export async function esAdmin(email?: string | null): Promise<boolean> {
  const e = email?.trim().toLowerCase();
  if (!e) return false;

  if (lista().includes(e)) return true;
  if (listaExplicita()) return false;

  // Modo sin configurar: el dueño es quien creó la primera cuenta del sitio.
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
