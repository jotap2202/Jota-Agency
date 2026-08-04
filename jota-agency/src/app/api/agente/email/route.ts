import { prisma } from "@/lib/prisma";
import { tenantPorSlug, canalHabilitado } from "@/lib/agente/tenant";
import { desdeEmail } from "@/lib/agente/normalizar";
import { procesar } from "@/lib/agente/orquestador";
import { firmaValida } from "@/lib/agente/cripto";
import { esCorreoAutomatico, redactar } from "@/lib/agente/seguridad";
import { suprimir } from "@/lib/agente/email";
import * as ev from "@/lib/agente/eventos";

/**
 * Workflow 04 — Inbound Email Processor.
 *
 * Recibe el email ya parseado de cualquier proveedor (Resend inbound, Gmail
 * vía Pub/Sub, Cloudflare Email Workers, un flujo de n8n) en JSON.
 *
 * El webhook va FIRMADO con el secreto del tenant: sin firma, cualquiera que
 * descubra la URL puede meter emails falsos y hacer que el agente le conteste
 * a quien quiera desde el dominio del cliente.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  const slug = new URL(req.url).searchParams.get("tenant")?.trim();
  if (!slug) return Response.json({ error: "Falta ?tenant=" }, { status: 400 });

  const t = await tenantPorSlug(slug);
  if (!t) return Response.json({ error: "Negocio inexistente" }, { status: 404 });

  // El cuerpo se lee como texto para poder verificar la firma sobre los bytes
  // exactos: si se parseara primero y se re-serializara, la firma no daría.
  const crudo = await req.text();
  const firma = req.headers.get("x-jota-signature") ?? "";
  if (!firmaValida(crudo, t.secretoWebhook, firma)) {
    await ev.fallo({
      tenantId: t.id, workflow: "04-email-intake",
      correlationId: ev.nuevaCorrelacion(), error: "firma inválida",
    });
    return Response.json({ error: "Firma inválida" }, { status: 401 });
  }

  if (t.estado !== "activo") return Response.json({ error: "Agente inactivo" }, { status: 409 });
  if (!canalHabilitado(t, "email")) return Response.json({ error: "Email deshabilitado" }, { status: 409 });

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(crudo) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "JSON inválido" }, { status: 400 });
  }

  const consulta = desdeEmail(t.id, body);
  if ("error" in consulta) return Response.json({ error: consulta.error }, { status: 400 });

  // Rebotes, autorespuestas y newsletters: se registran pero no se contestan.
  // Contestarle a un mailer-daemon genera un bucle de emails infinito.
  if (esCorreoAutomatico(consulta.emailHeaders ?? {})) {
    const de = consulta.email;
    const asunto = (consulta.emailHeaders?.asunto ?? "").toLowerCase();
    if (de && /(undeliverable|delivery status|mail delivery failed)/.test(asunto)) {
      await suprimir(t.id, de, "rebote", "Rebote duro detectado en el email entrante");
    }
    await ev.ok({
      tenantId: t.id, workflow: "04-email-intake",
      correlationId: ev.nuevaCorrelacion(), referencia: "automatico",
    });
    return Response.json({ ok: true, ignorado: "correo automático" });
  }

  try {
    const r = await procesar(t, consulta);
    return Response.json({ ok: r.ok, estado: r.estadoFinal, conversacion: r.conversationId });
  } catch (e) {
    console.error("[agente/email]", redactar(e));
    return Response.json({ ok: false, estado: "error" }, { status: 202 });
  }
}

/**
 * Eventos del proveedor de email: rebotes y quejas de spam.
 * Se manejan en el mismo endpoint con `?evento=1` para no multiplicar rutas.
 */
export async function PUT(req: Request) {
  const url = new URL(req.url);
  const slug = url.searchParams.get("tenant")?.trim();
  if (!slug) return Response.json({ error: "Falta ?tenant=" }, { status: 400 });
  const t = await tenantPorSlug(slug);
  if (!t) return Response.json({ error: "Negocio inexistente" }, { status: 404 });

  const crudo = await req.text();
  if (!firmaValida(crudo, t.secretoWebhook, req.headers.get("x-jota-signature") ?? "")) {
    return Response.json({ error: "Firma inválida" }, { status: 401 });
  }

  let body: { tipo?: string; email?: string; messageId?: string; detalle?: string };
  try {
    body = JSON.parse(crudo);
  } catch {
    return Response.json({ error: "JSON inválido" }, { status: 400 });
  }

  const email = body.email?.trim();
  if (!email) return Response.json({ error: "Falta email" }, { status: 400 });

  if (body.tipo === "bounce" || body.tipo === "rebote") {
    await suprimir(t.id, email, "rebote", body.detalle);
  } else if (body.tipo === "complaint" || body.tipo === "queja") {
    await suprimir(t.id, email, "queja", body.detalle);
  } else if (body.tipo === "unsubscribe" || body.tipo === "baja") {
    await suprimir(t.id, email, "baja", body.detalle);
  } else {
    return Response.json({ error: "Tipo desconocido" }, { status: 400 });
  }

  if (body.messageId) {
    await prisma.emailOutbox.updateMany({
      where: { tenantId: t.id, messageId: body.messageId },
      data: { estado: "fallido", ultimoError: `${body.tipo}: ${body.detalle ?? ""}`.slice(0, 300) },
    });
  }

  return Response.json({ ok: true });
}
