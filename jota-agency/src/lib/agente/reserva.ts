import type { Tenant } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { SITIO_URL } from "@/lib/sitio";
import { crearCita, citaLegible, huecosDisponibles } from "./agenda";
import { encolar } from "./email";
import { avisar } from "./notificaciones";
import { configDesdeEnv } from "./prospeccion";
import { normalizarEmail, normalizarTelefono } from "./seguridad";
import { paraTenant, tenantPorSlug } from "./tenant";

/**
 * Reserva pública de la llamada de 15 minutos (/agendar).
 *
 * Es el final de todos los caminos de venta: la web, el email en frío y J.
 * Por eso usa la MISMA agenda que el agente: si J ofrece un horario en un
 * chat y alguien lo reserva acá, el segundo en llegar recibe "ocupado" en vez
 * de una reunión doble.
 *
 * Es un formulario público, así que cuida tres cosas: que un bot no llene la
 * agenda (honeypot + topes), que una persona no reserve diez horarios, y que
 * el prospecto que ya teníamos en el panel no quede duplicado.
 */

export const DURACION_MIN = 30; // la llamada es de 15; el resto es margen
export const TITULO = "Intro call";

/** El negocio de JOTA en el agente: el mismo que manda la prospección. */
export async function tenantDeJota(): Promise<Tenant | null> {
  const slug = configDesdeEnv().tenantSlug;
  if (!slug) return null;
  const t = await tenantPorSlug(slug);
  return t && t.estado === "activo" ? t : null;
}

export async function horariosLibres(t: Tenant): Promise<{ inicio: string; etiqueta: string }[]> {
  const huecos = await huecosDisponibles(t, { duracionMin: DURACION_MIN, dias: 14, todos: true });
  return huecos.slice(0, 120).map((h) => ({ inicio: h.inicio.toISOString(), etiqueta: h.etiqueta }));
}

export type DatosReserva = {
  nombre: string;
  email: string;
  empresa: string;
  web: string | null;
  telefono: string | null;
  mensaje: string | null;
  inicio: Date;
};

/** Valida lo que llega del formulario. Pura, para poder probarla. */
export function validarReserva(fd: Record<string, unknown>, ahora = new Date()): DatosReserva | { error: string } {
  const txt = (k: string, max: number) => String(fd[k] ?? "").trim().slice(0, max);
  // Campo trampa: invisible para una persona, un bot lo completa.
  if (txt("sitio_alternativo", 200)) return { error: "bot" };

  const nombre = txt("nombre", 120);
  const empresa = txt("empresa", 160);
  const email = normalizarEmail(txt("email", 200));
  const inicio = new Date(txt("inicio", 40));
  if (nombre.length < 2) return { error: "nombre" };
  if (!email) return { error: "email" };
  if (!empresa) return { error: "empresa" };
  if (Number.isNaN(inicio.getTime()) || inicio.getTime() <= ahora.getTime()) return { error: "horario" };

  let web = txt("web", 300) || null;
  if (web && !/^https?:\/\//i.test(web)) web = `https://${web}`;
  if (web) {
    try {
      new URL(web);
    } catch {
      web = null;
    }
  }
  return {
    nombre, email, empresa, web,
    telefono: normalizarTelefono(txt("telefono", 40)) || null,
    mensaje: txt("mensaje", 1000) || null,
    inicio,
  };
}

export type ResultadoReserva =
  | { ok: true; cuando: string }
  | { ok: false; motivo: "ocupado" | "fuera_de_horario" | "pasado" | "demasiadas" | "cerrado" };

export async function reservarLlamada(t: Tenant, d: DatosReserva): Promise<ResultadoReserva> {
  // Tope global: más de 20 reservas en una hora no es demanda, es un ataque.
  const ultimaHora = await prisma.appointment.count({
    where: paraTenant(t.id, { titulo: { startsWith: TITULO }, createdAt: { gte: new Date(Date.now() - 3600_000) } }),
  });
  if (ultimaHora >= 20) return { ok: false, motivo: "cerrado" };

  const contacto = await prisma.contact.upsert({
    where: { tenantId_email: { tenantId: t.id, email: d.email } },
    create: {
      tenantId: t.id, email: d.email, nombre: d.nombre, empresa: d.empresa,
      sitioWeb: d.web, telefono: d.telefono, consentimiento: "otorgado",
    },
    update: { empresa: d.empresa, ...(d.telefono ? { telefono: d.telefono } : {}) },
  });

  // Una persona, dos reuniones futuras como máximo.
  const futuras = await prisma.appointment.count({
    where: paraTenant(t.id, { contactId: contacto.id, estado: { in: ["agendada", "reprogramada"] }, inicio: { gt: new Date() } }),
  });
  if (futuras >= 2) return { ok: false, motivo: "demasiadas" };

  const r = await crearCita(t, {
    tenantId: t.id, contactId: contacto.id, inicio: d.inicio, duracionMin: DURACION_MIN,
    titulo: `${TITULO} — ${d.empresa}`, motivo: d.mensaje ?? undefined,
  });
  if (!r.ok) return { ok: false, motivo: r.motivo };
  const cuando = citaLegible(r.inicio, t.zonaHoraria);
  if (r.duplicada) return { ok: true, cuando };

  await encolar(t, {
    tenantId: t.id, para: d.email, plantilla: "cita_confirmada",
    datos: { nombre: d.nombre.split(/\s+/)[0], cuando, zona: t.zonaHoraria, motivo: "15-minute intro call" },
    claveIdempotencia: `cita:${r.id}:confirmada`,
  });

  await vincularProspecto(d, r.inicio);

  await avisar({
    t, evento: "reunion_agendada",
    titulo: `Llamada agendada: ${d.empresa}`,
    detalle: `${d.nombre} <${d.email}> reservó ${cuando}.${d.mensaje ? ` Dijo: "${d.mensaje.slice(0, 200)}"` : ""}`,
    url: `${SITIO_URL}/panel/prospectos`,
    clave: `reserva:${r.id}`,
  });
  return { ok: true, cuando };
}

/**
 * Si ya lo teníamos como prospecto (por email o por nombre de empresa), pasa
 * a "reunión" —y eso frena los seguimientos automáticos—. Si no, entra nuevo.
 */
async function vincularProspecto(d: DatosReserva, inicio: Date): Promise<void> {
  const existente = await prisma.prospecto.findFirst({
    where: {
      esDemo: false,
      OR: [{ email: { equals: d.email, mode: "insensitive" } }, { empresa: { equals: d.empresa, mode: "insensitive" } }],
    },
  });
  const nota = `[${new Date().toISOString().slice(0, 10)}] Reservó la llamada desde /agendar.${d.mensaje ? ` Dijo: "${d.mensaje}"` : ""}`;
  if (existente) {
    await prisma.prospecto.update({
      where: { id: existente.id },
      data: {
        estado: existente.estado === "cliente" ? "cliente" : "reunion",
        proximoContacto: inicio,
        email: existente.email ?? d.email,
        contacto: existente.contacto ?? d.nombre,
        telefono: existente.telefono ?? d.telefono,
        notas: `${existente.notas ? `${existente.notas}\n` : ""}${nota}`.slice(-4000),
      },
    });
    return;
  }
  await prisma.prospecto.create({
    data: {
      empresa: d.empresa, rubro: "Sin rubro", web: d.web, email: d.email, contacto: d.nombre,
      telefono: d.telefono, estado: "reunion", proximoContacto: inicio, notas: nota,
      fuente: "Web — /agendar",
    },
  });
}
