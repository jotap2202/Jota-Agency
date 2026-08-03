import { PrismaClient } from "@prisma/client";
import { calcularScore, resumirScore } from "@/lib/ceo/score";
import { cargarOverview } from "@/lib/ceo/datos";
import { generarBriefing } from "@/lib/ceo/briefing";
import { dinero, porcentaje } from "@/lib/ceo/dinero";
import { costoPorLead } from "@/lib/ceo/metricas";
import {
  LEADS_DEMO, CLIENTES_DEMO, CAMPANIAS_DEMO, TAREAS_DEMO,
  INGRESOS_POR_MES, GASTOS_DEMO, OBJETIVO_MENSUAL, hace, en, USD,
} from "@/lib/ceo/demo";

const prisma = new PrismaClient();
let f = 0;
const ok = (c: boolean, m: string) => { console.log(c ? `  ✅ ${m}` : `  ❌ ${m}`); if (!c) f++; };
const inicioDeMes = (n: number) => { const h = new Date(); return new Date(Date.UTC(h.getUTCFullYear(), h.getUTCMonth() - n, 1, 12)); };

/** Misma lógica que la server action cargarDemo(), sin el chequeo de sesión. */
async function sembrar() {
  for (const l of LEADS_DEMO) {
    const datos = { industria: l.industria, empleados: l.empleados, ingresosEstimados: l.facturacion, cargo: l.cargo, web: `https://x.example`, linkedin: null, servicioInteres: l.servicio, estado: l.estado, ultimoContacto: l.diasDesdeContacto != null ? hace(l.diasDesdeContacto) : null };
    const r = calcularScore(datos);
    await prisma.prospecto.create({ data: {
      empresa: l.empresa, rubro: l.rubro, industria: l.industria, ciudad: l.ciudad, pais: "US",
      web: datos.web, contacto: l.contacto, cargo: l.cargo, empleados: l.empleados,
      ingresosEstimados: l.facturacion, servicioInteres: l.servicio, fuente: l.fuente,
      estado: l.estado, valorEstimado: l.valor, probabilidad: l.prob,
      score: r.score, scoreDetalle: resumirScore(r), ultimoContacto: datos.ultimoContacto,
      proximoContacto: l.seguimientoEnDias != null ? en(l.seguimientoEnDias) : null, esDemo: true,
    }});
  }
  const clientes = [];
  for (const c of CLIENTES_DEMO) {
    clientes.push(await prisma.cliente.create({ data: {
      empresa: c.empresa, contacto: c.contacto, email: c.email, servicio: c.servicio,
      inicio: inicioDeMes(c.mesesAtras), precioMensual: c.precioMensual, costoOperativo: c.costoOperativo,
      estadoContrato: "activo", reunionesLogradas: c.reuniones, leadsEntregados: c.leads,
      satisfaccion: c.satisfaccion, salud: c.salud, ultimoContacto: hace(c.ultimoContactoDias),
      proximosPasos: c.pasos, esDemo: true,
    }}));
  }
  for (const mes of INGRESOS_POR_MES) {
    const base = inicioDeMes(mes.mesesAtras);
    const activos = clientes.filter((c) => c.inicio <= base);
    const suma = activos.reduce((t, c) => t + c.precioMensual, 0);
    for (const c of activos) {
      await prisma.ingreso.create({ data: { concepto: `${c.servicio} — ${c.empresa}`, monto: c.precioMensual, fecha: new Date(base.getTime() + 4 * 86400000), servicio: c.servicio, canal: "referidos", recurrente: true, clienteId: c.id, esDemo: true } });
    }
    const resto = USD(mes.total) - suma;
    if (resto > 0) await prisma.ingreso.create({ data: { concepto: "Website Development", monto: resto, fecha: new Date(base.getTime() + 12 * 86400000), servicio: "Website Development", canal: "linkedin", esDemo: true } });
    for (const g of GASTOS_DEMO) {
      await prisma.gasto.create({ data: { concepto: g.concepto, monto: g.mensual, fecha: new Date(base.getTime() + 2 * 86400000), categoria: g.categoria, canal: g.canal, esDemo: true } });
    }
  }
  for (const c of CAMPANIAS_DEMO) {
    await prisma.campania.create({ data: { nombre: c.nombre, canal: c.canal, publico: c.publico, industria: c.industria, inicio: hace(c.diasAtras), presupuesto: c.presupuesto, gastado: c.gastado, enviados: c.enviados, respuestas: c.respuestas, respuestasPositivas: c.positivas, leads: c.leads, reuniones: c.reuniones, ventas: c.ventas, ingresos: c.ingresos, estado: c.estado, esDemo: true } });
  }
  const h = new Date();
  await prisma.objetivo.create({ data: { titulo: "Monthly Revenue Goal", tipo: "mensual", metrica: "ingresos", valorObjetivo: OBJETIVO_MENSUAL, periodoInicio: new Date(Date.UTC(h.getUTCFullYear(), h.getUTCMonth(), 1, 12)), periodoFin: new Date(Date.UTC(h.getUTCFullYear(), h.getUTCMonth() + 1, 0, 12)), esDemo: true } });
  for (const t of TAREAS_DEMO) {
    await prisma.tareaCeo.create({ data: { titulo: t.titulo, descripcion: t.descripcion, prioridad: t.prioridad, categoria: t.categoria, vence: en(t.venceEnDias), impacto: t.impacto, esDemo: true } });
  }
}

const TABLAS = '"Actividad","TareaCeo","Notificacion","Ingreso","Gasto","Campania","Objetivo","Cliente","Prospecto"';

(async () => {
  console.log("\n1. Sembrar los datos demo");
  // Se limpia ANTES, no solo al final: si una corrida anterior se cortó a la
  // mitad, la siguiente encontraría datos viejos y fallaría por duplicados.
  // Una prueba que solo pasa con la base recién creada no sirve de red.
  await prisma.$executeRawUnsafe(`TRUNCATE ${TABLAS} CASCADE`);
  await sembrar();
  ok(await prisma.prospecto.count() === 30, `30 leads (${await prisma.prospecto.count()})`);
  ok(await prisma.cliente.count() === 5, "5 clientes");
  ok(await prisma.campania.count() === 6, "6 campañas");
  ok(await prisma.tareaCeo.count() === 12, "12 tareas");
  ok(await prisma.ingreso.count() >= 6, "6 meses de ingresos");

  console.log("\n2. cargarOverview() sobre datos reales");
  const d = await cargarOverview();
  ok(d.hayDemo === true, "detecta que hay datos demo");
  ok(d.objetivoDefinido === true, "encuentra el objetivo del mes");
  ok(d.meta.objetivo === USD(25000), `objetivo $25,000 (${dinero(d.meta.objetivo)})`);
  ok(d.dinero.recaudadoMes > 0, `recaudado del mes: ${dinero(d.dinero.recaudadoMes)}`);
  ok(d.dinero.mrr === USD(1800 + 3200 + 2400 + 1500 + 1200), `MRR = suma de los 5 contratos (${dinero(d.dinero.mrr)})`);
  ok(d.dinero.serieMeses.length === 6, "la serie tiene 6 meses");
  ok(d.clientes.activos === 5, "5 clientes activos");
  ok(d.clientes.enRiesgo.length === 2, `2 clientes en riesgo/atención (${d.clientes.enRiesgo.length})`);

  console.log("\n3. Embudo y pipeline");
  ok(d.embudo.leadsTotales === 30, "30 leads en total");
  ok(d.embudo.porEtapa.reduce((t, e) => t + e.valor, 0) === 30, "las etapas suman los 30 leads, sin perder ninguno");
  ok(d.embudo.pipelinePond < d.embudo.pipelineTotal, `ponderado (${dinero(d.embudo.pipelinePond)}) < total (${dinero(d.embudo.pipelineTotal)})`);
  ok(d.embudo.sinContactar === LEADS_DEMO.filter(l => l.estado === "nuevo").length, `sin contactar: ${d.embudo.sinContactar}`);
  ok(d.embudo.topLeads.length === 5, "top 5 oportunidades");
  ok(d.embudo.topLeads.every((p, i, a) => i === 0 || a[i-1].score >= p.score), "el top viene ordenado por score");
  ok(d.embudo.seguimientosVencidos.length >= 2, `${d.embudo.seguimientosVencidos.length} seguimientos vencidos`);

  console.log("\n4. Marketing por canal");
  ok(d.marketing.porCanal.length === 6, `6 canales con campañas (${d.marketing.porCanal.length})`);
  const meta_ = d.marketing.porCanal.find((c) => c.canal === "metaAds")!;
  ok(meta_.roi !== null && meta_.roi === -100, `Meta Ads: gastó y no vendió → ROI −100% (${porcentaje(meta_.roi!)})`);
  ok(meta_.cac === null, "Meta Ads: CAC es null (0 ventas), no $0");
  const ref = d.marketing.porCanal.find((c) => c.canal === "referidos")!;
  ok(ref.cpl === 0, `Referidos: gastó $0 y trajo ${ref.leads} leads → CPL $0, que es un dato verdadero`);
  ok(costoPorLead(USD(500), 0) === null, "un canal SIN leads sí devuelve null (no se puede dividir)");

  console.log("\n5. El briefing convierte los datos en decisiones");
  const b = generarBriefing(d);
  ok(b.length > 0, `${b.length} recomendaciones`);
  ok(b[0].prioridad === "critica" || b[0].prioridad === "alta", `la primera es urgente (${b[0].prioridad})`);
  ok(b.some((x) => x.id === "seguimientos"), "detecta los seguimientos vencidos");
  ok(b.some((x) => x.id.startsWith("riesgo-")), "detecta clientes en riesgo");
  ok(b.some((x) => x.id.startsWith("canal-malo-")), "detecta el canal que pierde plata");
  ok(b.every((x) => x.accion.length > 10), "toda recomendación trae una acción concreta");
  ok(b.every((x) => x.metrica.length > 0), "toda recomendación dice qué métrica mejora");
  console.log("\n  Primeras 3 recomendaciones generadas:");
  for (const x of b.slice(0, 3)) console.log(`    [${x.prioridad}] ${x.situacion}\n       → ${x.accion}`);

  console.log("\n6. Sin datos, el briefing pide lo que falta en vez de inventar");
  await prisma.$executeRawUnsafe(`TRUNCATE ${TABLAS} CASCADE`);
  const vacio = await cargarOverview();
  const bv = generarBriefing(vacio);
  ok(bv.every((x) => x.prioridad === "falta" || x.impacto === 0), "sin datos no afirma impactos");
  ok(bv.some((x) => x.id === "sin-objetivo"), "pide cargar el objetivo");
  ok(bv.some((x) => x.id === "sin-clientes"), "pide cargar clientes");
  ok(bv.some((x) => x.id === "sin-canales"), "pide cargar campañas");
  ok(vacio.marketing.cac === null, "CAC es null y no $0 cuando no hay nada");

  console.log(f === 0 ? "\n✅ TODAS PASAN\n" : `\n❌ ${f} FALLO(S)\n`);
  await prisma.$disconnect();
  process.exit(f ? 1 : 0);
})();
