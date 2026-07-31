import { cerrarSesion } from "@/lib/auth";

export async function POST() {
  await cerrarSesion();
  return Response.json({ ok: true });
}
