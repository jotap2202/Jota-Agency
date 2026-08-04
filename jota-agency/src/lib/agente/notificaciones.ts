import type { Tenant } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { SITIO_URL } from "@/lib/sitio";
import { destinatarios, integracion } from "./tenant";
import { encolar } from "./email";
import { redactar } from "./seguridad";
import * as ev from "./eventos";

/**
 * Workflow 14 — Internal Notifications.
 *
 * Avisar de más es igual de malo que no avisar: si suena por cada consulta,
 * en una semana nadie mira las notificaciones y el hot lead de las 3am se
 * pierde igual. Por eso cada evento tiene prioridad y solo los importantes
 * salen por email.
 */

export type EventoInterno =
  | "nuevo_lead"
  | "hot_lead"
  | "reunion_agendada"
  | "urgente"
  | "queja"
  | "handoff"
  | "error"
  | "sin_resolver"
  | "email_rebotado"
  | "lead_sin_seguimiento"
  | "baja"
  | "kb_desactualizada";

const PRIORIDAD: Record<EventoInterno, "alta" | "media" | "baja"> = {
  hot_lead: "alta", reunion_agendada: "alta", urgente: "alta",
  queja: "alta", handoff: "alta", error: "alta",
  nuevo_lead: "media", sin_resolver: "media", email_rebotado: "media",
  lead_sin_seguimiento: "media", baja: "baja", kb_desactualizada: "baja",
};

/** Solo estos llegan al mail del dueño. El resto vive en el panel. */
const POR_EMAIL: EventoInterno[] = ["hot_lead", "reunion_agendada", "urgente", "queja", "handoff", "error"];

export type PedidoAviso = {
  t: Tenant;
  evento: EventoInterno;
  titulo: string;
  detalle: string;
  url?: string;
  /** Datos para el email interno completo (solo en hot_lead). */
  datosLead?: Record<string, string>;
  /** Evita mandar el mismo aviso dos veces. */
  clave?: string;
};

export async function avisar(p: PedidoAviso): Promise<void> {
  const { t, evento } = p;
  const prioridad = PRIORIDAD[evento];
  const url = p.url ?? `${SITIO_URL}/ceo/agent/inbox`;

  // 1. Panel. Siempre. Es el registro que queda.
  await prisma.notificacion
    .create({
      data: {
        tipo: `agente_${evento}`,
        titulo: `${t.nombreNegocio}: ${p.titulo}`.slice(0, 200),
        detalle: p.detalle.slice(0, 500),
        url,
        esDemo: t.esDemo,
      },
    })
    .catch((e) => console.error("[avisos] panel", redactar(e)));

  // 2. Email al equipo, solo si vale la pena interrumpir.
  if (POR_EMAIL.includes(evento)) {
    const equipo = await destinatarios(t.id);
    for (const m of equipo) {
      await encolar(t, {
        tenantId: t.id,
        para: m.email,
        plantilla: p.datosLead ? "resumen_interno" : "error_interno",
        datos: p.datosLead ?? {
          que: p.titulo,
          cuando: new Date().toISOString(),
          detalle: p.detalle,
        },
        clase: "transaccional",
        claveIdempotencia: p.clave ? `aviso:${p.clave}:${m.id}` : undefined,
      }).catch((e) => console.error("[avisos] email", redactar(e)));
    }
  }

  // 3. Slack, si el cliente lo conectó.
  if (prioridad !== "baja") {
    await slack(t, `*${p.titulo}*\n${p.detalle}\n${url}`).catch((e) =>
      console.error("[avisos] slack", redactar(e)),
    );
  }
}

/**
 * Slack por Incoming Webhook: la URL ES la credencial, así que va cifrada en
 * `TenantIntegration` como cualquier otro secreto.
 */
async function slack(t: Tenant, texto: string): Promise<void> {
  const integ = await integracion(t.id, "slack");
  const url = integ?.secreto;
  if (!url) return;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: texto }),
  });
  if (!res.ok) throw new Error(`slack ${res.status}`);
  await ev.auditar({ tenantId: t.id, actorTipo: "sistema", accion: "slack.aviso", entidad: "Tenant", entidadId: t.id });
}
