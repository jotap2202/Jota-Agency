/**
 * Formato interno común.
 *
 * Todo canal —chat, formulario, email, webhook— se traduce a esto antes de
 * tocar la base. Agregar WhatsApp mañana es escribir un normalizador nuevo,
 * no tocar el orquestador.
 */

export type Canal =
  | "website_chat"
  | "web_form"
  | "email"
  | "webhook"
  | "whatsapp"
  | "sms"
  | "instagram"
  | "telefono";

export const CANALES: Canal[] = [
  "website_chat", "web_form", "email", "webhook",
  "whatsapp", "sms", "instagram", "telefono",
];

/** Una consulta entrante, ya normalizada. */
export type ConsultaEntrante = {
  tenantId: string;
  canal: Canal;
  /** Hilo del canal externo. Es lo que agrupa mensajes en una conversación. */
  hiloExterno: string;
  /** ID del mensaje en el canal externo (Message-ID del email, etc.). */
  idExterno?: string;
  nombre?: string;
  apellido?: string;
  email?: string;
  telefono?: string;
  empresa?: string;
  mensaje: string;
  recibidoEn: Date;
  /** Datos propios del canal. Nunca se mete en el prompt. */
  metadatos?: Record<string, unknown>;
  /** Cabeceras de email, para no romper el hilo al responder. */
  emailHeaders?: {
    messageId?: string;
    inReplyTo?: string;
    references?: string;
    asunto?: string;
    de?: string;
    para?: string[];
    cc?: string[];
    autoSubmitted?: boolean;
  };
};

/** Las 14 intenciones del pedido. Se permite más de una. */
export type Intencion =
  | "general_question"
  | "service_inquiry"
  | "pricing_question"
  | "estimate_request"
  | "appointment_request"
  | "existing_customer_support"
  | "complaint"
  | "urgent_request"
  | "sales_opportunity"
  | "partnership"
  | "job_application"
  | "vendor"
  | "spam"
  | "unknown";

export const INTENCIONES: Intencion[] = [
  "general_question", "service_inquiry", "pricing_question", "estimate_request",
  "appointment_request", "existing_customer_support", "complaint", "urgent_request",
  "sales_opportunity", "partnership", "job_application", "vendor", "spam", "unknown",
];

/** Los siete finales posibles. Ninguna consulta queda sin uno. */
export type EstadoFinal =
  | "respondida"
  | "calificada"
  | "agendada"
  | "seguimiento"
  | "handoff"
  | "descartada"
  | "error";

/** Datos del lead. `null` = no lo sabemos. Nunca se completa a ojo. */
export type DatosLead = {
  nombre: string | null;
  apellido: string | null;
  email: string | null;
  telefono: string | null;
  empresa: string | null;
  sitioWeb: string | null;
  ubicacion: string | null;
  servicio: string | null;
  problema: string | null;
  resultado: string | null;
  presupuesto: string | null;
  plazo: string | null;
  tamanioEmpresa: string | null;
  autoridad: string | null;
  mejorHorario: string | null;
  canalPreferido: string | null;
  consentimiento: boolean | null;
};

export const DATOS_LEAD_VACIO: DatosLead = {
  nombre: null, apellido: null, email: null, telefono: null, empresa: null,
  sitioWeb: null, ubicacion: null, servicio: null, problema: null,
  resultado: null, presupuesto: null, plazo: null, tamanioEmpresa: null,
  autoridad: null, mejorHorario: null, canalPreferido: null, consentimiento: null,
};

export type PedidoHerramienta = {
  herramienta: string;
  argumentos: Record<string, unknown>;
};

/** Lo que el modelo devuelve. Se valida antes de usarse. */
export type SalidaAgente = {
  respuesta: string;
  intencion: Intencion;
  intenciones: Intencion[];
  idioma: string;
  sentimiento: "positivo" | "neutral" | "negativo";
  urgencia: "baja" | "media" | "alta";
  confianza: number;
  datosLead: DatosLead;
  factoresScore: { positivos: string[]; negativos: string[]; faltantes: string[] };
  proximaAccion: string;
  requiereHumano: boolean;
  motivoHandoff: string | null;
  pedidoHerramienta: PedidoHerramienta | null;
};

/** Resultado de procesar una consulta de punta a punta. */
export type ResultadoConsulta = {
  ok: boolean;
  duplicado: boolean;
  estadoFinal: EstadoFinal;
  conversationId: string;
  messageId: string;
  /** Lo que se le muestra al cliente. Vacío si quedó pendiente de aprobación. */
  respuesta: string;
  requiereAprobacion: boolean;
  leadId?: string;
  correlationId: string;
};

export type ModoOperacion = "draft" | "supervisado" | "autonomo";
