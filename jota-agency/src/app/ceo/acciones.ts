"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { esAdmin } from "@/lib/admin";
import { calcularScore, resumirScore } from "@/lib/ceo/score";
import { aCentavos } from "@/lib/ceo/dinero";
import {
  LEADS_DEMO, CLIENTES_DEMO, CAMPANIAS_DEMO, TAREAS_DEMO,
  INGRESOS_POR_MES, GASTOS_DEMO, OBJETIVO_MENSUAL, hace, en, USD,
} from "@/lib/ceo/demo";

/**
 * Cada server action es un endpoint HTTP público. Que /ceo esté protegida no
 * protege a estas funciones: hay que revalidar el permiso acá adentro, en
 * todas, sin excepción.
 */
async function exigirCeo() {
  const session = await auth();
  if (!session?.user || !(await esAdmin(session.user.email))) {
    throw new Error("No autorizado");
  }
  return session.user.email ?? "ceo";
}

const refrescar = () => {
  revalidatePath("/ceo");
  revalidatePath("/ceo/leads");
};

const texto = (v: FormDataEntryValue | null, max: number) =>
  String(v ?? "").trim().slice(0, max) || null;

// ---------------------------------------------------------------------------
//  Datos demo
// ---------------------------------------------------------------------------

/** Primer día del mes, N meses hacia atrás. */
function inicioDeMes(mesesAtras: number): Date {
  const h = new Date();
  return new Date(Date.UTC(h.getUTCFullYear(), h.getUTCMonth() - mesesAtras, 1, 12));
}

export async function cargarDemo() {
  await exigirCeo();
  await limpiarDemo();

  // --- Prospectos, con su score ya calculado ---
  for (const l of LEADS_DEMO) {
    const datos = {
      industria: l.industria,
      empleados: l.empleados,
      ingresosEstimados: l.facturacion,
      cargo: l.cargo,
      web: `https://${l.empresa.toLowerCase().replace(/[^a-z0-9]+/g, "")}.example`,
      linkedin: null,
      servicioInteres: l.servicio,
      estado: l.estado,
      ultimoContacto: l.diasDesdeContacto != null ? hace(l.diasDesdeContacto) : null,
    };
    const r = calcularScore(datos);

    const prospecto = await prisma.prospecto.create({
      data: {
        empresa: l.empresa,
        rubro: l.rubro,
        industria: l.industria,
        ciudad: l.ciudad,
        pais: "US",
        web: datos.web,
        contacto: l.contacto,
        cargo: l.cargo,
        empleados: l.empleados,
        ingresosEstimados: l.facturacion,
        servicioInteres: l.servicio,
        fuente: l.fuente,
        estado: l.estado,
        valorEstimado: l.valor,
        probabilidad: l.prob,
        score: r.score,
        scoreDetalle: resumirScore(r),
        ultimoContacto: datos.ultimoContacto,
        proximoContacto: l.seguimientoEnDias != null ? en(l.seguimientoEnDias) : null,
        esDemo: true,
      },
    });

    if (l.diasDesdeContacto != null) {
      await prisma.actividad.create({
        data: {
          prospectoId: prospecto.id,
          tipo: l.estado === "reunion" ? "reunion" : "email",
          detalle:
            l.estado === "reunion"
              ? `Reunión de diagnóstico sobre ${l.servicio}`
              : `Contacto por ${l.fuente} ofreciendo ${l.servicio}`,
          esDemo: true,
        },
      });
    }
  }

  // --- Clientes ---
  const clientes = [];
  for (const c of CLIENTES_DEMO) {
    clientes.push(
      await prisma.cliente.create({
        data: {
          empresa: c.empresa,
          contacto: c.contacto,
          email: c.email,
          servicio: c.servicio,
          inicio: inicioDeMes(c.mesesAtras),
          precioMensual: c.precioMensual,
          costoOperativo: c.costoOperativo,
          estadoContrato: c.salud === "cancelado" ? "cancelado" : "activo",
          proximaFactura: en(30 - (new Date().getUTCDate() % 30)),
          reunionesLogradas: c.reuniones,
          leadsEntregados: c.leads,
          satisfaccion: c.satisfaccion,
          salud: c.salud,
          ultimoContacto: hace(c.ultimoContactoDias),
          proximosPasos: c.pasos,
          esDemo: true,
        },
      }),
    );
  }

  // --- Ingresos: 6 meses, repartidos entre los clientes ---
  for (const mes of INGRESOS_POR_MES) {
    const base = inicioDeMes(mes.mesesAtras);
    const activos = clientes.filter((c) => c.inicio <= base);
    const sumaRecurrente = activos.reduce((t, c) => t + c.precioMensual, 0);

    for (const c of activos) {
      await prisma.ingreso.create({
        data: {
          concepto: `${c.servicio} — ${c.empresa}`,
          monto: c.precioMensual,
          fecha: new Date(base.getTime() + 4 * 86_400_000),
          servicio: c.servicio,
          canal: "referidos",
          recurrente: true,
          cobrado: true,
          clienteId: c.id,
          esDemo: true,
        },
      });
    }

    // Lo que falta para llegar al total del mes se registra como trabajo puntual.
    const resto = USD(mes.total) - sumaRecurrente;
    if (resto > 0) {
      await prisma.ingreso.create({
        data: {
          concepto: "Website Development — proyecto puntual",
          monto: resto,
          fecha: new Date(base.getTime() + 12 * 86_400_000),
          servicio: "Website Development",
          canal: mes.mesesAtras % 2 === 0 ? "linkedin" : "coldEmail",
          recurrente: false,
          cobrado: true,
          esDemo: true,
        },
      });
    }
  }

  // --- Gastos: mismos 6 meses ---
  for (const mes of INGRESOS_POR_MES) {
    const base = inicioDeMes(mes.mesesAtras);
    for (const g of GASTOS_DEMO) {
      await prisma.gasto.create({
        data: {
          concepto: g.concepto,
          monto: g.mensual,
          fecha: new Date(base.getTime() + 2 * 86_400_000),
          categoria: g.categoria,
          canal: g.canal,
          esDemo: true,
        },
      });
    }
  }

  // --- Campañas ---
  const campanias = [];
  for (const c of CAMPANIAS_DEMO) {
    campanias.push(
      await prisma.campania.create({
        data: {
          nombre: c.nombre, canal: c.canal, publico: c.publico, industria: c.industria,
          inicio: hace(c.diasAtras), presupuesto: c.presupuesto, gastado: c.gastado,
          enviados: c.enviados, respuestas: c.respuestas, respuestasPositivas: c.positivas,
          leads: c.leads, reuniones: c.reuniones, ventas: c.ventas, ingresos: c.ingresos,
          estado: c.estado, esDemo: true,
        },
      }),
    );
  }

  // --- Objetivo del mes ---
  const h = new Date();
  await prisma.objetivo.create({
    data: {
      titulo: "Monthly Revenue Goal",
      tipo: "mensual",
      metrica: "ingresos",
      valorObjetivo: OBJETIVO_MENSUAL,
      periodoInicio: new Date(Date.UTC(h.getUTCFullYear(), h.getUTCMonth(), 1, 12)),
      periodoFin: new Date(Date.UTC(h.getUTCFullYear(), h.getUTCMonth() + 1, 0, 12)),
      esDemo: true,
    },
  });

  // --- Tareas ---
  for (const t of TAREAS_DEMO) {
    await prisma.tareaCeo.create({
      data: {
        titulo: t.titulo, descripcion: t.descripcion, prioridad: t.prioridad,
        categoria: t.categoria, vence: en(t.venceEnDias), impacto: t.impacto,
        esDemo: true,
      },
    });
  }

  // --- Notificaciones ---
  const enRiesgo = clientes.find((c) => c.salud === "riesgo");
  const peorCampania = campanias.find((c) => c.ventas === 0 && c.gastado > 0);
  await prisma.notificacion.createMany({
    data: [
      { tipo: "clienteEnRiesgo", titulo: `${enRiesgo?.empresa ?? "Un cliente"} está en riesgo`, detalle: "21 días sin contacto y resultados por debajo de lo acordado.", url: "/ceo/clients", esDemo: true },
      { tipo: "seguimientoVencido", titulo: "2 seguimientos vencidos", detalle: "Napili Property Partners y Wailuku Family Dentistry.", url: "/ceo/leads", esDemo: true },
      { tipo: "propuestaSinRespuesta", titulo: "Makena Estate Group no respondió", detalle: "Propuesta de $5,200/mes enviada hace 4 días.", url: "/ceo/pipeline", esDemo: true },
      { tipo: "campaniaBaja", titulo: `${peorCampania?.nombre ?? "Una campaña"} sin retorno`, detalle: "Gastó presupuesto y no cerró ninguna venta.", url: "/ceo/campaigns", esDemo: true },
      { tipo: "objetivoAtrasado", titulo: "El objetivo del mes va atrasado", detalle: "Al ritmo actual no se alcanza el objetivo de facturación.", url: "/ceo/goals", esDemo: true },
    ],
  });

  refrescar();
}

/** Borra SOLO lo marcado como demo. Lo que cargaste vos queda intacto. */
async function limpiarDemo() {
  await prisma.actividad.deleteMany({ where: { esDemo: true } });
  await prisma.tareaCeo.deleteMany({ where: { esDemo: true } });
  await prisma.notificacion.deleteMany({ where: { esDemo: true } });
  await prisma.ingreso.deleteMany({ where: { esDemo: true } });
  await prisma.gasto.deleteMany({ where: { esDemo: true } });
  await prisma.campania.deleteMany({ where: { esDemo: true } });
  await prisma.objetivo.deleteMany({ where: { esDemo: true } });
  await prisma.cliente.deleteMany({ where: { esDemo: true } });
  await prisma.prospecto.deleteMany({ where: { esDemo: true } });
}

export async function borrarDemo() {
  await exigirCeo();
  await limpiarDemo();
  refrescar();
}

// ---------------------------------------------------------------------------
//  Alta rápida desde la barra superior
// ---------------------------------------------------------------------------

export async function agregarLead(formData: FormData) {
  await exigirCeo();
  const empresa = texto(formData.get("empresa"), 160);
  if (!empresa) throw new Error("Falta el nombre de la empresa");

  const industria = texto(formData.get("industria"), 80);
  const cargo = texto(formData.get("cargo"), 80);
  const empleadosRaw = texto(formData.get("empleados"), 10);
  const empleados = empleadosRaw ? Number(empleadosRaw) : null;
  const servicioInteres = texto(formData.get("servicio"), 80);
  const web = texto(formData.get("web"), 300);

  const r = calcularScore({
    industria, cargo, web, servicioInteres,
    empleados: Number.isFinite(empleados) ? empleados : null,
    estado: "nuevo",
  });

  await prisma.prospecto.create({
    data: {
      empresa,
      rubro: industria ?? "Sin rubro",
      industria,
      ciudad: texto(formData.get("ciudad"), 80),
      contacto: texto(formData.get("contacto"), 120),
      cargo,
      email: texto(formData.get("email"), 160),
      telefono: texto(formData.get("telefono"), 60),
      web,
      empleados: Number.isFinite(empleados) ? empleados : null,
      servicioInteres,
      fuente: texto(formData.get("fuente"), 80) ?? "Carga manual",
      valorEstimado: aCentavos(String(formData.get("valor") ?? "0")),
      estado: "nuevo",
      score: r.score,
      scoreDetalle: resumirScore(r),
    },
  });
  refrescar();
}

export async function registrarIngreso(formData: FormData) {
  await exigirCeo();
  const concepto = texto(formData.get("concepto"), 200);
  const monto = aCentavos(String(formData.get("monto") ?? "0"));
  if (!concepto) throw new Error("Falta el concepto");
  if (monto <= 0) throw new Error("El monto tiene que ser mayor a cero");

  const fechaRaw = texto(formData.get("fecha"), 10);
  const fecha = fechaRaw ? new Date(`${fechaRaw}T12:00:00Z`) : new Date();

  await prisma.ingreso.create({
    data: {
      concepto,
      monto,
      fecha: Number.isNaN(fecha.getTime()) ? new Date() : fecha,
      servicio: texto(formData.get("servicio"), 80) ?? "Custom Service",
      canal: texto(formData.get("canal"), 40),
      recurrente: formData.get("recurrente") === "on",
      cobrado: formData.get("cobrado") !== "no",
    },
  });
  refrescar();
}

export async function marcarNotificacionLeida(id: string) {
  await exigirCeo();
  await prisma.notificacion.update({ where: { id }, data: { leida: true } });
  refrescar();
}

export async function marcarTodasLeidas() {
  await exigirCeo();
  await prisma.notificacion.updateMany({ where: { leida: false }, data: { leida: true } });
  refrescar();
}

export async function cambiarEstadoTarea(id: string, estado: string) {
  await exigirCeo();
  if (!["pendiente", "enCurso", "hecha"].includes(estado)) throw new Error("Estado inválido");
  await prisma.tareaCeo.update({ where: { id }, data: { estado } });
  refrescar();
}
