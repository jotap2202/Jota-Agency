import { createHash, randomUUID } from "node:crypto";
import { limpiarMensaje, normalizarEmail, normalizarTelefono } from "./seguridad";
import type { Canal, ConsultaEntrante } from "./tipos";

/**
 * Adaptadores de canal → formato interno común.
 *
 * Toda la inteligencia del sistema trabaja sobre `ConsultaEntrante`. Sumar
 * WhatsApp o Instagram mañana es escribir una función acá; el orquestador,
 * el scoring y el panel no se enteran.
 */

/**
 * Clave de deduplicación.
 *
 * Con id externo (Message-ID de un email, id de mensaje de WhatsApp) alcanza
 * con eso: es único de verdad. Sin id externo —un formulario web, por
 * ejemplo— se hashea el contenido junto con una ventana de 5 minutos: si la
 * persona hace doble clic en "Enviar", o el navegador reintenta el POST, se
 * guarda una sola consulta; si vuelve mañana con el mismo texto, esa sí es
 * una consulta nueva y entra.
 */
export function claveIdempotencia(c: {
  tenantId: string;
  canal: Canal;
  idExterno?: string;
  email?: string | null;
  mensaje: string;
  recibidoEn: Date;
}): string {
  const base = c.idExterno
    ? `${c.tenantId}|${c.canal}|${c.idExterno}`
    : [
        c.tenantId,
        c.canal,
        c.email ?? "",
        c.mensaje.trim().slice(0, 500),
        Math.floor(c.recibidoEn.getTime() / (5 * 60_000)),
      ].join("|");
  return createHash("sha256").update(base).digest("base64url").slice(0, 43);
}

// ---------------------------------------------------------------------------
//  Chat del sitio
// ---------------------------------------------------------------------------

export function desdeChat(
  tenantId: string,
  b: Record<string, unknown>,
): ConsultaEntrante | { error: string } {
  const mensaje = limpiarMensaje(String(b.mensaje ?? b.message ?? ""));
  if (!mensaje) return { error: "mensaje vacío" };
  // La sesión la genera el widget y vive en el navegador: es lo que agrupa
  // los mensajes de una misma visita en una sola conversación.
  const sesion = typeof b.sesion === "string" && b.sesion.length >= 8 ? b.sesion.slice(0, 64) : randomUUID();

  return {
    tenantId,
    canal: "website_chat",
    hiloExterno: sesion,
    nombre: texto(b.nombre ?? b.name, 80),
    email: normalizarEmail(texto(b.email, 254)) ?? undefined,
    telefono: normalizarTelefono(texto(b.telefono ?? b.phone, 40)) ?? undefined,
    mensaje,
    recibidoEn: new Date(),
    metadatos: { url: texto(b.url, 300), referrer: texto(b.referrer, 300) },
  };
}

// ---------------------------------------------------------------------------
//  Formulario de contacto / pedido de presupuesto
// ---------------------------------------------------------------------------

export function desdeFormulario(
  tenantId: string,
  b: Record<string, unknown>,
): ConsultaEntrante | { error: string } {
  const email = normalizarEmail(texto(b.email, 254));
  const nombre = texto(b.nombre ?? b.name, 80);
  const cuerpo = limpiarMensaje(String(b.mensaje ?? b.message ?? b.details ?? ""));

  // Un formulario sin forma de contacto no sirve para nada: se rechaza en la
  // puerta en vez de crear un lead imposible de seguir.
  if (!email && !texto(b.telefono ?? b.phone, 40)) return { error: "hace falta email o teléfono" };
  if (!cuerpo && !texto(b.servicio ?? b.service, 200)) return { error: "el formulario vino vacío" };

  // Los campos sueltos del formulario se arman como texto: así el agente ve
  // lo mismo que vería si la persona lo hubiera escrito en el chat, y la
  // verificación de "no inventes datos" tiene contra qué comparar.
  const partes = [
    cuerpo,
    campo("Service", b.servicio ?? b.service),
    campo("Budget", b.presupuesto ?? b.budget),
    campo("Timeline", b.plazo ?? b.timeline),
    campo("Location", b.ubicacion ?? b.location),
    campo("Company", b.empresa ?? b.company),
  ].filter(Boolean);

  return {
    tenantId,
    canal: "web_form",
    hiloExterno: `form:${email ?? texto(b.telefono ?? b.phone, 40)}:${Date.now()}`,
    nombre,
    email: email ?? undefined,
    telefono: normalizarTelefono(texto(b.telefono ?? b.phone, 40)) ?? undefined,
    empresa: texto(b.empresa ?? b.company, 120),
    mensaje: partes.join("\n"),
    recibidoEn: new Date(),
    metadatos: { formulario: texto(b.formulario ?? b.form_name, 80), url: texto(b.url, 300) },
  };
}

function campo(etiqueta: string, v: unknown): string {
  const t = texto(v, 300);
  return t ? `${etiqueta}: ${t}` : "";
}

// ---------------------------------------------------------------------------
//  Email entrante
// ---------------------------------------------------------------------------

/**
 * El hilo se agrupa por la RAÍZ de References, no por el asunto.
 *
 * Agrupar por asunto rompe de las dos maneras posibles: dos consultas
 * distintas que se llaman "Question" quedan pegadas, y una respuesta con el
 * asunto editado abre un hilo nuevo. Las cabeceras son la única fuente seria.
 */
export function hiloDeEmail(h: { messageId?: string; inReplyTo?: string; references?: string }): string {
  const refs = (h.references ?? "").split(/\s+/).filter(Boolean);
  return refs[0] ?? h.inReplyTo ?? h.messageId ?? randomUUID();
}

export function desdeEmail(
  tenantId: string,
  b: Record<string, unknown>,
): ConsultaEntrante | { error: string } {
  const de = texto(b.from ?? b.de, 320) ?? "";
  const email = normalizarEmail(extraerEmail(de));
  if (!email) return { error: "remitente inválido" };

  const texto_ = limpiarMensaje(String(b.text ?? b.texto ?? b.body ?? ""), 20_000);
  const asunto = texto(b.subject ?? b.asunto, 300) ?? "(no subject)";
  if (!texto_) return { error: "email sin cuerpo de texto" };

  const messageId = texto(b.message_id ?? b.messageId, 300) ?? undefined;
  const inReplyTo = texto(b.in_reply_to ?? b.inReplyTo, 300) ?? undefined;
  const references = texto(b.references, 2000) ?? undefined;

  return {
    tenantId,
    canal: "email",
    hiloExterno: hiloDeEmail({ messageId, inReplyTo, references }),
    idExterno: messageId,
    nombre: extraerNombre(de),
    email,
    // Sin el asunto, una respuesta de una línea ("sounds good") pierde todo el
    // contexto de qué se está aceptando.
    mensaje: `Subject: ${asunto}\n\n${quitarCitado(texto_)}`,
    recibidoEn: fechaDe(b.date ?? b.fecha),
    emailHeaders: {
      messageId, inReplyTo, references, asunto, de,
      para: listaTexto(b.to ?? b.para),
      cc: listaTexto(b.cc),
      autoSubmitted: /auto-(generated|replied)/i.test(texto(b.auto_submitted, 60) ?? ""),
    },
  };
}

/**
 * Saca el texto citado de la respuesta.
 *
 * Sin esto, cada respuesta al agente reenvía toda la conversación anterior, y
 * el modelo recibe cinco veces lo mismo: más costo, más ruido y más chances de
 * "responder" algo que ya se había respondido.
 */
export function quitarCitado(cuerpo: string): string {
  const lineas = cuerpo.split("\n");
  const corte = lineas.findIndex(
    (l) =>
      /^\s*>/.test(l) ||
      /^\s*-{2,}\s*Original Message/i.test(l) ||
      /^\s*On .+ wrote:\s*$/i.test(l) ||
      /^\s*El .+ escribió:\s*$/i.test(l),
  );
  const limpio = (corte > 0 ? lineas.slice(0, corte) : lineas).join("\n").trim();
  return limpio || cuerpo.trim();
}

export function extraerEmail(de: string): string | null {
  const m = de.match(/<([^>]+)>/) ?? de.match(/([^\s<>,;]+@[^\s<>,;]+)/);
  return m ? m[1] : null;
}

export function extraerNombre(de: string): string | undefined {
  const m = de.match(/^\s*"?([^"<]+?)"?\s*</);
  const n = m?.[1]?.trim();
  return n && !n.includes("@") ? n.slice(0, 80) : undefined;
}

// ---------------------------------------------------------------------------
//  Webhook genérico (n8n, Zapier, Facebook Lead Ads, lo que sea)
// ---------------------------------------------------------------------------

export function desdeWebhook(
  tenantId: string,
  b: Record<string, unknown>,
): ConsultaEntrante | { error: string } {
  const mensaje = limpiarMensaje(String(b.message ?? b.mensaje ?? ""));
  if (!mensaje) return { error: "falta el campo message" };
  const canal = (typeof b.channel === "string" ? b.channel : "webhook") as Canal;

  return {
    tenantId,
    canal,
    hiloExterno: texto(b.conversation_id ?? b.thread_id, 120) ?? `wh:${randomUUID()}`,
    idExterno: texto(b.message_id, 200),
    nombre: texto(b.customer_name ?? b.name, 80),
    email: normalizarEmail(texto(b.customer_email ?? b.email, 254)) ?? undefined,
    telefono: normalizarTelefono(texto(b.customer_phone ?? b.phone, 40)) ?? undefined,
    mensaje,
    recibidoEn: fechaDe(b.received_at),
    metadatos: (b.metadata as Record<string, unknown>) ?? {},
  };
}

// ---------------------------------------------------------------------------

function texto(v: unknown, max: number): string | undefined {
  if (typeof v !== "string") return undefined;
  const t = limpiarMensaje(v, max);
  return t || undefined;
}

function listaTexto(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === "string").slice(0, 20);
  if (typeof v === "string") return v.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 20);
  return [];
}

/** Una fecha del futuro o basura se reemplaza por ahora: no se confía en el emisor. */
function fechaDe(v: unknown): Date {
  if (typeof v === "string") {
    const d = new Date(v);
    if (!Number.isNaN(d.getTime()) && d.getTime() < Date.now() + 60_000) return d;
  }
  return new Date();
}
