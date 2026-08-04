import { tenantPorClave } from "@/lib/agente/tenant";
import { canalHabilitado } from "@/lib/agente/tenant";
import { desdeChat } from "@/lib/agente/normalizar";
import { procesar } from "@/lib/agente/orquestador";
import { limitar } from "@/lib/rate-limit";
import { redactar } from "@/lib/agente/seguridad";

/**
 * Workflow 02 — Website Chat Intake.
 *
 * Endpoint público: lo llama el widget desde el sitio del cliente, así que
 * necesita CORS abierto. Lo que lo protege no es el origen —cualquiera puede
 * falsificarlo— sino que solo permite CREAR mensajes en un tenant, nunca leer
 * nada, más rate limit por clave y por IP.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

function json(cuerpo: unknown, status = 200) {
  return Response.json(cuerpo, { status, headers: { ...CORS, "Cache-Control": "no-store" } });
}

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return json({ error: "Cuerpo inválido" }, 400);
  }

  const clave = String(body.clave ?? body.key ?? "").trim();
  if (!clave) return json({ error: "Falta la clave pública" }, 400);

  // El límite por IP frena a un visitante que se pone pesado; el límite por
  // clave frena a alguien que quiere quemarle los tokens al cliente.
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "sin-ip";
  const porIp = limitar(`agente:ip:${ip}`, 20, 60_000);
  if (!porIp.permitido) {
    return json({ error: "Demasiados mensajes seguidos. Esperá un momento." }, 429);
  }
  const porClave = limitar(`agente:clave:${clave}`, 240, 60_000);
  if (!porClave.permitido) {
    return json({ error: "El agente está recibiendo demasiadas consultas. Probá en un minuto." }, 429);
  }

  const t = await tenantPorClave(clave);
  if (!t) return json({ error: "Agente no disponible" }, 404);
  if (t.estado !== "activo") {
    return json({ error: "El agente todavía no está activo para este negocio" }, 409);
  }
  if (!canalHabilitado(t, "website_chat")) {
    return json({ error: "El chat no está habilitado para este negocio" }, 409);
  }

  const consulta = desdeChat(t.id, body);
  if ("error" in consulta) return json({ error: consulta.error }, 400);

  try {
    const r = await procesar(t, consulta);
    return json({
      ok: r.ok,
      sesion: consulta.hiloExterno,
      respuesta: r.respuesta,
      estado: r.estadoFinal,
      esperaAprobacion: r.requiereAprobacion,
      agente: t.nombreAgente,
    });
  } catch (e) {
    // La consulta ya está guardada: el workflow de recuperación la levanta.
    console.error("[agente/chat]", redactar(e));
    return json(
      {
        ok: false,
        respuesta: `Thanks for reaching out to ${t.nombreNegocio}. Someone from the team will get back to you shortly.`,
        estado: "error",
      },
      200,
    );
  }
}
