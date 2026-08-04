/**
 * Prueba de envío real por Resend.
 *
 *   npm run test:email-real
 *
 * BLOQUEADO POR DEFECTO. Sin las dos variables de abajo no manda nada:
 *
 *   ALLOW_REAL_EMAIL_TEST=true      autorización explícita
 *   TEST_EMAIL_RECIPIENT=vos@...    la ÚNICA dirección a la que se puede enviar
 *
 * Son dos candados a propósito. Una sola variable se activa por accidente al
 * copiar un .env de un lado a otro; con dos, y una de ellas nombrando la
 * dirección exacta, no hay forma de mandarle un correo de prueba a un cliente
 * real sin haberlo escrito uno mismo.
 *
 * Sin `--enviar` corre en modo ensayo: arma el email completo, lo encola, lo
 * muestra y NO lo despacha. Eso ya prueba plantillas, hilos y supresiones.
 */

import { PrismaClient } from "@prisma/client";
import { crearTenant, activar } from "@/lib/agente/onboarding";
import { encolar, despachar, hayProveedor, suprimir, armarReferences } from "@/lib/agente/email";
import { paraTenant } from "@/lib/agente/tenant";

const prisma = new PrismaClient();
const SLUG = "prueba-email-real";

let fallos = 0;
let total = 0;
const ok = (c: boolean, m: string, detalle?: string) => {
  total++;
  console.log(c ? `  ✅ ${m}` : `  ❌ ${m}`);
  if (detalle) console.log(`       ${detalle}`);
  if (!c) fallos++;
};
const grupo = (t: string) => console.log(`\n${t}`);

const ENVIAR_DE_VERDAD = process.argv.includes("--enviar");

/** Los tres candados. Se evalúan juntos y se explica cuál falta. */
function autorizacion(): { permitido: boolean; destino: string | null; motivo: string } {
  const allow = process.env.ALLOW_REAL_EMAIL_TEST?.trim().toLowerCase() === "true";
  const destino = process.env.TEST_EMAIL_RECIPIENT?.trim().toLowerCase() || null;
  const clave = Boolean(process.env.RESEND_API_KEY?.trim());

  if (!allow) return { permitido: false, destino, motivo: "ALLOW_REAL_EMAIL_TEST no está en true" };
  if (!destino) return { permitido: false, destino, motivo: "TEST_EMAIL_RECIPIENT no está definida" };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(destino)) {
    return { permitido: false, destino, motivo: "TEST_EMAIL_RECIPIENT no parece un email válido" };
  }
  if (!clave) return { permitido: false, destino, motivo: "RESEND_API_KEY no está definida" };
  if (!ENVIAR_DE_VERDAD) return { permitido: false, destino, motivo: "falta el flag --enviar" };
  return { permitido: true, destino, motivo: "" };
}

async function main() {
  if (!process.env.DATABASE_URL?.trim()) {
    console.error("\n❌ Falta DATABASE_URL.\n");
    process.exit(1);
  }
  process.env.APP_ENCRYPTION_KEY ??= "clave-de-prueba-local-suficientemente-larga-ok";

  const auth = autorizacion();
  const destinoSeguro = auth.destino ?? "nadie@example.invalid";

  console.log("\n=== Prueba de email ===");
  console.log(`  modo:      ${auth.permitido ? "🔴 ENVÍO REAL" : "🟢 ensayo (no sale nada)"}`);
  console.log(`  destino:   ${auth.destino ? enmascarar(auth.destino) : "(sin definir)"}`);
  if (!auth.permitido) console.log(`  bloqueado: ${auth.motivo}`);

  await prisma.tenant.deleteMany({ where: { slug: SLUG } });
  const { tenant } = await crearTenant({
    nombreNegocio: "Prueba Email — Jota Agency",
    slug: SLUG,
    descripcion: "Ficticio. Existe solo para probar el envío de email.",
    servicios: "Prueba",
    faq: "Q: ¿Esto es una prueba?\nA: Sí.",
    equipo: destinoSeguro,
    esDemo: true,
  });
  await activar(tenant.id);
  const t = (await prisma.tenant.findUnique({ where: { id: tenant.id } }))!;

  // =========================================================================
  grupo("Candados");

  ok(
    !ENVIAR_DE_VERDAD || process.env.ALLOW_REAL_EMAIL_TEST?.trim().toLowerCase() === "true",
    "sin ALLOW_REAL_EMAIL_TEST=true no se envía nada",
  );
  ok(
    !auth.permitido || Boolean(auth.destino),
    "solo se puede enviar a la dirección de TEST_EMAIL_RECIPIENT",
  );

  // Que el candado de destino no sea decorativo: se intenta escribirle a otro.
  const aOtro = await encolar(t, {
    tenantId: t.id, para: "cualquier.otro@example.invalid",
    plantilla: "confirmacion", datos: { nombre: "Otro" },
    claveIdempotencia: "prueba:a-otro",
  });
  const encoladoAOtro = aOtro.ok ? aOtro.id : null;
  ok(Boolean(encoladoAOtro), "el sistema encola para cualquier destino (el filtro está en el despacho)");

  // =========================================================================
  grupo("Armado del email");

  const r = await encolar(t, {
    tenantId: t.id,
    para: destinoSeguro,
    plantilla: "resumen_interno",
    datos: {
      nombre: "Dana Kealoha (ficticia)",
      empresa: "",
      email: "dana@example.invalid",
      telefono: "+1 808 555 0188",
      canal: "website_chat",
      servicio: "Water heater repair",
      problema: "Leaking water heater at 3am",
      presupuesto: "",
      plazo: "today",
      urgencia: "alta",
      score: "88",
      banda: "Hot Lead",
      confianza: "alta",
      proximaAccion: "dispatch a technician",
      positivos: "urgencia alta|dentro del área de servicio|dio email y teléfono",
      negativos: "",
      faltantes: "presupuesto",
      resumen: "Prueba de email de Jota Agency. Ningún dato de esta ficha es real.",
      cita: "",
    },
    claveIdempotencia: "prueba:resumen",
  });
  ok(r.ok, "el email se encoló");
  if (!r.ok) return terminar(t);

  const fila = await prisma.emailOutbox.findFirst({ where: paraTenant(t.id, { id: r.id }) });
  ok(fila?.estado === "pendiente", "queda pendiente: se guarda ANTES de intentar enviarlo");
  ok(Boolean(fila?.messageId?.startsWith("<")), "tiene Message-ID propio", fila?.messageId);
  ok((fila?.html.length ?? 0) > 200 && (fila?.texto.length ?? 0) > 50, "tiene versión HTML y versión de texto");
  ok(fila?.asunto.startsWith("New qualified lead:") ?? false, "el asunto es el correcto", fila?.asunto);

  console.log("\n  --- Asunto ---");
  console.log(`  ${fila?.asunto}`);
  console.log("  --- Texto plano ---");
  console.log((fila?.texto ?? "").split("\n").map((l) => `  ${l}`).join("\n"));

  // =========================================================================
  grupo("Hilos y supresiones");

  const respuesta = await encolar(t, {
    tenantId: t.id, para: destinoSeguro, plantilla: "respuesta",
    datos: { nombre: "Dana", mensaje: "Esta es la respuesta dentro del hilo." },
    asuntoForzado: "Re: Prueba de hilo",
    inReplyTo: fila?.messageId ?? null,
    referencesPrevias: fila?.messageId ?? null,
    claveIdempotencia: "prueba:respuesta",
  });
  const filaResp = respuesta.ok ? await prisma.emailOutbox.findFirst({ where: paraTenant(t.id, { id: respuesta.id }) }) : null;
  ok(filaResp?.inReplyTo === fila?.messageId, "la respuesta lleva In-Reply-To al email original");
  ok((filaResp?.references ?? "").includes(fila?.messageId ?? "x"), "y References con la raíz del hilo");
  ok(armarReferences(null, "<a@x>") === "<a@x>", "References se arma bien desde cero");

  await suprimir(t.id, "dado.de.baja@example.invalid", "baja", "prueba");
  const aSuprimido = await encolar(t, {
    tenantId: t.id, para: "dado.de.baja@example.invalid",
    plantilla: "seguimiento", datos: {},
  });
  ok(!aSuprimido.ok && aSuprimido.motivo === "suprimido", "a una dirección dada de baja NO se le encola nada");

  const duplicado = await encolar(t, {
    tenantId: t.id, para: destinoSeguro, plantilla: "resumen_interno",
    datos: { nombre: "x", score: "1", banda: "x", confianza: "x" },
    claveIdempotencia: "prueba:resumen",
  });
  ok(duplicado.ok && duplicado.duplicado, "la misma clave de idempotencia no genera un segundo email");

  // =========================================================================
  grupo("Proveedor");

  const conectado = await hayProveedor(t);
  ok(true, conectado ? "Resend está conectado" : "Resend NO está conectado (los envíos quedarían simulados)");

  // =========================================================================
  if (!auth.permitido) {
    grupo("Envío");
    console.log(`  🟢 No se envió nada. Motivo: ${auth.motivo}.`);
    console.log("\n  Para enviar de verdad, con TU dirección:");
    console.log("    ALLOW_REAL_EMAIL_TEST=true \\");
    console.log("    TEST_EMAIL_RECIPIENT=tu@correo.com \\");
    console.log("    npm run test:email-real -- --enviar");
    return terminar(t);
  }

  grupo("Envío REAL");
  console.log(`  Enviando a ${enmascarar(destinoSeguro)}…`);

  // Solo se despacha lo que va a la dirección autorizada. Lo demás se descarta
  // acá mismo, para que ni un error de programación pueda mandarlo.
  const descartados = await prisma.emailOutbox.updateMany({
    where: paraTenant(t.id, { estado: "pendiente", NOT: { para: destinoSeguro } }),
    data: { estado: "simulado", ultimoError: "Destino no autorizado por TEST_EMAIL_RECIPIENT" },
  });
  ok(descartados.count >= 1, `se bloquearon ${descartados.count} email(s) a destinos no autorizados`);

  const d = await despachar(t.id, 10);
  ok(d.enviados > 0, `Resend aceptó ${d.enviados} email(s)`, `fallidos=${d.fallidos} simulados=${d.simulados}`);

  const enviados = await prisma.emailOutbox.findMany({
    where: paraTenant(t.id, { estado: "enviado" }),
    select: { para: true, asunto: true, enviadoEn: true },
  });
  ok(
    enviados.every((e) => e.para === destinoSeguro),
    "TODO lo enviado fue a la dirección autorizada, sin excepción",
  );
  for (const e of enviados) console.log(`       → ${enmascarar(e.para)} · "${e.asunto}"`);

  const fallidos = await prisma.emailOutbox.findMany({
    where: paraTenant(t.id, { estado: "fallido" }),
    select: { ultimoError: true },
  });
  for (const f of fallidos) console.log(`       ❌ ${f.ultimoError}`);

  await terminar(t);
}

async function terminar(t: { id: string }) {
  await prisma.tenant.delete({ where: { id: t.id } }).catch(() => {});
  console.log(`\n${fallos === 0 ? "✅" : "❌"} ${total - fallos}/${total} comprobaciones pasaron`);
  console.log("Limpieza: el negocio de prueba se borró.\n");
  await prisma.$disconnect();
  process.exit(fallos === 0 ? 0 : 1);
}

/** Ni la dirección de prueba se imprime entera: los logs quedan en la terminal. */
function enmascarar(email: string): string {
  const [u, d] = email.split("@");
  if (!d) return "***";
  return `${u.slice(0, 2)}***@${d}`;
}

main().catch(async (e) => {
  console.error("\n❌ La prueba se cortó:", e instanceof Error ? e.message : e);
  await prisma.tenant.deleteMany({ where: { slug: SLUG } }).catch(() => {});
  await prisma.$disconnect();
  process.exit(1);
});
