import { randomUUID } from "node:crypto";
import type { Tenant } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { SITIO_URL } from "@/lib/sitio";
import { integracion, paraTenant } from "./tenant";
import { armar, type Plantilla } from "./plantillas";
import { normalizarEmail, redactar } from "./seguridad";
import * as ev from "./eventos";

/**
 * Workflow 11 — Outbound Email Sender.
 *
 * Dos decisiones de diseño:
 *
 * 1. GUARDAR ANTES DE ENVIAR. El email se escribe en `EmailOutbox` y recién
 *    después se intenta despachar. Si el proveedor está caído, el email no se
 *    perdió: está en la cola y se reintenta. Si se enviara primero y se
 *    guardara después, un fallo intermedio deja un email enviado del que no
 *    hay registro — y el próximo reintento lo manda dos veces.
 *
 * 2. HILOS DE VERDAD. Cada email lleva Message-ID propio, y las respuestas
 *    llevan In-Reply-To y References. Sin esas cabeceras, Gmail abre un hilo
 *    nuevo por cada respuesta y la conversación queda partida en pedazos.
 */

const HOST_ID = (() => {
  try {
    return new URL(SITIO_URL).hostname;
  } catch {
    return "jotaagency.org";
  }
})();

export function nuevoMessageId(): string {
  return `<${randomUUID()}@${HOST_ID}>`;
}

/**
 * Arma la cadena References de una respuesta.
 * Se conserva el orden y se recorta por la cola: los clientes de correo usan
 * el primero (raíz del hilo) y los últimos; el medio es prescindible.
 */
export function armarReferences(referencesPrevias: string | null, inReplyTo: string | null): string {
  const partes = [...(referencesPrevias ?? "").split(/\s+/), inReplyTo ?? ""]
    .map((s) => s.trim())
    .filter(Boolean);
  const unicas = [...new Set(partes)];
  if (unicas.length <= 12) return unicas.join(" ");
  return [unicas[0], ...unicas.slice(-11)].join(" ");
}

// ---------------------------------------------------------------------------
//  Supresiones
// ---------------------------------------------------------------------------

/** ¿Está dado de baja o rebotó? Se consulta SIEMPRE antes de encolar. */
export async function estaSuprimido(tenantId: string, email: string): Promise<boolean> {
  const e = normalizarEmail(email);
  if (!e) return true;
  const fila = await prisma.suppression.findUnique({
    where: { tenantId_email: { tenantId, email: e } },
  });
  return Boolean(fila);
}

export async function suprimir(
  tenantId: string,
  email: string,
  motivo: "baja" | "rebote" | "queja" | "manual",
  detalle?: string,
): Promise<void> {
  const e = normalizarEmail(email);
  if (!e) return;
  await prisma.suppression.upsert({
    where: { tenantId_email: { tenantId, email: e } },
    create: { tenantId, email: e, motivo, detalle },
    update: { motivo, detalle },
  });
  // Una baja también corta los seguimientos programados: si no, el sistema
  // respeta la baja en el próximo envío pero igual manda los ya agendados.
  await prisma.followUp.updateMany({
    where: paraTenant(tenantId, { estado: "pendiente", lead: { contacto: { email: e } } }),
    data: { estado: "cancelado", motivoCancelacion: motivo === "baja" ? "baja" : "rebote" },
  });
  await ev.auditar({
    tenantId, actorTipo: "sistema", accion: `email.${motivo}`, entidad: "Suppression", entidadId: e,
  });
}

// ---------------------------------------------------------------------------
//  Encolar
// ---------------------------------------------------------------------------

export type PedidoEmail = {
  tenantId: string;
  para: string;
  plantilla: Plantilla;
  datos: Record<string, string>;
  clase?: "transaccional" | "marketing";
  /** Para responder dentro de un hilo existente. */
  inReplyTo?: string | null;
  referencesPrevias?: string | null;
  asuntoForzado?: string;
  /** Evita duplicados: misma clave = un solo email, para siempre. */
  claveIdempotencia?: string;
  cc?: string[];
};

export type ResultadoEncolar =
  | { ok: true; id: string; messageId: string; duplicado: boolean }
  | { ok: false; motivo: "suprimido" | "email_invalido" | "sin_destinatario" };

export async function encolar(t: Tenant, p: PedidoEmail): Promise<ResultadoEncolar> {
  const para = normalizarEmail(p.para);
  if (!para) return { ok: false, motivo: p.para ? "email_invalido" : "sin_destinatario" };

  // Las internas al equipo no se suprimen: son avisos operativos, no marketing.
  const esInterna = p.plantilla === "resumen_interno" || p.plantilla === "error_interno";
  if (!esInterna && (await estaSuprimido(t.id, para))) {
    return { ok: false, motivo: "suprimido" };
  }

  if (p.claveIdempotencia) {
    const ya = await prisma.emailOutbox.findUnique({
      where: { tenantId_claveIdempotencia: { tenantId: t.id, claveIdempotencia: p.claveIdempotencia } },
    });
    if (ya) return { ok: true, id: ya.id, messageId: ya.messageId, duplicado: true };
  }

  const armado = armar(p.plantilla, t, p.datos);
  const messageId = nuevoMessageId();

  // Responder dentro de un hilo: el asunto tiene que seguir siendo el mismo,
  // con Re:. Cambiarlo hace que algunos clientes lo saquen del hilo.
  const asunto = p.asuntoForzado?.trim() || armado.asunto;

  const fila = await prisma.emailOutbox.create({
    data: {
      tenantId: t.id,
      para,
      cc: p.cc ?? [],
      responderA: remitenteDe(t).responderA,
      asunto: asunto.slice(0, 300),
      html: armado.html,
      texto: armado.texto,
      messageId,
      inReplyTo: p.inReplyTo ?? null,
      references: p.inReplyTo ? armarReferences(p.referencesPrevias ?? null, p.inReplyTo) : null,
      plantilla: p.plantilla,
      clase: p.clase ?? "transaccional",
      claveIdempotencia: p.claveIdempotencia ?? null,
      estado: "pendiente",
    },
  });

  return { ok: true, id: fila.id, messageId, duplicado: false };
}

function remitenteDe(t: Tenant): { de: string; responderA: string } {
  const ajustes = (t.ajustes as Record<string, unknown> | null) ?? {};
  const de = typeof ajustes.emailRemitente === "string" ? ajustes.emailRemitente : "";
  const responder = typeof ajustes.emailResponderA === "string" ? ajustes.emailResponderA : "";
  const porDefecto = `${t.nombreAgente} <no-reply@${HOST_ID}>`;
  return { de: de || porDefecto, responderA: responder || de || `hello@${HOST_ID}` };
}

// ---------------------------------------------------------------------------
//  Despachar
// ---------------------------------------------------------------------------

export type ResultadoDespacho = { enviados: number; fallidos: number; simulados: number };

/**
 * Manda lo que esté pendiente. Lo llama el cron y también se puede disparar a
 * mano desde el panel.
 *
 * Si el tenant no tiene proveedor de email conectado, el email queda en estado
 * `simulado`: se ve completo en el panel, con su asunto y su cuerpo, pero se
 * dice claramente que no salió. Es lo que permite mostrar la demo sin mentir
 * diciendo que se envió algo que no se envió.
 */
export async function despachar(tenantId: string, limite = 20): Promise<ResultadoDespacho> {
  const correlationId = ev.nuevaCorrelacion();
  const t = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!t) return { enviados: 0, fallidos: 0, simulados: 0 };

  const pendientes = await prisma.emailOutbox.findMany({
    where: paraTenant(tenantId, { estado: "pendiente", intentos: { lt: ev.MAX_INTENTOS } }),
    orderBy: { createdAt: "asc" },
    take: limite,
  });
  if (pendientes.length === 0) return { enviados: 0, fallidos: 0, simulados: 0 };

  const proveedor = await proveedorDe(t);
  const r: ResultadoDespacho = { enviados: 0, fallidos: 0, simulados: 0 };

  for (const email of pendientes) {
    if (!proveedor) {
      await prisma.emailOutbox.update({
        where: { id: email.id },
        data: { estado: "simulado", ultimoError: "Sin proveedor de email conectado" },
      });
      r.simulados++;
      continue;
    }

    try {
      await prisma.emailOutbox.update({
        where: { id: email.id },
        data: { estado: "enviando", intentos: { increment: 1 } },
      });
      await proveedor.enviar({
        de: remitenteDe(t).de,
        responderA: email.responderA,
        para: email.para,
        cc: email.cc,
        asunto: email.asunto,
        html: email.html,
        texto: email.texto,
        messageId: email.messageId,
        inReplyTo: email.inReplyTo,
        references: email.references,
      });
      await prisma.emailOutbox.update({
        where: { id: email.id },
        data: { estado: "enviado", enviadoEn: new Date(), ultimoError: null },
      });
      await ev.auditar({
        tenantId, actorTipo: "ia", accion: "email.enviado",
        entidad: "EmailOutbox", entidadId: email.id,
        metadatos: { plantilla: email.plantilla },
      });
      r.enviados++;
    } catch (e) {
      const intentos = email.intentos + 1;
      await prisma.emailOutbox.update({
        where: { id: email.id },
        data: {
          estado: intentos >= ev.MAX_INTENTOS ? "fallido" : "pendiente",
          ultimoError: redactar(e instanceof Error ? e.message : e, 300),
        },
      });
      await ev.fallo({
        tenantId, workflow: "11-email-saliente", correlationId,
        referencia: email.id, error: e, intentos: email.intentos,
      });
      r.fallidos++;
    }
  }

  return r;
}

// ---------------------------------------------------------------------------
//  Proveedores
// ---------------------------------------------------------------------------

type Sobre = {
  de: string;
  responderA: string | null;
  para: string;
  cc: string[];
  asunto: string;
  html: string;
  texto: string;
  messageId: string;
  inReplyTo: string | null;
  references: string | null;
};

type Proveedor = { nombre: string; enviar(s: Sobre): Promise<void> };

/**
 * Resend se eligió porque su API es un POST HTTPS: no agrega dependencias al
 * proyecto (nodemailer arrastra bastante) y permite mandar cabeceras de hilo
 * a mano, que es justo lo que hace falta para responder emails sin romper la
 * conversación.
 *
 * La credencial sale de la integración del tenant (cifrada) o, para el propio
 * Jota Agency, de la variable de entorno.
 */
async function proveedorDe(t: Tenant): Promise<Proveedor | null> {
  const integ = await integracion(t.id, "email_resend");
  const clave = integ?.secreto ?? process.env.RESEND_API_KEY?.trim();
  if (!clave) return null;

  return {
    nombre: "resend",
    async enviar(s: Sobre) {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${clave}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: s.de,
          to: [s.para],
          ...(s.cc.length ? { cc: s.cc } : {}),
          ...(s.responderA ? { reply_to: s.responderA } : {}),
          subject: s.asunto,
          html: s.html,
          text: s.texto,
          headers: {
            "Message-ID": s.messageId,
            ...(s.inReplyTo ? { "In-Reply-To": s.inReplyTo } : {}),
            ...(s.references ? { References: s.references } : {}),
          },
        }),
      });
      if (!res.ok) {
        throw new Error(`resend ${res.status}: ${redactar(await res.text().catch(() => ""), 200)}`);
      }
    },
  };
}

/** ¿Hay proveedor conectado? El panel lo usa para avisar en vez de mentir. */
export async function hayProveedor(t: Tenant): Promise<boolean> {
  return (await proveedorDe(t)) !== null;
}
