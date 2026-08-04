import type { Tenant } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { paraTenant } from "./tenant";
import { encolar, estaSuprimido } from "./email";
import * as ev from "./eventos";

/**
 * Workflow 12 — Follow-Up Scheduler.
 *
 * La parte difícil de una secuencia de seguimiento no es mandarla: es
 * FRENARLA. Un sistema que sigue escribiéndole a alguien que ya contestó, ya
 * agendó o ya pidió que lo dejen en paz no es un seguimiento, es spam, y
 * quema la reputación del dominio del cliente.
 *
 * Por eso los cortes están en un solo lugar (`cortar`) y se llaman desde todos
 * los caminos que corresponden.
 */

export type MotivoCorte =
  | "respondio" | "agendo" | "baja" | "cliente" | "spam" | "humano" | "rebote" | "manual";

/** Programa la secuencia del tenant para un lead. Idempotente por paso. */
export async function programar(t: Tenant, leadId: string, desde = new Date()): Promise<number> {
  const horas = t.secuenciaHoras.length ? t.secuenciaHoras : [24, 72, 168];
  let creados = 0;

  for (let i = 0; i < horas.length; i++) {
    const cuando = new Date(desde.getTime() + horas[i] * 3600_000);
    try {
      await prisma.followUp.create({
        data: { tenantId: t.id, leadId, paso: i + 1, programadoEn: cuando, estado: "pendiente" },
      });
      creados++;
    } catch {
      // Ya existía ese paso para ese lead (@@unique): no se duplica.
    }
  }
  return creados;
}

/**
 * Corta todos los seguimientos pendientes de un lead.
 * Devuelve cuántos frenó, para poder verlo en las pruebas y en la auditoría.
 */
export async function cortar(tenantId: string, leadId: string, motivo: MotivoCorte): Promise<number> {
  const r = await prisma.followUp.updateMany({
    where: paraTenant(tenantId, { leadId, estado: "pendiente" }),
    data: { estado: "cancelado", motivoCancelacion: motivo },
  });
  if (r.count > 0) {
    await ev.auditar({
      tenantId, actorTipo: "sistema", accion: "seguimiento.cortado",
      entidad: "Lead", entidadId: leadId, metadatos: { motivo, cancelados: r.count },
    });
  }
  return r.count;
}

/** Corta por contacto: sirve para bajas y rebotes, que llegan por email. */
export async function cortarPorContacto(tenantId: string, contactId: string, motivo: MotivoCorte): Promise<number> {
  const leads = await prisma.lead.findMany({
    where: paraTenant(tenantId, { contactId }),
    select: { id: true },
  });
  let n = 0;
  for (const l of leads) n += await cortar(tenantId, l.id, motivo);
  return n;
}

/**
 * Ejecuta lo que vence. Lo llama el cron.
 *
 * Antes de cada envío se vuelve a chequear todo: el lead pudo cambiar de
 * estado, el contacto pudo darse de baja y la conversación pudo haber sido
 * tomada por una persona desde que el paso se programó.
 */
export async function ejecutarPendientes(tenantId: string, limite = 20): Promise<{ enviados: number; cortados: number }> {
  const correlationId = ev.nuevaCorrelacion();
  const t = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!t || t.estado === "pausado") return { enviados: 0, cortados: 0 };

  const vencidos = await prisma.followUp.findMany({
    where: paraTenant(tenantId, { estado: "pendiente", programadoEn: { lte: new Date() } }),
    orderBy: { programadoEn: "asc" },
    take: limite,
    include: {
      lead: {
        include: {
          contacto: true,
          conversacion: { select: { id: true, iaActiva: true, estado: true } },
        },
      },
    },
  });

  let enviados = 0;
  let cortados = 0;

  for (const f of vencidos) {
    const lead = f.lead;
    const c = lead.contacto;

    const motivo = motivoDeCorte(lead.estado, lead.conversacion, c.noContactar);
    if (motivo) {
      await cortar(tenantId, lead.id, motivo);
      cortados++;
      continue;
    }
    if (!c.email || (await estaSuprimido(tenantId, c.email))) {
      await cortar(tenantId, lead.id, "baja");
      cortados++;
      continue;
    }

    const ultimo = f.paso >= (t.secuenciaHoras.length || 3);
    const r = await encolar(t, {
      tenantId,
      para: c.email,
      plantilla: ultimo ? "reactivacion" : "seguimiento",
      datos: {
        nombre: c.nombre ?? "",
        mensaje: textoDelPaso(f.paso, ultimo, lead.servicio),
      },
      clase: "transaccional",
      claveIdempotencia: `seguimiento:${lead.id}:${f.paso}`,
    });

    await prisma.followUp.update({
      where: { id: f.id },
      data: {
        estado: r.ok ? "enviado" : "cancelado",
        motivoCancelacion: r.ok ? null : "baja",
        enviadoEn: r.ok ? new Date() : null,
      },
    });
    if (r.ok) enviados++;
    else cortados++;
  }

  await ev.ok({ tenantId, workflow: "12-seguimientos", correlationId, referencia: `${enviados}/${vencidos.length}` });
  return { enviados, cortados };
}

function motivoDeCorte(
  estadoLead: string,
  conv: { iaActiva: boolean; estado: string } | null,
  noContactar: boolean,
): MotivoCorte | null {
  if (noContactar) return "baja";
  if (estadoLead === "ganado") return "cliente";
  if (estadoLead === "descartado") return "spam";
  if (estadoLead === "perdido") return "manual";
  if (conv && !conv.iaActiva) return "humano";
  if (conv && conv.estado === "esperando_humano") return "humano";
  return null;
}

function textoDelPaso(paso: number, ultimo: boolean, servicio: string | null): string {
  const que = servicio ? `about ${servicio}` : "about your inquiry";
  if (ultimo) {
    return `We never heard back ${que}, so we'll stop reaching out. If the timing gets better, just reply to this email and we'll pick it right back up.`;
  }
  if (paso === 1) {
    return `Just following up ${que}. Is this still something you're looking into? Happy to answer anything before you decide.`;
  }
  return `Checking in one more time ${que}. If now isn't the right moment, tell me when to circle back and I'll set a reminder — otherwise I'll stop here.`;
}
