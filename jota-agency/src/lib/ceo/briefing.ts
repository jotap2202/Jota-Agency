import { dinero, porcentaje } from "@/lib/ceo/dinero";
import type { DatosOverview } from "@/lib/ceo/datos";

/**
 * CEO Daily Briefing.
 *
 * Reglas deterministas sobre los datos reales — no un texto generado. Cada
 * conclusión es reproducible y se puede auditar mirando el número que la
 * disparó, que es lo que hace que se le pueda creer.
 *
 * Regla dura: si falta el dato, NO se concluye. Se emite un aviso de tipo
 * "falta" diciendo qué cargar. Un tablero que inventa una recomendación con
 * datos incompletos es peor que uno que se calla.
 */

export type Recomendacion = {
  id: string;
  /** critica | alta | media | info | falta */
  prioridad: "critica" | "alta" | "media" | "info" | "falta";
  situacion: string;
  motivo: string;
  /** Impacto estimado en centavos. 0 si no es cuantificable. */
  impacto: number;
  accion: string;
  metrica: string;
  href?: string;
};

const ORDEN = { critica: 0, alta: 1, media: 2, falta: 3, info: 4 } as const;

export function generarBriefing(d: DatosOverview): Recomendacion[] {
  const r: Recomendacion[] = [];
  const { meta, embudo, clientes, marketing, dinero: din } = d;

  // ---------- objetivo del mes ----------
  if (!d.objetivoDefinido) {
    r.push({
      id: "sin-objetivo",
      prioridad: "falta",
      situacion: "No hay objetivo de facturación cargado para este mes",
      motivo: "Sin objetivo no se puede calcular cuánto falta, ni el ritmo diario necesario, ni si vas adelantado o atrasado.",
      impacto: 0,
      accion: "Definí el objetivo mensual en la sección Goals.",
      metrica: "Objetivo mensual",
      href: "/ceo/goals",
    });
  } else if (meta.estado === "completed") {
    r.push({
      id: "objetivo-cumplido",
      prioridad: "info",
      situacion: `Objetivo del mes alcanzado: ${dinero(meta.recaudado)} sobre ${dinero(meta.objetivo)}`,
      motivo: `Quedan ${meta.diasRestantes} días. Todo lo que entre ahora es excedente.`,
      impacto: 0,
      accion: "Adelantá cierres del mes que viene para arrancar con colchón.",
      metrica: "Ingresos del mes",
      href: "/ceo/revenue",
    });
  } else {
    const faltanCierres =
      din.ticket && din.ticket > 0 ? Math.ceil(meta.restante / din.ticket) : null;
    r.push({
      id: "objetivo",
      prioridad: meta.estado === "behind" ? "critica" : meta.estado === "atRisk" ? "alta" : "media",
      situacion: `Faltan ${dinero(meta.restante)} para el objetivo del mes`,
      motivo:
        `Llevás ${porcentaje(meta.progreso)} en ${meta.diasTranscurridos} días. ` +
        `Quedan ${meta.diasRestantes} días, así que necesitás ${dinero(meta.diarioNecesario)} por día ` +
        `(${dinero(meta.semanalNecesario)} por semana). Al ritmo actual cerrás el mes en ${dinero(meta.proyeccion)}.`,
      impacto: meta.restante,
      accion: faltanCierres
        ? `Cerrar ${faltanCierres} contrato${faltanCierres === 1 ? "" : "s"} de tu ticket promedio (${dinero(din.ticket!)}).`
        : "Registrá tus clientes activos para poder calcular cuántos cierres faltan.",
      metrica: "Ingresos del mes",
      href: "/ceo/revenue",
    });
  }

  // ---------- pipeline vs objetivo ----------
  if (d.objetivoDefinido && meta.restante > 0) {
    if (embudo.pipelinePond < meta.restante) {
      r.push({
        id: "pipeline-corto",
        prioridad: "alta",
        situacion: "El pipeline no alcanza para cubrir lo que falta del mes",
        motivo:
          `Pipeline ponderado por probabilidad: ${dinero(embudo.pipelinePond)}. ` +
          `Falta para el objetivo: ${dinero(meta.restante)}. Aunque cerraras todo lo probable, no llegás.`,
        impacto: meta.restante - embudo.pipelinePond,
        accion: "Sumá oportunidades nuevas esta semana: el problema es de volumen de entrada, no de cierre.",
        metrica: "Pipeline ponderado",
        href: "/ceo/pipeline",
      });
    }
  }

  // ---------- seguimientos vencidos ----------
  if (embudo.seguimientosVencidos.length > 0) {
    const valor = embudo.seguimientosVencidos.reduce((t, p) => t + p.valorEstimado, 0);
    r.push({
      id: "seguimientos",
      prioridad: embudo.seguimientosVencidos.length >= 3 ? "critica" : "alta",
      situacion: `${embudo.seguimientosVencidos.length} seguimiento${embudo.seguimientosVencidos.length === 1 ? "" : "s"} vencido${embudo.seguimientosVencidos.length === 1 ? "" : "s"}`,
      motivo:
        `${embudo.seguimientosVencidos.slice(0, 3).map((p) => p.empresa).join(", ")}` +
        `${embudo.seguimientosVencidos.length > 3 ? ` y ${embudo.seguimientosVencidos.length - 3} más` : ""}. ` +
        `Representan ${dinero(valor)} en oportunidades.`,
      impacto: valor,
      accion: "Escribiles hoy. Un seguimiento vencido es la forma más barata de perder un negocio ya trabajado.",
      metrica: "Oportunidades activas",
      href: "/ceo/leads",
    });
  }

  // ---------- leads sin contactar ----------
  if (embudo.sinContactar > 0) {
    r.push({
      id: "sin-contactar",
      prioridad: embudo.sinContactar >= 5 ? "alta" : "media",
      situacion: `${embudo.sinContactar} lead${embudo.sinContactar === 1 ? "" : "s"} sin contactar`,
      motivo: "Están cargados pero nadie los tocó todavía. Un lead sin contactar tiene valor cero.",
      impacto: 0,
      accion: "Priorizá por score: empezá por los de puntaje más alto.",
      metrica: "Tasa de contacto",
      href: "/ceo/leads",
    });
  }

  // ---------- estancados ----------
  if (embudo.estancados.length > 0) {
    const valor = embudo.estancados.reduce((t, p) => t + p.valorEstimado, 0);
    r.push({
      id: "estancados",
      prioridad: "media",
      situacion: `${embudo.estancados.length} oportunidad${embudo.estancados.length === 1 ? "" : "es"} sin movimiento hace más de 10 días`,
      motivo: `Suman ${dinero(valor)}. Una oportunidad que no avanza en 10 días normalmente ya se enfrió.`,
      impacto: valor,
      accion: "Reactivalas o marcalas como perdidas. Un pipeline inflado con negocios muertos te hace planificar mal.",
      metrica: "Tiempo en etapa",
      href: "/ceo/pipeline",
    });
  }

  // ---------- clientes en riesgo ----------
  for (const c of clientes.enRiesgo) {
    const anual = c.precioMensual * 12;
    r.push({
      id: `riesgo-${c.id}`,
      prioridad: c.salud === "riesgo" ? "critica" : "media",
      situacion: `${c.empresa} está ${c.salud === "riesgo" ? "en riesgo de cancelar" : "necesitando atención"}`,
      motivo:
        c.proximosPasos ??
        `Satisfacción ${c.satisfaccion}/5. Contrato de ${dinero(c.precioMensual)} por mes.`,
      impacto: anual,
      accion: `Llamalo esta semana. Retener cuesta mucho menos que reemplazar ${dinero(anual)} de facturación anual.`,
      metrica: "Retención",
      href: "/ceo/clients",
    });
  }

  // ---------- canales ----------
  if (marketing.porCanal.length === 0) {
    r.push({
      id: "sin-canales",
      prioridad: "falta",
      situacion: "No hay campañas cargadas",
      motivo: "Sin campañas no se puede calcular costo por lead, costo por reunión ni retorno por canal.",
      impacto: 0,
      accion: "Cargá tus campañas activas con su presupuesto y resultados en la sección Campaigns.",
      metrica: "ROI por canal",
      href: "/ceo/campaigns",
    });
  } else {
    const perdedores = marketing.porCanal.filter((c) => c.gastado > 0 && (c.roi ?? 0) < 0);
    for (const c of perdedores.slice(0, 2)) {
      r.push({
        id: `canal-malo-${c.canal}`,
        prioridad: "alta",
        situacion: `${c.nombre} está perdiendo dinero`,
        motivo:
          `Invertiste ${dinero(c.gastado)} y volvieron ${dinero(c.ingresos)}. ` +
          `ROI de ${porcentaje(c.roi ?? 0)}${c.ventas === 0 ? ", sin ninguna venta cerrada" : ""}.`,
        impacto: c.gastado - c.ingresos,
        accion: "Pausalo o cambiale la oferta. Ese presupuesto rinde más en el canal que ya funciona.",
        metrica: "ROI por canal",
        href: "/ceo/marketing",
      });
    }

    const conReuniones = marketing.porCanal.filter((c) => c.cpr !== null && c.reuniones >= 3);
    if (conReuniones.length >= 2) {
      const mejor = [...conReuniones].sort((a, b) => (a.cpr ?? 0) - (b.cpr ?? 0))[0];
      const peor = [...conReuniones].sort((a, b) => (b.cpr ?? 0) - (a.cpr ?? 0))[0];
      if (mejor.canal !== peor.canal && (peor.cpr ?? 0) > (mejor.cpr ?? 0) * 1.5) {
        r.push({
          id: "canal-escalar",
          prioridad: "media",
          situacion: `${mejor.nombre} consigue reuniones más baratas que ${peor.nombre}`,
          motivo: `${dinero(mejor.cpr!)} por reunión contra ${dinero(peor.cpr!)}. Más de 1.5x de diferencia.`,
          impacto: 0,
          accion: `Mové presupuesto de ${peor.nombre} a ${mejor.nombre} y medí dos semanas antes de decidir.`,
          metrica: "Costo por reunión",
          href: "/ceo/marketing",
        });
      }
    }
  }

  // ---------- margen ----------
  if (din.margenMes !== null && din.margenMes < 30 && din.recaudadoMes > 0) {
    r.push({
      id: "margen",
      prioridad: din.margenMes < 15 ? "alta" : "media",
      situacion: `Margen de ${porcentaje(din.margenMes)} este mes`,
      motivo: `Facturaste ${dinero(din.recaudadoMes)} y gastaste ${dinero(din.gastoMes)}.`,
      impacto: 0,
      accion: "Revisá los clientes con mayor costo operativo: puede haber uno que factura pero no deja.",
      metrica: "Margen de ganancia",
      href: "/ceo/revenue",
    });
  }

  // ---------- datos faltantes ----------
  if (clientes.total === 0) {
    r.push({
      id: "sin-clientes",
      prioridad: "falta",
      situacion: "No hay clientes cargados",
      motivo: "Sin clientes no se puede calcular MRR, ticket promedio, lifetime value ni riesgo de cancelación.",
      impacto: 0,
      accion: "Cargá tus clientes activos con su precio mensual en la sección Clients.",
      metrica: "MRR",
      href: "/ceo/clients",
    });
  }
  if (marketing.inversionMes === 0 && embudo.leadsTotales > 0) {
    r.push({
      id: "sin-gastos",
      prioridad: "falta",
      situacion: "No hay inversión de marketing registrada este mes",
      motivo: "Sin gasto cargado, el costo de adquisición y el ROI no se pueden calcular — no son cero, son desconocidos.",
      impacto: 0,
      accion: "Registrá lo que gastás en anuncios y herramientas en la sección Revenue.",
      metrica: "CAC",
      href: "/ceo/revenue",
    });
  }

  return r.sort((a, b) => ORDEN[a.prioridad] - ORDEN[b.prioridad] || b.impacto - a.impacto);
}

export const COLOR_PRIORIDAD: Record<Recomendacion["prioridad"], string> = {
  critica: "ceo-chip-red",
  alta: "ceo-chip-red",
  media: "ceo-chip-gold",
  falta: "ceo-chip-gris",
  info: "ceo-chip-green",
};

export const ETIQUETA_PRIORIDAD: Record<Recomendacion["prioridad"], string> = {
  critica: "Crítico",
  alta: "Alta",
  media: "Media",
  falta: "Falta cargar",
  info: "Info",
};
