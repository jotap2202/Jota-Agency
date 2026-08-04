import type { Message, Tenant } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { paraTenant } from "./tenant";
import { claveIdempotencia } from "./normalizar";
import { normalizarEmail } from "./seguridad";
import type { ConsultaEntrante } from "./tipos";
import * as ev from "./eventos";

/**
 * Intake — el corazón del "ninguna consulta desaparece en silencio".
 *
 * EL MENSAJE SE GUARDA ANTES DE PROCESARLO. Siempre. Si después falla el
 * modelo, se cae la API de Anthropic o explota el servidor a la mitad, la
 * consulta ya está en la base con su estado sin cerrar, y el workflow de
 * recuperación la encuentra y la reprocesa.
 *
 * Al revés —procesar y guardar al final— cada error es una consulta perdida
 * de la que nadie se entera. Que es exactamente lo que este producto promete
 * que no pasa.
 */

export type ResultadoIntake = {
  contactId: string;
  conversationId: string;
  mensaje: Message;
  duplicado: boolean;
  /** Cuántos mensajes escribió esta persona en la conversación, contando este. */
  mensajesDelContacto: number;
  contactoPrevio: boolean;
  correlationId: string;
};

export async function recibir(t: Tenant, c: ConsultaEntrante): Promise<ResultadoIntake> {
  const correlationId = ev.nuevaCorrelacion();
  const workflow = workflowDe(c.canal);
  await ev.inicio({ tenantId: t.id, workflow, correlationId });

  const clave = claveIdempotencia({
    tenantId: t.id,
    canal: c.canal,
    idExterno: c.idExterno,
    email: c.email ?? null,
    mensaje: c.mensaje,
    recibidoEn: c.recibidoEn,
  });

  // --- 1. ¿Ya lo procesamos? ---
  const yaVisto = await prisma.message.findUnique({
    where: { tenantId_claveIdempotencia: { tenantId: t.id, claveIdempotencia: clave } },
  });
  if (yaVisto) {
    const previos = await contarDelContacto(t.id, yaVisto.conversationId);
    const conv = await prisma.conversation.findUnique({
      where: { id: yaVisto.conversationId },
      select: { contactId: true },
    });
    await ev.ok({ tenantId: t.id, workflow, correlationId, referencia: yaVisto.id });
    return {
      contactId: conv?.contactId ?? "",
      conversationId: yaVisto.conversationId,
      mensaje: yaVisto,
      duplicado: true,
      mensajesDelContacto: previos,
      contactoPrevio: true,
      correlationId,
    };
  }

  // --- 2. Contacto: buscar o crear ---
  const { contactId, previo } = await buscarOCrearContacto(t.id, c);

  // --- 3. Conversación: continuar el hilo o abrir uno ---
  const conversationId = await buscarOCrearConversacion(t.id, contactId, c);

  // --- 4. GUARDAR. Punto sin retorno: de acá en adelante la consulta existe. ---
  const mensaje = await prisma.message.create({
    data: {
      tenantId: t.id,
      conversationId,
      direccion: "entrante",
      remitente: "contacto",
      contenido: c.mensaje,
      formato: "texto",
      idExterno: c.idExterno ?? null,
      claveIdempotencia: clave,
      entrega: "entregado",
      // Sin estado final todavía: es justamente lo que hace que recuperación
      // pueda encontrarla si el proceso se corta después de este punto.
      estadoFinal: null,
    },
  });

  await prisma.conversation.update({
    where: { id: conversationId },
    data: { ultimoMensajeAt: c.recibidoEn, estado: "abierta" },
  });

  const mensajesDelContacto = await contarDelContacto(t.id, conversationId);
  await ev.ok({ tenantId: t.id, workflow, correlationId, referencia: mensaje.id });

  return {
    contactId,
    conversationId,
    mensaje,
    duplicado: false,
    mensajesDelContacto,
    contactoPrevio: previo,
    correlationId,
  };
}

function workflowDe(canal: string): ev.Workflow {
  if (canal === "website_chat") return "02-chat-intake";
  if (canal === "web_form") return "03-form-intake";
  if (canal === "email") return "04-email-intake";
  return "02-chat-intake";
}

async function contarDelContacto(tenantId: string, conversationId: string): Promise<number> {
  return prisma.message.count({
    where: paraTenant(tenantId, { conversationId, direccion: "entrante", remitente: "contacto" }),
  });
}

/**
 * Identidad del contacto.
 *
 * Se busca por email y, si no hay, por teléfono. Si no hay ninguno de los dos
 * —el caso normal del chat web: alguien escribe sin identificarse— se crea un
 * contacto anónimo. NO se intenta adivinar quién es por el nombre: dos "John"
 * distintos fusionados es peor que dos contactos que después alguien une.
 */
async function buscarOCrearContacto(
  tenantId: string,
  c: ConsultaEntrante,
): Promise<{ contactId: string; previo: boolean }> {
  const email = normalizarEmail(c.email);

  if (email) {
    const existente = await prisma.contact.findUnique({
      where: { tenantId_email: { tenantId, email } },
    });
    if (existente) {
      await completarVacios(existente.id, {
        nombre: existente.nombre ? null : c.nombre ?? null,
        telefono: existente.telefono ? null : c.telefono ?? null,
        empresa: existente.empresa ? null : c.empresa ?? null,
      });
      return { contactId: existente.id, previo: true };
    }
  } else if (c.telefono) {
    const porTel = await prisma.contact.findFirst({
      where: paraTenant(tenantId, { telefono: c.telefono }),
    });
    if (porTel) return { contactId: porTel.id, previo: true };
  }

  const nuevo = await prisma.contact.create({
    data: {
      tenantId,
      nombre: c.nombre ?? null,
      apellido: c.apellido ?? null,
      email,
      telefono: c.telefono ?? null,
      empresa: c.empresa ?? null,
    },
  });
  return { contactId: nuevo.id, previo: false };
}

/** Completa solo los campos vacíos: nunca pisa un dato que ya teníamos. */
async function completarVacios(id: string, datos: Record<string, string | null>): Promise<void> {
  const limpio = Object.fromEntries(Object.entries(datos).filter(([, v]) => v));
  if (Object.keys(limpio).length > 0) {
    await prisma.contact.update({ where: { id }, data: limpio });
  }
}

async function buscarOCrearConversacion(
  tenantId: string,
  contactId: string,
  c: ConsultaEntrante,
): Promise<string> {
  const existente = await prisma.conversation.findFirst({
    where: paraTenant(tenantId, { canal: c.canal, hiloExterno: c.hiloExterno }),
  });
  if (existente) return existente.id;

  const creada = await prisma.conversation.create({
    data: {
      tenantId,
      contactId,
      canal: c.canal,
      hiloExterno: c.hiloExterno,
      estado: "abierta",
      iaActiva: true,
      ultimoMensajeAt: c.recibidoEn,
    },
  });
  return creada.id;
}

/**
 * Cierra el círculo: marca con qué estado terminó la consulta.
 * Mientras `estadoFinal` sea null, para el sistema la consulta sigue abierta.
 */
export async function marcarEstadoFinal(
  tenantId: string,
  messageId: string,
  estado: string,
): Promise<void> {
  await prisma.message.updateMany({
    where: paraTenant(tenantId, { id: messageId }),
    data: { estadoFinal: estado },
  });
}

/** Guarda lo que respondió el agente (o una persona). */
export async function guardarRespuesta(o: {
  tenantId: string;
  conversationId: string;
  contenido: string;
  remitente: "agente" | "humano" | "sistema";
  generadoPorIa?: boolean;
  confianza?: number | null;
  fuentes?: string[];
  tokensEntrada?: number;
  tokensSalida?: number;
  entrega?: string;
}): Promise<Message> {
  const m = await prisma.message.create({
    data: {
      tenantId: o.tenantId,
      conversationId: o.conversationId,
      direccion: "saliente",
      remitente: o.remitente,
      contenido: o.contenido,
      generadoPorIa: o.generadoPorIa ?? o.remitente === "agente",
      confianza: o.confianza ?? null,
      fuentes: o.fuentes ?? [],
      tokensEntrada: o.tokensEntrada ?? 0,
      tokensSalida: o.tokensSalida ?? 0,
      entrega: o.entrega ?? "entregado",
    },
  });
  await prisma.conversation.update({
    where: { id: o.conversationId },
    data: { ultimoMensajeAt: new Date() },
  });
  return m;
}
