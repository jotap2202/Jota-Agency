import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
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
