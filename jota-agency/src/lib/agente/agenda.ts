import type { Tenant } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { paraTenant, horariosDe, aMinutos, aHhmm, DIAS, type Dia } from "./tenant";
import * as ev from "./eventos";

/**
 * Workflows 09 (Calendar Availability) y 10 (Appointment Booking).
 *
 * REGLA QUE NO SE NEGOCIA: el agente solo puede ofrecer horarios que salieron
 * de `huecosDisponibles()`. Nunca inventa disponibilidad, y nunca dice que una
 * reunión quedó confirmada antes de que `crearCita()` haya devuelto ok.
 *
 * La disponibilidad de esta versión sale de los horarios del negocio menos las
 * citas ya creadas acá. Es real, pero es local: si el dueño se anota algo en
 * su Google Calendar y no está en esta base, el agente no lo ve. La interfaz
 * `ProveedorCalendario` está para enchufar Google Calendar sin tocar nada más.
 */

// ---------------------------------------------------------------------------
//  Zonas horarias
// ---------------------------------------------------------------------------

/** Cuántos ms está adelantada la zona respecto de UTC en ese instante. */
export function offsetMs(d: Date, zona: string): number {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: zona, hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(d);
  const n = (t: string) => Number(partes.find((p) => p.type === t)?.value ?? 0);
  const comoUtc = Date.UTC(n("year"), n("month") - 1, n("day"), n("hour") % 24, n("minute"), n("second"));
  return comoUtc - d.getTime();
}

/**
 * "2026-08-12" + "14:30" en Pacific/Honolulu → el Date UTC correspondiente.
 *
 * Se itera dos veces porque el offset depende del instante y el instante
 * depende del offset: en el salto de horario de verano, una sola pasada da
 * una hora de más. Maui no tiene DST, pero los clientes de mañana sí.
 */
export function aUtc(fechaISO: string, hhmm: string, zona: string): Date {
  let d = new Date(`${fechaISO}T${hhmm}:00Z`);
  for (let i = 0; i < 2; i++) {
    d = new Date(new Date(`${fechaISO}T${hhmm}:00Z`).getTime() - offsetMs(d, zona));
  }
  return d;
}

/** Fecha local (YYYY-MM-DD) y día de la semana en la zona indicada. */
export function fechaEnZona(d: Date, zona: string): { fechaISO: string; dia: Dia } {
  const fechaISO = new Intl.DateTimeFormat("en-CA", { timeZone: zona }).format(d);
  const [a, m, dd] = fechaISO.split("-").map(Number);
  const dia = DIAS[new Date(Date.UTC(a, m - 1, dd)).getUTCDay()];
  return { fechaISO, dia };
}

export function sumarDiasISO(fechaISO: string, n: number): string {
  const [a, m, d] = fechaISO.split("-").map(Number);
  const x = new Date(Date.UTC(a, m - 1, d + n));
  return x.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
//  Disponibilidad
// ---------------------------------------------------------------------------

export type Hueco = {
  /** Instante real de inicio. */
  inicio: Date;
  fin: Date;
  /** Cómo se le muestra al contacto, en la zona que corresponda. */
  etiqueta: string;
};

export type OpcionesHuecos = {
  duracionMin?: number;
  /** Cuántos días hacia adelante mirar. */
  dias?: number;
  /** Cuántos huecos devolver. El pedido dice entre 2 y 4. */
  cantidad?: number;
  /** No ofrecer nada antes de esto (por defecto, dentro de 2 horas). */
  desde?: Date;
  /** Zona del contacto, para etiquetar en su hora. */
  zonaContacto?: string;
};

export async function huecosDisponibles(t: Tenant, o: OpcionesHuecos = {}): Promise<Hueco[]> {
  const duracion = o.duracionMin ?? 30;
  const dias = o.dias ?? 10;
  const cantidad = Math.min(Math.max(o.cantidad ?? 3, 2), 4);
  const ahora = new Date();
  // Margen mínimo: ofrecer "en 5 minutos" no le sirve a nadie.
  const desde = o.desde ?? new Date(ahora.getTime() + 2 * 3600_000);

  const horarios = horariosDe(t);
  const hasta = new Date(desde.getTime() + dias * 86_400_000);

  const ocupadas = await prisma.appointment.findMany({
    where: paraTenant(t.id, {
      estado: { in: ["agendada", "reprogramada"] },
      inicio: { lt: hasta },
      fin: { gt: desde },
    }),
    select: { inicio: true, fin: true },
  });

  const huecos: Hueco[] = [];
  const { fechaISO } = fechaEnZona(desde, t.zonaHoraria);

  for (let d = 0; d < dias && huecos.length < cantidad * 3; d++) {
    const fecha = sumarDiasISO(fechaISO, d);
    const [aa, mm, dd] = fecha.split("-").map(Number);
    const dia = DIAS[new Date(Date.UTC(aa, mm - 1, dd)).getUTCDay()];
    for (const [abre, cierra] of horarios[dia] ?? []) {
      for (let min = aMinutos(abre); min + duracion <= aMinutos(cierra); min += duracion) {
        const inicio = aUtc(fecha, aHhmm(min), t.zonaHoraria);
        const fin = new Date(inicio.getTime() + duracion * 60_000);
        if (inicio < desde) continue;
        const chocan = ocupadas.some((c) => inicio < c.fin && fin > c.inicio);
        if (chocan) continue;
        huecos.push({ inicio, fin, etiqueta: etiquetar(inicio, t.zonaHoraria, o.zonaContacto) });
      }
    }
  }

  // Se reparten en días distintos: tres horarios del mismo martes es una mala
  // oferta; martes, miércoles y jueves da chances reales de que uno sirva.
  const porDia = new Map<string, Hueco>();
  for (const h of huecos) {
    const clave = fechaEnZona(h.inicio, t.zonaHoraria).fechaISO;
    if (!porDia.has(clave)) porDia.set(clave, h);
    if (porDia.size >= cantidad) break;
  }
  const elegidos = [...porDia.values()];
  return elegidos.length >= 2 ? elegidos : huecos.slice(0, cantidad);
}

function etiquetar(d: Date, zonaNegocio: string, zonaContacto?: string): string {
  const fmt = (z: string) =>
    new Intl.DateTimeFormat("en-US", {
      timeZone: z, weekday: "short", month: "short", day: "numeric",
      hour: "numeric", minute: "2-digit", timeZoneName: "short",
    }).format(d);
  const base = fmt(zonaNegocio);
  if (!zonaContacto || zonaContacto === zonaNegocio) return base;
  return `${base} (${fmt(zonaContacto)} your time)`;
}

// ---------------------------------------------------------------------------
//  Reservar
// ---------------------------------------------------------------------------

export type PedidoCita = {
  tenantId: string;
  contactId: string;
  leadId?: string | null;
  conversationId?: string | null;
  inicio: Date;
  duracionMin?: number;
  titulo: string;
  motivo?: string;
};

export type ResultadoCita =
  | { ok: true; id: string; inicio: Date; fin: Date; duplicada: boolean }
  | { ok: false; motivo: "ocupado" | "fuera_de_horario" | "pasado" };

/**
 * Crea la cita. Antes verifica de nuevo que el hueco siga libre: entre que el
 * agente ofreció los horarios y la persona eligió pueden pasar minutos, y en
 * el medio alguien más pudo reservar el mismo.
 */
export async function crearCita(t: Tenant, p: PedidoCita): Promise<ResultadoCita> {
  const correlationId = ev.nuevaCorrelacion();
  const duracion = p.duracionMin ?? 30;
  const fin = new Date(p.inicio.getTime() + duracion * 60_000);

  if (p.inicio.getTime() < Date.now()) return { ok: false, motivo: "pasado" };
  if (!dentroDeHorario(t, p.inicio, fin)) return { ok: false, motivo: "fuera_de_horario" };

  // Misma persona, mismo horario: es un doble clic, no dos reuniones.
  const yaSuya = await prisma.appointment.findFirst({
    where: paraTenant(t.id, {
      contactId: p.contactId, inicio: p.inicio,
      estado: { in: ["agendada", "reprogramada"] },
    }),
  });
  if (yaSuya) return { ok: true, id: yaSuya.id, inicio: yaSuya.inicio, fin: yaSuya.fin, duplicada: true };

  const choque = await prisma.appointment.findFirst({
    where: paraTenant(t.id, {
      estado: { in: ["agendada", "reprogramada"] },
      inicio: { lt: fin }, fin: { gt: p.inicio },
    }),
  });
  if (choque) return { ok: false, motivo: "ocupado" };

  const cita = await prisma.appointment.create({
    data: {
      tenantId: t.id,
      contactId: p.contactId,
      leadId: p.leadId ?? null,
      conversationId: p.conversationId ?? null,
      proveedor: "interno",
      titulo: p.titulo.slice(0, 200),
      motivo: p.motivo?.slice(0, 500) ?? null,
      inicio: p.inicio,
      fin,
      zonaHoraria: t.zonaHoraria,
      estado: "agendada",
    },
  });

  await ev.ok({ tenantId: t.id, workflow: "10-agendar", correlationId, referencia: cita.id });
  await ev.auditar({
    tenantId: t.id, actorTipo: "ia", accion: "cita.creada",
    entidad: "Appointment", entidadId: cita.id,
  });
  return { ok: true, id: cita.id, inicio: cita.inicio, fin: cita.fin, duplicada: false };
}

export async function reprogramar(t: Tenant, citaId: string, nuevoInicio: Date): Promise<ResultadoCita> {
  const cita = await prisma.appointment.findFirst({ where: paraTenant(t.id, { id: citaId }) });
  if (!cita) return { ok: false, motivo: "ocupado" };
  const duracion = Math.round((cita.fin.getTime() - cita.inicio.getTime()) / 60_000);
  const fin = new Date(nuevoInicio.getTime() + duracion * 60_000);

  if (nuevoInicio.getTime() < Date.now()) return { ok: false, motivo: "pasado" };
  if (!dentroDeHorario(t, nuevoInicio, fin)) return { ok: false, motivo: "fuera_de_horario" };

  const choque = await prisma.appointment.findFirst({
    where: paraTenant(t.id, {
      id: { not: citaId }, estado: { in: ["agendada", "reprogramada"] },
      inicio: { lt: fin }, fin: { gt: nuevoInicio },
    }),
  });
  if (choque) return { ok: false, motivo: "ocupado" };

  const act = await prisma.appointment.update({
    where: { id: citaId },
    data: { inicio: nuevoInicio, fin, estado: "reprogramada" },
  });
  await ev.auditar({
    tenantId: t.id, actorTipo: "ia", accion: "cita.reprogramada",
    entidad: "Appointment", entidadId: citaId,
  });
  return { ok: true, id: act.id, inicio: act.inicio, fin: act.fin, duplicada: false };
}

export async function cancelar(t: Tenant, citaId: string, quien: "ia" | "humano" = "ia"): Promise<boolean> {
  const n = await prisma.appointment.updateMany({
    where: paraTenant(t.id, { id: citaId, estado: { in: ["agendada", "reprogramada"] } }),
    data: { estado: "cancelada" },
  });
  if (n.count > 0) {
    await ev.auditar({
      tenantId: t.id, actorTipo: quien, accion: "cita.cancelada",
      entidad: "Appointment", entidadId: citaId,
    });
  }
  return n.count > 0;
}

export function dentroDeHorario(t: Tenant, inicio: Date, fin: Date): boolean {
  const { fechaISO, dia } = fechaEnZona(inicio, t.zonaHoraria);
  const tramos = horariosDe(t)[dia] ?? [];
  if (tramos.length === 0) return false;
  const min = minutosDelDia(inicio, t.zonaHoraria);
  const minFin = min + Math.round((fin.getTime() - inicio.getTime()) / 60_000);
  // Una cita no puede empezar un día y terminar al siguiente.
  if (fechaEnZona(fin, t.zonaHoraria).fechaISO !== fechaISO && minFin > 1440) return false;
  return tramos.some(([a, b]) => min >= aMinutos(a) && minFin <= aMinutos(b));
}

function minutosDelDia(d: Date, zona: string): number {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: zona, hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(d);
  const n = (t: string) => Number(partes.find((p) => p.type === t)?.value ?? 0);
  return (n("hour") % 24) * 60 + n("minute");
}

/** Cómo se le muestra una cita a una persona. */
export function citaLegible(inicio: Date, zona: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: zona, weekday: "long", month: "long", day: "numeric",
    hour: "numeric", minute: "2-digit", timeZoneName: "short",
  }).format(inicio);
}
