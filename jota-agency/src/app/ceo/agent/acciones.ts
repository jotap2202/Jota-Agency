"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { esAdmin } from "@/lib/admin";
import { paraTenant } from "@/lib/agente/tenant";
import { guardarRespuesta } from "@/lib/agente/intake";
import { derivar, devolverALaIa } from "@/lib/agente/handoff";
import { cargarDemo, borrarDemo } from "@/lib/agente/demo";
import { crearTenant, activar } from "@/lib/agente/onboarding";
import { sincronizarFuente } from "@/lib/agente/conocimiento";
import { despachar, encolar, suprimir } from "@/lib/agente/email";
import { recuperar } from "@/lib/agente/recuperacion";
import { cifrar, hayClaveMaestra, tokenNuevo } from "@/lib/agente/cripto";
import { cortar } from "@/lib/agente/seguimientos";
import { sincronizar } from "@/lib/agente/crm";
import { normalizarEmail } from "@/lib/agente/seguridad";
import * as ev from "@/lib/agente/eventos";

/**
 * Cada server action es un endpoint HTTP público. Que /ceo esté protegida por
 * el layout NO protege a estas funciones: el permiso se revalida acá adentro,
 * en todas, sin excepción.
 *
 * Además, toda acción que toca datos de un negocio recibe el tenantId y filtra
 * por él con `paraTenant`. Un id de otro tenant no devuelve nada en vez de
 * devolver datos ajenos.
 */
async function exigirCeo(): Promise<string> {
  const session = await auth();
  if (!session?.user || !(await esAdmin(session.user.email))) {
    throw new Error("No autorizado");
  }
  return session.user.email ?? "ceo";
}

const texto = (v: FormDataEntryValue | null, max: number) =>
  String(v ?? "").trim().slice(0, max);

function refrescar(...rutas: string[]) {
  for (const r of ["/ceo/agent", ...rutas]) revalidatePath(r);
}

// ---------------------------------------------------------------------------
//  Demo
// ---------------------------------------------------------------------------

export async function accionCargarDemo(): Promise<void> {
  await exigirCeo();
  await cargarDemo();
  refrescar("/ceo/agent/inbox", "/ceo/agent/leads", "/ceo/agent/businesses", "/ceo");
}

export async function accionBorrarDemo(): Promise<void> {
  await exigirCeo();
  await borrarDemo();
  refrescar("/ceo/agent/inbox", "/ceo/agent/leads", "/ceo/agent/businesses", "/ceo");
}

// ---------------------------------------------------------------------------
//  Live Inbox
// ---------------------------------------------------------------------------

export async function accionResponder(fd: FormData) {
  const quien = await exigirCeo();
  const tenantId = texto(fd.get("tenantId"), 40);
  const conversationId = texto(fd.get("conversationId"), 40);
  const mensaje = texto(fd.get("mensaje"), 4000);
  if (!tenantId || !conversationId || !mensaje) return;

  const conv = await prisma.conversation.findFirst({
    where: paraTenant(tenantId, { id: conversationId }),
    include: { contacto: true },
  });
  if (!conv) throw new Error("Conversación inexistente");

  // Si una persona escribe, la IA deja de contestar sola en ese hilo. Si no,
  // los dos le responden a la misma persona y queda un desastre.
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { iaActiva: false, estado: "abierta" },
  });

  await guardarRespuesta({
    tenantId, conversationId, contenido: mensaje, remitente: "humano",
    generadoPorIa: false,
  });

  // Por email, la respuesta sale por email dentro del mismo hilo.
  if (conv.canal === "email" && conv.contacto.email) {
    const ultimoEntrante = await prisma.message.findFirst({
      where: paraTenant(tenantId, { conversationId, direccion: "entrante" }),
      orderBy: { createdAt: "desc" },
      select: { idExterno: true },
    });
    const t = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (t) {
      await encolar(t, {
        tenantId, para: conv.contacto.email, plantilla: "respuesta",
        datos: { nombre: conv.contacto.nombre ?? "", mensaje },
        inReplyTo: ultimoEntrante?.idExterno ?? null,
        referencesPrevias: conv.hiloExterno,
      });
    }
  }

  await ev.auditar({
    tenantId, actorTipo: "humano", actorId: quien, accion: "conversacion.respuesta_manual",
    entidad: "Conversation", entidadId: conversationId,
  });
  refrescar(`/ceo/agent/inbox/${conversationId}`, "/ceo/agent/inbox");
}

export async function accionPausarIa(fd: FormData) {
  const quien = await exigirCeo();
  const tenantId = texto(fd.get("tenantId"), 40);
  const conversationId = texto(fd.get("conversationId"), 40);
  const activar_ = texto(fd.get("activar"), 5) === "si";
  if (!tenantId || !conversationId) return;

  if (activar_) {
    await devolverALaIa(tenantId, conversationId, quien);
  } else {
    await prisma.conversation.updateMany({
      where: paraTenant(tenantId, { id: conversationId }),
      data: { iaActiva: false },
    });
    await ev.auditar({
      tenantId, actorTipo: "humano", actorId: quien, accion: "conversacion.ia_pausada",
      entidad: "Conversation", entidadId: conversationId,
    });
  }
  refrescar(`/ceo/agent/inbox/${conversationId}`, "/ceo/agent/inbox");
}

export async function accionDerivar(fd: FormData) {
  const quien = await exigirCeo();
  const tenantId = texto(fd.get("tenantId"), 40);
  const conversationId = texto(fd.get("conversationId"), 40);
  if (!tenantId || !conversationId) return;
  const t = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!t) return;
  await derivar({
    t, conversationId, motivo: "pedido_del_usuario",
    detalle: `Derivada a mano por ${quien}`, quien: "humano",
  });
  refrescar(`/ceo/agent/inbox/${conversationId}`, "/ceo/agent/inbox");
}

export async function accionAsignar(fd: FormData) {
  await exigirCeo();
  const tenantId = texto(fd.get("tenantId"), 40);
  const conversationId = texto(fd.get("conversationId"), 40);
  const miembroId = texto(fd.get("miembroId"), 40) || null;
  if (!tenantId || !conversationId) return;
  // El miembro tiene que ser de ESTE tenant.
  if (miembroId) {
    const m = await prisma.tenantMember.findFirst({ where: paraTenant(tenantId, { id: miembroId }) });
    if (!m) throw new Error("Ese responsable no pertenece a este negocio");
  }
  await prisma.conversation.updateMany({
    where: paraTenant(tenantId, { id: conversationId }),
    data: { asignadoA: miembroId },
  });
  refrescar(`/ceo/agent/inbox/${conversationId}`);
}

export async function accionNota(fd: FormData) {
  const quien = await exigirCeo();
  const tenantId = texto(fd.get("tenantId"), 40);
  const conversationId = texto(fd.get("conversationId"), 40);
  const nota = texto(fd.get("nota"), 2000);
  if (!tenantId || !conversationId || !nota) return;
  const conv = await prisma.conversation.findFirst({ where: paraTenant(tenantId, { id: conversationId }) });
  if (!conv) throw new Error("Conversación inexistente");
  await prisma.message.create({
    data: {
      tenantId, conversationId, direccion: "saliente", remitente: "sistema",
      contenido: `[nota interna] ${nota} — ${quien}`,
    },
  });
  refrescar(`/ceo/agent/inbox/${conversationId}`);
}

export async function accionEstadoConversacion(fd: FormData) {
  await exigirCeo();
  const tenantId = texto(fd.get("tenantId"), 40);
  const conversationId = texto(fd.get("conversationId"), 40);
  const estado = texto(fd.get("estado"), 20);
  if (!["abierta", "esperando_humano", "resuelta", "descartada"].includes(estado)) return;
  await prisma.conversation.updateMany({
    where: paraTenant(tenantId, { id: conversationId }),
    data: { estado },
  });
  refrescar(`/ceo/agent/inbox/${conversationId}`, "/ceo/agent/inbox");
}

// ---------------------------------------------------------------------------
//  Aprobaciones
// ---------------------------------------------------------------------------

export async function accionAprobacion(fd: FormData) {
  const quien = await exigirCeo();
  const tenantId = texto(fd.get("tenantId"), 40);
  const id = texto(fd.get("aprobacionId"), 40);
  const decision = texto(fd.get("decision"), 12);
  const textoFinal = texto(fd.get("textoFinal"), 4000);
  if (!tenantId || !id || !["aprobar", "editar", "rechazar"].includes(decision)) return;

  const ap = await prisma.approvalRequest.findFirst({ where: paraTenant(tenantId, { id, estado: "pendiente" }) });
  if (!ap) return;

  const final = decision === "editar" ? textoFinal : ap.propuesta;

  await prisma.approvalRequest.update({
    where: { id },
    data: {
      estado: decision === "rechazar" ? "rechazada" : decision === "editar" ? "editada" : "aprobada",
      resueltaPor: quien,
      resueltaEn: new Date(),
      textoFinal: decision === "rechazar" ? null : final,
    },
  });

  // Aprobar significa que el mensaje SALE. Si no se enviara, el modo borrador
  // sería un cementerio de respuestas aprobadas que nadie recibió.
  if (decision !== "rechazar" && ap.conversationId && final) {
    await guardarRespuesta({
      tenantId, conversationId: ap.conversationId, contenido: final,
      remitente: "agente", generadoPorIa: true,
    });
    const conv = await prisma.conversation.findFirst({
      where: paraTenant(tenantId, { id: ap.conversationId }),
      include: { contacto: true },
    });
    const t = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (t && conv?.canal === "email" && conv.contacto.email) {
      await encolar(t, {
        tenantId, para: conv.contacto.email, plantilla: "respuesta",
        datos: { nombre: conv.contacto.nombre ?? "", mensaje: final },
        claveIdempotencia: `aprobacion:${id}`,
      });
    }
  }

  await ev.auditar({
    tenantId, actorTipo: "humano", actorId: quien, accion: `aprobacion.${decision}`,
    entidad: "ApprovalRequest", entidadId: id,
  });
  refrescar(`/ceo/agent/inbox/${ap.conversationId ?? ""}`, "/ceo/agent/inbox");
}

// ---------------------------------------------------------------------------
//  Leads
// ---------------------------------------------------------------------------

export async function accionEstadoLead(fd: FormData) {
  const quien = await exigirCeo();
  const tenantId = texto(fd.get("tenantId"), 40);
  const leadId = texto(fd.get("leadId"), 40);
  const estado = texto(fd.get("estado"), 20);
  if (!["nuevo", "calificado", "nutrir", "baja_prioridad", "descartado", "ganado", "perdido"].includes(estado)) return;

  await prisma.lead.updateMany({ where: paraTenant(tenantId, { id: leadId }), data: { estado } });

  // Ganado, perdido o descartado: se frenan los seguimientos. Seguir
  // escribiéndole a un cliente que ya compró es la forma más rápida de que
  // el dueño del negocio apague el agente.
  if (estado === "ganado") await cortar(tenantId, leadId, "cliente");
  if (estado === "descartado") await cortar(tenantId, leadId, "spam");
  if (estado === "perdido") await cortar(tenantId, leadId, "manual");

  await ev.auditar({
    tenantId, actorTipo: "humano", actorId: quien, accion: "lead.estado",
    entidad: "Lead", entidadId: leadId, metadatos: { estado },
  });
  refrescar("/ceo/agent/leads");
}

export async function accionSincronizarCrm(fd: FormData) {
  await exigirCeo();
  const tenantId = texto(fd.get("tenantId"), 40);
  const leadId = texto(fd.get("leadId"), 40);
  const t = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!t) return;
  await sincronizar(t, leadId);
  refrescar("/ceo/agent/leads");
}

// ---------------------------------------------------------------------------
//  Base de conocimiento
// ---------------------------------------------------------------------------

export async function accionGuardarFuente(fd: FormData) {
  await exigirCeo();
  const tenantId = texto(fd.get("tenantId"), 40);
  const id = texto(fd.get("fuenteId"), 40);
  const titulo = texto(fd.get("titulo"), 200);
  const contenido = texto(fd.get("contenido"), 80_000);
  const tipo = texto(fd.get("tipo"), 30) || "manual";
  if (!tenantId || !titulo || !contenido) return;

  const fuente = id
    ? (await prisma.knowledgeSource.updateMany({
        where: paraTenant(tenantId, { id }),
        data: { titulo, contenido, tipo, estado: "activa" },
      }),
      await prisma.knowledgeSource.findFirst({ where: paraTenant(tenantId, { id }) }))
    : await prisma.knowledgeSource.create({ data: { tenantId, tipo, titulo, contenido } });

  if (fuente) await sincronizarFuente(tenantId, fuente.id);
  refrescar("/ceo/agent/knowledge");
}

export async function accionBorrarFuente(fd: FormData) {
  await exigirCeo();
  const tenantId = texto(fd.get("tenantId"), 40);
  const id = texto(fd.get("fuenteId"), 40);
  await prisma.knowledgeSource.deleteMany({ where: paraTenant(tenantId, { id }) });
  refrescar("/ceo/agent/knowledge");
}

export async function accionResincronizar(fd: FormData) {
  await exigirCeo();
  const tenantId = texto(fd.get("tenantId"), 40);
  const id = texto(fd.get("fuenteId"), 40);
  await sincronizarFuente(tenantId, id).catch(() => {});
  refrescar("/ceo/agent/knowledge");
}

// ---------------------------------------------------------------------------
//  Configuración del agente
// ---------------------------------------------------------------------------

export async function accionGuardarConfig(fd: FormData) {
  const quien = await exigirCeo();
  const tenantId = texto(fd.get("tenantId"), 40);
  if (!tenantId) return;

  const horas = texto(fd.get("secuenciaHoras"), 60)
    .split(",")
    .map((h) => Number(h.trim()))
    .filter((h) => Number.isFinite(h) && h > 0 && h <= 24 * 90);

  const confianza = Number(texto(fd.get("confianzaMinima"), 8));
  const umbral = Number(texto(fd.get("umbralAviso"), 5));
  const sla = Number(texto(fd.get("slaRespuestaMin"), 6));

  await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      nombreAgente: texto(fd.get("nombreAgente"), 60) || "Ava",
      presentacion: texto(fd.get("presentacion"), 400) || null,
      tono: texto(fd.get("tono"), 20) || "profesional",
      largoRespuesta: texto(fd.get("largoRespuesta"), 10) || "corta",
      usaEmojis: fd.get("usaEmojis") === "on",
      idioma: texto(fd.get("idioma"), 5) || "en",
      firmaEmail: texto(fd.get("firmaEmail"), 400) || null,
      descripcion: texto(fd.get("descripcion"), 2000) || null,
      sitioWeb: texto(fd.get("sitioWeb"), 300) || null,
      zonaHoraria: texto(fd.get("zonaHoraria"), 60) || "Pacific/Honolulu",
      servicios: texto(fd.get("servicios"), 8000),
      areaServicio: texto(fd.get("areaServicio"), 500) || null,
      reglasPrecio: texto(fd.get("reglasPrecio"), 8000),
      politicas: texto(fd.get("politicas"), 8000),
      prohibido: texto(fd.get("prohibido"), 4000),
      reglasHandoff: texto(fd.get("reglasHandoff"), 4000),
      requiereAprobacion: texto(fd.get("requiereAprobacion"), 2000),
      canales: texto(fd.get("canales"), 500) || "website_chat\nweb_form\nemail",
      modo: ["draft", "supervisado", "autonomo"].includes(texto(fd.get("modo"), 20))
        ? texto(fd.get("modo"), 20)
        : "supervisado",
      confianzaMinima: Number.isFinite(confianza) && confianza >= 0 && confianza <= 1 ? confianza : 0.6,
      umbralAviso: Number.isFinite(umbral) && umbral >= 0 && umbral <= 100 ? Math.round(umbral) : 70,
      slaRespuestaMin: Number.isFinite(sla) && sla >= 1 && sla <= 1440 ? Math.round(sla) : 15,
      secuenciaHoras: horas.length ? horas : [24, 72, 168],
    },
  });

  await ev.auditar({
    tenantId, actorTipo: "humano", actorId: quien, accion: "tenant.config",
    entidad: "Tenant", entidadId: tenantId,
  });
  refrescar("/ceo/agent/settings");
}

export async function accionHorarios(fd: FormData) {
  await exigirCeo();
  const tenantId = texto(fd.get("tenantId"), 40);
  const dias = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
  const horarios: Record<string, [string, string][]> = {};
  for (const d of dias) {
    if (fd.get(`${d}_activo`) !== "on") continue;
    const desde = texto(fd.get(`${d}_desde`), 5);
    const hasta = texto(fd.get(`${d}_hasta`), 5);
    if (/^\d{2}:\d{2}$/.test(desde) && /^\d{2}:\d{2}$/.test(hasta) && desde < hasta) {
      horarios[d] = [[desde, hasta]];
    }
  }
  await prisma.tenant.update({ where: { id: tenantId }, data: { horarios } });
  refrescar("/ceo/agent/settings");
}

// ---------------------------------------------------------------------------
//  Equipo
// ---------------------------------------------------------------------------

export async function accionGuardarMiembro(fd: FormData) {
  await exigirCeo();
  const tenantId = texto(fd.get("tenantId"), 40);
  const email = normalizarEmail(texto(fd.get("email"), 254));
  const nombre = texto(fd.get("nombre"), 120);
  if (!tenantId || !email) return;
  await prisma.tenantMember.upsert({
    where: { tenantId_email: { tenantId, email } },
    create: {
      tenantId, email, nombre: nombre || email.split("@")[0],
      rol: texto(fd.get("rol"), 20) || "owner",
      recibeAvisos: fd.get("recibeAvisos") !== "no",
    },
    update: {
      nombre: nombre || undefined,
      rol: texto(fd.get("rol"), 20) || "owner",
      recibeAvisos: fd.get("recibeAvisos") !== "no",
    },
  });
  refrescar("/ceo/agent/settings");
}

export async function accionBorrarMiembro(fd: FormData) {
  await exigirCeo();
  const tenantId = texto(fd.get("tenantId"), 40);
  await prisma.tenantMember.deleteMany({
    where: paraTenant(tenantId, { id: texto(fd.get("miembroId"), 40) }),
  });
  refrescar("/ceo/agent/settings");
}

// ---------------------------------------------------------------------------
//  Integraciones
// ---------------------------------------------------------------------------

export async function accionGuardarIntegracion(fd: FormData) {
  const quien = await exigirCeo();
  const tenantId = texto(fd.get("tenantId"), 40);
  const tipo = texto(fd.get("tipo"), 40);
  const secreto = texto(fd.get("secreto"), 2000);
  const url = texto(fd.get("url"), 500);
  if (!tenantId || !tipo) return;

  if (secreto && !hayClaveMaestra()) {
    throw new Error("Falta APP_ENCRYPTION_KEY: no se pueden guardar credenciales cifradas");
  }

  const config: Record<string, string> = {};
  if (url) config.url = url;

  await prisma.tenantIntegration.upsert({
    where: { tenantId_tipo: { tenantId, tipo } },
    create: {
      tenantId, tipo, config,
      cifrado: secreto ? cifrar(secreto) : null,
      estado: secreto || url ? "activo" : "sin_configurar",
      verificadaEn: new Date(),
    },
    update: {
      config,
      // Si el campo viene vacío, se conserva la credencial anterior: el panel
      // nunca muestra el secreto, así que "vacío" significa "no lo toqué".
      ...(secreto ? { cifrado: cifrar(secreto) } : {}),
      estado: "activo",
      ultimoError: null,
      verificadaEn: new Date(),
    },
  });

  await ev.auditar({
    tenantId, actorTipo: "humano", actorId: quien, accion: "integracion.guardada",
    entidad: "TenantIntegration", entidadId: tipo,
  });
  refrescar("/ceo/agent/settings");
}

export async function accionBorrarIntegracion(fd: FormData) {
  await exigirCeo();
  const tenantId = texto(fd.get("tenantId"), 40);
  const tipo = texto(fd.get("tipo"), 40);
  await prisma.tenantIntegration.deleteMany({ where: paraTenant(tenantId, { tipo }) });
  refrescar("/ceo/agent/settings");
}

export async function accionRotarClaves(fd: FormData) {
  const quien = await exigirCeo();
  const tenantId = texto(fd.get("tenantId"), 40);
  if (!tenantId) return;
  await prisma.tenant.update({
    where: { id: tenantId },
    data: { clavePublica: tokenNuevo("pk"), secretoWebhook: tokenNuevo("whs") },
  });
  await ev.auditar({
    tenantId, actorTipo: "humano", actorId: quien, accion: "tenant.claves_rotadas",
    entidad: "Tenant", entidadId: tenantId,
  });
  refrescar("/ceo/agent/settings");
}

// ---------------------------------------------------------------------------
//  Negocios
// ---------------------------------------------------------------------------

export async function accionCrearNegocio(fd: FormData) {
  await exigirCeo();
  const nombre = texto(fd.get("nombreNegocio"), 200);
  if (!nombre) throw new Error("Falta el nombre del negocio");

  await crearTenant({
    nombreNegocio: nombre,
    descripcion: texto(fd.get("descripcion"), 2000),
    sitioWeb: texto(fd.get("sitioWeb"), 300),
    zonaHoraria: texto(fd.get("zonaHoraria"), 60) || "Pacific/Honolulu",
    idioma: texto(fd.get("idioma"), 5) || "en",
    nombreAgente: texto(fd.get("nombreAgente"), 60),
    tono: texto(fd.get("tono"), 20),
    servicios: texto(fd.get("servicios"), 8000),
    areaServicio: texto(fd.get("areaServicio"), 500),
    reglasPrecio: texto(fd.get("reglasPrecio"), 8000),
    politicas: texto(fd.get("politicas"), 8000),
    faq: texto(fd.get("faq"), 20_000),
    equipo: texto(fd.get("equipo"), 1000),
  });
  refrescar("/ceo/agent/businesses");
}

export async function accionActivarNegocio(fd: FormData): Promise<void> {
  await exigirCeo();
  await activar(texto(fd.get("tenantId"), 40));
  refrescar("/ceo/agent/businesses", "/ceo/agent/settings");
}

export async function accionPausarNegocio(fd: FormData) {
  await exigirCeo();
  const tenantId = texto(fd.get("tenantId"), 40);
  await prisma.tenant.update({ where: { id: tenantId }, data: { estado: "pausado" } });
  refrescar("/ceo/agent/businesses", "/ceo/agent/settings");
}

// ---------------------------------------------------------------------------
//  Operación
// ---------------------------------------------------------------------------

export async function accionDespachar(fd: FormData): Promise<void> {
  await exigirCeo();
  await despachar(texto(fd.get("tenantId"), 40), 50);
  refrescar("/ceo/agent/health");
}

export async function accionRecuperar(fd: FormData): Promise<void> {
  await exigirCeo();
  await recuperar(texto(fd.get("tenantId"), 40));
  refrescar("/ceo/agent/health", "/ceo/agent/inbox");
}

export async function accionSuprimir(fd: FormData) {
  await exigirCeo();
  const tenantId = texto(fd.get("tenantId"), 40);
  const email = texto(fd.get("email"), 254);
  if (!tenantId || !email) return;
  await suprimir(tenantId, email, "manual", "Agregado a mano desde el panel");
  refrescar("/ceo/agent/health");
}
