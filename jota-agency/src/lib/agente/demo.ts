import { prisma } from "@/lib/prisma";
import { crearTenant } from "./onboarding";
import { calcularPuntaje, estadoDeBanda } from "./puntaje";
import { armar } from "./plantillas";
import { nuevoMessageId } from "./email";
import { DATOS_LEAD_VACIO } from "./tipos";

/**
 * Modo demo.
 *
 * Un negocio ficticio de Maui, del tipo que compra este servicio: oficio a
 * domicilio, urgencias fuera de horario, dueño que no puede atender el
 * teléfono a las 3am. Todo lo que se ve acá es inventado a propósito: no hay
 * un solo dato de una persona real.
 *
 * La demo cuenta la historia completa que se vende:
 *   consulta a las 3:14am → respuesta en 40 segundos → calificación →
 *   captura de contacto → reunión agendada → email al cliente →
 *   email interno al dueño → lead en el panel → y un caso de handoff.
 */

export const SLUG_DEMO = "valley-isle-plumbing";

const SERVICIOS = `Emergency plumbing repair (24/7 dispatch)
Water heater repair and replacement
Drain cleaning and hydro-jetting
Leak detection and slab leaks
Repiping (copper and PEX)
Fixture installation (sinks, toilets, showers)
Annual plumbing inspections`;

const PRECIOS = `Standard service call fee: $89, waived if the repair is done the same visit.
After-hours emergency call fee (before 7am, after 6pm, weekends): $149.
Drain cleaning starts at $185 for a single accessible drain.
Water heater replacement ranges from $1,600 to $3,400 depending on tank size, location and permits.
Any quote beyond these ranges must be given by a technician after seeing the job. Never quote a total price for a job that has not been inspected.`;

const POLITICAS = `All work is guaranteed for 1 year on labor and follows manufacturer warranty on parts.
We are licensed and insured in the State of Hawaii (C-37 Plumbing).
We do not work on commercial kitchens or hotel properties.
Payment is due on completion. We accept card, check and bank transfer.
Cancellations are free with 4 hours notice.
We do not offer discounts over chat. Any discount must be approved by the owner.`;

const FAQ = `Q: Do you serve my area?
A: We serve all of Maui: Kahului, Wailuku, Kihei, Lahaina, Paia, Makawao, Haiku and Hana (Hana has a $95 travel surcharge).

Q: How fast can someone come out?
A: For emergencies we dispatch 24/7, usually within 2 hours in Central and South Maui. Standard appointments are typically within 2 business days.

Q: Do you charge just to come out?
A: Yes, there's an $89 service call fee ($149 after hours), and we waive it if we complete the repair on that same visit.

Q: Are you licensed?
A: Yes, C-37 Plumbing license, and we're fully insured.

Q: Do you work on new construction?
A: We do repipes and remodels, but we don't take on full new-construction builds.

Q: What if my water heater is leaking right now?
A: Shut off the water supply valve on top of the heater and the gas or breaker, then call us — that's an emergency dispatch.`;

const DESCRIPCION = `Valley Isle Plumbing & Air is a family-run plumbing and HVAC company based in Kahului, serving all of Maui since 2009. Two-truck operation, owner-operated, known for actually answering the phone on weekends.`;

const HORARIOS = {
  mon: [["07:00", "17:00"]],
  tue: [["07:00", "17:00"]],
  wed: [["07:00", "17:00"]],
  thu: [["07:00", "17:00"]],
  fri: [["07:00", "17:00"]],
  sat: [["08:00", "12:00"]],
} as Record<string, [string, string][]>;

// ---------------------------------------------------------------------------

/** Borra TODO lo del tenant demo. Los datos reales no se tocan. */
export async function borrarDemo(): Promise<number> {
  const demos = await prisma.tenant.findMany({ where: { esDemo: true }, select: { id: true } });
  if (demos.length === 0) return 0;
  // Todas las tablas cuelgan de Tenant con onDelete: Cascade.
  const r = await prisma.tenant.deleteMany({ where: { esDemo: true } });
  await prisma.notificacion.deleteMany({ where: { esDemo: true, tipo: { startsWith: "agente_" } } });
  return r.count;
}

export type ResultadoDemo = { tenantId: string; slug: string; clavePublica: string; conversaciones: number };

export async function cargarDemo(): Promise<ResultadoDemo> {
  await borrarDemo();

  const { tenant } = await crearTenant({
    nombreNegocio: "Valley Isle Plumbing & Air",
    slug: SLUG_DEMO,
    descripcion: DESCRIPCION,
    sitioWeb: "https://valleyisleplumbing.example",
    zonaHoraria: "Pacific/Honolulu",
    idioma: "en",
    nombreAgente: "Kai",
    tono: "cercano",
    servicios: SERVICIOS,
    areaServicio: "Maui: Kahului, Wailuku, Kihei, Lahaina, Paia, Makawao, Haiku, Hana",
    reglasPrecio: PRECIOS,
    politicas: POLITICAS,
    faq: FAQ,
    horarios: HORARIOS,
    equipo: "owner@valleyisleplumbing.example,dispatch@valleyisleplumbing.example",
    esDemo: true,
    ajustes: { emailRemitente: "Kai <kai@valleyisleplumbing.example>" },
  });

  await prisma.tenant.update({
    where: { id: tenant.id },
    data: {
      estado: "activo",
      modo: "autonomo",
      modoPorCanal: { email: "supervisado" },
      presentacion: "Hi, I'm Kai from Valley Isle Plumbing — I can help right now, even at 3am.",
      firmaEmail: "Kai\nValley Isle Plumbing & Air\n(808) 555-0142",
    },
  });
  const t = (await prisma.tenant.findUnique({ where: { id: tenant.id } }))!;

  const ahora = Date.now();
  const hace = (h: number) => new Date(ahora - h * 3600_000);

  // =========================================================================
  //  1. La historia principal: emergencia a las 3:14am
  // =========================================================================
  const madrugada = madrugadaDe(ahora, t.zonaHoraria);

  const dana = await prisma.contact.create({
    data: {
      tenantId: t.id, nombre: "Dana", apellido: "Kealoha",
      email: "dana.kealoha@example.com", telefono: "+18085550188",
      ubicacion: "Kihei", idioma: "en", consentimiento: "otorgado",
    },
  });

  const convDana = await prisma.conversation.create({
    data: {
      tenantId: t.id, contactId: dana.id, canal: "website_chat",
      hiloExterno: "demo-chat-dana", estado: "abierta", iaActiva: true,
      intencion: "urgent_request", intenciones: ["service_inquiry", "appointment_request"],
      sentimiento: "negativo", urgencia: "alta",
      resumen: "Water heater leaking at 3am in Kihei. Booked for the same morning.",
      ultimoMensajeAt: new Date(madrugada.getTime() + 6 * 60_000),
    },
  });

  const guion: [string, "contacto" | "agente", number, number?][] = [
    ["My water heater is leaking all over the garage floor. It's 3am. Is anyone there??", "contacto", 0],
    ["I'm here — that counts as an emergency, so let's stop the damage first. Turn off the cold water valve on top of the heater, and shut the gas (or the breaker if it's electric). Are you able to reach those?", "agente", 0.7],
    ["ok done. water stopped. what now", "contacto", 1.5],
    ["Good — that's the hard part handled. We dispatch 24/7 and we're usually in Kihei within about two hours. Are you looking to get someone out tonight, or first thing this morning?", "agente", 2.2],
    ["first thing in the morning is fine, i dont want to pay night rates", "contacto", 3.4],
    ["Makes sense — the after-hours fee is $149 versus $89 during regular hours, and it's waived if we finish the repair on that visit. I've got Tuesday 8:00 AM or Tuesday 10:30 AM open. Which works?", "agente", 4.1],
    ["8am works. Dana Kealoha, dana.kealoha@example.com", "contacto", 5.0],
    ["Booked — Tuesday 8:00 AM HST, and I've emailed you the confirmation. One last thing so the tech comes prepared: do you know roughly how old the heater is?", "agente", 5.6],
    ["about 12 years, its the original one from when we bought the house", "contacto", 6.0],
  ];

  let conversaciones = 0;
  for (const [texto, quien, offset, conf] of guion) {
    await prisma.message.create({
      data: {
        tenantId: t.id, conversationId: convDana.id,
        direccion: quien === "contacto" ? "entrante" : "saliente",
        remitente: quien,
        contenido: texto,
        claveIdempotencia: quien === "contacto" ? `demo-dana-${offset}` : null,
        generadoPorIa: quien === "agente",
        confianza: quien === "agente" ? (conf ?? 0.9) : null,
        tokensEntrada: quien === "agente" ? 2400 : 0,
        tokensSalida: quien === "agente" ? 180 : 0,
        estadoFinal: quien === "contacto" ? (offset >= 5 ? "agendada" : "respondida") : null,
        createdAt: new Date(madrugada.getTime() + offset * 60_000),
      },
    });
  }
  conversaciones++;

  const puntajeDana = calcularPuntaje({
    t,
    datos: {
      ...DATOS_LEAD_VACIO,
      nombre: "Dana", apellido: "Kealoha", email: "dana.kealoha@example.com",
      telefono: "+18085550188", ubicacion: "Kihei",
      servicio: "Water heater repair", problema: "Water heater leaking, 12 years old",
      plazo: "today", autoridad: "homeowner",
    },
    intencion: "urgent_request",
    urgencia: "alta",
    mensajesDelContacto: 5,
  });

  const leadDana = await prisma.lead.create({
    data: {
      tenantId: t.id, contactId: dana.id, conversationId: convDana.id,
      servicio: "Water heater repair / replacement",
      problema: "Leaking water heater, 12 years old, garage flooding",
      plazo: "today", ubicacion: "Kihei",
      score: puntajeDana.score, confianza: puntajeDana.confianza,
      scoreDetalle: {
        positivos: puntajeDana.positivos, negativos: puntajeDana.negativos,
        faltantes: puntajeDana.faltantes, factores: puntajeDana.factores,
      },
      estado: estadoDeBanda(puntajeDana.banda),
      proximaAccion: "reunión agendada",
      createdAt: madrugada,
    },
  });

  const inicioCita = proximaManiana(ahora, t.zonaHoraria, 8);
  await prisma.appointment.create({
    data: {
      tenantId: t.id, contactId: dana.id, leadId: leadDana.id, conversationId: convDana.id,
      titulo: "Valley Isle Plumbing — water heater service",
      motivo: "Leaking water heater, 12 years old",
      inicio: inicioCita, fin: new Date(inicioCita.getTime() + 60 * 60_000),
      zonaHoraria: t.zonaHoraria, estado: "agendada", createdAt: madrugada,
    },
  });

  // Los dos emails que hacen la demo: al cliente y al dueño.
  await outbox(t.id, "cita_confirmada", "dana.kealoha@example.com", armarDemo(t, "cita_confirmada", {
    nombre: "Dana",
    cuando: new Intl.DateTimeFormat("en-US", {
      timeZone: t.zonaHoraria, weekday: "long", month: "long", day: "numeric",
      hour: "numeric", minute: "2-digit", timeZoneName: "short",
    }).format(inicioCita),
    zona: t.zonaHoraria,
    motivo: "Water heater service",
  }), madrugada);

  await outbox(t.id, "resumen_interno", "owner@valleyisleplumbing.example", armarDemo(t, "resumen_interno", {
    nombre: "Dana Kealoha", empresa: "", email: "dana.kealoha@example.com",
    telefono: "+1 808 555 0188", canal: "website_chat",
    servicio: "Water heater repair / replacement",
    problema: "Leaking water heater, 12 years old, garage flooding",
    presupuesto: "not stated", plazo: "today", urgencia: "alta",
    score: String(puntajeDana.score), banda: puntajeDana.etiqueta, confianza: puntajeDana.confianza,
    proximaAccion: "Tech dispatch 8:00 AM",
    positivos: puntajeDana.positivos.join("|"),
    negativos: puntajeDana.negativos.join("|"),
    faltantes: puntajeDana.faltantes.join("|"),
    resumen: "Emergency at 3:14am. Agent walked her through shutting off the supply, then booked an 8am visit. Heater is 12 years old — likely a replacement, not a repair.",
    cita: inicioCita.toISOString(),
  }), madrugada);

  await prisma.notificacion.create({
    data: {
      tipo: "agente_hot_lead", esDemo: true,
      titulo: "Valley Isle Plumbing & Air: Hot Lead — Dana Kealoha",
      detalle: `urgent_request · score ${puntajeDana.score} · reunión agendada 8:00 AM`,
      url: `/ceo/agent/inbox/${convDana.id}`,
      createdAt: madrugada,
    },
  });

  // =========================================================================
  //  2. Handoff: pide un descuento que la IA no puede autorizar
  // =========================================================================
  const marcus = await prisma.contact.create({
    data: {
      tenantId: t.id, nombre: "Marcus", apellido: "Reyes",
      email: "marcus.reyes@example.com", ubicacion: "Wailuku", idioma: "en",
    },
  });
  const convMarcus = await prisma.conversation.create({
    data: {
      tenantId: t.id, contactId: marcus.id, canal: "website_chat",
      hiloExterno: "demo-chat-marcus", estado: "esperando_humano", iaActiva: false,
      intencion: "pricing_question", sentimiento: "neutral", urgencia: "media",
      resumen: "Repipe quote. Asked for a 20% discount — handed off to the owner.",
      ultimoMensajeAt: hace(20),
    },
  });
  for (const [texto, quien, min] of [
    ["What would a full repipe run for a 3 bedroom in Wailuku?", "contacto", 0],
    ["A repipe depends a lot on the layout, whether it's slab or crawlspace, and the permit side — so I don't want to throw out a number that turns out to be wrong. A tech can look and give you a firm quote. Is the house on a slab?", "agente", 0.6],
    ["slab. and honestly if you can do 20% off i'll book today", "contacto", 2],
    ["That's a call for the owner, not me — I've passed it over with your details so he can get back to you directly.", "agente", 2.4],
  ] as [string, "contacto" | "agente", number][]) {
    await prisma.message.create({
      data: {
        tenantId: t.id, conversationId: convMarcus.id,
        direccion: quien === "contacto" ? "entrante" : "saliente",
        remitente: quien, contenido: texto,
        claveIdempotencia: quien === "contacto" ? `demo-marcus-${min}` : null,
        generadoPorIa: quien === "agente",
        confianza: quien === "agente" ? 0.82 : null,
        tokensEntrada: quien === "agente" ? 2300 : 0,
        tokensSalida: quien === "agente" ? 120 : 0,
        estadoFinal: quien === "contacto" ? (min >= 2 ? "handoff" : "respondida") : null,
        createdAt: new Date(hace(20).getTime() + min * 60_000),
      },
    });
  }
  conversaciones++;

  const puntajeMarcus = calcularPuntaje({
    t,
    datos: { ...DATOS_LEAD_VACIO, nombre: "Marcus", email: "marcus.reyes@example.com", ubicacion: "Wailuku", servicio: "Repiping" },
    intencion: "pricing_question", urgencia: "media", mensajesDelContacto: 2,
  });
  await prisma.lead.create({
    data: {
      tenantId: t.id, contactId: marcus.id, conversationId: convMarcus.id,
      servicio: "Repiping", problema: "3-bedroom slab home in Wailuku", ubicacion: "Wailuku",
      score: puntajeMarcus.score, confianza: puntajeMarcus.confianza,
      scoreDetalle: {
        positivos: puntajeMarcus.positivos, negativos: puntajeMarcus.negativos,
        faltantes: puntajeMarcus.faltantes, factores: puntajeMarcus.factores,
      },
      estado: estadoDeBanda(puntajeMarcus.banda),
      proximaAccion: "el dueño responde por el descuento",
      createdAt: hace(20),
    },
  });

  await prisma.approvalRequest.create({
    data: {
      tenantId: t.id, conversationId: convMarcus.id,
      accion: "ofrecer_descuento",
      propuesta: "Hi Marcus — we can do 20% off the repipe if you book this week.",
      motivo: "El contacto pidió un 20% de descuento. Las políticas dicen que cualquier descuento lo aprueba el dueño.",
      confianza: 0.41,
      riesgos: ["Descuento no autorizado", "Compromete un precio sin inspección"],
      datos: { servicio: "Repiping", ubicacion: "Wailuku" },
      createdAt: hace(20),
    },
  });

  await prisma.notificacion.create({
    data: {
      tipo: "agente_handoff", esDemo: true,
      titulo: "Valley Isle Plumbing & Air: Handoff — pidió un descuento",
      detalle: "Marcus Reyes · repipe en Wailuku · espera respuesta del dueño",
      url: `/ceo/agent/inbox/${convMarcus.id}`,
      createdAt: hace(20),
    },
  });

  // =========================================================================
  //  3. Email entrante con hilo + seguimiento programado
  // =========================================================================
  const lena = await prisma.contact.create({
    data: { tenantId: t.id, nombre: "Lena", apellido: "Fischer", email: "lena.fischer@example.com", ubicacion: "Paia" },
  });
  const raiz = nuevoMessageId();
  const convLena = await prisma.conversation.create({
    data: {
      tenantId: t.id, contactId: lena.id, canal: "email", hiloExterno: raiz,
      estado: "abierta", iaActiva: true, intencion: "estimate_request",
      sentimiento: "neutral", urgencia: "baja",
      resumen: "Asked for an estimate on a bathroom remodel. Waiting on her reply.",
      ultimoMensajeAt: hace(50),
    },
  });
  await prisma.message.createMany({
    data: [
      {
        tenantId: t.id, conversationId: convLena.id, direccion: "entrante", remitente: "contacto",
        contenido: "Subject: Bathroom remodel estimate\n\nHi — we're redoing the guest bathroom in Paia next month and need a plumber for the rough-in. Can you give me an estimate?",
        idExterno: raiz, claveIdempotencia: "demo-lena-1", estadoFinal: "seguimiento", createdAt: hace(50),
      },
      {
        tenantId: t.id, conversationId: convLena.id, direccion: "saliente", remitente: "agente",
        contenido: "Hi Lena — happy to help with the rough-in. Estimates for remodels come from a tech after seeing the space, since it depends on what's behind the wall. Would a walkthrough next week work? I have Thursday morning or Friday afternoon.",
        generadoPorIa: true, confianza: 0.88, tokensEntrada: 2500, tokensSalida: 140, createdAt: hace(49.9),
      },
    ],
  });
  conversaciones++;

  const puntajeLena = calcularPuntaje({
    t,
    datos: { ...DATOS_LEAD_VACIO, nombre: "Lena", email: "lena.fischer@example.com", ubicacion: "Paia", servicio: "Fixture installation", plazo: "next month" },
    intencion: "estimate_request", urgencia: "baja", mensajesDelContacto: 1,
  });
  const leadLena = await prisma.lead.create({
    data: {
      tenantId: t.id, contactId: lena.id, conversationId: convLena.id,
      servicio: "Bathroom remodel rough-in", problema: "Guest bathroom remodel in Paia",
      plazo: "next month", ubicacion: "Paia",
      score: puntajeLena.score, confianza: puntajeLena.confianza,
      scoreDetalle: {
        positivos: puntajeLena.positivos, negativos: puntajeLena.negativos,
        faltantes: puntajeLena.faltantes, factores: puntajeLena.factores,
      },
      estado: estadoDeBanda(puntajeLena.banda),
      proximaAccion: "ofrecer horarios de visita",
      createdAt: hace(50),
    },
  });
  await prisma.followUp.createMany({
    data: [
      { tenantId: t.id, leadId: leadLena.id, paso: 1, programadoEn: hace(-2), estado: "pendiente" },
      { tenantId: t.id, leadId: leadLena.id, paso: 2, programadoEn: hace(-50), estado: "pendiente" },
      { tenantId: t.id, leadId: leadLena.id, paso: 3, programadoEn: hace(-146), estado: "pendiente" },
    ],
  });

  // =========================================================================
  //  4. Spam, para que el panel muestre que también se filtra
  // =========================================================================
  const spam = await prisma.contact.create({
    data: { tenantId: t.id, nombre: "Growth Partners", email: "outreach@seo-growth.example" },
  });
  const convSpam = await prisma.conversation.create({
    data: {
      tenantId: t.id, contactId: spam.id, canal: "web_form", hiloExterno: "demo-spam",
      estado: "descartada", iaActiva: true, intencion: "spam", ultimoMensajeAt: hace(8),
    },
  });
  await prisma.message.create({
    data: {
      tenantId: t.id, conversationId: convSpam.id, direccion: "entrante", remitente: "contacto",
      contenido: "We offer SEO services and can increase your traffic by 300%. https://a.example https://b.example https://c.example",
      claveIdempotencia: "demo-spam-1", estadoFinal: "descartada", createdAt: hace(8),
    },
  });
  conversaciones++;

  // Un lead que se dio de baja: prueba que las supresiones se respetan.
  await prisma.suppression.create({
    data: { tenantId: t.id, email: "old.prospect@example.com", motivo: "baja", detalle: 'Respondió "stop"' },
  });

  await prisma.tenant.update({ where: { id: t.id }, data: { estado: "activo" } });

  return { tenantId: t.id, slug: t.slug, clavePublica: t.clavePublica, conversaciones };
}

// ---------------------------------------------------------------------------

function armarDemo(t: Parameters<typeof armar>[1], p: Parameters<typeof armar>[0], d: Record<string, string>) {
  return armar(p, t, d);
}

async function outbox(
  tenantId: string,
  plantilla: string,
  para: string,
  armado: { asunto: string; html: string; texto: string },
  cuando: Date,
): Promise<void> {
  await prisma.emailOutbox.create({
    data: {
      tenantId, para, asunto: armado.asunto, html: armado.html, texto: armado.texto,
      messageId: nuevoMessageId(), plantilla, clase: "transaccional",
      // En la demo los emails se muestran como simulados: nunca se le manda
      // un correo de verdad a una dirección inventada.
      estado: "simulado", ultimoError: "Demo: no se envía nada real",
      createdAt: cuando,
    },
  });
}

/** Las 3:14am de hoy (o de ayer si todavía no pasó), en la zona del negocio. */
function madrugadaDe(ahora: number, zona: string): Date {
  const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: zona }).format(new Date(ahora));
  const d = fechaEnZonaUtc(hoy, "03:14", zona);
  return d.getTime() > ahora ? new Date(d.getTime() - 86_400_000) : d;
}

/** Las HH:00 de la próxima mañana hábil, en la zona del negocio. */
function proximaManiana(ahora: number, zona: string, hora: number): Date {
  for (let i = 1; i <= 7; i++) {
    const fecha = new Intl.DateTimeFormat("en-CA", { timeZone: zona }).format(new Date(ahora + i * 86_400_000));
    const [a, m, dd] = fecha.split("-").map(Number);
    const dow = new Date(Date.UTC(a, m - 1, dd)).getUTCDay();
    if (dow >= 1 && dow <= 5) return fechaEnZonaUtc(fecha, `${String(hora).padStart(2, "0")}:00`, zona);
  }
  return new Date(ahora + 86_400_000);
}

function fechaEnZonaUtc(fechaISO: string, hhmm: string, zona: string): Date {
  let d = new Date(`${fechaISO}T${hhmm}:00Z`);
  for (let i = 0; i < 2; i++) {
    const partes = new Intl.DateTimeFormat("en-US", {
      timeZone: zona, hour12: false,
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    }).formatToParts(d);
    const n = (x: string) => Number(partes.find((p) => p.type === x)?.value ?? 0);
    const off = Date.UTC(n("year"), n("month") - 1, n("day"), n("hour") % 24, n("minute"), n("second")) - d.getTime();
    d = new Date(new Date(`${fechaISO}T${hhmm}:00Z`).getTime() - off);
  }
  return d;
}
