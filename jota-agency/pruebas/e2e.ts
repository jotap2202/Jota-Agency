/**
 * Flujo completo de punta a punta, con servicios REALES.
 *
 *   npm run test:e2e
 *
 * Recorre exactamente lo que se le vende a un cliente, en orden:
 *
 *   1. Se da de alta un negocio nuevo desde cero (como el wizard del panel).
 *   2. Llega una consulta por el chat, fuera de horario.
 *   3. El agente responde con IA real.
 *   4. Se captura y califica el lead.
 *   5. Quedan registrados contacto y conversación.
 *   6. Sale el email al cliente y el email interno al negocio.
 *   7. Una segunda consulta dispara el handoff a una persona.
 *   8. Todo aparece en el panel.
 *
 * Requiere ANTHROPIC_API_KEY y DATABASE_URL. El email sale de verdad SOLO con
 * ALLOW_REAL_EMAIL_TEST=true, TEST_EMAIL_RECIPIENT y RESEND_API_KEY; sin eso
 * los emails se arman y se muestran, pero quedan como simulados.
 *
 * Todo lo que crea es ficticio y se borra al terminar.
 */

import { PrismaClient } from "@prisma/client";
import { crearTenant, activar, pendientesParaActivar } from "@/lib/agente/onboarding";
import { procesar } from "@/lib/agente/orquestador";
import { despachar, hayProveedor } from "@/lib/agente/email";
import { paraTenant } from "@/lib/agente/tenant";
import { ultimosDias, costoCentavos } from "@/lib/agente/metricas";
import { MODELO, hayClaveIa } from "@/lib/agente/agente";
import type { ConsultaEntrante } from "@/lib/agente/tipos";

const prisma = new PrismaClient();
const SLUG = "e2e-maui-mobile-detailing";

let fallos = 0;
let total = 0;
const ok = (c: boolean, m: string, detalle?: string) => {
  total++;
  console.log(c ? `  ✅ ${m}` : `  ❌ ${m}`);
  if (detalle) console.log(`       ${detalle}`);
  if (!c) fallos++;
};
const paso = (n: number, t: string) => console.log(`\n━━━ PASO ${n} — ${t}`);

const destinoEmail = process.env.TEST_EMAIL_RECIPIENT?.trim().toLowerCase() || null;
const enviarDeVerdad =
  process.env.ALLOW_REAL_EMAIL_TEST?.trim().toLowerCase() === "true" &&
  Boolean(destinoEmail) &&
  Boolean(process.env.RESEND_API_KEY?.trim());

async function limpiar() {
  await prisma.tenant.deleteMany({ where: { slug: SLUG } });
  await prisma.notificacion.deleteMany({ where: { titulo: { startsWith: "Maui Mobile Detailing" } } });
}

let n = 0;
function chat(tenantId: string, mensaje: string, hilo = "e2e-1"): ConsultaEntrante {
  n++;
  return {
    tenantId, canal: "website_chat", hiloExterno: hilo,
    mensaje, recibidoEn: new Date(),
  };
}

async function main() {
  if (!process.env.DATABASE_URL?.trim()) {
    console.error("\n❌ Falta DATABASE_URL.\n");
    process.exit(1);
  }
  if (!hayClaveIa()) {
    console.error(
      "\n❌ Falta ANTHROPIC_API_KEY.\n" +
        "   Ponela en jota-agency/.env y volvé a correr:  npm run test:e2e\n",
    );
    process.exit(1);
  }
  process.env.APP_ENCRYPTION_KEY ??= "clave-de-prueba-local-suficientemente-larga-ok";

  console.log("\n╔══════════════════════════════════════════════════════════╗");
  console.log("║  FLUJO COMPLETO — 24/7 AI Agent                          ║");
  console.log("╚══════════════════════════════════════════════════════════╝");
  console.log(`  modelo:  ${MODELO}`);
  console.log(`  email:   ${enviarDeVerdad ? `🔴 ENVÍO REAL a ${enmascarar(destinoEmail!)}` : "🟢 simulado (no sale nada)"}`);

  await limpiar();

  // =========================================================================
  paso(1, "Dar de alta un negocio nuevo, sin tocar código");

  const equipo = destinoEmail ?? "dueno@example.invalid";
  const { tenant, fragmentos, miembros } = await crearTenant({
    nombreNegocio: "Maui Mobile Detailing",
    slug: SLUG,
    descripcion:
      "Lavado y detailing de autos a domicilio en Maui. Vamos a la casa o la oficina del cliente.",
    zonaHoraria: "Pacific/Honolulu",
    idioma: "en",
    nombreAgente: "Leilani",
    tono: "cercano",
    servicios: "Exterior wash and wax\nInterior deep clean\nFull detail (interior + exterior)\nCeramic coating\nHeadlight restoration",
    areaServicio: "Kahului, Wailuku, Kihei, Wailea, Paia",
    reglasPrecio:
      "Exterior wash and wax: $89.\n" +
      "Interior deep clean: $129.\n" +
      "Full detail: $199 for sedans, $249 for SUVs and trucks.\n" +
      "Ceramic coating starts at $650 and requires an in-person quote.\n" +
      "Never quote a price for a vehicle you have not seen if it is not on this list.",
    politicas:
      "We come to you; there is no shop.\n" +
      "Cancellations are free with 12 hours notice.\n" +
      "We do not detail boats, RVs or motorcycles.\n" +
      "Any discount must be approved by the owner.",
    faq:
      "Q: Do you come to my house?\nA: Yes, we're fully mobile. We bring our own water and power.\n\n" +
      "Q: How long does a full detail take?\nA: About 3 to 4 hours for a sedan.\n\n" +
      "Q: Do you work on boats?\nA: No, we only do cars, SUVs and trucks.\n\n" +
      "Q: Do you serve Hana?\nA: No. We cover Kahului, Wailuku, Kihei, Wailea and Paia only.",
    horarios: { mon: [["08:00", "17:00"]], tue: [["08:00", "17:00"]], wed: [["08:00", "17:00"]], thu: [["08:00", "17:00"]], fri: [["08:00", "17:00"]], sat: [["09:00", "13:00"]] },
    equipo,
    esDemo: true,
  });

  ok(tenant.estado === "onboarding", "el negocio nuevo NO arranca activo");
  ok(fragmentos > 0, `se indexó el conocimiento del formulario`, `${fragmentos} fragmentos`);
  ok(miembros > 0, "quedó cargado quien recibe los avisos");
  ok((await pendientesParaActivar(tenant.id)).length === 0, "no falta nada para activarlo");

  await activar(tenant.id);
  await prisma.tenant.update({ where: { id: tenant.id }, data: { modo: "autonomo", umbralAviso: 55 } });
  const t = (await prisma.tenant.findUnique({ where: { id: tenant.id } }))!;
  ok(t.estado === "activo", "activado");
  console.log(`       Línea para instalar en su web:`);
  console.log(`       <script src="…/api/agente/widget?clave=${t.clavePublica}" async></script>`);

  // =========================================================================
  paso(2, "Entra una consulta por el chat");

  const r1 = await procesar(t, chat(t.id, "Hey, do you guys come to Kihei? My truck is filthy and I need it done this week."));
  ok(r1.ok, "la consulta se procesó");
  console.log(`       Cliente: "Hey, do you guys come to Kihei? My truck is filthy…"`);
  console.log(`       Leilani: "${r1.respuesta}"`);

  // =========================================================================
  paso(3, "El agente respondió con IA real, usando la info del negocio");

  ok(r1.respuesta.length > 0, "hay una respuesta de verdad, no un texto fijo");
  ok(/kihei|yes|we do|come to you|mobile/i.test(r1.respuesta), "responde sobre la cobertura usando la FAQ cargada");
  const msgIa = await prisma.message.findFirst({
    where: paraTenant(t.id, { direccion: "saliente", generadoPorIa: true }),
    orderBy: { createdAt: "desc" },
  });
  ok((msgIa?.tokensEntrada ?? 0) > 0, "consumió tokens reales", `entrada=${msgIa?.tokensEntrada} salida=${msgIa?.tokensSalida}`);
  ok((msgIa?.confianza ?? 0) > 0, "reportó su confianza", `confianza=${msgIa?.confianza}`);

  // El guardrail que más importa: precios que SÍ están aprobados se pueden decir.
  const r2 = await procesar(t, chat(t.id, "How much for a full detail on a pickup truck?"));
  console.log(`       Cliente: "How much for a full detail on a pickup truck?"`);
  console.log(`       Leilani: "${r2.respuesta}"`);
  ok(/249|\$249/.test(r2.respuesta) || /quote|in person/i.test(r2.respuesta), "usa el precio aprobado de la lista, o deriva");
  ok(!/\$1[0-9]{2,}|\$[3-9][0-9]{2}/.test(r2.respuesta.replace(/249|650|199|129|89/g, "")), "no inventa un precio que no está en la lista");

  // =========================================================================
  paso(4, "Captura y calificación del lead");

  const r3 = await procesar(
    t,
    chat(t.id, "Sounds good. I'm Alex Tanaka, alex.tanaka@example.invalid, 808-555-0133. Truck is at my place in Kihei, I need it before Friday."),
  );
  console.log(`       Cliente: "I'm Alex Tanaka, alex.tanaka@example.invalid, 808-555-0133…"`);
  console.log(`       Leilani: "${r3.respuesta}"`);

  const lead = await prisma.lead.findFirst({
    where: paraTenant(t.id, { conversationId: r3.conversationId }),
    include: { contacto: true },
  });
  ok(lead !== null, "se creó el lead");
  ok(lead?.contacto.nombre?.toLowerCase().includes("alex") ?? false, "capturó el nombre", lead?.contacto.nombre ?? "—");
  ok(lead?.contacto.email === "alex.tanaka@example.invalid", "capturó el email", lead?.contacto.email ?? "—");
  ok(Boolean(lead?.contacto.telefono), "capturó el teléfono", lead?.contacto.telefono ?? "—");
  ok((lead?.score ?? 0) >= 50, "lo calificó con un score usable", `score=${lead?.score} · confianza=${lead?.confianza}`);
  ok(lead?.presupuesto === null, "NO inventó un presupuesto que nadie mencionó");

  const detalle = (lead?.scoreDetalle ?? {}) as { positivos?: string[]; faltantes?: string[] };
  console.log(`       A favor: ${(detalle.positivos ?? []).slice(0, 4).join(" · ")}`);
  console.log(`       Falta:   ${(detalle.faltantes ?? []).slice(0, 3).join(" · ")}`);
  ok((detalle.positivos?.length ?? 0) > 0, "el score viene explicado, no es un número suelto");

  // =========================================================================
  paso(5, "Contacto y conversación quedaron registrados");

  const [contactos, conversaciones, mensajes, huerfanos] = await Promise.all([
    prisma.contact.count({ where: paraTenant(t.id) }),
    prisma.conversation.count({ where: paraTenant(t.id) }),
    prisma.message.count({ where: paraTenant(t.id) }),
    prisma.message.count({ where: paraTenant(t.id, { direccion: "entrante", estadoFinal: null }) }),
  ]);
  ok(contactos >= 1, "el contacto está en la base", `contactos=${contactos}`);
  ok(conversaciones >= 1, "la conversación está en la base", `conversaciones=${conversaciones}`);
  ok(mensajes >= 6, "todos los mensajes de ida y vuelta quedaron guardados", `mensajes=${mensajes}`);
  ok(huerfanos === 0, "NINGUNA consulta quedó sin cerrar");

  // =========================================================================
  paso(6, "Emails: al cliente y al negocio");

  const cola = await prisma.emailOutbox.findMany({
    where: paraTenant(t.id),
    orderBy: { createdAt: "asc" },
    select: { id: true, para: true, asunto: true, plantilla: true, estado: true, texto: true },
  });
  ok(cola.length > 0, `se encolaron ${cola.length} email(s)`);
  for (const e of cola) console.log(`       · ${e.plantilla} → ${enmascarar(e.para)} · "${e.asunto}"`);

  const interno = cola.find((e) => e.plantilla === "resumen_interno");
  ok(interno !== undefined, "salió el email interno al negocio con el resumen del lead");
  if (interno) {
    console.log("\n       ── Email que recibe el dueño ──");
    console.log(interno.texto.split("\n").slice(0, 18).map((l) => `       ${l}`).join("\n"));
  }

  const proveedor = await hayProveedor(t);
  if (enviarDeVerdad && proveedor) {
    // Blindaje: solo se despacha lo que va a la dirección autorizada.
    const bloqueados = await prisma.emailOutbox.updateMany({
      where: paraTenant(t.id, { estado: "pendiente", NOT: { para: destinoEmail! } }),
      data: { estado: "simulado", ultimoError: "Destino no autorizado por TEST_EMAIL_RECIPIENT" },
    });
    if (bloqueados.count > 0) console.log(`       (${bloqueados.count} email[s] bloqueado[s] por ir a otro destino)`);
    const d = await despachar(t.id, 10);
    ok(d.enviados > 0, `Resend aceptó ${d.enviados} email(s)`, `fallidos=${d.fallidos}`);
    const enviados = await prisma.emailOutbox.findMany({ where: paraTenant(t.id, { estado: "enviado" }), select: { para: true } });
    ok(enviados.every((e) => e.para === destinoEmail), "todo lo enviado fue a la dirección autorizada");
  } else {
    const d = await despachar(t.id, 10);
    ok(d.simulados > 0 || d.enviados === 0, "sin autorización de envío, los emails quedan simulados", `simulados=${d.simulados}`);
    console.log("       🟢 No salió ningún email. Para enviarlos de verdad:");
    console.log("          ALLOW_REAL_EMAIL_TEST=true TEST_EMAIL_RECIPIENT=tu@correo.com npm run test:e2e");
  }

  // =========================================================================
  paso(7, "Human handoff");

  const r4 = await procesar(
    t,
    chat(t.id, "Actually can you give me 40% off if I book three cars? And do you detail boats?", "e2e-handoff"),
  );
  console.log(`       Cliente: "Can you give me 40% off… and do you detail boats?"`);
  console.log(`       Leilani: "${r4.respuesta}"`);
  ok(!/40%|yes,? we (do|detail) boats/i.test(r4.respuesta), "NO concede el descuento ni afirma que hace botes");

  const convHandoff = await prisma.conversation.findFirst({
    where: paraTenant(t.id, { hiloExterno: "e2e-handoff" }),
  });
  const derivadas = await prisma.conversation.count({ where: paraTenant(t.id, { estado: "esperando_humano" }) });
  const aprobaciones = await prisma.approvalRequest.count({ where: paraTenant(t.id, { estado: "pendiente" }) });
  ok(
    derivadas > 0 || aprobaciones > 0 || convHandoff?.iaActiva === false,
    "el pedido de descuento terminó en manos de una persona",
    `derivadas=${derivadas} · aprobaciones pendientes=${aprobaciones}`,
  );

  // =========================================================================
  paso(8, "Todo esto es lo que ve el panel");

  const m = await ultimosDias(t.id, 1);
  console.log(`       Consultas recibidas:  ${m.consultas}`);
  console.log(`       Respondidas:          ${m.respondidas} (${m.tasaRespuesta === null ? "—" : Math.round(m.tasaRespuesta * 100) + "%"})`);
  console.log(`       1ª respuesta:         ${m.primeraRespuestaMin === null ? "—" : m.primeraRespuestaMin + " min"}`);
  console.log(`       Leads capturados:     ${m.leads} (${m.leadsCalificados} calificados)`);
  console.log(`       Derivadas a humano:   ${m.handoffs}`);
  console.log(`       Fuera de horario:     ${m.fueraDeHorario}`);
  console.log(`       Costo de IA:          ${m.costoIaCentavos === null ? "—" : "US$ " + (m.costoIaCentavos / 100).toFixed(4)}`);

  ok(m.consultas >= 4, "el panel cuenta las consultas");
  ok(m.leads >= 1, "el panel muestra el lead");
  ok(m.costoIaCentavos !== null && m.costoIaCentavos > 0, "el panel muestra el costo real");
  ok((await prisma.workflowEvent.count({ where: paraTenant(t.id, { tipo: "dlq" }) })) === 0, "nada terminó en la cola de errores");

  // =========================================================================
  const uso = await prisma.message.aggregate({
    where: paraTenant(t.id, { generadoPorIa: true }),
    _sum: { tokensEntrada: true, tokensSalida: true },
  });
  const costo = costoCentavos(uso._sum.tokensEntrada ?? 0, uso._sum.tokensSalida ?? 0);
  console.log("\n─────────────────────────────────────────────");
  console.log(`Costo real de esta corrida: ${costo === null ? "—" : "US$ " + (costo / 100).toFixed(4)}`);
  console.log(`Conversaciones: ${conversaciones} · tokens: ${(uso._sum.tokensEntrada ?? 0) + (uso._sum.tokensSalida ?? 0)}`);

  await limpiar();
  console.log(`Limpieza: el negocio de prueba se borró.`);
  console.log(`\n${fallos === 0 ? "✅" : "❌"} ${total - fallos}/${total} comprobaciones del flujo completo pasaron\n`);

  await prisma.$disconnect();
  process.exit(fallos === 0 ? 0 : 1);
}

function enmascarar(email: string): string {
  const [u, d] = email.split("@");
  return d ? `${u.slice(0, 2)}***@${d}` : "***";
}

main().catch(async (e) => {
  console.error("\n❌ El flujo se cortó:", e instanceof Error ? e.message : e);
  await limpiar().catch(() => {});
  await prisma.$disconnect();
  process.exit(1);
});
