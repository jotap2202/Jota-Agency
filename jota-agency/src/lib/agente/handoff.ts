import type { Tenant } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { SITIO_URL } from "@/lib/sitio";
import { paraTenant, destinatarios } from "./tenant";
import { avisar } from "./notificaciones";
import { cortarPorContacto } from "./seguimientos";
import * as ev from "./eventos";

/**
 * Workflow 13 — Human Handoff.
 *
 * Derivar no es solo mandar un aviso. Si la IA sigue contestando mientras el
 * dueño escribe su propia respuesta, el cliente recibe dos mensajes distintos
 * de la misma empresa y queda peor que antes. Por eso lo primero que pasa acá
 * es apagar la IA en esa conversación.
 */

export type MotivoHandoff =
  | "pedido_del_usuario"
  | "confianza_baja"
  | "sin_informacion"
  | "queja"
  | "emergencia"
  | "negociacion"
  | "descuento"
  | "privacidad"
  | "contrato"
  | "lead_valioso"
  | "riesgo_reputacional"
  | "fallos_repetidos"
  | "accion_fallida";

export const TEXTO_MOTIVO: Record<MotivoHandoff, string> = {
  pedido_del_usuario: "El contacto pidió hablar con una persona",
  confianza_baja: "El agente no tenía confianza suficiente en su respuesta",
  sin_informacion: "La respuesta no está en la información aprobada",
  queja: "Queja seria",
  emergencia: "Situación urgente",
  negociacion: "Negociación compleja",
  descuento: "Pidió un descuento no autorizado",
  privacidad: "Cuestión de privacidad o datos personales",
  contrato: "Decisión contractual",
  lead_valioso: "Oportunidad de alto valor",
  riesgo_reputacional: "Riesgo para la reputación del negocio",
  fallos_repetidos: "Dos respuestas seguidas no resolvieron la consulta",
  accion_fallida: "El agente no pudo completar una acción",
};

/** Mensaje que ve el cliente. Claro, sin excusas y sin prometer plazos falsos. */
export function textoParaElCliente(t: Tenant, idioma: string, abierto: boolean): string {
  const es = idioma.startsWith("es");
  if (es) {
    return abierto
      ? `Prefiero pasarte con alguien del equipo de ${t.nombreNegocio} para darte una respuesta exacta. Te escriben en un rato.`
      : `Prefiero pasarte con alguien del equipo de ${t.nombreNegocio} para darte una respuesta exacta. Te responden apenas abran.`;
  }
  return abierto
    ? `Let me pass this to someone on the ${t.nombreNegocio} team so you get an exact answer. They'll be in touch shortly.`
    : `Let me pass this to someone on the ${t.nombreNegocio} team so you get an exact answer. They'll reply when they're back in the office.`;
}

export type ResultadoHandoff = { ok: true; yaEstaba: boolean };

export async function derivar(o: {
  t: Tenant;
  conversationId: string;
  motivo: MotivoHandoff;
  detalle?: string;
  leadId?: string | null;
  contactId?: string | null;
  quien?: "ia" | "humano";
}): Promise<ResultadoHandoff> {
  const { t, conversationId, motivo } = o;
  const correlationId = ev.nuevaCorrelacion();

  const conv = await prisma.conversation.findFirst({
    where: paraTenant(t.id, { id: conversationId }),
    include: { contacto: true },
  });
  if (!conv) throw new Error("conversación inexistente para este tenant");
  if (conv.estado === "esperando_humano" && !conv.iaActiva) return { ok: true, yaEstaba: true };

  // 1. Apagar la IA. Primero esto, antes que cualquier aviso.
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { estado: "esperando_humano", iaActiva: false },
  });

  // 2. Frenar seguimientos automáticos: los retoma la persona.
  if (o.contactId ?? conv.contactId) {
    await cortarPorContacto(t.id, o.contactId ?? conv.contactId, "humano");
  }

  // 3. Asignar a alguien concreto, si hay equipo cargado.
  const equipo = await destinatarios(t.id);
  if (equipo.length > 0 && !conv.asignadoA) {
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { asignadoA: equipo[0].id },
    });
  }

  // 4. Avisar, con el resumen de la conversación.
  const resumen = await resumirConversacion(t.id, conversationId);
  await avisar({
    t,
    evento: "handoff",
    titulo: `Handoff: ${TEXTO_MOTIVO[motivo]}`,
    detalle: `${conv.contacto.nombre ?? "Contacto sin nombre"} · ${conv.canal}\n${o.detalle ?? ""}\n\n${resumen}`.trim(),
    url: `${SITIO_URL}/ceo/agent/inbox/${conversationId}`,
    clave: `handoff:${conversationId}`,
  });

  await ev.auditar({
    tenantId: t.id,
    actorTipo: o.quien ?? "ia",
    accion: "conversacion.handoff",
    entidad: "Conversation",
    entidadId: conversationId,
    metadatos: { motivo },
  });
  await ev.ok({ tenantId: t.id, workflow: "13-handoff", correlationId, referencia: conversationId });

  return { ok: true, yaEstaba: false };
}

/** Devolver la conversación a la IA. Lo hace una persona desde el panel. */
export async function devolverALaIa(tenantId: string, conversationId: string, quien: string): Promise<boolean> {
  const r = await prisma.conversation.updateMany({
    where: paraTenant(tenantId, { id: conversationId }),
    data: { estado: "abierta", iaActiva: true },
  });
  if (r.count > 0) {
    await ev.auditar({
      tenantId, actorTipo: "humano", actorId: quien,
      accion: "conversacion.devuelta_ia", entidad: "Conversation", entidadId: conversationId,
    });
  }
  return r.count > 0;
}

/**
 * Resumen de texto plano para el aviso. Se arma con los mensajes reales, sin
 * pasar por el modelo: un resumen generado costaría tokens y podría inventar,
 * y acá lo que se necesita es exactitud.
 */
export async function resumirConversacion(tenantId: string, conversationId: string, maxMensajes = 8): Promise<string> {
  const mensajes = await prisma.message.findMany({
    where: paraTenant(tenantId, { conversationId }),
    orderBy: { createdAt: "desc" },
    take: maxMensajes,
    select: { direccion: true, remitente: true, contenido: true },
  });
  return mensajes
    .reverse()
    .map((m) => `${m.remitente === "contacto" ? "Cliente" : m.remitente === "agente" ? "IA" : "Equipo"}: ${m.contenido.slice(0, 300)}`)
    .join("\n");
}
