import { ZONA } from "@/lib/zona";

/**
 * TODAS las fórmulas del Command Center viven acá.
 *
 * El motivo es concreto: si la tasa de conversión se calcula en el Overview
 * y otra vez en el reporte de marketing, tarde o temprano divergen y el
 * tablero se contradice a sí mismo. Un número que no coincide consigo mismo
 * no se vuelve a creer nunca más.
 *
 * Regla de división: cuando el denominador es cero el resultado es `null`,
 * no cero. "No hay datos" y "es cero" son cosas distintas y la interfaz las
 * tiene que mostrar distinto — un CAC de $0 se lee como excelente cuando en
 * realidad significa que todavía no cerraste ningún cliente.
 */

/** División segura: null si no hay denominador. */
export function dividir(numerador: number, denominador: number): number | null {
  return denominador > 0 ? numerador / denominador : null;
}

/** Clientes cerrados ÷ leads totales × 100 */
export function tasaConversion(cerrados: number, leadsTotales: number): number | null {
  const r = dividir(cerrados, leadsTotales);
  return r === null ? null : r * 100;
}

/** Inversión de marketing ÷ leads generados. En centavos. */
export function costoPorLead(inversionCentavos: number, leads: number): number | null {
  return dividir(inversionCentavos, leads);
}

/** Inversión de marketing ÷ reuniones conseguidas. En centavos. */
export function costoPorReunion(inversionCentavos: number, reuniones: number): number | null {
  return dividir(inversionCentavos, reuniones);
}

/** Inversión total de adquisición ÷ nuevos clientes. En centavos. */
export function costoAdquisicion(inversionCentavos: number, nuevosClientes: number): number | null {
  return dividir(inversionCentavos, nuevosClientes);
}

/** (Ingresos atribuidos − inversión) ÷ inversión × 100 */
export function roi(ingresosCentavos: number, inversionCentavos: number): number | null {
  const r = dividir(ingresosCentavos - inversionCentavos, inversionCentavos);
  return r === null ? null : r * 100;
}

/** Ganancia neta ÷ ingresos × 100 */
export function margen(gananciaCentavos: number, ingresosCentavos: number): number | null {
  const r = dividir(gananciaCentavos, ingresosCentavos);
  return r === null ? null : r * 100;
}

/** Σ (valor estimado × probabilidad). En centavos. */
export function pipelinePonderado(
  oportunidades: { valorEstimado: number; probabilidad: number }[],
): number {
  return Math.round(
    oportunidades.reduce((t, o) => t + o.valorEstimado * (o.probabilidad / 100), 0),
  );
}

/** Valor promedio por cliente. En centavos. */
export function ticketPromedio(ingresosCentavos: number, clientes: number): number | null {
  return dividir(ingresosCentavos, clientes);
}

/**
 * Lifetime value = ticket mensual promedio × meses de permanencia promedio.
 * Con menos de dos clientes cerrados el promedio no significa nada, así que
 * devuelve null en vez de un número que parece dato y no lo es.
 */
export function lifetimeValue(
  ticketMensualCentavos: number | null,
  mesesPromedio: number | null,
): number | null {
  if (ticketMensualCentavos === null || mesesPromedio === null) return null;
  return Math.round(ticketMensualCentavos * mesesPromedio);
}

/** Meses que aguanta la operación con la caja actual al ritmo de gasto actual. */
export function runwayMeses(cajaCentavos: number, gastoMensualCentavos: number): number | null {
  return dividir(cajaCentavos, gastoMensualCentavos);
}

// ---------------------------------------------------------------------------
//  Objetivo del mes
// ---------------------------------------------------------------------------

export type EstadoObjetivo = {
  objetivo: number;
  recaudado: number;
  restante: number;
  progreso: number;
  diasRestantes: number;
  diasTranscurridos: number;
  /** Cuánto hay que facturar por día para llegar. Centavos. */
  diarioNecesario: number;
  /** Lo mismo por semana. Centavos. */
  semanalNecesario: number;
  /** Ritmo diario logrado hasta ahora. Centavos. */
  ritmoActual: number;
  /** Proyección a fin de mes si se mantiene el ritmo. Centavos. */
  proyeccion: number;
  /** onTrack | atRisk | behind | completed */
  estado: "onTrack" | "atRisk" | "behind" | "completed";
};

/** Día del mes según la zona horaria del negocio, no la del servidor. */
export function partesDeFecha(d: Date) {
  const f = new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const buscar = (t: string) => Number(f.find((p) => p.type === t)?.value ?? 0);
  return { anio: buscar("year"), mes: buscar("month"), dia: buscar("day") };
}

export function diasDelMes(anio: number, mes: number): number {
  return new Date(Date.UTC(anio, mes, 0)).getUTCDate();
}

/**
 * Estado del objetivo mensual, con todo lo que el CEO necesita para decidir.
 *
 * `diasRestantes` incluye el día de hoy: si es 20 de un mes de 31, quedan 12
 * días para vender, no 11. Contarlo mal infla el diario necesario y hace
 * tomar decisiones apuradas por un error de aritmética.
 */
export function estadoObjetivoMensual(
  objetivoCentavos: number,
  recaudadoCentavos: number,
  ahora: Date = new Date(),
): EstadoObjetivo {
  const { anio, mes, dia } = partesDeFecha(ahora);
  const total = diasDelMes(anio, mes);
  const diasRestantes = Math.max(total - dia + 1, 0);
  const diasTranscurridos = dia;

  const restante = Math.max(objetivoCentavos - recaudadoCentavos, 0);
  const progreso = objetivoCentavos > 0 ? (recaudadoCentavos / objetivoCentavos) * 100 : 0;

  const diarioNecesario = diasRestantes > 0 ? Math.ceil(restante / diasRestantes) : restante;
  const ritmoActual = diasTranscurridos > 0 ? recaudadoCentavos / diasTranscurridos : 0;
  const proyeccion = Math.round(ritmoActual * total);

  let estado: EstadoObjetivo["estado"];
  if (recaudadoCentavos >= objetivoCentavos && objetivoCentavos > 0) estado = "completed";
  else if (progreso >= (diasTranscurridos / total) * 100) estado = "onTrack";
  else if (progreso >= (diasTranscurridos / total) * 100 * 0.75) estado = "atRisk";
  else estado = "behind";

  return {
    objetivo: objetivoCentavos,
    recaudado: recaudadoCentavos,
    restante,
    progreso,
    diasRestantes,
    diasTranscurridos,
    diarioNecesario,
    semanalNecesario: diarioNecesario * 7,
    ritmoActual: Math.round(ritmoActual),
    proyeccion,
    estado,
  };
}

/**
 * Proyección de ingresos a 30/60/90 días.
 *
 * Combina lo que ya está comprometido (recurrente de clientes activos) con
 * lo que el pipeline sugiere, ponderado por probabilidad. Se separan a
 * propósito: lo recurrente es casi seguro, lo del pipeline es una apuesta, y
 * mezclarlos en un solo número esconde el riesgo.
 */
export function proyeccion(
  mrrCentavos: number,
  pipelinePonderadoCentavos: number,
  cicloVentaDias = 45,
): { dias: 30 | 60 | 90; comprometido: number; probable: number; total: number }[] {
  return ([30, 60, 90] as const).map((dias) => {
    const meses = dias / 30;
    const comprometido = Math.round(mrrCentavos * meses);
    // El pipeline no entra de golpe: se reparte según el ciclo de venta.
    const fraccion = Math.min(dias / cicloVentaDias, 1);
    const probable = Math.round(pipelinePonderadoCentavos * fraccion);
    return { dias, comprometido, probable, total: comprometido + probable };
  });
}
