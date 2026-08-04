import { prisma } from "@/lib/prisma";
import { SITIO_URL } from "@/lib/sitio";
import { paraTenant } from "./tenant";
import { avisar } from "./notificaciones";
import { derivar } from "./handoff";
import * as ev from "./eventos";

/**
 * Workflow 16 — Daily Lead Recovery.
 *
 * Este workflow es la razón por la que la promesa "zero lost inquiries" se
 * puede sostener sin cruzar los dedos.
 *
 * Busca lo que se rompió: mensajes entrantes que nunca llegaron a un estado
 * final, leads que quedaron sin próxima acción, conversaciones abiertas hace
 * días. Lo que puede reintentar, lo reintenta; lo que no, lo pone en manos de
 * una persona.
 */

export type Recuperacion = {
  sinEstadoFinal: number;
  derivados: number;
  leadsSinSeguimiento: number;
  conversacionesEstancadas: number;
};

export async function recuperar(tenantId: string): Promise<Recuperacion> {
  const correlationId = ev.nuevaCorrelacion();
  const t = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!t || t.estado === "pausado") {
    return { sinEstadoFinal: 0, derivados: 0, leadsSinSeguimiento: 0, conversacionesEstancadas: 0 };
  }

  await ev.inicio({ tenantId, workflow: "16-recuperacion", correlationId });
  const ahora = Date.now();
  const limiteSla = new Date(ahora - t.slaRespuestaMin * 60_000);

  // --- 1. Consultas guardadas que nunca se cerraron ---
  const huerfanos = await prisma.message.findMany({
    where: paraTenant(tenantId, {
      direccion: "entrante",
      estadoFinal: null,
      createdAt: { lt: limiteSla },
    }),
    orderBy: { createdAt: "asc" },
    take: 50,
    select: { id: true, conversationId: true, createdAt: true },
  });

  let derivados = 0;
  for (const m of huerfanos) {
    // No se reintenta el modelo a ciegas: si la consulta ya pasó el SLA, el
    // valor está en que la vea una persona, no en volver a jugar a la ruleta
    // con la API. Se marca como error y se deriva.
    await prisma.message.update({ where: { id: m.id }, data: { estadoFinal: "error" } });
    await derivar({
      t,
      conversationId: m.conversationId,
      motivo: "accion_fallida",
      detalle: `Recuperación: la consulta del ${m.createdAt.toISOString()} nunca se terminó de procesar.`,
    }).catch(() => {});
    derivados++;
  }

  if (huerfanos.length > 0) {
    await avisar({
      t, evento: "error",
      titulo: `${huerfanos.length} consulta${huerfanos.length === 1 ? "" : "s"} sin resolver`,
      detalle: "Quedaron guardadas pero sin respuesta. Ya están derivadas al equipo.",
      url: `${SITIO_URL}/ceo/agent/health`,
      clave: `recuperacion:${new Date().toISOString().slice(0, 13)}`,
    });
  }

  // --- 2. Leads calificados sin ningún seguimiento programado ---
  const sinSeguimiento = await prisma.lead.count({
    where: paraTenant(tenantId, {
      estado: { in: ["calificado", "nutrir"] },
      seguirEl: null,
      createdAt: { lt: new Date(ahora - 24 * 3600_000) },
      seguimientos: { none: { estado: "pendiente" } },
    }),
  });
  if (sinSeguimiento > 0) {
    await avisar({
      t, evento: "lead_sin_seguimiento",
      titulo: `${sinSeguimiento} lead${sinSeguimiento === 1 ? "" : "s"} sin seguimiento`,
      detalle: "Están calificados y hace más de un día que nadie los toca.",
      url: `${SITIO_URL}/ceo/agent/leads`,
      clave: `sinseg:${new Date().toISOString().slice(0, 10)}`,
    });
  }

  // --- 3. Conversaciones esperando a una persona hace demasiado ---
  const estancadas = await prisma.conversation.count({
    where: paraTenant(tenantId, {
      estado: "esperando_humano",
      ultimoMensajeAt: { lt: new Date(ahora - 48 * 3600_000) },
    }),
  });
  if (estancadas > 0) {
    await avisar({
      t, evento: "sin_resolver",
      titulo: `${estancadas} conversación${estancadas === 1 ? "" : "es"} esperando al equipo hace más de 48h`,
      detalle: "Están derivadas pero nadie respondió todavía.",
      url: `${SITIO_URL}/ceo/agent/inbox`,
      clave: `estancadas:${new Date().toISOString().slice(0, 10)}`,
    });
  }

  await ev.ok({ tenantId, workflow: "16-recuperacion", correlationId, referencia: `${huerfanos.length}` });

  return {
    sinEstadoFinal: huerfanos.length,
    derivados,
    leadsSinSeguimiento: sinSeguimiento,
    conversacionesEstancadas: estancadas,
  };
}
