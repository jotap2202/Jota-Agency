import { prisma } from "@/lib/prisma";
import { ejecutarPendientes } from "@/lib/agente/seguimientos";
import { despachar } from "@/lib/agente/email";
import { recuperar } from "@/lib/agente/recuperacion";
import { revisar } from "@/lib/agente/salud";
import { avisar } from "@/lib/agente/notificaciones";
import { SITIO_URL } from "@/lib/sitio";
import { redactar } from "@/lib/agente/seguridad";
import * as ev from "@/lib/agente/eventos";

/**
 * El latido del sistema. Corre cada 15 minutos (ver vercel.json).
 *
 * Hace, en este orden y para cada negocio activo:
 *   12 — seguimientos que vencen
 *   11 — despachar la bandeja de salida
 *   16 — recuperar consultas que quedaron sin cerrar
 *   19 — health check (solo avisa si algo se rompió)
 *
 * Está protegido con CRON_SECRET. Sin eso, cualquiera puede dispararlo en
 * loop y hacer que se manden los seguimientos de todos los clientes de golpe.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function autorizado(req: Request): boolean {
  const secreto = process.env.CRON_SECRET?.trim();
  // Vercel Cron manda este header automáticamente cuando hay CRON_SECRET.
  const auth = req.headers.get("authorization") ?? "";
  if (secreto) return auth === `Bearer ${secreto}`;
  // Sin secreto configurado, solo se acepta el user-agent de Vercel Cron.
  // No es una gran defensa: por eso el health check avisa que falta el secreto.
  return (req.headers.get("user-agent") ?? "").includes("vercel-cron");
}

export async function GET(req: Request) {
  if (!autorizado(req)) return Response.json({ error: "No autorizado" }, { status: 401 });

  const correlationId = ev.nuevaCorrelacion();
  const tenants = await prisma.tenant.findMany({
    where: { estado: "activo" },
    select: { id: true, slug: true, nombreNegocio: true },
  });

  const resumen: Record<string, unknown>[] = [];

  for (const t of tenants) {
    const fila: Record<string, unknown> = { tenant: t.slug };
    try {
      fila.seguimientos = await ejecutarPendientes(t.id);
      fila.emails = await despachar(t.id);
      fila.recuperacion = await recuperar(t.id);

      const salud = await revisar(t.id);
      fila.salud = salud.estado;
      if (salud.estado === "roto") {
        const rotos = salud.chequeos.filter((c) => c.estado === "roto");
        await avisar({
          t: (await prisma.tenant.findUnique({ where: { id: t.id } }))!,
          evento: "error",
          titulo: "El agente tiene un problema que lo deja sin funcionar",
          detalle: rotos.map((c) => `${c.titulo}: ${c.detalle}`).join(" · "),
          url: `${SITIO_URL}/ceo/agent/health`,
          // Una alerta por día como máximo: si está roto, no hace falta que
          // suene cada 15 minutos.
          clave: `salud:${t.id}:${new Date().toISOString().slice(0, 10)}`,
        });
      }
    } catch (e) {
      fila.error = redactar(e, 200);
      await ev.fallo({ tenantId: t.id, workflow: "19-salud", correlationId, error: e });
    }
    resumen.push(fila);
  }

  await ev.ok({ workflow: "19-salud", correlationId, referencia: `${tenants.length} tenants` });
  return Response.json({ ok: true, tenants: tenants.length, resumen }, { headers: { "Cache-Control": "no-store" } });
}
