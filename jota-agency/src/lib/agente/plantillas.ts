import type { Tenant } from "@prisma/client";
import { SITIO_URL } from "@/lib/sitio";

/**
 * Plantillas de email. HTML profesional + versión de texto, siempre las dos:
 * los clientes de correo que bloquean HTML muestran la de texto, y un email
 * sin `text/plain` puntúa peor en los filtros de spam.
 *
 * Todo lo variable entra escapado. Un nombre con `<` no puede romper el HTML
 * ni inyectar nada en el cliente de correo de otra persona.
 */

export type Plantilla =
  | "confirmacion"
  | "respuesta"
  | "faltan_datos"
  | "resumen_interno"
  | "cita_confirmada"
  | "cita_recordatorio"
  | "seguimiento"
  | "handoff"
  | "reactivacion"
  | "error_interno";

export type EmailArmado = { asunto: string; html: string; texto: string };

export function escapar(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Párrafos a partir de texto plano, respetando saltos de línea. */
function parrafos(texto: string): string {
  return texto
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 14px;line-height:1.6">${escapar(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

function envoltura(t: Tenant, cuerpo: string, pie?: string): string {
  const firma = t.firmaEmail?.trim() || `${t.nombreAgente} · ${t.nombreNegocio}`;
  return `<!doctype html><html><body style="margin:0;padding:0;background:#f5f5f4">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f4;padding:28px 12px">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e7e5e4;border-radius:12px">
<tr><td style="padding:26px 28px 8px">
<div style="font:600 15px/1.3 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1c1917">${escapar(t.nombreNegocio)}</div>
</td></tr>
<tr><td style="padding:6px 28px 22px;font:400 15px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#292524">
${cuerpo}
<p style="margin:22px 0 0;color:#57534e;font-size:14px">${escapar(firma).replace(/\n/g, "<br>")}</p>
</td></tr>
<tr><td style="padding:14px 28px 22px;border-top:1px solid #f0efee;font:400 12px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#78716c">
${pie ?? `You're receiving this because you contacted ${escapar(t.nombreNegocio)}.`}
</td></tr>
</table></td></tr></table></body></html>`;
}

const PIE_TEXTO = (t: Tenant) =>
  `\n\n--\n${t.firmaEmail?.trim() || `${t.nombreAgente} · ${t.nombreNegocio}`}`;

// ---------------------------------------------------------------------------
//  Plantillas al cliente
// ---------------------------------------------------------------------------

export function armar(
  plantilla: Plantilla,
  t: Tenant,
  d: Record<string, string>,
): EmailArmado {
  const nombre = d.nombre?.trim();
  const hola = nombre ? `Hi ${nombre},` : "Hi,";

  switch (plantilla) {
    case "confirmacion": {
      const asunto = `We got your message — ${t.nombreNegocio}`;
      const cuerpo = `${hola}\n\nThanks for reaching out to ${t.nombreNegocio}. Your message came through and we're on it.\n\n${d.resumen ? `What you told us:\n"${d.resumen}"\n\n` : ""}You'll hear back from us shortly.`;
      return { asunto, html: envoltura(t, parrafos(cuerpo)), texto: cuerpo + PIE_TEXTO(t) };
    }

    case "respuesta": {
      const asunto = d.asunto?.trim() || `Re: your message to ${t.nombreNegocio}`;
      const cuerpo = `${hola}\n\n${d.mensaje ?? ""}`;
      return { asunto, html: envoltura(t, parrafos(cuerpo)), texto: cuerpo + PIE_TEXTO(t) };
    }

    case "faltan_datos": {
      const asunto = d.asunto?.trim() || `One quick question — ${t.nombreNegocio}`;
      const cuerpo = `${hola}\n\n${d.mensaje ?? "To move this forward, we just need one more detail."}`;
      return { asunto, html: envoltura(t, parrafos(cuerpo)), texto: cuerpo + PIE_TEXTO(t) };
    }

    case "cita_confirmada": {
      const asunto = `Confirmed: ${d.cuando} — ${t.nombreNegocio}`;
      const cuerpo = `${hola}\n\nYour appointment is confirmed.\n\nWhen: ${d.cuando} (${d.zona})\nWhat: ${d.motivo || "Consultation"}${d.url ? `\nJoin: ${d.url}` : ""}\n\nIf you need to reschedule or cancel, just reply to this email.`;
      return { asunto, html: envoltura(t, parrafos(cuerpo)), texto: cuerpo + PIE_TEXTO(t) };
    }

    case "cita_recordatorio": {
      const asunto = `Reminder: ${d.cuando} — ${t.nombreNegocio}`;
      const cuerpo = `${hola}\n\nQuick reminder about your appointment.\n\nWhen: ${d.cuando} (${d.zona})${d.url ? `\nJoin: ${d.url}` : ""}\n\nReply here if anything changed.`;
      return { asunto, html: envoltura(t, parrafos(cuerpo)), texto: cuerpo + PIE_TEXTO(t) };
    }

    case "seguimiento": {
      const asunto = d.asunto?.trim() || `Following up — ${t.nombreNegocio}`;
      const cuerpo = `${hola}\n\n${d.mensaje ?? "Just checking in on the message you sent us. Is this still something you're looking into?"}`;
      return {
        asunto,
        html: envoltura(t, parrafos(cuerpo), pieBaja(t, d.urlBaja)),
        texto: `${cuerpo}${PIE_TEXTO(t)}\n\nDon't want these follow-ups? Reply with "stop".`,
      };
    }

    case "reactivacion": {
      const asunto = d.asunto?.trim() || `Still interested? — ${t.nombreNegocio}`;
      const cuerpo = `${hola}\n\n${d.mensaje ?? "We never heard back, so we're closing this one out. If the timing is better now, just reply and we'll pick it up."}`;
      return {
        asunto,
        html: envoltura(t, parrafos(cuerpo), pieBaja(t, d.urlBaja)),
        texto: `${cuerpo}${PIE_TEXTO(t)}\n\nDon't want these follow-ups? Reply with "stop".`,
      };
    }

    case "handoff": {
      const asunto = d.asunto?.trim() || `Passing this to the team — ${t.nombreNegocio}`;
      const cuerpo = `${hola}\n\n${d.mensaje ?? "I've passed your message to a member of the team so you get an accurate answer. They'll be in touch shortly."}`;
      return { asunto, html: envoltura(t, parrafos(cuerpo)), texto: cuerpo + PIE_TEXTO(t) };
    }

    // ---- Internas, para el negocio ----
    case "resumen_interno":
      return resumenInterno(t, d);

    case "error_interno": {
      const asunto = `[${t.nombreNegocio}] AI agent needs attention`;
      const cuerpo = `Something failed and needs a human.\n\nWhat: ${d.que}\nWhen: ${d.cuando}\nDetail: ${d.detalle ?? "—"}\n\nOpen the panel: ${SITIO_URL}/ceo/agent/health`;
      return { asunto, html: envoltura(t, parrafos(cuerpo), "Internal alert."), texto: cuerpo };
    }
  }
}

function pieBaja(t: Tenant, urlBaja?: string): string {
  const base = `You're receiving this because you contacted ${escapar(t.nombreNegocio)}.`;
  return urlBaja
    ? `${base} <a href="${escapar(urlBaja)}" style="color:#78716c">Stop these follow-ups</a>.`
    : `${base} Reply with "stop" to end these follow-ups.`;
}

/**
 * El email interno más importante del sistema: tiene que dejar entender la
 * oportunidad SIN abrir la conversación. Si el dueño del negocio necesita
 * hacer clic para saber si vale la pena, el email falló.
 */
function resumenInterno(t: Tenant, d: Record<string, string>): EmailArmado {
  const asunto = `New qualified lead: ${d.nombre || "Unknown"} — ${d.servicio || "unspecified"}`;

  const filas: [string, string][] = [
    ["Name", d.nombre || "—"],
    ["Company", d.empresa || "—"],
    ["Email", d.email || "—"],
    ["Phone", d.telefono || "—"],
    ["Channel", d.canal || "—"],
    ["Service", d.servicio || "—"],
    ["Main need", d.problema || "—"],
    ["Budget", d.presupuesto || "not stated"],
    ["Timeline", d.plazo || "not stated"],
    ["Urgency", d.urgencia || "—"],
    ["Lead score", `${d.score} / 100 — ${d.banda} (confidence: ${d.confianza})`],
    ["Next action", d.proximaAccion || "—"],
    ["Appointment", d.cita || "none booked"],
  ];

  const tabla = filas
    .map(
      ([k, v]) =>
        `<tr><td style="padding:5px 12px 5px 0;color:#78716c;font-size:13px;white-space:nowrap;vertical-align:top">${escapar(k)}</td><td style="padding:5px 0;font-size:14px;color:#1c1917">${escapar(v)}</td></tr>`,
    )
    .join("");

  const razones = (etiqueta: string, items: string) =>
    items
      ? `<p style="margin:0 0 4px;font-size:13px;color:#78716c">${etiqueta}</p><ul style="margin:0 0 14px;padding-left:18px;font-size:13.5px;color:#292524">${items
          .split("|")
          .filter(Boolean)
          .map((i) => `<li style="margin-bottom:3px">${escapar(i.trim())}</li>`)
          .join("")}</ul>`
      : "";

  const html = envoltura(
    t,
    `<p style="margin:0 0 16px;font-size:16px;font-weight:600">${escapar(d.banda || "Lead")} · score ${escapar(d.score || "0")}</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:18px">${tabla}</table>
${razones("Why it scored well", d.positivos || "")}
${razones("Concerns", d.negativos || "")}
${razones("Still missing", d.faltantes || "")}
<p style="margin:0 0 6px;font-size:13px;color:#78716c">Conversation summary</p>
<p style="margin:0 0 18px;font-size:14px;line-height:1.6">${escapar(d.resumen || "—")}</p>
<a href="${escapar(d.urlConversacion || `${SITIO_URL}/ceo/agent/inbox`)}" style="display:inline-block;padding:10px 18px;background:#1c1917;color:#fff;text-decoration:none;border-radius:8px;font-size:14px">Open the conversation</a>`,
    "Internal notification — do not forward to the customer.",
  );

  const texto = [
    `${d.banda || "Lead"} · score ${d.score}/100 (confidence: ${d.confianza})`,
    "",
    ...filas.map(([k, v]) => `${k}: ${v}`),
    "",
    d.positivos ? `Why it scored well: ${d.positivos.replace(/\|/g, "; ")}` : "",
    d.negativos ? `Concerns: ${d.negativos.replace(/\|/g, "; ")}` : "",
    d.faltantes ? `Still missing: ${d.faltantes.replace(/\|/g, "; ")}` : "",
    "",
    `Summary: ${d.resumen || "—"}`,
    "",
    `Conversation: ${d.urlConversacion || `${SITIO_URL}/ceo/agent/inbox`}`,
  ]
    .filter((l) => l !== "")
    .join("\n");

  return { asunto, html, texto };
}
