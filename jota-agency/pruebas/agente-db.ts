/**
 * Pruebas del 24/7 AI Agent contra una base Postgres REAL.
 *
 * Acá se prueba lo que no se puede probar con objetos falsos: que dos negocios
 * no se vean los datos, que una consulta duplicada no se procese dos veces,
 * que el mensaje quede guardado aunque después falle todo, y que los
 * seguimientos se frenen cuando tienen que frenarse.
 *
 * Correr con:  DATABASE_URL=... npm run test:agente-db
 *
 * La prueba TRUNCA las tablas del agente antes de empezar: una prueba que solo
 * pasa con la base recién creada no sirve como red.
 */

import { PrismaClient } from "@prisma/client";
import { recibir, marcarEstadoFinal, guardarRespuesta } from "@/lib/agente/intake";
import { crearTenant, pendientesParaActivar, activar } from "@/lib/agente/onboarding";
import { buscarConocimiento, sincronizarFuente } from "@/lib/agente/conocimiento";
import { huecosDisponibles, crearCita, reprogramar, cancelar, aUtc } from "@/lib/agente/agenda";
import { programar, cortar, ejecutarPendientes } from "@/lib/agente/seguimientos";
import { encolar, despachar, suprimir, estaSuprimido } from "@/lib/agente/email";
import { derivar, devolverALaIa } from "@/lib/agente/handoff";
import { ejecutar } from "@/lib/agente/herramientas";
import { recuperar } from "@/lib/agente/recuperacion";
import { revisar } from "@/lib/agente/salud";
import { ultimosDias } from "@/lib/agente/metricas";
import { cargarDemo, borrarDemo } from "@/lib/agente/demo";
import { paraTenant } from "@/lib/agente/tenant";
import type { ConsultaEntrante } from "@/lib/agente/tipos";

const prisma = new PrismaClient();
let fallos = 0;
let total = 0;
const ok = (c: boolean, m: string) => {
  total++;
  console.log(c ? `  ✅ ${m}` : `  ❌ ${m}`);
  if (!c) fallos++;
};
const grupo = (t: string) => console.log(`\n${t}`);

process.env.APP_ENCRYPTION_KEY ??= "clave-maestra-de-prueba-suficientemente-larga-ok";

async function limpiar() {
  // Tenant borra en cascada todo lo del agente. Las tablas del CEO no se tocan.
  await prisma.tenant.deleteMany({});
  await prisma.notificacion.deleteMany({ where: { tipo: { startsWith: "agente_" } } });
  await prisma.workflowEvent.deleteMany({});
  await prisma.auditLog.deleteMany({});
}

function consulta(tenantId: string, c: Partial<ConsultaEntrante> = {}): ConsultaEntrante {
  return {
    tenantId, canal: "website_chat", hiloExterno: "hilo-1",
    mensaje: "My water heater is leaking", recibidoEn: new Date("2026-08-04T13:00:00Z"),
    ...c,
  };
}

async function main() {
  await limpiar();

  // =========================================================================
  grupo("Onboarding — dar de alta un negocio");

  const { tenant: a, fragmentos } = await crearTenant({
    nombreNegocio: "Alpha Plumbing",
    servicios: "Water heater repair\nDrain cleaning",
    areaServicio: "Maui",
    reglasPrecio: "Service call: $89.",
    faq: "Q: Do you serve Kihei?\nA: Yes, all of Maui.\n\nQ: Are you licensed?\nA: Yes, C-37.",
    equipo: "owner@alpha.example",
    zonaHoraria: "Pacific/Honolulu",
  });
  ok(a.estado === "onboarding", "un negocio nuevo NO arranca activo");
  ok(a.modo === "supervisado", "y arranca en modo supervisado");
  ok(a.clavePublica.startsWith("pk_") && a.secretoWebhook.startsWith("whs_"), "se generan clave pública y secreto");
  ok(fragmentos > 0, "el conocimiento del formulario queda indexado");
  ok((await pendientesParaActivar(a.id)).length === 0, "con servicios, conocimiento y equipo, se puede activar");

  const sinNada = await crearTenant({ nombreNegocio: "Vacío SA" });
  const faltan = await pendientesParaActivar(sinNada.tenant.id);
  ok(faltan.length >= 3, "un negocio vacío enumera qué le falta");
  ok(!(await activar(sinNada.tenant.id)).ok, "y NO se deja activar");
  await prisma.tenant.delete({ where: { id: sinNada.tenant.id } });

  await activar(a.id);
  const alpha = (await prisma.tenant.findUnique({ where: { id: a.id } }))!;
  ok(alpha.estado === "activo", "activar funciona cuando no falta nada");

  const { tenant: b } = await crearTenant({
    nombreNegocio: "Beta Roofing",
    servicios: "Roof repair",
    faq: "Q: Do you serve Kihei?\nA: We only work in Lahaina.",
    equipo: "owner@beta.example",
  });
  await activar(b.id);
  const beta = (await prisma.tenant.findUnique({ where: { id: b.id } }))!;

  // =========================================================================
  grupo("Aislamiento entre negocios");

  const kbAlpha = await buscarConocimiento(alpha.id, "do you serve kihei");
  const kbBeta = await buscarConocimiento(beta.id, "do you serve kihei");
  ok(kbAlpha.length > 0 && kbBeta.length > 0, "los dos negocios encuentran su propia respuesta");
  ok(kbAlpha.some((f) => f.texto.includes("all of Maui")), "Alpha ve su FAQ");
  ok(!kbAlpha.some((f) => f.texto.includes("only work in Lahaina")), "Alpha NO ve la FAQ de Beta");
  ok(kbBeta.some((f) => f.texto.includes("only work in Lahaina")), "Beta ve su FAQ");
  ok(!kbBeta.some((f) => f.texto.includes("all of Maui")), "Beta NO ve la FAQ de Alpha");

  const rA = await recibir(alpha, consulta(alpha.id, { email: "cliente@example.com" }));
  const rB = await recibir(beta, consulta(beta.id, { email: "cliente@example.com", hiloExterno: "hilo-beta" }));
  ok(rA.contactId !== rB.contactId, "el mismo email en dos negocios son dos contactos distintos");
  ok(
    (await prisma.contact.count({ where: paraTenant(alpha.id) })) === 1,
    "cada negocio ve solo su contacto",
  );

  // Intentar leer la conversación de Beta con el tenant de Alpha.
  const fuga = await prisma.conversation.findFirst({
    where: paraTenant(alpha.id, { id: rB.conversationId }),
  });
  ok(fuga === null, "pedir la conversación de otro negocio devuelve null, no los datos");

  // Y lo mismo desde una herramienta del agente, que es la vía del modelo.
  const salidaFuga = await ejecutar(
    { t: alpha, conversationId: rB.conversationId, contactId: rB.contactId },
    "GetConversationHistory",
    {},
  );
  ok(
    salidaFuga.ok && (salidaFuga.datos.mensajes as unknown[]).length === 0,
    "una herramienta con el id de otro negocio no devuelve mensajes",
  );

  // =========================================================================
  grupo("Intake — guardar antes de procesar, y no procesar dos veces");

  const msgAlpha = await prisma.message.findUnique({ where: { id: rA.mensaje.id } });
  ok(msgAlpha !== null, "el mensaje entrante queda guardado apenas llega");
  ok(msgAlpha?.estadoFinal === null, "y sin estado final: es lo que hace que recuperación lo encuentre");
  ok(msgAlpha?.claveIdempotencia !== null, "con su clave de deduplicación");

  const repetido = await recibir(alpha, consulta(alpha.id, { email: "cliente@example.com" }));
  ok(repetido.duplicado, "la misma consulta reenviada se detecta como duplicada");
  ok(repetido.mensaje.id === rA.mensaje.id, "y devuelve el mensaje original, no crea otro");
  ok(
    (await prisma.message.count({ where: paraTenant(alpha.id, { direccion: "entrante" }) })) === 1,
    "en la base sigue habiendo un solo mensaje",
  );

  const segundo = await recibir(alpha, consulta(alpha.id, {
    email: "cliente@example.com", mensaje: "Also, how much is a drain cleaning?",
    recibidoEn: new Date("2026-08-04T13:10:00Z"),
  }));
  ok(!segundo.duplicado, "un mensaje distinto SÍ entra");
  ok(segundo.conversationId === rA.conversationId, "y continúa la misma conversación");
  ok(segundo.mensajesDelContacto === 2, "cuenta bien los mensajes de la persona");
  ok(segundo.contactoPrevio, "reconoce que el contacto ya existía");

  const otroHilo = await recibir(alpha, consulta(alpha.id, {
    email: "otro@example.com", hiloExterno: "hilo-2", mensaje: "Different person",
  }));
  ok(otroHilo.conversationId !== rA.conversationId, "otra sesión abre otra conversación");

  // =========================================================================
  grupo("Base de conocimiento — sincronizar y reindexar");

  const fuente = await prisma.knowledgeSource.create({
    data: { tenantId: alpha.id, tipo: "manual", titulo: "Emergencias", contenido: "We dispatch 24/7 for emergencies." },
  });
  const s1 = await sincronizarFuente(alpha.id, fuente.id);
  ok(s1.fragmentos === 1, "una fuente corta produce un fragmento");
  ok((await buscarConocimiento(alpha.id, "emergencies")).length > 0, "y se encuentra al buscar");

  await prisma.knowledgeSource.update({
    where: { id: fuente.id },
    data: { contenido: "We dispatch 24/7.\n\nHana has a travel surcharge." },
  });
  const s2 = await sincronizarFuente(alpha.id, fuente.id);
  ok(
    (await prisma.knowledgeChunk.count({ where: paraTenant(alpha.id, { sourceId: fuente.id }) })) === s2.fragmentos,
    "al reindexar, en la base queda exactamente lo que devolvió la sincronización",
  );
  ok(
    !(await prisma.knowledgeChunk.findFirst({
      where: paraTenant(alpha.id, { sourceId: fuente.id, texto: { contains: "for emergencies" } }),
    })),
    "no queda ningún fragmento huérfano de la versión anterior",
  );
  const hana = await buscarConocimiento(alpha.id, "hana surcharge");
  ok(hana.length > 0 && hana[0].texto.includes("surcharge"), "el contenido nuevo se encuentra");
  ok((await buscarConocimiento(alpha.id, "xyzzy quux")).length === 0, "una consulta sin respuesta devuelve vacío, no un fragmento cualquiera");

  // =========================================================================
  grupo("Agenda — disponibilidad real, sin dobles reservas");

  await prisma.tenant.update({
    where: { id: alpha.id },
    data: { horarios: { mon: [["09:00", "17:00"]], tue: [["09:00", "17:00"]], wed: [["09:00", "17:00"]] } },
  });
  const alpha2 = (await prisma.tenant.findUnique({ where: { id: alpha.id } }))!;

  const huecos = await huecosDisponibles(alpha2, { cantidad: 3, duracionMin: 60 });
  ok(huecos.length >= 2, "ofrece al menos dos horarios");
  ok(huecos.length <= 4, "y nunca más de cuatro");
  ok(huecos.every((h) => h.inicio.getTime() > Date.now()), "todos los horarios son futuros");
  const dias = new Set(huecos.map((h) => h.inicio.toISOString().slice(0, 10)));
  ok(dias.size === huecos.length, "reparte los horarios en días distintos");
  ok(huecos[0].etiqueta.includes("HST") || huecos[0].etiqueta.includes("GMT"), "la etiqueta lleva la zona horaria");

  const elegido = huecos[0];
  const cita = await crearCita(alpha2, {
    tenantId: alpha2.id, contactId: rA.contactId, conversationId: rA.conversationId,
    inicio: elegido.inicio, duracionMin: 60, titulo: "Service call",
  });
  ok(cita.ok, "se puede reservar un hueco ofrecido");

  const choque = await crearCita(alpha2, {
    tenantId: alpha2.id, contactId: otroHilo.contactId,
    inicio: elegido.inicio, duracionMin: 60, titulo: "Otra",
  });
  ok(!choque.ok && choque.motivo === "ocupado", "otra persona NO puede reservar el mismo horario");

  const mismaPersona = await crearCita(alpha2, {
    tenantId: alpha2.id, contactId: rA.contactId,
    inicio: elegido.inicio, duracionMin: 60, titulo: "Doble clic",
  });
  ok(mismaPersona.ok && mismaPersona.duplicada, "el doble clic de la misma persona no crea dos reuniones");

  const nocturno = await crearCita(alpha2, {
    tenantId: alpha2.id, contactId: rA.contactId,
    inicio: aUtc(fechaFutura(alpha2.zonaHoraria), "23:00", alpha2.zonaHoraria),
    titulo: "Fuera de hora",
  });
  ok(!nocturno.ok && nocturno.motivo === "fuera_de_horario", "no se puede agendar fuera del horario del negocio");

  const pasado = await crearCita(alpha2, {
    tenantId: alpha2.id, contactId: rA.contactId,
    inicio: new Date(Date.now() - 3600_000), titulo: "Ayer",
  });
  ok(!pasado.ok && pasado.motivo === "pasado", "no se puede agendar en el pasado");

  const huecosDespues = await huecosDisponibles(alpha2, { cantidad: 4, duracionMin: 60 });
  ok(
    !huecosDespues.some((h) => h.inicio.getTime() === elegido.inicio.getTime()),
    "el horario reservado desaparece de la disponibilidad",
  );

  if (cita.ok) {
    const nuevo = huecosDespues[0];
    const re = await reprogramar(alpha2, cita.id, nuevo.inicio);
    ok(re.ok, "se puede reprogramar a un hueco libre");
    ok(await cancelar(alpha2, cita.id), "se puede cancelar");
    ok(!(await cancelar(alpha2, cita.id)), "cancelar dos veces no rompe: devuelve false");
  }

  // =========================================================================
  grupo("Email — cola, supresiones y no duplicar");

  const e1 = await encolar(alpha2, {
    tenantId: alpha2.id, para: "cliente@example.com", plantilla: "confirmacion",
    datos: { nombre: "Cliente" }, claveIdempotencia: "conf:1",
  });
  ok(e1.ok, "el email se encola");
  const e2 = await encolar(alpha2, {
    tenantId: alpha2.id, para: "cliente@example.com", plantilla: "confirmacion",
    datos: { nombre: "Cliente" }, claveIdempotencia: "conf:1",
  });
  ok(e2.ok && e2.duplicado, "la misma clave de idempotencia no encola un segundo email");
  ok(
    (await prisma.emailOutbox.count({ where: paraTenant(alpha2.id, { claveIdempotencia: "conf:1" }) })) === 1,
    "en la base hay un solo email",
  );

  const guardado = await prisma.emailOutbox.findFirst({ where: paraTenant(alpha2.id, { id: e1.ok ? e1.id : "" }) });
  ok(guardado?.estado === "pendiente", "queda pendiente: se guarda ANTES de intentar enviarlo");
  ok(Boolean(guardado?.messageId?.startsWith("<")), "con su Message-ID para poder mantener el hilo");

  const d = await despachar(alpha2.id);
  ok(d.simulados > 0 && d.enviados === 0, "sin proveedor conectado, los emails se marcan simulados, no enviados");

  await suprimir(alpha2.id, "cliente@example.com", "baja", "pidió baja");
  ok(await estaSuprimido(alpha2.id, "cliente@example.com"), "la supresión queda registrada");
  ok(!(await estaSuprimido(beta.id, "cliente@example.com")), "y NO afecta al otro negocio");
  const e3 = await encolar(alpha2, {
    tenantId: alpha2.id, para: "cliente@example.com", plantilla: "seguimiento", datos: {},
  });
  ok(!e3.ok && e3.motivo === "suprimido", "no se le manda nada a alguien dado de baja");
  const interno = await encolar(alpha2, {
    tenantId: alpha2.id, para: "cliente@example.com", plantilla: "error_interno",
    datos: { que: "x", cuando: "y" },
  });
  ok(interno.ok, "los avisos internos al equipo no se frenan por una supresión de marketing");

  // =========================================================================
  grupo("Seguimientos — frenar es lo importante");

  const lead = await prisma.lead.create({
    data: {
      tenantId: alpha2.id, contactId: otroHilo.contactId, conversationId: otroHilo.conversationId,
      servicio: "Drain cleaning", score: 70, estado: "calificado",
    },
  });
  ok((await programar(alpha2, lead.id)) === 3, "programa los tres pasos de la secuencia");
  ok((await programar(alpha2, lead.id)) === 0, "programarla de nuevo no duplica pasos");

  ok((await cortar(alpha2.id, lead.id, "respondio")) === 3, "cortar frena los tres pasos pendientes");
  const cortados = await prisma.followUp.findMany({ where: paraTenant(alpha2.id, { leadId: lead.id }) });
  ok(cortados.every((f) => f.estado === "cancelado"), "quedan cancelados");
  ok(cortados.every((f) => f.motivoCancelacion === "respondio"), "con el motivo guardado");

  // Un paso vencido de un lead que ya es cliente no se manda.
  const lead2 = await prisma.lead.create({
    data: {
      tenantId: alpha2.id, contactId: otroHilo.contactId,
      servicio: "Repipe", score: 80, estado: "ganado",
    },
  });
  await prisma.followUp.create({
    data: { tenantId: alpha2.id, leadId: lead2.id, paso: 1, programadoEn: new Date(Date.now() - 3600_000) },
  });
  const ejec = await ejecutarPendientes(alpha2.id);
  ok(ejec.enviados === 0 && ejec.cortados === 1, "un lead que ya es cliente no recibe el seguimiento: se corta");

  // Un lead cuya conversación tomó una persona tampoco.
  const lead3 = await prisma.lead.create({
    data: {
      tenantId: alpha2.id, contactId: rA.contactId, conversationId: rA.conversationId,
      servicio: "Heater", score: 75, estado: "calificado",
    },
  });
  await prisma.conversation.update({ where: { id: rA.conversationId }, data: { iaActiva: false } });
  await prisma.followUp.create({
    data: { tenantId: alpha2.id, leadId: lead3.id, paso: 1, programadoEn: new Date(Date.now() - 3600_000) },
  });
  const ejec2 = await ejecutarPendientes(alpha2.id);
  ok(ejec2.enviados === 0 && ejec2.cortados === 1, "si la conversación la tomó una persona, el seguimiento se corta");
  await prisma.conversation.update({ where: { id: rA.conversationId }, data: { iaActiva: true } });

  // =========================================================================
  grupo("Handoff");

  await derivar({ t: alpha2, conversationId: otroHilo.conversationId, motivo: "queja", detalle: "Cliente enojado" });
  const derivada = await prisma.conversation.findUnique({ where: { id: otroHilo.conversationId } });
  ok(derivada?.iaActiva === false, "la IA se apaga en esa conversación");
  ok(derivada?.estado === "esperando_humano", "y la conversación queda esperando al equipo");
  ok(derivada?.asignadoA !== null, "se asigna a alguien del equipo");

  const aviso = await prisma.notificacion.findFirst({
    where: { tipo: "agente_handoff" }, orderBy: { createdAt: "desc" },
  });
  ok(aviso !== null, "queda un aviso para el equipo");
  ok(aviso?.titulo.includes("Alpha Plumbing") ?? false, "el aviso dice de qué negocio es");

  ok(await devolverALaIa(alpha2.id, otroHilo.conversationId, "test@jota"), "se puede devolver a la IA");
  const devuelta = await prisma.conversation.findUnique({ where: { id: otroHilo.conversationId } });
  ok(devuelta?.iaActiva === true && devuelta.estado === "abierta", "y vuelve a estar activa");

  // =========================================================================
  grupo("Herramientas del agente");

  const ctx = { t: alpha2, conversationId: rA.conversationId, contactId: rA.contactId, leadId: lead3.id };

  const desconocida = await ejecutar(ctx, "BorrarTodo", {});
  ok(!desconocida.ok, "una herramienta que no existe se rechaza");

  const buscar = await ejecutar(ctx, "SearchBusinessKnowledge", { query: "licensed" });
  ok(buscar.ok && (buscar.datos.encontrados as number) > 0, "SearchBusinessKnowledge encuentra en la KB del negocio");

  const sinRespuesta = await ejecutar(ctx, "SearchBusinessKnowledge", { query: "quantum flux capacitor" });
  ok(sinRespuesta.ok === true && sinRespuesta.mensaje?.includes("No hay información aprobada") === true, "y avisa cuando no hay nada, en vez de devolver cualquier cosa");

  const aTercero = await ejecutar(ctx, "SendTransactionalEmail", {
    to: "desconocido@otro.example", body: "hola",
  });
  ok(!aTercero.ok, "el agente NO puede mandarle un email a alguien ajeno a la conversación");

  const alContacto = await ejecutar(ctx, "SendTransactionalEmail", {
    to: "cliente@example.com", body: "Acá va la respuesta",
  });
  ok(!alContacto.ok, "y tampoco al contacto que se dio de baja");

  // Chat web anónimo: alguien escribe sin identificarse.
  const anonimo = await recibir(alpha2, consulta(alpha2.id, { hiloExterno: "hilo-anon", mensaje: "Can I book something?" }));
  const sinEmail = await ejecutar(
    { t: alpha2, conversationId: anonimo.conversationId, contactId: anonimo.contactId },
    "CreateAppointment",
    { start_at: (await huecosDisponibles(alpha2, { cantidad: 2 }))[0].inicio.toISOString(), name: "Sin Mail" },
  );
  ok(!sinEmail.ok && sinEmail.error.includes("email"), "no se agenda sin email: primero hay que pedírselo");
  const sinNombre = await ejecutar(
    { t: alpha2, conversationId: anonimo.conversationId, contactId: anonimo.contactId },
    "CreateAppointment",
    { start_at: (await huecosDisponibles(alpha2, { cantidad: 2 }))[0].inicio.toISOString(), email: "anon@example.com" },
  );
  ok(!sinNombre.ok && sinNombre.error.includes("nombre"), "ni sin nombre: el pedido exige confirmar los dos");

  const nota = await ejecutar(ctx, "AddConversationNote", { note: "El cliente prefiere WhatsApp" });
  ok(nota.ok, "AddConversationNote guarda una nota interna");

  const auditadas = await prisma.auditLog.count({
    where: paraTenant(alpha2.id, { accion: { startsWith: "herramienta." } }),
  });
  ok(auditadas >= 5, "cada llamada a una herramienta queda auditada");

  // =========================================================================
  grupo("Recuperación — ninguna consulta desaparece");

  // Una consulta vieja sin estado final simula un proceso que se cortó.
  const perdida = await prisma.message.create({
    data: {
      tenantId: alpha2.id, conversationId: otroHilo.conversationId,
      direccion: "entrante", remitente: "contacto",
      contenido: "Hola? Alguien?", claveIdempotencia: "perdida-1",
      estadoFinal: null, createdAt: new Date(Date.now() - 3 * 3600_000),
    },
  });
  const rec = await recuperar(alpha2.id);
  ok(rec.sinEstadoFinal >= 1, "recuperación encuentra la consulta que quedó sin cerrar");
  const recuperada = await prisma.message.findUnique({ where: { id: perdida.id } });
  ok(recuperada?.estadoFinal === "error", "la marca como error en vez de dejarla invisible");
  ok(rec.derivados >= 1, "y la deriva a una persona");

  const rec2 = await recuperar(alpha2.id);
  ok(rec2.sinEstadoFinal === 0, "correr recuperación de nuevo no vuelve a levantar lo ya resuelto");

  // =========================================================================
  grupo("Salud y métricas");

  const salud = await revisar(alpha2.id);
  ok(salud.chequeos.some((c) => c.clave === "ia"), "el health check mira el modelo");
  ok(salud.chequeos.some((c) => c.clave === "email"), "y el proveedor de email");
  ok(
    salud.chequeos.find((c) => c.clave === "email")?.estado === "atencion",
    "sin proveedor conectado avisa, no dice que está todo bien",
  );
  ok(salud.chequeos.find((c) => c.clave === "kb")?.estado === "ok", "con conocimiento cargado, la KB está ok");
  ok(salud.chequeos.every((c) => c.estado !== "ok" ? Boolean(c.detalle) : true), "cada problema explica qué pasa");

  await marcarEstadoFinal(alpha2.id, rA.mensaje.id, "respondida");
  await guardarRespuesta({
    tenantId: alpha2.id, conversationId: rA.conversationId,
    contenido: "Respuesta de prueba", remitente: "agente",
    tokensEntrada: 2000, tokensSalida: 200,
  });

  const m = await ultimosDias(alpha2.id, 30);
  ok(m.consultas > 0, "las métricas cuentan las consultas del negocio");
  ok(m.costoIaCentavos !== null && m.costoIaCentavos >= 0, "calcula el costo de IA con los tokens reales");
  ok(m.porCanal.some((c) => c.canal === "website_chat"), "desglosa por canal");

  const mBeta = await ultimosDias(beta.id, 30);
  ok(mBeta.consultas === 1, "las métricas de Beta solo cuentan lo de Beta");

  // =========================================================================
  grupo("Modo demo");

  const demo = await cargarDemo();
  ok(demo.conversaciones >= 3, "la demo carga varias conversaciones");
  const tDemo = (await prisma.tenant.findUnique({ where: { id: demo.tenantId } }))!;
  ok(tDemo.esDemo, "el negocio de demo queda marcado como demo");
  ok(tDemo.estado === "activo", "y activo, para poder mostrarlo");

  const emailsDemo = await prisma.emailOutbox.findMany({ where: paraTenant(tDemo.id) });
  ok(emailsDemo.length >= 2, "la demo incluye el email al cliente y el email interno al dueño");
  ok(emailsDemo.every((e) => e.estado === "simulado"), "y NINGUNO figura como enviado de verdad");
  ok(
    emailsDemo.some((e) => e.asunto.startsWith("New qualified lead:")),
    "el email interno al dueño está en la demo",
  );

  const citaDemo = await prisma.appointment.count({ where: paraTenant(tDemo.id) });
  ok(citaDemo >= 1, "la demo tiene una reunión agendada");
  const handoffDemo = await prisma.conversation.count({ where: paraTenant(tDemo.id, { estado: "esperando_humano" }) });
  ok(handoffDemo >= 1, "y un caso de handoff");
  const aprobDemo = await prisma.approvalRequest.count({ where: paraTenant(tDemo.id, { estado: "pendiente" }) });
  ok(aprobDemo >= 1, "y una acción esperando aprobación humana");
  const spamDemo = await prisma.conversation.count({ where: paraTenant(tDemo.id, { intencion: "spam" }) });
  ok(spamDemo >= 1, "y un caso de spam filtrado");

  const mDemo = await ultimosDias(tDemo.id, 30);
  ok(mDemo.consultas >= 4, "las métricas de la demo tienen números para mostrar");
  ok(mDemo.fueraDeHorario >= 1, "incluye la consulta de las 3am, que es lo que se vende");

  const antes = await prisma.tenant.count();
  await borrarDemo();
  ok((await prisma.tenant.count()) === antes - 1, "borrar la demo saca el negocio de demo");
  ok((await prisma.tenant.count({ where: { id: alpha2.id } })) === 1, "y NO toca los negocios reales");
  ok(
    (await prisma.conversation.count({ where: { tenantId: tDemo.id } })) === 0,
    "las conversaciones de la demo se borran en cascada",
  );

  // =========================================================================
  console.log(`\n${fallos === 0 ? "✅" : "❌"} ${total - fallos}/${total} pruebas de integración pasaron\n`);
  await prisma.$disconnect();
  process.exit(fallos === 0 ? 0 : 1);
}

/** Un martes futuro, para probar horarios sin depender del día de hoy. */
function fechaFutura(zona: string): string {
  for (let i = 1; i <= 8; i++) {
    const d = new Date(Date.now() + i * 86_400_000);
    const iso = new Intl.DateTimeFormat("en-CA", { timeZone: zona }).format(d);
    const [a, m, dd] = iso.split("-").map(Number);
    const dow = new Date(Date.UTC(a, m - 1, dd)).getUTCDay();
    if (dow === 2) return iso;
  }
  return new Intl.DateTimeFormat("en-CA", { timeZone: zona }).format(new Date(Date.now() + 86_400_000));
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
