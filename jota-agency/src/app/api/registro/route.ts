import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { limitar } from "@/lib/rate-limit";

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "sin-ip";
  const { permitido, reintentarEnSeg } = limitar(`registro:${ip}`, 5, 10 * 60 * 1000);
  if (!permitido) {
    return Response.json(
      { error: "Demasiados intentos. Probá de nuevo en unos minutos." },
      { status: 429, headers: { "Retry-After": String(reintentarEnSeg) } },
    );
  }

  let body: { name?: string; email?: string; empresa?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  const name = String(body.name ?? "").trim();
  const email = String(body.email ?? "").trim().toLowerCase();
  const empresa = String(body.empresa ?? "").trim();
  const password = String(body.password ?? "");

  if (!name || !empresa || !email.includes("@") || !email.includes(".")) {
    return Response.json({ error: "Completá nombre, email y empresa." }, { status: 400 });
  }
  if (password.length < 6) {
    return Response.json({ error: "La contraseña debe tener al menos 6 caracteres." }, { status: 400 });
  }

  const existe = await prisma.user.findUnique({ where: { email } });
  if (existe) {
    return Response.json({ error: "Ya existe una cuenta con ese email. Probá entrar." }, { status: 409 });
  }

  await prisma.user.create({
    data: { name, email, empresa, password: await bcrypt.hash(password, 10) },
  });

  return Response.json({ ok: true });
}
