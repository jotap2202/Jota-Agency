import { prisma } from "@/lib/prisma";
import { ZONA } from "@/lib/zona";
import { ETIQUETA_CANAL } from "@/lib/ceo/demo";
import {
  costoAdquisicion, costoPorLead, costoPorReunion, estadoObjetivoMensual,
  margen, partesDeFecha, pipelinePonderado, proyeccion, roi, tasaConversion,
  ticketPromedio,
} from "@/lib/ceo/metricas";

/** Etapas del embudo, en orden. Fuente única para pipeline y conteos. */
export const ETAPAS = [
  { clave: "nuevo", nombre: "New Lead" },
  { clave: "contactado", nombre: "Contacted" },
  { clave: "replied", nombre: "Replied" },
  { clave: "qualified", nombre: "Qualified" },
  { clave: "reunion", nombre: "Meeting" },
  { clave: "propuesta", nombre: "Proposal" },
  { clave: "negociacion", nombre: "Negotiation" },
  { clave: "cliente", nombre: "Won" },
  { clave: "descartado", nombre: "Lost" },
] as const;

/** Etapas que cuentan como oportunidad abierta (ni ganada ni perdida). */
const ABIERTAS = ["contactado", "replied", "qualified", "reunion", "propuesta", "negociacion"];

/** Primer y último instante del mes en curso, según la hora de Maui. */
export function limitesDelMes(ahora = new Date()) {
  const { anio, mes } = partesDeFecha(ahora);
  // Se agrega el desfase de Maui (UTC-10) para que el corte del mes ocurra a
  // medianoche allá y no a medianoche UTC, que sería 10 horas antes.
  const desfaseMs = 10 * 3_600_000;
  return {
    desde: new Date(Date.UTC(anio, mes - 1, 1) + desfaseMs),
    hasta: new Date(Date.UTC(anio, mes, 1) + desfaseMs),
    anio,
    mes,
  };
}

function mesesAtras(n: number, ahora = new Date()) {
  const { anio, mes } = partesDeFecha(ahora);
  const desfaseMs = 10 * 3_600_000;
  return new Date(Date.UTC(anio, mes - 1 - n, 1) + desfaseMs);
}

const etiquetaMes = (d: Date) =>
  new Intl.DateTimeFormat("en-US", { timeZone: ZONA, month: "short" }).format(d);

export type DatosOverview = Awaited<ReturnType<typeof cargarOverview>>;

export async function cargarOverview() {
  const ahora = new Date();
  const { desde, hasta } = limitesDelMes(ahora);
  const hace6 = mesesAtras(5, ahora);

  const [ingresos6m, gastos6m, prospectos, clientes, campanias, objetivo, tareas, hayDemo] =
    await Promise.all([
      prisma.ingreso.findMany({ where: { fecha: { gte: hace6 } }, orderBy: { fecha: "asc" } }),
      prisma.gasto.findMany({ where: { fecha: { gte: hace6 } } }),
      prisma.prospecto.findMany(),
      prisma.cliente.findMany(),
      prisma.campania.findMany(),
      prisma.objetivo.findFirst({
        where: { tipo: "mensual", metrica: "ingresos", periodoFin: { gte: desde } },
        orderBy: { periodoFin: "asc" },
      }),
      prisma.tareaCeo.findMany({ where: { estado: { not: "hecha" } }, orderBy: { vence: "asc" } }),
      prisma.prospecto.count({ where: { esDemo: true } }).then((n) => n > 0),
    ]);

  // ---------- dinero ----------
  const delMes = ingresos6m.filter((i) => i.fecha >= desde && i.fecha < hasta);
  const recaudadoMes = delMes.reduce((t, i) => t + i.monto, 0);
  const gastosMes = gastos6m.filter((g) => g.fecha >= desde && g.fecha < hasta);
  const gastoMes = gastosMes.reduce((t, g) => t + g.monto, 0);
  const gananciaMes = recaudadoMes - gastoMes;

  const clientesActivos = clientes.filter((c) => c.estadoContrato === "activo");
  const mrr = clientesActivos.reduce((t, c) => t + c.precioMensual, 0);
  const enRiesgo = clientes.filter((c) => c.salud === "riesgo" || c.salud === "atencion");

  // Serie de 6 meses
  const serieMeses: { etiqueta: string; valor: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const ini = mesesAtras(i, ahora);
    const fin = mesesAtras(i - 1, ahora);
    serieMeses.push({
      etiqueta: etiquetaMes(ini),
      valor: ingresos6m.filter((x) => x.fecha >= ini && x.fecha < fin).reduce((t, x) => t + x.monto, 0),
    });
  }

  // ---------- objetivo ----------
  const objetivoMes = objetivo?.valorObjetivo ?? 0;
  const meta = estadoObjetivoMensual(objetivoMes, recaudadoMes, ahora);

  // ---------- embudo ----------
  const porEtapa = ETAPAS.map((e) => {
    const enEtapa = prospectos.filter((p) => p.estado === e.clave);
    return {
      etiqueta: e.nombre,
      clave: e.clave,
      valor: enEtapa.length,
      valorDinero: enEtapa.reduce((t, p) => t + p.valorEstimado, 0),
    };
  });

  const abiertos = prospectos.filter((p) => ABIERTAS.includes(p.estado));
  const pipelineTotal = abiertos.reduce((t, p) => t + p.valorEstimado, 0);
  const pipelinePond = pipelinePonderado(abiertos);

  const leadsNuevosMes = prospectos.filter((p) => p.createdAt >= desde).length;
  const calificados = prospectos.filter((p) =>
    ["qualified", "reunion", "propuesta", "negociacion", "cliente"].includes(p.estado),
  ).length;
  const reuniones = prospectos.filter((p) =>
    ["reunion", "propuesta", "negociacion", "cliente"].includes(p.estado),
  ).length;
  const propuestas = prospectos.filter((p) => ["propuesta", "negociacion"].includes(p.estado)).length;
  const ganados = prospectos.filter((p) => p.estado === "cliente").length;

  // ---------- marketing ----------
  const inversionMktMes = gastosMes
    .filter((g) => g.categoria === "marketing" || g.categoria === "herramientas")
    .reduce((t, g) => t + g.monto, 0);

  const canales = new Map<string, { leads: number; reuniones: number; ventas: number; ingresos: number; gastado: number }>();
  for (const c of campanias) {
    const a = canales.get(c.canal) ?? { leads: 0, reuniones: 0, ventas: 0, ingresos: 0, gastado: 0 };
    a.leads += c.leads; a.reuniones += c.reuniones; a.ventas += c.ventas;
    a.ingresos += c.ingresos; a.gastado += c.gastado;
    canales.set(c.canal, a);
  }
  const porCanal = [...canales.entries()]
    .map(([canal, v]) => ({
      canal,
      nombre: ETIQUETA_CANAL[canal] ?? canal,
      ...v,
      cpl: costoPorLead(v.gastado, v.leads),
      cpr: costoPorReunion(v.gastado, v.reuniones),
      cac: costoAdquisicion(v.gastado, v.ventas),
      roi: roi(v.ingresos, v.gastado),
      conversion: tasaConversion(v.ventas, v.leads),
    }))
    .sort((a, b) => b.ingresos - a.ingresos);

  const porServicio = [...delMes.reduce((m, i) => {
    m.set(i.servicio, (m.get(i.servicio) ?? 0) + i.monto);
    return m;
  }, new Map<string, number>())]
    .map(([etiqueta, valor]) => ({ etiqueta, valor }))
    .sort((a, b) => b.valor - a.valor);

  const campaniasActivas = campanias.filter((c) => c.estado === "active");

  return {
    hayDemo,
    ahora,
    meta,
    objetivoDefinido: Boolean(objetivo),

    dinero: {
      recaudadoMes,
      gastoMes,
      gananciaMes,
      margenMes: margen(gananciaMes, recaudadoMes),
      mrr,
      ticket: ticketPromedio(mrr, clientesActivos.length),
      serieMeses,
      porServicio,
      proyeccion: proyeccion(mrr, pipelinePond),
    },

    embudo: {
      porEtapa,
      pipelineTotal,
      pipelinePond,
      leadsNuevosMes,
      leadsTotales: prospectos.length,
      calificados,
      reuniones,
      propuestas,
      ganados,
      conversion: tasaConversion(ganados, prospectos.length),
      sinContactar: prospectos.filter((p) => p.estado === "nuevo").length,
      seguimientosVencidos: prospectos.filter(
        (p) => p.proximoContacto && p.proximoContacto <= ahora && !["cliente", "descartado"].includes(p.estado),
      ),
      topLeads: [...abiertos].sort((a, b) => b.score - a.score).slice(0, 5),
      estancados: abiertos.filter(
        (p) => p.ultimoContacto && ahora.getTime() - p.ultimoContacto.getTime() > 10 * 86_400_000,
      ),
    },

    clientes: {
      total: clientes.length,
      activos: clientesActivos.length,
      enRiesgo,
      lista: clientes,
    },

    marketing: {
      inversionMes: inversionMktMes,
      cac: costoAdquisicion(inversionMktMes, ganados),
      roiMes: roi(recaudadoMes, inversionMktMes),
      porCanal,
      campaniasActivas: campaniasActivas.length,
      peorCampania: [...campanias]
        .filter((c) => c.gastado > 0)
        .sort((a, b) => (roi(a.ingresos, a.gastado) ?? 0) - (roi(b.ingresos, b.gastado) ?? 0))[0],
      mejorCampania: [...campanias]
        .filter((c) => c.gastado > 0)
        .sort((a, b) => (roi(b.ingresos, b.gastado) ?? 0) - (roi(a.ingresos, a.gastado) ?? 0))[0],
    },

    tareas,
  };
}
