import { tenantPorClave, canalHabilitado } from "@/lib/agente/tenant";
import { desdeFormulario } from "@/lib/agente/normalizar";
import { procesar } from "@/lib/agente/orquestador";
import { limitar } from "@/lib/rate-limit";
import { redactar } from "@/lib/agente/seguridad";

/**
 * Workflow 03 — Website Form Intake.
 *
 * Formularios de contacto y pedidos de presupuesto. Acepta JSON y también
 * `application/x-www-form-urlencoded`, para que un formulario HTML común
 * pueda apuntar acá sin JavaScript.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function POST(req: Request) {
  const tipo = req.headers.get("content-type") ?? "";
  let body: Record<string, unknown>;
  try {
    if (tipo.includes("application/json")) {
      body = (await req.json()) as Record<string, unknown>;
    } else {
      body = Object.fromEntries(await req.formData()) as Record<string, unknown>;
    }
  } catch {
    return Response.json({ error: "Cuerpo inválido" }, { status: 400, headers: CORS });
  }

  // Honeypot: un campo invisible que sólo completan los bots. Si viene lleno,
  // se responde 200 para que el bot crea que funcionó y no reintente.
  if (String(body._empresa_web ?? body.website ?? "").trim()) {
    return Response.json({ ok: true }, { headers: CORS });
  }

  const clave = String(body.clave ?? body.key ?? "").trim();
  if (!clave) return Response.json({ error: "Falta la clave pública" }, { status: 400, headers: CORS });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "sin-ip";
  if (!limitar(`agente:form:${ip}`, 6, 10 * 60_000).permitido) {
    return Response.json({ error: "Demasiados envíos. Probá en unos minutos." }, { status: 429, headers: CORS });
  }

  const t = await tenantPorClave(clave);
  if (!t || t.estado !== "activo") {
    return Response.json({ error: "Formulario no disponible" }, { status: 404, headers: CORS });
  }
  if (!canalHabilitado(t, "web_form")) {
    return Response.json({ error: "Los formularios no están habilitados" }, { status: 409, headers: CORS });
  }

  const consulta = desdeFormulario(t.id, body);
  if ("error" in consulta) {
    return Response.json({ error: consulta.error }, { status: 400, headers: CORS });
  }

  try {
    const r = await procesar(t, consulta);
    return Response.json(
      { ok: r.ok, estado: r.estadoFinal, respuesta: r.respuesta },
      { headers: { ...CORS, "Cache-Control": "no-store" } },
    );
  } catch (e) {
    console.error("[agente/form]", redactar(e));
    // El formulario ya quedó guardado: para el visitante, se envió.
    return Response.json({ ok: true, estado: "error" }, { headers: CORS });
  }
}
