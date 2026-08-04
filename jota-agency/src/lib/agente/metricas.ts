import { prisma } from "@/lib/prisma";
import { paraTenant, estaAbierto } from "./tenant";
import { MODELO } from "./agente";

/**
 * Workflow 17 — Reporting and Analytics.
 *
 * Misma regla que en el CEO Command Center: dividir por cero devuelve `null`,
 * no `0`. "No hubo leads" y "el costo por lead es cero" son cosas distintas, y
 * mostrar $0 cuando en realidad no hay datos hace que el reporte mienta justo
 * en el número que se usa para decidir.
 */

export function dividir(n: number, d: number): number | null {
  return d > 0 ? n / d : null;
}

/**
 * Precio por millón de tokens, en centavos de dólar.
 * Si se cambia AGENTE_MODELO a uno que no está acá, el costo se informa como
 * null en vez de inventar un número.
 */
const PRECIOS: Record<string, { entrada: number; salida: number }> = {
  "claude-opus-4-8": { entrada: 500, salida: 2500 },
  "claude-opus-4-7": { entrada: 500, salida: 2500 },
  "claude-sonnet-5": { entrada: 300, salida: 1500 },
  "claude-sonnet-4-6": { entrada: 300, salida: 1500 },
  "claude-haiku-4-5": { entrada: 100, salida: 500 },
};

/** Costo en centavos. null si no se conoce el precio del modelo configurado. */
export function costoCentavos(entrada: number, salida: number, modelo = MODELO): number | null {
  const p = PRECIOS[modelo];
  if (!p) return null;
  return Math.round((entrada * p.entrada + salida * p.salida) / 1_000_000);
}

export type Metricas = {
  desde: Date;
  hasta: Date;
  consultas: number;
  respondidas: number;
  tasaRespuesta: number | null;
  primeraRespuestaMin: number | null;
  resueltasPorIa: number;
  handoffs: number;
  fueraDeHorario: number;
  recuperadas: number;
  errores: number;
  leads: number;
  leadsCalificados: number;
  hotLeads: number;
  reuniones: number;
  emailsEnviados: number;
  emailsSimulados: number;
  rebotes: number;
  bajas: number;
  seguimientosEnviados: number;
  tokensEntrada: number;
  tokensSalida: number;
  costoIaCentavos: number | null;
  costoPorConversacion: number | null;
  costoPorLead: number | null;
  ingresoEstimadoCentavos: number;
  porCanal: { canal: string; consultas: number; leads: number }[];
};

/** Ventana de los últimos N días. Que el rango se arme acá y no en la página
 *  mantiene el render del panel libre de lecturas del reloj. */
export async function ultimosDias(tenantId: string, dias: number): Promise<Metricas> {
  const hasta = new Date();
  return calcular(tenantId, new Date(hasta.getTime() - dias * 86_400_000), hasta);
}

export async function calcular(tenantId: string, desde: Date, hasta = new Date()): Promise<Metricas> {
  const t = await prisma.tenant.findUnique({ where: { id: tenantId } });
  const rango = { gte: desde, lte: hasta };

  const [entrantes, salientesIa, conversaciones, leads, citas, emails, supresiones, seguimientos, eventosError] =
    await Promise.all([
      prisma.message.findMany({
        where: paraTenant(tenantId, { direccion: "entrante", createdAt: rango }),
        select: { id: true, conversationId: true, estadoFinal: true, createdAt: true },
      }),
      prisma.message.aggregate({
        where: paraTenant(tenantId, { direccion: "saliente", generadoPorIa: true, createdAt: rango }),
        _sum: { tokensEntrada: true, tokensSalida: true },
        _count: true,
      }),
      prisma.conversation.findMany({
        where: paraTenant(tenantId, { createdAt: rango }),
        select: { id: true, canal: true, estado: true },
      }),
      prisma.lead.findMany({
        where: paraTenant(tenantId, { createdAt: rango }),
        select: { id: true, score: true, estado: true, presupuesto: true, conversationId: true },
      }),
      prisma.appointment.count({
        where: paraTenant(tenantId, { createdAt: rango, estado: { in: ["agendada", "reprogramada", "completada"] } }),
      }),
      prisma.emailOutbox.groupBy({
        by: ["estado"],
        where: paraTenant(tenantId, { createdAt: rango }),
        _count: true,
      }),
      prisma.suppression.groupBy({
        by: ["motivo"],
        where: paraTenant(tenantId, { createdAt: rango }),
        _count: true,
      }),
      prisma.followUp.count({ where: paraTenant(tenantId, { estado: "enviado", enviadoEn: rango }) }),
      prisma.workflowEvent.count({ where: paraTenant(tenantId, { tipo: "dlq", createdAt: rango }) }),
    ]);

  const respondidas = entrantes.filter((m) => m.estadoFinal && m.estadoFinal !== "error").length;
  const handoffs = entrantes.filter((m) => m.estadoFinal === "handoff").length;
  const errores = entrantes.filter((m) => m.estadoFinal === "error").length;
  const resueltasPorIa = entrantes.filter(
    (m) => m.estadoFinal === "respondida" || m.estadoFinal === "calificada" || m.estadoFinal === "agendada",
  ).length;

  const fueraDeHorario = t ? entrantes.filter((m) => !estaAbierto(t, m.createdAt)).length : 0;

  const primeraRespuestaMin = await tiempoPrimeraRespuesta(tenantId, entrantes);

  const tokensEntrada = salientesIa._sum.tokensEntrada ?? 0;
  const tokensSalida = salientesIa._sum.tokensSalida ?? 0;
  const costoIa = costoCentavos(tokensEntrada, tokensSalida);

  const cuenta = (lista: { estado?: string; motivo?: string; _count: number }[], clave: string) =>
    lista.find((x) => x.estado === clave || x.motivo === clave)?._count ?? 0;

  const porCanal = agruparPorCanal(conversaciones, leads);

  return {
    desde, hasta,
    consultas: entrantes.length,
    respondidas,
    tasaRespuesta: dividir(respondidas, entrantes.length),
    primeraRespuestaMin,
    resueltasPorIa,
    handoffs,
    fueraDeHorario,
    recuperadas: errores,
    errores: eventosError,
    leads: leads.length,
    leadsCalificados: leads.filter((l) => l.score >= 60).length,
    hotLeads: leads.filter((l) => l.score >= 80).length,
    reuniones: citas,
    emailsEnviados: cuenta(emails, "enviado"),
    emailsSimulados: cuenta(emails, "simulado"),
    rebotes: cuenta(supresiones, "rebote"),
    bajas: cuenta(supresiones, "baja"),
    seguimientosEnviados: seguimientos,
    tokensEntrada,
    tokensSalida,
    costoIaCentavos: costoIa,
    costoPorConversacion: costoIa === null ? null : dividir(costoIa, conversaciones.length),
    costoPorLead: costoIa === null ? null : dividir(costoIa, leads.length),
    // Solo suma presupuestos que el contacto DIJO. Nunca se estima uno.
    ingresoEstimadoCentavos: leads.reduce((s, l) => s + (l.presupuesto ?? 0), 0),
    porCanal,
  };
}

/**
 * Minutos entre la consulta y la primera respuesta.
 *
 * Es la métrica que se le vende al cliente ("no lead goes unanswered, not even
 * at 3am"), así que se calcula de verdad: por conversación, con la primera
 * saliente posterior a la primera entrante.
 */
async function tiempoPrimeraRespuesta(
  tenantId: string,
  entrantes: { conversationId: string; createdAt: Date }[],
): Promise<number | null> {
  if (entrantes.length === 0) return null;
  const primeras = new Map<string, Date>();
  for (const m of entrantes) {
    const ya = primeras.get(m.conversationId);
    if (!ya || m.createdAt < ya) primeras.set(m.conversationId, m.createdAt);
  }
  const ids = [...primeras.keys()].slice(0, 500);
  const salientes = await prisma.message.findMany({
    where: paraTenant(tenantId, { conversationId: { in: ids }, direccion: "saliente" }),
    select: { conversationId: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  const primeraSalida = new Map<string, Date>();
  for (const s of salientes) {
    if (!primeraSalida.has(s.conversationId)) primeraSalida.set(s.conversationId, s.createdAt);
  }

  const diffs: number[] = [];
  for (const [conv, entrada] of primeras) {
    const salida = primeraSalida.get(conv);
    if (salida && salida > entrada) diffs.push((salida.getTime() - entrada.getTime()) / 60_000);
  }
  if (diffs.length === 0) return null;
  return Math.round((diffs.reduce((a, b) => a + b, 0) / diffs.length) * 10) / 10;
}

function agruparPorCanal(
  conversaciones: { id: string; canal: string }[],
  leads: { conversationId: string | null }[],
): { canal: string; consultas: number; leads: number }[] {
  const canalDe = new Map(conversaciones.map((c) => [c.id, c.canal]));
  const mapa = new Map<string, { consultas: number; leads: number }>();
  for (const c of conversaciones) {
    const v = mapa.get(c.canal) ?? { consultas: 0, leads: 0 };
    v.consultas++;
    mapa.set(c.canal, v);
  }
  for (const l of leads) {
    const canal = l.conversationId ? canalDe.get(l.conversationId) : null;
    if (!canal) continue;
    const v = mapa.get(canal) ?? { consultas: 0, leads: 0 };
    v.leads++;
    mapa.set(canal, v);
  }
  return [...mapa.entries()]
    .map(([canal, v]) => ({ canal, ...v }))
    .sort((a, b) => b.consultas - a.consultas);
}

/** Datos del reporte diario al dueño del negocio. */
export async function reporteDiario(tenantId: string) {
  const hasta = new Date();
  const desde = new Date(hasta.getTime() - 24 * 3600_000);
  const m = await calcular(tenantId, desde, hasta);

  const [hot, sinResolver, preguntas] = await Promise.all([
    prisma.lead.findMany({
      where: paraTenant(tenantId, { createdAt: { gte: desde }, score: { gte: 80 } }),
      include: { contacto: { select: { nombre: true, email: true, empresa: true } } },
      orderBy: { score: "desc" },
      take: 10,
    }),
    prisma.conversation.count({
      where: paraTenant(tenantId, { estado: "esperando_humano" }),
    }),
    prisma.conversation.groupBy({
      by: ["intencion"],
      where: paraTenant(tenantId, { createdAt: { gte: desde } }),
      _count: true,
      orderBy: { _count: { intencion: "desc" } },
      take: 5,
    }),
  ]);

  return { metricas: m, hotLeads: hot, sinResolver, preguntas };
}
