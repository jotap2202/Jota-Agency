import Anthropic from "@anthropic-ai/sdk";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { DIAG_PROMPT, DIAG_DEMO, type Idioma } from "@/lib/diagnostico";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Guarda el lead sin romper la respuesta si la base falla. */
async function guardar(userId: string, consulta: string, resultado: string, idioma: Idioma) {
  try {
    await prisma.diagnostico.create({ data: { userId, consulta, resultado, idioma } });
  } catch (e) {
    console.error("No se pudo guardar el diagnóstico", e);
  }
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Necesitás iniciar sesión." }, { status: 401 });
  }
  const userId = session.user.id;

  let body: { consulta?: string; idioma?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  const consulta = String(body.consulta ?? "").trim().slice(0, 4000);
  const idioma: Idioma = body.idioma === "en" ? "en" : "es";
  if (!consulta) {
    return Response.json({ error: "Contanos sobre tu negocio." }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const apiKey = process.env.ANTHROPIC_API_KEY;

  // ---- Sin clave: modo demo. Se marca con una cabecera para que la UI lo avise. ----
  if (!apiKey) {
    const texto = DIAG_DEMO[idioma];
    await guardar(userId, consulta, texto, idioma);
    return new Response(texto, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "X-Diagnostico-Modo": "demo",
        "Cache-Control": "no-store",
      },
    });
  }

  // ---- Con clave: J genera el diagnóstico en vivo, en streaming ----
  const client = new Anthropic({ apiKey });

  const stream = client.messages.stream({
    model: "claude-opus-4-8",
    max_tokens: 1200,
    messages: [{ role: "user", content: DIAG_PROMPT(idioma, consulta) }],
  });

  const salida = new ReadableStream<Uint8Array>({
    async start(controller) {
      let completo = "";
      try {
        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            completo += event.delta.text;
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
      } catch (e) {
        console.error("Fallo al generar el diagnóstico con J", e);
        if (!completo) {
          controller.enqueue(
            encoder.encode(
              idioma === "en"
                ? "I couldn't reach J right now. Please try again in a few seconds."
                : "No pude conectar con J en este momento. Probá de nuevo en unos segundos.",
            ),
          );
        }
      } finally {
        controller.close();
        if (completo.trim()) await guardar(userId, consulta, completo.trim(), idioma);
      }
    },
    cancel() {
      stream.abort();
    },
  });

  return new Response(salida, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Diagnostico-Modo": "live",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    },
  });
}
