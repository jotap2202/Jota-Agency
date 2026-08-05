import type { Tenant } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { SITIO_URL } from "@/lib/sitio";
import { paraTenant, modoDe, estaAbierto, canalHabilitado } from "./tenant";
import { recibir, marcarEstadoFinal, guardarRespuesta } from "./intake";
import { buscarConocimiento } from "./conocimiento";
import { pensar, hayClaveIa, type MensajeHistorial } from "./agente";
import { respuestaFallback } from "./prompt";
import { ejecutar, type Contexto } from "./herramientas";
import { calcularPuntaje, estadoDeBanda, montoAproximado } from "./puntaje";
import { derivar, textoParaElCliente, type MotivoHandoff } from "./handoff";
import { programar, cortar } from "./seguimientos";
import { encolar, suprimir } from "./email";
import { avisar } from "./notificaciones";
import { pareceSpam, pareceInyeccion, normalizarEmail, normalizarTelefono } from "./seguridad";
import * as ev from "./eventos";
import type { ConsultaEntrante, EstadoFinal, ResultadoConsulta, SalidaAgente } from "./tipos";

/**
 * Workflow 05 — Conversation Orchestrator.
 *
 * Los 25 pasos del flujo principal, en orden. La estructura es deliberada:
 * el mensaje se guarda en el paso 9 (`recibir`) y todo lo que puede fallar
 * pasa después. Cualquier `throw` de acá en adelante deja la consulta guardada
 * con `estadoFinal` en null, que es la señal que busca recuperación.
 */

/** Frases que significan "no me escribas más". Se respetan sin pasar por el modelo. */
const BAJA = /^\s*(stop|unsubscribe|remove me|no me escrib|baja|dar de baja|opt.?out)\b/i;

export async function procesar(t: Tenant, c: ConsultaEntrante): Promise<ResultadoConsulta> {
  // Paso 2-3: canal habilitado y tenant activo se validan en la ruta HTTP.
  // Paso 4-9: normalizar, deduplicar, contacto, conversación, GUARDAR.
  const intake = await recibir(t, c);
  const { conversationId, correlationId } = intake;

  const base = {
    duplicado: intake.duplicado,
    conversationId,
    messageId: intake.mensaje.id,
    correlationId,
    requiereAprobacion: false,
  };

  // Un reenvío del mismo mensaje no se vuelve a contestar: se devuelve lo que
  // ya se había respondido.
  if (intake.duplicado) {
    const ultima = await prisma.message.findFirst({
      where: paraTenant(t.id, { conversationId, direccion: "saliente" }),
      orderBy: { createdAt: "desc" },
      select: { contenido: true },
    });
    return {
      ...base, ok: true,
      estadoFinal: (intake.mensaje.estadoFinal as EstadoFinal) ?? "respondida",
      respuesta: ultima?.contenido ?? "",
    };
  }

  try {
    return await procesarGuardado(t, c, intake, base);
  } catch (e) {
    // La consulta ya está guardada y sin estado final: recuperación la agarra.
    await ev.fallo({
      tenantId: t.id, workflow: "05-orquestador", correlationId,
      referencia: intake.mensaje.id, error: e,
    });
    await avisar({
      t, evento: "error",
      titulo: "Una consulta falló al procesarse",
      detalle: `Conversación ${conversationId}. Quedó guardada y se va a reintentar.`,
      url: `${SITIO_URL}/ceo/agent/health`,
      clave: `error:${intake.mensaje.id}`,
    });
    return { ...base, ok: false, estadoFinal: "error", respuesta: respuestaFallback(t, t.idioma) };
  }
}

type Base = {
  duplicado: boolean;
  conversationId: string;
  messageId: string;
  correlationId: string;
  requiereAprobacion: boolean;
};

async function procesarGuardado(
  t: Tenant,
  c: ConsultaEntrante,
  intake: Awaited<ReturnType<typeof recibir>>,
  base: Base,
): Promise<ResultadoConsulta> {
  const { conversationId, contactId } = intake;

  const conv = await prisma.conversation.findFirst({
    where: paraTenant(t.id, { id: conversationId }),
    include: { contacto: true },
  });
  if (!conv) throw new Error("conversación desaparecida");

  // ---- Baja: es lo primero. No pasa por la IA ni gasta tokens. ----
  if (BAJA.test(c.mensaje) && conv.contacto.email) {
    await suprimir(t.id, conv.contacto.email, "baja", "Lo pidió por escrito");
    await prisma.contact.update({ where: { id: contactId }, data: { noContactar: true } });
    const texto = "You're unsubscribed — you won't get any more messages from us. If you ever need us, just write again.";
    await guardarRespuesta({ tenantId: t.id, conversationId, contenido: texto, remitente: "sistema" });
    await cerrar(t, intake.mensaje.id, "descartada");
    await prisma.conversation.update({ where: { id: conversationId }, data: { estado: "resuelta" } });
    return { ...base, ok: true, estadoFinal: "descartada", respuesta: texto };
  }

  // ---- La IA está apagada: la conversación la tiene una persona ----
  if (!conv.iaActiva) {
    await avisar({
      t, evento: "sin_resolver",
      titulo: `Nuevo mensaje en una conversación tomada por el equipo`,
      detalle: `${conv.contacto.nombre ?? "Contacto"} escribió de nuevo.`,
      url: `${SITIO_URL}/ceo/agent/inbox/${conversationId}`,
      clave: `humano:${intake.mensaje.id}`,
    });
    await cerrar(t, intake.mensaje.id, "handoff");
    return { ...base, ok: true, estadoFinal: "handoff", respuesta: "" };
  }

  // ---- Spam evidente: no merece una llamada al modelo ----
  if (pareceSpam(c.mensaje, c.email)) {
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { estado: "descartada", intencion: "spam" },
    });
    await cerrar(t, intake.mensaje.id, "descartada");
    return { ...base, ok: true, estadoFinal: "descartada", respuesta: "" };
  }

  // ---- Pasos 10-13: contexto, conocimiento ----
  const historial = await armarHistorial(t.id, conversationId);
  const fuenteTexto = historial.filter((h) => h.rol === "user").map((h) => h.texto).join("\n");
  const fragmentos = await buscarConocimiento(t.id, c.mensaje, 5);
  const datosConocidos = await datosYaConocidos(t.id, contactId, conversationId);

  if (pareceInyeccion(c.mensaje)) {
    await ev.auditar({
      tenantId: t.id, actorTipo: "sistema", accion: "seguridad.inyeccion_detectada",
      entidad: "Message", entidadId: intake.mensaje.id,
    });
  }

  // ---- Paso 14-16: pensar ----
  if (!hayClaveIa()) {
    return await sinIa(t, intake, base, "sin_informacion");
  }

  const r = await pensar({
    t, canal: c.canal, historial, fragmentos,
    datosYaConocidos: datosConocidos, fuenteTexto,
  });

  if (!r.ok) {
    console.error(`[agente] el modelo no respondió (${r.motivo}): ${r.detalle ?? ""}`);
    await ev.fallo({
      tenantId: t.id, workflow: "05-orquestador", correlationId: base.correlationId,
      referencia: intake.mensaje.id, error: `modelo: ${r.motivo} ${r.detalle}`,
    });
    return await sinIa(t, intake, base, "accion_fallida");
  }

  let salida: SalidaAgente = r.salida;
  let tokens = r.tokens;

  // ---- Herramienta: una ronda, y con el resultado se vuelve a pedir texto ----
  if (salida.pedidoHerramienta) {
    const ctx: Contexto = { t, conversationId, contactId, leadId: await leadDe(t.id, conversationId) };
    const res = await ejecutar(ctx, salida.pedidoHerramienta.herramienta, salida.pedidoHerramienta.argumentos);

    const segunda = await pensar({
      t, canal: c.canal, historial, fragmentos,
      datosYaConocidos: datosConocidos, fuenteTexto,
      resultadoHerramienta: {
        herramienta: salida.pedidoHerramienta.herramienta,
        salida: JSON.stringify(res).slice(0, 2000),
      },
    });
    if (segunda.ok) {
      // La segunda vuelta piensa sobre el resultado de la herramienta y suele
      // devolver lead_data vacío. Lo que la primera vuelta ya extrajo —y ya
      // pasó la validación de citas— no se pierde: campo por campo, se
      // conserva el que tenga valor.
      const previos = salida.datosLead;
      salida = segunda.salida;
      for (const k of Object.keys(previos) as (keyof typeof previos)[]) {
        if (salida.datosLead[k] == null && previos[k] != null) {
          (salida.datosLead as Record<string, unknown>)[k] = previos[k];
        }
      }
      tokens = {
        entrada: tokens.entrada + segunda.tokens.entrada,
        salida: tokens.salida + segunda.tokens.salida,
      };
    } else if (!res.ok) {
      // La herramienta falló y el modelo no pudo rearmar: no se le miente al
      // cliente diciendo que se hizo algo que no se hizo.
      return await sinIa(t, intake, base, "accion_fallida");
    }
  }

  // ---- Pasos 18-20: lead y score ----
  const lead = await guardarLead(t, {
    contactId, conversationId, salida,
    mensajesDelContacto: intake.mensajesDelContacto,
    contactoPrevio: intake.contactoPrevio,
  });

  await prisma.conversation.update({
    where: { id: conversationId },
    data: {
      intencion: salida.intencion,
      intenciones: salida.intenciones,
      sentimiento: salida.sentimiento,
      urgencia: salida.urgencia,
      resumen: salida.respuesta.slice(0, 400),
    },
  });

  // ---- Paso 16 bis: guardrails ----
  const motivoHandoff = decidirHandoff(t, salida, lead.score, fragmentos.length);
  if (motivoHandoff) {
    const texto = textoParaElCliente(t, salida.idioma, estaAbierto(t));
    await derivar({
      t, conversationId, motivo: motivoHandoff,
      detalle: salida.motivoHandoff ?? undefined, leadId: lead.id, contactId,
    });
    await guardarRespuesta({
      tenantId: t.id, conversationId, contenido: texto, remitente: "agente",
      confianza: salida.confianza, fuentes: fragmentos.map((f) => f.id),
      tokensEntrada: tokens.entrada, tokensSalida: tokens.salida,
    });
    if (lead.score >= t.umbralAviso && lead.banda !== "spam") {
      await avisarLeadCalificado({
        t, canal: c.canal, conversationId, contactId,
        salida, lead, citaInicio: null,
      });
    }
    await cerrar(t, intake.mensaje.id, "handoff");
    return { ...base, ok: true, estadoFinal: "handoff", respuesta: texto, leadId: lead.id };
  }

  // ---- Modo de operación: ¿se envía o se pide aprobación? ----
  const modo = modoDe(t, c.canal);
  if (modo === "draft") {
    await prisma.approvalRequest.create({
      data: {
        tenantId: t.id, conversationId, accion: "enviar_respuesta",
        propuesta: salida.respuesta, motivo: "Modo borrador: toda respuesta se aprueba",
        confianza: salida.confianza,
        datos: { intencion: salida.intencion, score: lead.score },
      },
    });
    await avisar({
      t, evento: "nuevo_lead",
      titulo: "Respuesta esperando aprobación",
      detalle: salida.respuesta.slice(0, 300),
      url: `${SITIO_URL}/ceo/agent/inbox/${conversationId}`,
      clave: `aprobacion:${intake.mensaje.id}`,
    });
    await cerrar(t, intake.mensaje.id, "seguimiento");
    return { ...base, ok: true, requiereAprobacion: true, estadoFinal: "seguimiento", respuesta: "", leadId: lead.id };
  }

  // ---- Paso 17: enviar ----
  await guardarRespuesta({
    tenantId: t.id, conversationId, contenido: salida.respuesta, remitente: "agente",
    confianza: salida.confianza, fuentes: fragmentos.map((f) => f.id),
    tokensEntrada: tokens.entrada, tokensSalida: tokens.salida,
  });

  // Por email se responde por email, dentro del mismo hilo.
  if (c.canal === "email" && conv.contacto.email) {
    await encolar(t, {
      tenantId: t.id,
      para: conv.contacto.email,
      plantilla: "respuesta",
      datos: { nombre: conv.contacto.nombre ?? "", mensaje: salida.respuesta },
      asuntoForzado: asuntoRespuesta(c.emailHeaders?.asunto),
      inReplyTo: c.emailHeaders?.messageId ?? null,
      referencesPrevias: c.emailHeaders?.references ?? null,
      claveIdempotencia: `resp:${intake.mensaje.id}`,
    });
  }

  // ---- Pasos 21-23: próxima acción, seguimiento, aviso ----
  let estadoFinal: EstadoFinal = "respondida";

  const cita = await prisma.appointment.findFirst({
    where: paraTenant(t.id, { conversationId, estado: { in: ["agendada", "reprogramada"] } }),
    orderBy: { createdAt: "desc" },
  });

  if (cita) {
    estadoFinal = "agendada";
    await cortar(t.id, lead.id, "agendo");
  } else if (conv.contacto.email && !conv.contacto.noContactar && lead.score >= 40) {
    const n = await programar(t, lead.id);
    if (n > 0) estadoFinal = "seguimiento";
  }

  if (lead.score >= t.umbralAviso && lead.banda !== "spam") {
    estadoFinal = estadoFinal === "respondida" ? "calificada" : estadoFinal;
    await avisarLeadCalificado({
      t, canal: c.canal, conversationId, contactId,
      salida, lead, citaInicio: cita ? cita.inicio : null,
    });
  }

  // ---- Pasos 24-25: cerrar el círculo ----
  await cerrar(t, intake.mensaje.id, estadoFinal);
  await ev.ok({
    tenantId: t.id, workflow: "05-orquestador",
    correlationId: base.correlationId, referencia: intake.mensaje.id,
  });

  return { ...base, ok: true, estadoFinal, respuesta: salida.respuesta, leadId: lead.id };
}

// ---------------------------------------------------------------------------

async function cerrar(t: Tenant, messageId: string, estado: EstadoFinal): Promise<void> {
  await marcarEstadoFinal(t.id, messageId, estado);
}

/**
 * Camino sin IA: no hay clave, el modelo falló, o una herramienta no pudo
 * completarse. Se contesta algo honesto y se deriva a una persona. Nunca se
 * deja al cliente esperando.
 */
async function sinIa(
  t: Tenant,
  intake: Awaited<ReturnType<typeof recibir>>,
  base: Base,
  motivo: MotivoHandoff,
): Promise<ResultadoConsulta> {
  const texto = respuestaFallback(t, t.idioma);
  await guardarRespuesta({
    tenantId: t.id, conversationId: intake.conversationId,
    contenido: texto, remitente: "agente", confianza: 0,
  });
  await derivar({
    t, conversationId: intake.conversationId, motivo,
    detalle: "El agente no pudo generar una respuesta confiable",
    contactId: intake.contactId,
  });
  await cerrar(t, intake.mensaje.id, "handoff");
  return { ...base, ok: true, estadoFinal: "handoff", respuesta: texto };
}

function decidirHandoff(
  t: Tenant,
  s: SalidaAgente,
  score: number,
  fragmentos: number,
): MotivoHandoff | null {
  if (s.requiereHumano) {
    const m = (s.motivoHandoff ?? "").toLowerCase();
    if (/discount|descuento/.test(m)) return "descuento";
    if (/complaint|queja/.test(m)) return "queja";
    if (/emergen/.test(m)) return "emergencia";
    if (/contract|contrato/.test(m)) return "contrato";
    if (/privac/.test(m)) return "privacidad";
    return "pedido_del_usuario";
  }
  if (s.confianza < t.confianzaMinima) return "confianza_baja";
  if (s.intencion === "complaint") return "queja";
  if (s.intencion === "pricing_question" && !t.reglasPrecio.trim() && fragmentos === 0) return "sin_informacion";
  if (score >= 90) return "lead_valioso";
  return null;
}

async function armarHistorial(tenantId: string, conversationId: string): Promise<MensajeHistorial[]> {
  const mensajes = await prisma.message.findMany({
    where: paraTenant(tenantId, { conversationId }),
    orderBy: { createdAt: "asc" },
    take: 30,
    select: { direccion: true, remitente: true, contenido: true },
  });
  return mensajes
    .filter((m) => !m.contenido.startsWith("[nota interna]"))
    .map((m) => ({
      rol: m.direccion === "entrante" ? ("user" as const) : ("assistant" as const),
      texto: m.contenido,
    }));
}

/** Lo que ya sabemos, para que el agente no lo vuelva a preguntar. */
async function datosYaConocidos(
  tenantId: string,
  contactId: string,
  conversationId: string,
): Promise<Record<string, string>> {
  const [c, l] = await Promise.all([
    prisma.contact.findFirst({ where: paraTenant(tenantId, { id: contactId }) }),
    prisma.lead.findFirst({ where: paraTenant(tenantId, { conversationId }) }),
  ]);
  const d: Record<string, string> = {};
  const poner = (k: string, v: string | null | undefined) => { if (v) d[k] = v; };
  poner("name", [c?.nombre, c?.apellido].filter(Boolean).join(" ") || null);
  poner("email", c?.email);
  poner("phone", c?.telefono);
  poner("company", c?.empresa);
  poner("location", c?.ubicacion ?? l?.ubicacion);
  poner("service", l?.servicio);
  poner("problem", l?.problema);
  poner("timeline", l?.plazo);
  poner("budget", l?.presupuesto ? `${(l.presupuesto / 100).toFixed(0)} (stated)` : null);
  return d;
}

async function leadDe(tenantId: string, conversationId: string): Promise<string | null> {
  const l = await prisma.lead.findFirst({
    where: paraTenant(tenantId, { conversationId }),
    select: { id: true },
  });
  return l?.id ?? null;
}

/**
 * Crea o actualiza el lead y recalcula el score.
 *
 * Los campos solo se completan si venían vacíos o si el dato es nuevo: una
 * respuesta posterior no puede borrar el presupuesto que la persona dijo en
 * el segundo mensaje.
 */
/**
 * Aviso interno de lead calificado, con la ficha completa. Se manda tanto en
 * el camino normal como cuando la conversación termina en handoff: un lead de
 * score alto deriva a una persona a propósito, y que justo ese aviso llegara
 * como "error interno" sin nombre, teléfono ni score era exactamente al revés.
 */
async function avisarLeadCalificado(o: {
  t: Tenant;
  canal: ConsultaEntrante["canal"];
  conversationId: string;
  contactId: string;
  salida: SalidaAgente;
  lead: Awaited<ReturnType<typeof guardarLead>>;
  citaInicio: Date | null;
}) {
  const { t, lead, salida } = o;
  // El contacto se relee acá a propósito: el snapshot del orquestador es de
  // ANTES de guardarLead, y el asunto diría "Unknown" justo en el mensaje en
  // el que el cliente acaba de dejar su nombre.
  const contacto = await prisma.contact.findFirst({
    where: paraTenant(t.id, { id: o.contactId }),
    select: {
      nombre: true, apellido: true, empresa: true, email: true, telefono: true,
    },
  });
  await avisar({
    t,
    evento: lead.banda === "hot" ? "hot_lead" : "nuevo_lead",
    titulo: `${lead.etiqueta}: ${contacto?.nombre ?? "sin nombre"}`,
    detalle: `${salida.intencion} · score ${lead.score}`,
    url: `${SITIO_URL}/ceo/agent/inbox/${o.conversationId}`,
    clave: `lead:${lead.id}`,
    datosLead: {
      nombre: [contacto?.nombre, contacto?.apellido].filter(Boolean).join(" "),
      empresa: contacto?.empresa ?? "",
      email: contacto?.email ?? "",
      telefono: contacto?.telefono ?? "",
      canal: o.canal,
      servicio: salida.datosLead.servicio ?? "",
      problema: salida.datosLead.problema ?? "",
      presupuesto: salida.datosLead.presupuesto ?? "",
      plazo: salida.datosLead.plazo ?? "",
      urgencia: salida.urgencia,
      score: String(lead.score),
      banda: lead.etiqueta,
      confianza: lead.confianza,
      proximaAccion: salida.proximaAccion,
      positivos: lead.positivos.join("|"),
      negativos: lead.negativos.join("|"),
      faltantes: lead.faltantes.join("|"),
      resumen: salida.respuesta.slice(0, 500),
      cita: o.citaInicio ? o.citaInicio.toISOString() : "",
      urlConversacion: `${SITIO_URL}/ceo/agent/inbox/${o.conversationId}`,
    },
  });
}

async function guardarLead(
  t: Tenant,
  o: {
    contactId: string;
    conversationId: string;
    salida: SalidaAgente;
    mensajesDelContacto: number;
    contactoPrevio: boolean;
  },
) {
  const d = o.salida.datosLead;

  // Los datos de contacto van al Contact, que es donde viven.
  const datosContacto: Record<string, string> = {};
  const email = normalizarEmail(d.email);
  const tel = normalizarTelefono(d.telefono);
  if (d.nombre) datosContacto.nombre = d.nombre;
  if (d.apellido) datosContacto.apellido = d.apellido;
  if (tel) datosContacto.telefono = tel;
  if (d.empresa) datosContacto.empresa = d.empresa;
  if (d.ubicacion) datosContacto.ubicacion = d.ubicacion;
  if (o.salida.idioma) datosContacto.idioma = o.salida.idioma.slice(0, 5);

  if (email) {
    // Si ese email ya es de otro contacto, no se pisa: fusionar es decisión
    // de una persona.
    const otro = await prisma.contact.findFirst({
      where: paraTenant(t.id, { email, id: { not: o.contactId } }),
      select: { id: true },
    });
    if (!otro) datosContacto.email = email;
  }
  if (Object.keys(datosContacto).length > 0) {
    await prisma.contact.updateMany({
      where: paraTenant(t.id, { id: o.contactId }),
      data: datosContacto,
    });
  }

  const puntaje = calcularPuntaje({
    t,
    datos: { ...d, email: email ?? d.email, telefono: tel ?? d.telefono },
    intencion: o.salida.intencion,
    intenciones: o.salida.intenciones,
    urgencia: o.salida.urgencia,
    mensajesDelContacto: o.mensajesDelContacto,
    contactoPrevio: o.contactoPrevio,
  });

  const existente = await prisma.lead.findFirst({
    where: paraTenant(t.id, { conversationId: o.conversationId }),
  });

  const datosLead = {
    servicio: d.servicio ?? existente?.servicio ?? null,
    problema: d.problema ?? existente?.problema ?? null,
    resultado: d.resultado ?? existente?.resultado ?? null,
    presupuesto: d.presupuesto ? montoAproximado(d.presupuesto) : existente?.presupuesto ?? null,
    plazo: d.plazo ?? existente?.plazo ?? null,
    ubicacion: d.ubicacion ?? existente?.ubicacion ?? null,
    tamanioEmpresa: d.tamanioEmpresa ?? existente?.tamanioEmpresa ?? null,
    autoridad: d.autoridad ?? existente?.autoridad ?? null,
    mejorHorario: d.mejorHorario ?? existente?.mejorHorario ?? null,
    canalPreferido: d.canalPreferido ?? existente?.canalPreferido ?? null,
    score: puntaje.score,
    confianza: puntaje.confianza,
    scoreDetalle: {
      positivos: puntaje.positivos,
      negativos: puntaje.negativos,
      faltantes: puntaje.faltantes,
      factores: puntaje.factores,
    },
    estado: estadoDeBanda(puntaje.banda),
    proximaAccion: o.salida.proximaAccion,
  };

  const lead = existente
    ? await prisma.lead.update({ where: { id: existente.id }, data: datosLead })
    : await prisma.lead.create({
        data: {
          tenantId: t.id,
          contactId: o.contactId,
          conversationId: o.conversationId,
          ...datosLead,
        },
      });

  return { id: lead.id, ...puntaje };
}

/** "Re:" una sola vez, aunque el hilo tenga diez respuestas. */
export function asuntoRespuesta(asunto?: string): string | undefined {
  if (!asunto) return undefined;
  const limpio = asunto.replace(/^(\s*(re|rv|fwd)\s*:\s*)+/i, "").trim();
  return `Re: ${limpio}`.slice(0, 300);
}

/** Reexporta para las rutas: canal habilitado antes de aceptar nada. */
export { canalHabilitado };
