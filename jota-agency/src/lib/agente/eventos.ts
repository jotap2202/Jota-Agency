import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { redactar } from "./seguridad";

/**
 * Workflow 18 — Error Handler and Dead-Letter Queue.
 *
 * Todo paso del sistema deja rastro acá. Es lo que permite responder
 * "¿qué pasó con la consulta de las 3am?" sin adivinar, y lo que hace que un
 * error no signifique una consulta perdida: queda en la DLQ, se reintenta con
 * backoff y, si sigue fallando, se avisa.
 *
 * En `referencia` va el ID de la fila, NUNCA el contenido. Los logs no son
 * lugar para los datos de los clientes de otro.
 */

export type Workflow =
  | "01-tenant-config"
  | "02-chat-intake"
  | "03-form-intake"
  | "04-email-intake"
  | "05-orquestador"
  | "06-conocimiento"
  | "07-calificacion"
  | "08-crm-sync"
  | "09-disponibilidad"
  | "10-agendar"
  | "11-email-saliente"
  | "12-seguimientos"
  | "13-handoff"
  | "14-notificaciones"
  | "15-kb-sync"
  | "16-recuperacion"
  | "17-metricas"
  | "18-errores"
  | "19-salud"
  | "20-onboarding";

export function nuevaCorrelacion(): string {
  return randomUUID();
}

/**
 * Backoff exponencial: el 1er reintento a los 4 minutos, el 2do a los 16.
 * Al tercer fallo se deja de insistir y el caso pasa a la DLQ.
 */
export const MAX_INTENTOS = 3;
export function proximoIntentoEn(intentos: number, desde = new Date()): Date {
  const minutos = Math.pow(4, Math.max(1, intentos));
  return new Date(desde.getTime() + minutos * 60_000);
}

type Registro = {
  tenantId?: string | null;
  workflow: Workflow;
  correlationId: string;
  referencia?: string | null;
};

/** Marca que un workflow empezó. Sirve para detectar los que nunca terminaron. */
export async function inicio(r: Registro): Promise<void> {
  await guardar({ ...r, tipo: "inicio", estado: "en_curso" });
}

export async function ok(r: Registro): Promise<void> {
  await guardar({ ...r, tipo: "ok", estado: "ok" });
}

/**
 * Registra un fallo y lo deja listo para reintento. Devuelve si todavía queda
 * margen o si el asunto pasa a la dead-letter queue.
 */
export async function fallo(
  r: Registro & { error: unknown; intentos?: number },
): Promise<{ reintentar: boolean; intentos: number }> {
  const intentos = (r.intentos ?? 0) + 1;
  const alaDlq = intentos >= MAX_INTENTOS;
  await guardar({
    ...r,
    tipo: alaDlq ? "dlq" : "reintento",
    estado: "error",
    mensajeError: redactar(r.error instanceof Error ? r.error.message : r.error, 500),
    intentos,
    proximoIntento: alaDlq ? null : proximoIntentoEn(intentos),
  });
  return { reintentar: !alaDlq, intentos };
}

async function guardar(d: {
  tenantId?: string | null;
  workflow: Workflow;
  tipo: string;
  estado: string;
  correlationId: string;
  referencia?: string | null;
  mensajeError?: string;
  intentos?: number;
  proximoIntento?: Date | null;
}): Promise<void> {
  try {
    await prisma.workflowEvent.create({
      data: {
        tenantId: d.tenantId ?? null,
        workflow: d.workflow,
        tipo: d.tipo,
        estado: d.estado,
        correlationId: d.correlationId,
        referencia: d.referencia ?? null,
        mensajeError: d.mensajeError,
        intentos: d.intentos ?? 0,
        proximoIntento: d.proximoIntento ?? null,
      },
    });
  } catch (e) {
    // Si ni siquiera se puede escribir la traza, no se puede hacer nada más
    // que dejarlo en el log del servidor. No se rompe el pedido del cliente
    // por no poder auditar.
    console.error("[eventos] no se pudo guardar la traza", redactar(e));
  }
}

/** Lo que está esperando reintento y ya le tocó. */
export async function pendientesDeReintento(limite = 25) {
  return prisma.workflowEvent.findMany({
    where: { tipo: "reintento", proximoIntento: { lte: new Date() } },
    orderBy: { proximoIntento: "asc" },
    take: limite,
  });
}

/** Lo que se rindió y necesita una persona. */
export async function enDlq(tenantId?: string, limite = 50) {
  return prisma.workflowEvent.findMany({
    where: { tipo: "dlq", ...(tenantId ? { tenantId } : {}) },
    orderBy: { createdAt: "desc" },
    take: limite,
  });
}

// ---------------------------------------------------------------------------
//  Auditoría
// ---------------------------------------------------------------------------

/**
 * Quién hizo qué. La IA también es un actor: si mandó un email o creó una
 * cita, tiene que quedar escrito que lo hizo ella y no una persona.
 */
export async function auditar(d: {
  tenantId: string;
  actorTipo: "ia" | "humano" | "sistema";
  actorId?: string | null;
  accion: string;
  entidad: string;
  entidadId?: string | null;
  metadatos?: Record<string, unknown>;
}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        tenantId: d.tenantId,
        actorTipo: d.actorTipo,
        actorId: d.actorId ?? null,
        accion: d.accion,
        entidad: d.entidad,
        entidadId: d.entidadId ?? null,
        metadatos: (d.metadatos ?? {}) as object,
      },
    });
  } catch (e) {
    console.error("[auditoria] no se pudo guardar", redactar(e));
  }
}
