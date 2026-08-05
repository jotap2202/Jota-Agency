import {
  DATOS_LEAD_VACIO, INTENCIONES,
  type DatosLead, type Intencion, type SalidaAgente,
} from "./tipos";
import { verificarCitado } from "./seguridad";

/**
 * Contrato de salida del modelo.
 *
 * Se implementa como una herramienta forzada (`tool_choice`) en vez de "por
 * favor devolvé JSON": el modelo no puede contestar en prosa aunque quiera, y
 * la API valida el esquema antes de que el JSON llegue acá.
 *
 * Igual se valida todo de nuevo del lado nuestro. Un esquema garantiza la
 * forma, no la verdad: que `budget` sea string no significa que el cliente
 * haya dicho un presupuesto.
 */

export const NOMBRE_HERRAMIENTA = "responder";

const CAMPOS_LEAD = Object.keys(DATOS_LEAD_VACIO) as (keyof DatosLead)[];

export const ESQUEMA_SALIDA = {
  type: "object" as const,
  properties: {
    customer_reply: {
      type: "string",
      description: "The only text the customer will see. Never include internal fields here.",
    },
    intent: { type: "string", enum: INTENCIONES },
    additional_intents: {
      type: "array",
      items: { type: "string", enum: INTENCIONES },
      description: "Extra labels when the inquiry is more than one thing. May be empty.",
    },
    language: { type: "string", description: "ISO 639-1 code of the customer's language, e.g. en, es." },
    sentiment: { type: "string", enum: ["positivo", "neutral", "negativo"] },
    urgency: { type: "string", enum: ["baja", "media", "alta"] },
    confidence: {
      type: "number",
      description:
        "0 to 1. How confident you are that this reply is correct and grounded in approved information. " +
        "It measures groundedness, NOT whether the customer got what they wanted. Calibration: " +
        "0.9-1.0 = the reply comes directly from the business information, FAQ or retrieved knowledge — " +
        "including a clear 'no' (an area not covered, a service not offered); " +
        "0.6-0.8 = mostly grounded, minor gaps; " +
        "below 0.6 = ONLY when the approved information does not contain the answer.",
    },
    lead_data: {
      type: "object",
      description:
        "Only fill a field if the customer stated it in this conversation. Otherwise null. Never infer.",
      properties: Object.fromEntries(
        CAMPOS_LEAD.map((c) => [
          c,
          c === "consentimiento"
            ? { type: ["boolean", "null"] }
            : { type: ["string", "null"] },
        ]),
      ),
      required: CAMPOS_LEAD,
      additionalProperties: false,
    },
    lead_score_factors: {
      type: "object",
      properties: {
        positive: { type: "array", items: { type: "string" } },
        negative: { type: "array", items: { type: "string" } },
        missing: { type: "array", items: { type: "string" } },
      },
      required: ["positive", "negative", "missing"],
      additionalProperties: false,
    },
    next_action: {
      type: "string",
      description: "Short slug of the next best action, e.g. ask_timeline, offer_slots, wait_reply.",
    },
    requires_human: { type: "boolean" },
    human_handoff_reason: { type: ["string", "null"] },
    tool_request: {
      type: ["object", "null"],
      description: "Request one tool. Null if none is needed.",
      properties: {
        tool: { type: "string" },
        arguments: { type: "object", additionalProperties: true },
      },
      required: ["tool", "arguments"],
      additionalProperties: false,
    },
  },
  required: [
    "customer_reply", "intent", "language", "sentiment", "urgency", "confidence",
    "lead_data", "lead_score_factors", "next_action", "requires_human",
  ],
  additionalProperties: false,
};

// ---------------------------------------------------------------------------
//  Validación
// ---------------------------------------------------------------------------

function texto(v: unknown, max = 2000): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t && t.toLowerCase() !== "null" && t !== "n/a" ? t.slice(0, max) : null;
}

function lista(v: unknown, max = 8): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string" && x.trim().length > 0)
    .map((x) => x.trim().slice(0, 160))
    .slice(0, max);
}

function intencion(v: unknown): Intencion {
  return INTENCIONES.includes(v as Intencion) ? (v as Intencion) : "unknown";
}

export type ResultadoValidacion =
  | { ok: true; salida: SalidaAgente; descartados: string[] }
  | { ok: false; motivo: string };

/**
 * Convierte la respuesta cruda del modelo en algo confiable.
 *
 * `fuenteTexto` es todo lo que escribió la persona en la conversación. Cada
 * dato del lead se compara contra eso: si el modelo dice que el presupuesto
 * es "$5,000" y ese número no aparece en ningún lado, se descarta y queda
 * anotado en `descartados`. Es la garantía de "nunca inventes un dato para
 * subir el score", del lado del código y no de la buena voluntad del modelo.
 */
export function validarSalida(
  bruto: unknown,
  fuenteTexto: string,
  serviciosAprobados = "",
): ResultadoValidacion {
  if (!bruto || typeof bruto !== "object") return { ok: false, motivo: "salida vacía o no es objeto" };
  const o = bruto as Record<string, unknown>;

  const respuesta = texto(o.customer_reply, 4000);
  if (!respuesta) return { ok: false, motivo: "sin customer_reply" };

  // Datos del lead: se acepta solo lo que la persona dijo de verdad.
  const brutoLead = (o.lead_data ?? {}) as Record<string, unknown>;
  const datosLead: DatosLead = { ...DATOS_LEAD_VACIO };
  const descartados: string[] = [];

  for (const campo of CAMPOS_LEAD) {
    if (campo === "consentimiento") {
      datosLead.consentimiento = typeof brutoLead.consentimiento === "boolean" ? brutoLead.consentimiento : null;
      continue;
    }
    const valor = texto(brutoLead[campo], 300);
    if (!valor) continue;
    // `servicio` es una clasificación contra el catálogo del negocio: que el
    // modelo escriba "Drain cleaning" cuando el cliente dijo "slow drain" es
    // lo esperado, no un invento. Para ese campo la cita vale contra el
    // mensaje del cliente O contra el catálogo aprobado.
    const fuenteCampo =
      campo === "servicio" && serviciosAprobados
        ? `${fuenteTexto}\n${serviciosAprobados}`
        : fuenteTexto;
    if (verificarCitado(valor, fuenteCampo)) {
      (datosLead[campo] as string | null) = valor;
    } else {
      descartados.push(campo);
    }
  }

  const confianzaBruta = typeof o.confidence === "number" ? o.confidence : 0;
  const confianza = Math.min(1, Math.max(0, confianzaBruta));

  const factores = (o.lead_score_factors ?? {}) as Record<string, unknown>;

  const pedido = o.tool_request as Record<string, unknown> | null | undefined;
  const herramienta = pedido && typeof pedido === "object" ? texto(pedido.tool, 60) : null;

  const salida: SalidaAgente = {
    respuesta,
    intencion: intencion(o.intent),
    intenciones: lista(o.additional_intents, 4).map(intencion),
    idioma: (texto(o.language, 8) ?? "en").toLowerCase().slice(0, 5),
    sentimiento:
      o.sentiment === "positivo" || o.sentiment === "negativo" ? o.sentiment : "neutral",
    urgencia: o.urgency === "alta" || o.urgency === "baja" ? o.urgency : "media",
    confianza,
    datosLead,
    factoresScore: {
      positivos: lista(factores.positive),
      negativos: lista(factores.negative),
      faltantes: lista(factores.missing),
    },
    proximaAccion: texto(o.next_action, 60) ?? "wait_reply",
    requiereHumano: o.requires_human === true,
    motivoHandoff: texto(o.human_handoff_reason, 300),
    pedidoHerramienta: herramienta
      ? {
          herramienta,
          argumentos:
            pedido && typeof pedido.arguments === "object" && pedido.arguments
              ? (pedido.arguments as Record<string, unknown>)
              : {},
        }
      : null,
  };

  // Si se descartó un dato inventado, el modelo estaba rellenando huecos:
  // baja la confianza para que el resto del sistema lo trate con cuidado.
  //
  // Con una excepción: los campos DESCRIPTIVOS son paráfrasis por naturaleza
  // ("my truck is filthy" → problema: "vehicle detailing"). Descartarlos es
  // higiene de datos, pero no dice nada sobre la calidad de la respuesta al
  // cliente; capear la confianza por eso mandaba a handoff conversaciones
  // perfectamente respondidas. Inventar un email, un teléfono o un
  // presupuesto sí es grave: corrompe el contacto o infla el score, y ahí el
  // capeo se mantiene.
  const DESCRIPTIVOS: (keyof DatosLead)[] = ["servicio", "problema", "resultado"];
  const descartesGraves = descartados.filter((c) => !DESCRIPTIVOS.includes(c as keyof DatosLead));
  if (descartesGraves.length > 0) {
    salida.confianza = Math.min(salida.confianza, 0.5);
  }
  if (descartados.length > 0) {
    salida.factoresScore.faltantes = [
      ...salida.factoresScore.faltantes,
      ...descartados.map((c) => `${c} (descartado: no lo dijo el contacto)`),
    ];
  }

  return { ok: true, salida, descartados };
}
