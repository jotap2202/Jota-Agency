import type { Tenant } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { paraTenant } from "./tenant";
import { buscarConocimiento } from "./conocimiento";
import { huecosDisponibles, crearCita, reprogramar, cancelar, citaLegible } from "./agenda";
import { encolar } from "./email";
import { avisar } from "./notificaciones";
import { derivar, type MotivoHandoff } from "./handoff";
import { programar, cortar } from "./seguimientos";
import { normalizarEmail, normalizarTelefono, limpiarMensaje } from "./seguridad";
import * as ev from "./eventos";

/**
 * Las herramientas del agente.
 *
 * Cuatro reglas que valen para todas, sin excepción:
 *
 *  1. Reciben el tenant del CONTEXTO, nunca de los argumentos del modelo. Si
 *     el tenantId viniera en el JSON del modelo, bastaría una inyección bien
 *     escrita para leer los datos de otro cliente.
 *  2. Validan sus entradas. Lo que escribe el modelo es texto, no un contrato.
 *  3. Devuelven {ok} o {error}, nunca lanzan. Un fallo tiene que poder
 *     contarse en la conversación, no romper el pedido HTTP.
 *  4. Dejan auditoría.
 */

export type Contexto = {
  t: Tenant;
  conversationId: string;
  contactId: string;
  leadId?: string | null;
};

export type Salida =
  | { ok: true; datos: Record<string, unknown>; mensaje?: string }
  | { ok: false; error: string };

const err = (e: string): Salida => ({ ok: false, error: e });
const ok = (datos: Record<string, unknown>, mensaje?: string): Salida => ({ ok: true, datos, mensaje });

/** Nombres exactos que el modelo puede pedir. Cualquier otro se rechaza. */
export const HERRAMIENTAS = [
  "SearchBusinessKnowledge",
  "GetContact",
  "UpdateContact",
  "CreateLead",
  "UpdateLead",
  "AddConversationNote",
  "CheckCalendarAvailability",
  "CreateAppointment",
  "RescheduleAppointment",
  "CancelAppointment",
  "SendTransactionalEmail",
  "NotifyTeam",
  "RequestHumanHandoff",
  "CreateFollowUp",
  "CancelFollowUps",
  "GetConversationHistory",
] as const;

export type NombreHerramienta = (typeof HERRAMIENTAS)[number];

function texto(v: unknown, max = 500): string | null {
  if (typeof v !== "string") return null;
  const t = limpiarMensaje(v, max);
  return t || null;
}

function fecha(v: unknown): Date | null {
  if (typeof v !== "string") return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Punto de entrada único. El orquestador nunca llama a una herramienta
 * directo: pasa por acá, y acá se valida el nombre.
 */
export async function ejecutar(
  ctx: Contexto,
  nombre: string,
  args: Record<string, unknown>,
): Promise<Salida> {
  if (!(HERRAMIENTAS as readonly string[]).includes(nombre)) {
    return err(`Herramienta desconocida: ${nombre}`);
  }
  try {
    const r = await despachar(ctx, nombre as NombreHerramienta, args ?? {});
    await ev.auditar({
      tenantId: ctx.t.id,
      actorTipo: "ia",
      accion: `herramienta.${nombre}`,
      entidad: "Conversation",
      entidadId: ctx.conversationId,
      metadatos: { ok: r.ok },
    });
    return r;
  } catch (e) {
    await ev.fallo({
      tenantId: ctx.t.id, workflow: "05-orquestador",
      correlationId: ev.nuevaCorrelacion(), referencia: ctx.conversationId, error: e,
    });
    return err("La acción no se pudo completar");
  }
}

async function despachar(ctx: Contexto, nombre: NombreHerramienta, a: Record<string, unknown>): Promise<Salida> {
  const { t } = ctx;

  switch (nombre) {
    // -----------------------------------------------------------------
    case "SearchBusinessKnowledge": {
      const consulta = texto(a.query ?? a.consulta, 300);
      if (!consulta) return err("Falta la consulta");
      const frags = await buscarConocimiento(t.id, consulta, 5);
      return ok(
        { fragmentos: frags.map((f) => ({ titulo: f.titulo, texto: f.texto })), encontrados: frags.length },
        frags.length === 0 ? "No hay información aprobada sobre eso" : undefined,
      );
    }

    // -----------------------------------------------------------------
    case "GetContact": {
      const c = await prisma.contact.findFirst({
        where: paraTenant(t.id, { id: ctx.contactId }),
        select: {
          nombre: true, apellido: true, email: true, telefono: true,
          empresa: true, ubicacion: true, idioma: true, noContactar: true,
        },
      });
      return c ? ok({ contacto: c }) : err("Contacto inexistente");
    }

    case "UpdateContact": {
      const datos: Record<string, string | boolean> = {};
      const nombre = texto(a.first_name ?? a.nombre, 80);
      const apellido = texto(a.last_name ?? a.apellido, 80);
      const email = normalizarEmail(texto(a.email, 254));
      const telefono = normalizarTelefono(texto(a.phone ?? a.telefono, 40));
      const empresa = texto(a.company ?? a.empresa, 120);
      const ubicacion = texto(a.location ?? a.ubicacion, 120);
      if (nombre) datos.nombre = nombre;
      if (apellido) datos.apellido = apellido;
      if (email) datos.email = email;
      if (telefono) datos.telefono = telefono;
      if (empresa) datos.empresa = empresa;
      if (ubicacion) datos.ubicacion = ubicacion;
      if (Object.keys(datos).length === 0) return err("Nada válido para actualizar");

      // Si el email ya es de otro contacto del mismo tenant, no se pisa: se
      // deja el resto y se avisa. Fusionar contactos es decisión de una
      // persona, no de la IA.
      if (datos.email) {
        const otro = await prisma.contact.findFirst({
          where: paraTenant(t.id, { email: datos.email as string, id: { not: ctx.contactId } }),
          select: { id: true },
        });
        if (otro) delete datos.email;
      }
      await prisma.contact.updateMany({ where: paraTenant(t.id, { id: ctx.contactId }), data: datos });
      return ok({ actualizado: Object.keys(datos) });
    }

    // -----------------------------------------------------------------
    case "CreateLead": {
      if (ctx.leadId) return ok({ leadId: ctx.leadId, yaExistia: true });
      const lead = await prisma.lead.create({
        data: {
          tenantId: t.id,
          contactId: ctx.contactId,
          conversationId: ctx.conversationId,
          servicio: texto(a.service ?? a.servicio, 200),
          problema: texto(a.problem ?? a.problema, 1000),
        },
      });
      return ok({ leadId: lead.id, yaExistia: false });
    }

    case "UpdateLead": {
      if (!ctx.leadId) return err("Todavía no hay lead en esta conversación");
      const datos: Record<string, string | null> = {};
      for (const [clave, campo] of [
        ["service", "servicio"], ["problem", "problema"], ["outcome", "resultado"],
        ["timeline", "plazo"], ["location", "ubicacion"], ["next_action", "proximaAccion"],
      ] as const) {
        const v = texto(a[clave], 500);
        if (v) datos[campo] = v;
      }
      if (Object.keys(datos).length === 0) return err("Nada válido para actualizar");
      await prisma.lead.updateMany({ where: paraTenant(t.id, { id: ctx.leadId }), data: datos });
      return ok({ actualizado: Object.keys(datos) });
    }

    case "AddConversationNote": {
      const nota = texto(a.note ?? a.nota, 2000);
      if (!nota) return err("Nota vacía");
      await prisma.message.create({
        data: {
          tenantId: t.id, conversationId: ctx.conversationId,
          direccion: "saliente", remitente: "sistema",
          contenido: `[nota interna] ${nota}`, entrega: "entregado",
        },
      });
      return ok({ guardada: true });
    }

    // -----------------------------------------------------------------
    case "CheckCalendarAvailability": {
      const huecos = await huecosDisponibles(t, {
        duracionMin: typeof a.duration_minutes === "number" ? a.duration_minutes : 30,
        cantidad: typeof a.count === "number" ? a.count : 3,
        zonaContacto: texto(a.customer_timezone, 60) ?? undefined,
      });
      if (huecos.length === 0) {
        return ok({ huecos: [] }, "No hay horarios disponibles en los próximos días. Ofrecé que el equipo se contacte para coordinar.");
      }
      return ok({
        huecos: huecos.map((h) => ({ inicio: h.inicio.toISOString(), etiqueta: h.etiqueta })),
      });
    }

    case "CreateAppointment": {
      const inicio = fecha(a.start_at ?? a.inicio);
      if (!inicio) return err("Falta la fecha y hora de inicio en formato ISO");
      const email = normalizarEmail(texto(a.email, 254));
      const nombre = texto(a.name ?? a.nombre, 120);
      // El pedido exige confirmar nombre y email antes de crear la reunión.
      const c = await prisma.contact.findFirst({
        where: paraTenant(t.id, { id: ctx.contactId }),
        select: { nombre: true, email: true },
      });
      const emailFinal = email ?? c?.email ?? null;
      const nombreFinal = nombre ?? c?.nombre ?? null;
      if (!emailFinal) return err("No se puede agendar sin email del contacto: pedíselo primero");
      if (!nombreFinal) return err("No se puede agendar sin nombre del contacto: pedíselo primero");

      const r = await crearCita(t, {
        tenantId: t.id,
        contactId: ctx.contactId,
        leadId: ctx.leadId ?? null,
        conversationId: ctx.conversationId,
        inicio,
        duracionMin: typeof a.duration_minutes === "number" ? a.duration_minutes : 30,
        titulo: texto(a.title, 200) ?? `${t.nombreNegocio} — consultation`,
        motivo: texto(a.reason ?? a.motivo, 500) ?? undefined,
      });

      if (!r.ok) {
        const motivos: Record<string, string> = {
          ocupado: "Ese horario se acaba de ocupar. Ofrecé otro de los disponibles.",
          fuera_de_horario: "Ese horario está fuera del horario de atención.",
          pasado: "Ese horario ya pasó.",
        };
        return err(motivos[r.motivo] ?? "No se pudo agendar");
      }

      if (!r.duplicada) {
        await prisma.contact.updateMany({
          where: paraTenant(t.id, { id: ctx.contactId }),
          data: { ...(email ? { email } : {}), ...(nombre ? { nombre } : {}) },
        });
        await encolar(t, {
          tenantId: t.id, para: emailFinal, plantilla: "cita_confirmada",
          datos: {
            nombre: nombreFinal,
            cuando: citaLegible(r.inicio, t.zonaHoraria),
            zona: t.zonaHoraria,
            motivo: texto(a.reason ?? a.motivo, 200) ?? "",
          },
          claveIdempotencia: `cita:${r.id}:confirmada`,
        });
        if (ctx.leadId) {
          await cortar(t.id, ctx.leadId, "agendo");
          await prisma.lead.updateMany({
            where: paraTenant(t.id, { id: ctx.leadId }),
            data: { estado: "calificado", proximaAccion: "reunión agendada" },
          });
        }
        await avisar({
          t, evento: "reunion_agendada",
          titulo: `Reunión agendada: ${nombreFinal}`,
          detalle: `${citaLegible(r.inicio, t.zonaHoraria)} · ${emailFinal}`,
          clave: `cita:${r.id}`,
        });
      }

      return ok(
        { citaId: r.id, cuando: citaLegible(r.inicio, t.zonaHoraria), duplicada: r.duplicada },
        "Cita creada y confirmada por email.",
      );
    }

    case "RescheduleAppointment": {
      const citaId = texto(a.appointment_id ?? a.citaId, 40);
      const nuevo = fecha(a.start_at ?? a.inicio);
      if (!citaId || !nuevo) return err("Faltan el id de la cita y el nuevo horario");
      const r = await reprogramar(t, citaId, nuevo);
      if (!r.ok) return err(r.motivo === "ocupado" ? "Ese horario está ocupado" : "No se pudo reprogramar");
      const c = await prisma.contact.findFirst({
        where: paraTenant(t.id, { id: ctx.contactId }), select: { email: true, nombre: true },
      });
      if (c?.email) {
        await encolar(t, {
          tenantId: t.id, para: c.email, plantilla: "cita_confirmada",
          datos: { nombre: c.nombre ?? "", cuando: citaLegible(r.inicio, t.zonaHoraria), zona: t.zonaHoraria, motivo: "" },
          claveIdempotencia: `cita:${citaId}:${r.inicio.toISOString()}`,
        });
      }
      return ok({ citaId: r.id, cuando: citaLegible(r.inicio, t.zonaHoraria) });
    }

    case "CancelAppointment": {
      const citaId = texto(a.appointment_id ?? a.citaId, 40);
      if (!citaId) return err("Falta el id de la cita");
      const hecho = await cancelar(t, citaId);
      return hecho ? ok({ cancelada: true }) : err("No se encontró esa cita activa");
    }

    // -----------------------------------------------------------------
    case "SendTransactionalEmail": {
      const para = normalizarEmail(texto(a.to ?? a.para, 254));
      const mensaje = texto(a.body ?? a.mensaje, 3000);
      if (!para || !mensaje) return err("Faltan destinatario o cuerpo");
      // El agente solo le puede escribir al contacto de ESTA conversación.
      // Sin esta línea, una inyección le pediría mandarle un email a un
      // tercero desde el dominio del cliente.
      const c = await prisma.contact.findFirst({
        where: paraTenant(t.id, { id: ctx.contactId }), select: { email: true, nombre: true },
      });
      if (!c?.email || c.email !== para) return err("Solo se puede escribir al contacto de esta conversación");

      const r = await encolar(t, {
        tenantId: t.id, para, plantilla: "respuesta",
        datos: { nombre: c.nombre ?? "", mensaje, asunto: texto(a.subject ?? a.asunto, 200) ?? "" },
        claveIdempotencia: texto(a.idempotency_key, 120) ?? undefined,
      });
      return r.ok ? ok({ emailId: r.id, duplicado: r.duplicado }) : err(`No se envió: ${r.motivo}`);
    }

    case "NotifyTeam": {
      const titulo = texto(a.title ?? a.titulo, 200);
      if (!titulo) return err("Falta el título del aviso");
      await avisar({
        t,
        evento: a.urgent === true ? "urgente" : "nuevo_lead",
        titulo,
        detalle: texto(a.detail ?? a.detalle, 1000) ?? "",
        clave: `tool:${ctx.conversationId}:${titulo.slice(0, 40)}`,
      });
      return ok({ avisado: true });
    }

    case "RequestHumanHandoff": {
      const motivo = (texto(a.reason ?? a.motivo, 60) ?? "sin_informacion") as MotivoHandoff;
      await derivar({
        t, conversationId: ctx.conversationId,
        motivo, detalle: texto(a.detail ?? a.detalle, 1000) ?? undefined,
        leadId: ctx.leadId, contactId: ctx.contactId,
      });
      return ok({ derivado: true }, "La conversación quedó en manos del equipo.");
    }

    // -----------------------------------------------------------------
    case "CreateFollowUp": {
      if (!ctx.leadId) return err("No hay lead al que asociarle un seguimiento");
      const n = await programar(t, ctx.leadId);
      return ok({ pasosProgramados: n });
    }

    case "CancelFollowUps": {
      if (!ctx.leadId) return ok({ cancelados: 0 });
      const n = await cortar(t.id, ctx.leadId, "manual");
      return ok({ cancelados: n });
    }

    case "GetConversationHistory": {
      const mensajes = await prisma.message.findMany({
        where: paraTenant(t.id, { conversationId: ctx.conversationId }),
        orderBy: { createdAt: "asc" },
        take: 40,
        select: { direccion: true, remitente: true, contenido: true, createdAt: true },
      });
      return ok({ mensajes: mensajes.map((m) => ({ quien: m.remitente, texto: m.contenido })) });
    }
  }
}
