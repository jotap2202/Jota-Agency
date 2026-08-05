import type { Tenant } from "@prisma/client";
import { lineas, estaAbierto } from "./tenant";
import { normalizar } from "./seguridad";
import type { DatosLead, Intencion } from "./tipos";

/**
 * Workflow 07 — calificación del lead.
 *
 * Score de 0 a 100 EXPLICABLE. La regla de fondo es la misma que en el panel
 * del CEO: un factor sin datos no suma ni resta, se declara como faltante.
 *
 * Por qué importa: si "presupuesto desconocido" restara puntos, todo lead
 * nuevo arrancaría castigado por no haber hablado todavía, y un lead que dijo
 * "no tengo presupuesto" quedaría igual que uno que no dijo nada. Son cosas
 * distintas y el dueño del negocio necesita distinguirlas.
 *
 * El puntaje se normaliza sobre los factores que SÍ se pudieron evaluar, y se
 * informa con cuánta información se calculó.
 */

export type Factor = {
  clave: string;
  peso: number;
  /** 0 a 1, o null si no hay datos para evaluarlo. */
  valor: number | null;
  motivo: string;
};

export type Puntaje = {
  score: number;
  banda: "hot" | "qualified" | "nurture" | "low" | "spam";
  etiqueta: string;
  confianza: "alta" | "media" | "baja";
  positivos: string[];
  negativos: string[];
  faltantes: string[];
  factores: Factor[];
};

/** Pesos por defecto. Cada tenant puede pisarlos desde `ajustes.pesosScore`. */
export const PESOS_POR_DEFECTO: Record<string, number> = {
  servicio: 20,
  intencion: 18,
  urgencia: 12,
  presupuesto: 12,
  plazo: 10,
  contacto: 10,
  ubicacion: 8,
  autoridad: 5,
  interaccion: 5,
};

export function pesosDe(t: Tenant): Record<string, number> {
  const ajustes = (t.ajustes as Record<string, unknown> | null) ?? {};
  const propios = ajustes.pesosScore as Record<string, number> | undefined;
  if (!propios) return PESOS_POR_DEFECTO;
  const salida = { ...PESOS_POR_DEFECTO };
  for (const [k, v] of Object.entries(propios)) {
    if (k in salida && typeof v === "number" && v >= 0) salida[k] = v;
  }
  return salida;
}

export type EntradaPuntaje = {
  t: Tenant;
  datos: DatosLead;
  intencion: Intencion;
  intenciones?: Intencion[];
  urgencia: "baja" | "media" | "alta";
  /** Cuántos mensajes escribió la persona: mide interés real. */
  mensajesDelContacto: number;
  /** ¿Ya nos había escrito antes? */
  contactoPrevio?: boolean;
  ahora?: Date;
};

export function calcularPuntaje(e: EntradaPuntaje): Puntaje {
  const { t, datos } = e;
  const pesos = pesosDe(t);
  const ahora = e.ahora ?? new Date();
  const factores: Factor[] = [];

  const F = (clave: string, valor: number | null, motivo: string) =>
    factores.push({ clave, peso: pesos[clave] ?? 0, valor, motivo });

  // --- Spam corta todo: no tiene sentido puntuar una promoción de SEO. ---
  const todasIntenciones = [e.intencion, ...(e.intenciones ?? [])];
  if (todasIntenciones.includes("spam")) {
    return {
      score: 0, banda: "spam", etiqueta: "Spam", confianza: "alta",
      positivos: [], negativos: ["Clasificado como spam"], faltantes: [], factores: [],
    };
  }

  // --- Encaje con lo que el negocio vende ---
  const servicios = lineas(t.servicios).map(normalizar);
  if (!datos.servicio) {
    F("servicio", null, "Todavía no dijo qué servicio necesita");
  } else if (servicios.length === 0) {
    F("servicio", null, "El negocio no tiene servicios cargados: no se puede evaluar el encaje");
  } else {
    const pedido = normalizar(datos.servicio);
    const encaja = servicios.some((s) => s.includes(pedido) || pedido.includes(s) || compartenPalabras(s, pedido));
    F("servicio", encaja ? 1 : 0, encaja ? `Pide "${datos.servicio}", que el negocio ofrece` : `Pide "${datos.servicio}", que no está en los servicios del negocio`);
  }

  // --- Intención ---
  const valorIntencion: Partial<Record<Intencion, number>> = {
    estimate_request: 1, appointment_request: 1, sales_opportunity: 1,
    pricing_question: 0.8, service_inquiry: 0.7, urgent_request: 0.9,
    general_question: 0.35, existing_customer_support: 0.2, complaint: 0.15,
    partnership: 0.2, job_application: 0, vendor: 0, unknown: 0.3, spam: 0,
  };
  const vi = valorIntencion[e.intencion];
  F("intencion", vi ?? 0.3, `Intención: ${e.intencion}`);

  // --- Urgencia ---
  F("urgencia", e.urgencia === "alta" ? 1 : e.urgencia === "media" ? 0.55 : 0.2, `Urgencia ${e.urgencia}`);

  // --- Presupuesto: solo si lo dijo ---
  if (!datos.presupuesto) {
    F("presupuesto", null, "No mencionó presupuesto");
  } else {
    const monto = montoAproximado(datos.presupuesto);
    F(
      "presupuesto",
      monto === null ? 0.6 : monto >= 500000 ? 1 : monto >= 100000 ? 0.75 : 0.4,
      `Presupuesto mencionado: ${datos.presupuesto}`,
    );
  }

  // --- Plazo ---
  if (!datos.plazo) {
    F("plazo", null, "No mencionó plazo");
  } else {
    const p = normalizar(datos.plazo);
    const ya = /(asap|urgent|urgente|hoy|today|esta semana|this week|inmediat|now|ahora)/.test(p);
    const lejos = /(next year|proximo anio|el ano que viene|someday|algun dia|just looking|solo mirando)/.test(p);
    F("plazo", ya ? 1 : lejos ? 0.2 : 0.6, `Plazo: ${datos.plazo}`);
  }

  // --- Datos de contacto: sin forma de contactarlo, no hay oportunidad ---
  const tieneEmail = Boolean(datos.email);
  const tieneTel = Boolean(datos.telefono);
  const tieneNombre = Boolean(datos.nombre);
  const puntosContacto = (tieneEmail ? 0.5 : 0) + (tieneTel ? 0.3 : 0) + (tieneNombre ? 0.2 : 0);
  F(
    "contacto",
    puntosContacto,
    puntosContacto === 0
      ? "Sin nombre, email ni teléfono: no hay forma de contactarlo"
      : `Contacto: ${[tieneNombre && "nombre", tieneEmail && "email", tieneTel && "teléfono"].filter(Boolean).join(", ")}`,
  );

  // --- Ubicación vs. área de servicio ---
  const area = normalizar(t.areaServicio ?? "");
  if (!datos.ubicacion) {
    F("ubicacion", null, "No dijo dónde está");
  } else if (!area) {
    F("ubicacion", null, "El negocio no tiene área de servicio cargada");
  } else {
    const u = normalizar(datos.ubicacion);
    const dentro = area.includes(u) || u.includes(area) || compartenPalabras(area, u);
    F("ubicacion", dentro ? 1 : 0, dentro ? `${datos.ubicacion} está dentro del área` : `${datos.ubicacion} está fuera del área de servicio`);
  }

  // --- Autoridad para decidir ---
  if (!datos.autoridad) {
    F("autoridad", null, "No se sabe si decide él");
  } else {
    const a = normalizar(datos.autoridad);
    const decide = /(owner|dueno|founder|fundador|ceo|manager|gerente|director|yo decido|i decide|i am the)/.test(a);
    F("autoridad", decide ? 1 : 0.4, `Autoridad: ${datos.autoridad}`);
  }

  // --- Interacción: cuánto se involucró ---
  const m = e.mensajesDelContacto;
  F("interaccion", m >= 4 ? 1 : m >= 2 ? 0.6 : 0.3, `${m} mensaje${m === 1 ? "" : "s"} del contacto${e.contactoPrevio ? " · ya había escrito antes" : ""}`);

  // --- Normalización sobre lo evaluable ---
  const evaluables = factores.filter((f) => f.valor !== null && f.peso > 0);
  const pesoEvaluable = evaluables.reduce((s, f) => s + f.peso, 0);
  const pesoTotal = factores.reduce((s, f) => s + f.peso, 0);
  const obtenido = evaluables.reduce((s, f) => s + f.peso * (f.valor as number), 0);
  const score = pesoEvaluable > 0 ? Math.round((obtenido / pesoEvaluable) * 100) : 0;

  const cobertura = pesoTotal > 0 ? pesoEvaluable / pesoTotal : 0;
  const confianza: Puntaje["confianza"] = cobertura >= 0.75 ? "alta" : cobertura >= 0.5 ? "media" : "baja";

  const positivos = evaluables.filter((f) => (f.valor as number) >= 0.6).map((f) => f.motivo);
  const negativos = evaluables.filter((f) => (f.valor as number) < 0.4).map((f) => f.motivo);
  const faltantes = factores.filter((f) => f.valor === null).map((f) => f.motivo);

  // El negocio cerrado no cambia el valor del lead, pero sí la urgencia de
  // atenderlo: se anota como contexto, no como puntos.
  if (!estaAbierto(t, ahora)) positivos.push("Llegó fuera del horario de atención");

  return { score, banda: bandaDe(score), etiqueta: etiquetaDe(score), confianza, positivos, negativos, faltantes, factores };
}

export function bandaDe(score: number): Puntaje["banda"] {
  if (score >= 80) return "hot";
  if (score >= 60) return "qualified";
  if (score >= 40) return "nurture";
  return "low";
}

export function etiquetaDe(score: number): string {
  const b = bandaDe(score);
  return { hot: "Hot Lead", qualified: "Qualified Lead", nurture: "Nurture", low: "Low Priority", spam: "Spam" }[b];
}

/** Estado del Lead que corresponde a la banda. */
export function estadoDeBanda(b: Puntaje["banda"]): string {
  return { hot: "calificado", qualified: "calificado", nurture: "nutrir", low: "baja_prioridad", spam: "descartado" }[b];
}

function compartenPalabras(a: string, b: string): boolean {
  const pa = new Set(a.split(" ").filter((p) => p.length > 3));
  return b.split(" ").some((p) => p.length > 3 && pa.has(p));
}

/** Saca un número aproximado en centavos de un texto tipo "around $5,000". */
export function montoAproximado(texto: string): number | null {
  const m = texto.replace(/[.,](?=\d{3}\b)/g, "").match(/(\d+(?:\.\d+)?)\s*(k|mil|m)?/i);
  if (!m) return null;
  let n = Number(m[1]);
  if (!Number.isFinite(n)) return null;
  const sufijo = (m[2] ?? "").toLowerCase();
  if (sufijo === "k" || sufijo === "mil") n *= 1000;
  if (sufijo === "m") n *= 1_000_000;
  return Math.round(n * 100);
}
