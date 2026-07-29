import Anthropic from "@anthropic-ai/sdk";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { DIAG_PROMPT, DIAG_DEMO, type Idioma } from "@/lib/diagnostico";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Necesitás iniciar sesión." }, { status: 401 });
  }

  let body: { consulta?: string; idioma?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  const consulta = String(body.consulta ?? "").trim();
  const idioma: Idioma = body.idioma === "en" ? "en" : "es";
  if (!consulta) {
    return Response.json({ error: "Contanos sobre tu negocio." }, { status: 400 });
  }

  let resultado: string;
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    // Modo demo: sin clave, devolvemos un diagnóstico de ejemplo (igual guardamos el lead).
    resultado = DIAG_DEMO[idioma];
  } else {
    try {
      const client = new Anthropic({ apiKey });
      const message = await client.messages.create({
        model: "claude-opus-4-8", // para bajar costo en un tool público: "claude-haiku-4-5"
        max_tokens: 1000,
        messages: [{ role: "user", content: DIAG_PROMPT(idioma, consulta) }],
      });
      resultado = message.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim();
      if (!resultado) resultado = DIAG_DEMO[idioma];
    } catch (e) {
      console.error("Fallo al generar el diagnóstico con J", e);
      return Response.json(
        { error: "No pude conectar con J en este momento. Probá de nuevo en unos segundos." },
        { status: 502 },
      );
    }
  }

  try {
    await prisma.diagnostico.create({
      data: { userId: session.user.id, consulta, resultado, idioma },
    });
  } catch (e) {
    console.error("No se pudo guardar el diagnóstico", e);
  }

  return Response.json({ resultado });
}
