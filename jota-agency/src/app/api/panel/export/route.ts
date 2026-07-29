import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { esAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

/** Escapa un valor para CSV y evita que Excel interprete fórmulas (=, +, -, @). */
function celda(v: unknown): string {
  let s = v == null ? "" : String(v);
  if (/^[=+\-@]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

export async function GET() {
  const session = await auth();
  if (!esAdmin(session?.user?.email)) {
    return new Response("No autorizado", { status: 403 });
  }

  const leads = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      name: true, email: true, empresa: true, password: true, createdAt: true,
      diagnosticos: { orderBy: { createdAt: "desc" }, take: 1, select: { consulta: true, createdAt: true } },
      _count: { select: { diagnosticos: true } },
    },
  });

  const encabezados = ["Nombre", "Empresa", "Email", "Origen", "Alta", "Diagnosticos", "Ultima consulta", "Fecha consulta"];
  const filas = leads.map((l) => [
    l.name ?? "",
    l.empresa ?? "",
    l.email,
    l.password ? "Email" : "Google",
    l.createdAt.toISOString().slice(0, 16).replace("T", " "),
    l._count.diagnosticos,
    l.diagnosticos[0]?.consulta ?? "",
    l.diagnosticos[0]?.createdAt.toISOString().slice(0, 16).replace("T", " ") ?? "",
  ]);

  // BOM para que Excel abra bien los acentos
  const csv = "﻿" + [encabezados, ...filas].map((f) => f.map(celda).join(",")).join("\r\n");
  const hoy = new Date().toISOString().slice(0, 10);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="leads-jota-${hoy}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
