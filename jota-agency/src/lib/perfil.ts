import { prisma } from "@/lib/prisma";

/**
 * ¿La cuenta todavía no dejó el nombre de su empresa?
 *
 * Pasa con quien se registra por Google: Google nos da nombre, email y foto,
 * pero no la empresa. Sin ese dato el lead llega a medias, así que se lo
 * pedimos en un paso corto antes del diagnóstico.
 */
export async function faltaEmpresa(email?: string | null): Promise<boolean> {
  const e = email?.trim().toLowerCase();
  if (!e) return false;
  try {
    const u = await prisma.user.findUnique({ where: { email: e }, select: { empresa: true } });
    return Boolean(u) && !u?.empresa?.trim();
  } catch {
    return false;
  }
}
