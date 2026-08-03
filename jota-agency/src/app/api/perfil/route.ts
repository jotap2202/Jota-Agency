import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ERRORES } from "@/lib/errores-api";
import { idiomaActual } from "@/lib/idioma-servidor";

export const dynamic = "force-dynamic";

/**
 * Completa los datos que Google no nos da.
 *
 * Google devuelve nombre, email y foto, pero no la empresa — y para JOTA
 * la empresa es el dato que convierte una cuenta en un lead útil. Esta ruta
 * la guarda después de que la persona entró.
 */
export async function POST(req: Request) {
  const e = ERRORES[await idiomaActual()];
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: e.sesion }, { status: 401 });
  }

  let body: { empresa?: string; name?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: e.cuerpo }, { status: 400 });
  }

  const empresa = String(body.empresa ?? "").trim().slice(0, 120);
  if (!empresa) {
    return Response.json({ error: e.empresaVacia }, { status: 400 });
  }

  const name = String(body.name ?? "").trim().slice(0, 120);

  await prisma.user.update({
    where: { id: session.user.id },
    data: { empresa, ...(name ? { name } : {}) },
  });

  return Response.json({ ok: true });
}
