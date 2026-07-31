import { passwordValida, crearSesion } from "@/lib/auth";
import { limitar } from "@/lib/rate-limit";

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "sin-ip";
  const { permitido, reintentarEnSeg } = limitar(`login:${ip}`, 8, 10 * 60 * 1000);
  if (!permitido) {
    return Response.json(
      { error: "Demasiados intentos. Probá de nuevo en unos minutos." },
      { status: 429, headers: { "Retry-After": String(reintentarEnSeg) } },
    );
  }

  let body: { password?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  if (!passwordValida(String(body.password ?? ""))) {
    return Response.json({ error: "Contraseña incorrecta." }, { status: 401 });
  }

  await crearSesion();
  return Response.json({ ok: true });
}
