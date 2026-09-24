/**
 * Pruebas del workflow 21 — prospección saliente.
 *
 * Parte 1 (siempre): las reglas puras que protegen el dominio. Qué email se
 * acepta, cuándo se manda, cuánto se manda y qué borrador no puede salir.
 *
 * Parte 2 (solo con DATABASE_URL): el circuito completo contra un Postgres
 * real. Se manda el primer email, el prospecto RESPONDE, y se verifica que la
 * respuesta cae en la misma conversación del agente, que la secuencia se
 * frena y que una baja lo saca de la lista.
 *
 * Correr con:  npm run test:prospeccion
 *              DATABASE_URL=... npm run test:prospeccion   (base DESCARTABLE)
 */

import {
  configDesdeEnv, enHorarioDeEnvio, cupoDePasada, extraerEmails, dominioDe,
  validarBorrador, borradorBase, tocaSeguimiento, textoSeguimiento,
} from "@/lib/agente/prospeccion";
import { armar } from "@/lib/agente/plantillas";
import type { Tenant } from "@prisma/client";

let fallos = 0;
let total = 0;
const ok = (c: boolean, m: string) => {
  total++;
  console.log(c ? `  ✅ ${m}` : `  ❌ ${m}`);
  if (!c) fallos++;
};
const grupo = (t: string) => console.log(`\n${t}`);

function puras() {
  grupo("Configuración");
  const c0 = configDesdeEnv({});
  ok(c0.limiteDiario === 20 && c0.modo === "borrador" && c0.tenantSlug === null, "por defecto: 20/día, modo borrador, sin tenant");
  ok(configDesdeEnv({ PROSPECCION_LIMITE_DIARIO: "500" }).limiteDiario === 50, "el tope nunca pasa de 50 aunque se configure más");
  ok(configDesdeEnv({ PROSPECCION_LIMITE_DIARIO: "abc" }).limiteDiario === 20, "un límite inválido vuelve a 20");
  ok(configDesdeEnv({ PROSPECCION_MODO: "AUTOMATICO" }).modo === "automatico", "modo automático se activa explícitamente");
  ok(configDesdeEnv({ PROSPECCION_MODO: "yolo" }).modo === "borrador", "cualquier otro valor es borrador");
  ok(configDesdeEnv({ PROSPECCION_TENANT: " Jota " }).tenantSlug === "jota", "el slug se normaliza");

  grupo("Horario de envío (Hawái)");
  const zona = "Pacific/Honolulu";
  // Hawái es UTC-10 todo el año.
  ok(enHorarioDeEnvio(new Date("2026-09-24T19:00:00Z"), zona), "jueves 9:00 en Hawái → sí");
  ok(!enHorarioDeEnvio(new Date("2026-09-24T17:30:00Z"), zona), "jueves 7:30 → todavía no");
  ok(!enHorarioDeEnvio(new Date("2026-09-25T02:00:00Z"), zona), "jueves 16:00 → ya no");
  ok(!enHorarioDeEnvio(new Date("2026-09-26T20:00:00Z"), zona), "sábado 10:00 → nunca en fin de semana");

  grupo("Cupo por pasada");
  ok(cupoDePasada(50, 0) === 3, "50/día → 3 por pasada (repartido, no de golpe)");
  ok(cupoDePasada(20, 0) === 1, "20/día → 1 por pasada");
  ok(cupoDePasada(50, 49) === 1, "le queda 1 → manda 1");
  ok(cupoDePasada(50, 50) === 0 && cupoDePasada(50, 70) === 0, "tope alcanzado → 0");

  grupo("Emails encontrados en la web");
  ok(dominioDe("https://www.boydmaui.com/about") === "boydmaui.com", "dominio sin www");
  ok(dominioDe("no es una url con espacios") === null, "algo que no es URL → null");
  const html = `
    <a href="mailto:Info@BoydMaui.com">Email us</a>
    <p>Owner: owner@boydmaui.com · Web by studio@agenciaweb.com</p>
    <img src="logo@2x.png"> noreply@boydmaui.com
    <span>office&#64;boydmaui.com</span> reservas@mail.boydmaui.com`;
  const e = extraerEmails(html, "www.boydmaui.com");
  ok(!e.includes("studio@agenciaweb.com"), "NO toma el email de otro dominio (la agencia que hizo la web)");
  ok(!e.some((x) => x.startsWith("noreply")), "descarta noreply");
  ok(!e.some((x) => x.includes(".png")), "no confunde una imagen con un email");
  ok(e.includes("office@boydmaui.com"), "decodifica &#64; ofuscado");
  ok(e.includes("reservas@mail.boydmaui.com"), "acepta subdominios del propio dominio");
  ok(e[0] === "owner@boydmaui.com", "prioriza al dueño sobre info@");
  ok(e.includes("info@boydmaui.com"), "normaliza a minúsculas");
  ok(extraerEmails("<p>sin emails</p>", "x.com").length === 0, "sin emails → lista vacía, no inventa");

  grupo("Borradores que no pueden salir");
  const t = { nombreNegocio: "JOTA agency" } as Tenant;
  const base = borradorBase({ empresa: "Boyd Construction", rubro: "Constructora", ciudad: "Maui", contacto: "Mike Boyd" }, t);
  ok(validarBorrador(base).ok, "la plantilla sin IA pasa sus propias reglas");
  ok(base.texto.startsWith("Hi Mike,"), "usa solo el primer nombre");
  ok(borradorBase({ empresa: "X", rubro: "r", ciudad: null, contacto: null }, t).texto.startsWith("Hi,"), "sin nombre → 'Hi,'");
  const cuerpo = base.texto;
  ok(!validarBorrador({ asunto: "hola", texto: `Hi {name}, ${cuerpo}` }).ok, "rechaza placeholders sin completar");
  ok(!validarBorrador({ asunto: "hola", texto: `${cuerpo} https://jotaagency.org` }).ok, "rechaza links en el primer email");
  ok(!validarBorrador({ asunto: "hola", texto: `${cuerpo} We raise bookings 37%.` }).ok, "rechaza porcentajes (datos probablemente inventados)");
  ok(!validarBorrador({ asunto: "hola", texto: "Hi, short." }).ok, "rechaza un cuerpo vacío de contenido");
  ok(!validarBorrador({ asunto: "hola", texto: `${cuerpo} ${"word ".repeat(120)}` }).ok, "rechaza más de 160 palabras");
  ok(!validarBorrador({ asunto: "x".repeat(81), texto: cuerpo }).ok, "rechaza asuntos largos");

  grupo("Seguimientos");
  const ahora = new Date("2026-09-24T20:00:00Z");
  const hace = (d: number) => new Date(ahora.getTime() - d * 86_400_000);
  const p = (x: Partial<{ secuenciaPaso: number; ultimoEnvio: Date | null; respondioEn: Date | null; estado: string }>) => ({
    secuenciaPaso: 1, ultimoEnvio: hace(3), respondioEn: null, estado: "contactado", ...x,
  });
  ok(tocaSeguimiento(p({}), ahora) === 2, "3 días después del primero → seguimiento 2");
  ok(tocaSeguimiento(p({ ultimoEnvio: hace(2) }), ahora) === null, "2 días después → todavía no");
  ok(tocaSeguimiento(p({ secuenciaPaso: 2, ultimoEnvio: hace(4) }), ahora) === 3, "4 días después del segundo → seguimiento 3 (día 7)");
  ok(tocaSeguimiento(p({ secuenciaPaso: 3, ultimoEnvio: hace(30) }), ahora) === null, "después del tercero no hay más");
  ok(tocaSeguimiento(p({ respondioEn: hace(1) }), ahora) === null, "si respondió, se frena");
  ok(tocaSeguimiento(p({ estado: "reunion" }), ahora) === null, "si tiene reunión, se frena");
  ok(tocaSeguimiento(p({ estado: "descartado" }), ahora) === null, "si se dio de baja, se frena");
  ok(textoSeguimiento(2, "Boyd").includes("Boyd") && validarBorrador({ asunto: "Re: x", texto: textoSeguimiento(3, "Boyd").repeat(2) }).ok, "los seguimientos nombran a la empresa y no rompen las reglas");

  grupo("Plantilla del email en frío");
  const tenant = { nombreNegocio: "JOTA agency", nombreAgente: "J", firmaEmail: "Joaquín · JOTA agency" } as Tenant;
  const a = armar("prospeccion", tenant, { asunto: "quick question", cuerpo: "Hi <b>Mike</b>,\n\nTest.", direccion: "123 Main St, Kihei, HI 96753" });
  ok(a.asunto === "quick question", "respeta el asunto");
  ok(a.texto.includes("123 Main St") && a.html.includes("123 Main St"), "lleva la dirección postal (CAN-SPAM) en HTML y texto");
  ok(/reply "stop"/i.test(a.texto) && /reply &quot;stop&quot;/i.test(a.html), "explica cómo darse de baja");
  ok(!a.html.includes("<b>Mike</b>") && a.html.includes("&lt;b&gt;"), "escapa lo que escribió el modelo");
  ok(!a.html.includes("You're receiving this because you contacted"), "no dice que nos contactaron (sería falso en un email en frío)");
}

// ---------------------------------------------------------------------------
//  Parte 2: circuito completo contra Postgres
// ---------------------------------------------------------------------------

async function conBase() {
  const { PrismaClient } = await import("@prisma/client");
  const { crearTenant } = await import("@/lib/agente/onboarding");
  const { enviarPrimerEmail, sincronizarRespuestas } = await import("@/lib/agente/prospeccion");
  const { recibir } = await import("@/lib/agente/intake");
  const { desdeEmail } = await import("@/lib/agente/normalizar");
  const { suprimir } = await import("@/lib/agente/email");
  const prisma = new PrismaClient();

  await prisma.tenant.deleteMany({});
  await prisma.prospecto.deleteMany({ where: { fuente: "prueba-prospeccion" } });

  const { tenant: t } = await crearTenant({ nombreNegocio: "JOTA prueba", slug: "jota-prueba", servicios: "AI agent" });
  const direccion = "123 Main St, Kihei, HI 96753";
  const nuevo = (empresa: string, email: string) =>
    prisma.prospecto.create({
      data: {
        empresa, rubro: "Constructora", email, fuente: "prueba-prospeccion",
        borradorAsunto: "quick question", borradorTexto: borradorBase({ empresa, rubro: "", ciudad: null, contacto: null }, t).texto,
        borradorAprobado: true,
      },
    });

  grupo("Primer email");
  const p1 = await nuevo("Boyd Construction", "owner@boydmaui.com");
  ok((await enviarPrimerEmail(t, p1, direccion)).ok, "sale el primer email");
  const tras = await prisma.prospecto.findUniqueOrThrow({ where: { id: p1.id } });
  ok(tras.estado === "contactado" && tras.secuenciaPaso === 1, "el prospecto pasa a contactado, paso 1");
  const outbox = await prisma.emailOutbox.findFirst({ where: { tenantId: t.id, para: "owner@boydmaui.com" } });
  ok(outbox?.plantilla === "prospeccion" && outbox.clase === "marketing", "queda en la bandeja de salida del agente como marketing");
  ok(outbox?.messageId === tras.hiloMessageId, "guarda el Message-ID como raíz del hilo");
  ok(!(await enviarPrimerEmail(t, tras, direccion)).ok, "no se le puede mandar el primero dos veces");
  ok((await prisma.emailOutbox.count({ where: { tenantId: t.id, para: "owner@boydmaui.com" } })) === 1, "y en la bandeja sigue habiendo uno solo");

  grupo("Responde → cae en la conversación del agente");
  const respuesta = desdeEmail(t.id, {
    from: "Mike Boyd <owner@boydmaui.com>",
    subject: "Re: quick question",
    text: "Sure, what would a call look like?",
    message_id: "<resp-1@boydmaui.com>",
    in_reply_to: tras.hiloMessageId,
    references: tras.hiloMessageId,
  });
  if ("error" in respuesta) throw new Error(respuesta.error);
  const intake = await recibir(t, respuesta);
  ok(intake.conversationId === tras.conversationId, "la respuesta entra en LA MISMA conversación que abrimos al enviar");
  const mensajes = await prisma.message.findMany({ where: { conversationId: intake.conversationId }, orderBy: { createdAt: "asc" } });
  ok(mensajes[0]?.direccion === "saliente" && mensajes[0].contenido.includes("quick question"), "el agente ve lo que le escribimos antes de su respuesta");
  ok((await prisma.contact.count({ where: { tenantId: t.id, email: "owner@boydmaui.com" } })) === 1, "no se duplica el contacto");

  const s1 = await sincronizarRespuestas(t);
  const respondio = await prisma.prospecto.findUniqueOrThrow({ where: { id: p1.id } });
  ok(s1.respondieron === 1 && respondio.respondioEn !== null, "el panel se entera de que respondió");
  ok(tocaSeguimiento(respondio, new Date(Date.now() + 10 * 86_400_000)) === null, "y ya no le toca ningún seguimiento");

  grupo("Reunión agendada por J → reunión en el panel");
  await prisma.appointment.create({
    data: {
      tenantId: t.id, contactId: intake.contactId, conversationId: intake.conversationId,
      titulo: "Call", inicio: new Date(Date.now() + 86_400_000), fin: new Date(Date.now() + 90_000_000),
      zonaHoraria: "Pacific/Honolulu", estado: "agendada",
    },
  });
  // Un prospecto con respuesta sigue "contactado" hasta que hay cita.
  await sincronizarRespuestas(t);
  ok((await prisma.prospecto.findUniqueOrThrow({ where: { id: p1.id } })).estado === "reunion", "pasa a 'reunión agendada'");

  grupo("Baja");
  const p2 = await nuevo("Crescent Homes", "info@crescenthomesmaui.com");
  ok((await enviarPrimerEmail(t, p2, direccion)).ok, "sale el primero al segundo prospecto");
  await suprimir(t.id, "info@crescenthomesmaui.com", "baja", "prueba");
  await sincronizarRespuestas(t);
  ok((await prisma.prospecto.findUniqueOrThrow({ where: { id: p2.id } })).estado === "descartado", "una baja lo pasa a descartado");

  const p3 = await nuevo("Otra", "info@crescenthomesmaui.com");
  ok(!(await enviarPrimerEmail(t, p3, direccion)).ok, "y otro prospecto con el mismo email no recibe nada");

  await prisma.tenant.deleteMany({});
  await prisma.prospecto.deleteMany({ where: { fuente: "prueba-prospeccion" } });
  await prisma.$disconnect();
}

async function main() {
  puras();
  if (process.env.DATABASE_URL) await conBase();
  else console.log("\n(sin DATABASE_URL: se saltea el circuito contra la base)");
  console.log(fallos ? `\n❌ ${fallos} de ${total} FALLARON` : `\n✅ TODAS PASAN (${total})`);
  process.exit(fallos ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
