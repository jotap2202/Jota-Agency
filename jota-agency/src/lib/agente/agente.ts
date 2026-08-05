import Anthropic from "@anthropic-ai/sdk";
import type { Tenant } from "@prisma/client";
import { ESQUEMA_SALIDA, NOMBRE_HERRAMIENTA, validarSalida } from "./esquema";
import { construirPrompt } from "./prompt";
import type { Fragmento } from "./conocimiento";
import type { Canal, SalidaAgente } from "./tipos";
import { redactar } from "./seguridad";

/**
 * La llamada al modelo.
 *
 * La salida se pide como HERRAMIENTA FORZADA, no como "devolveme un JSON":
 * con `tool_choice` el modelo no puede contestar en prosa aunque quiera, y la
 * API valida el esquema antes de que nos llegue. Igual se revalida acá:
 * el esquema garantiza la forma, no la verdad.
 *
 * Si algo falla —API caída, JSON inválido dos veces, timeout— no se rompe la
 * conversación: se devuelve `ok:false` y el orquestador contesta con el
 * fallback y deriva a una persona. El cliente nunca queda sin respuesta.
 */

export const MODELO = process.env.AGENTE_MODELO?.trim() || "claude-opus-4-8";
const TIMEOUT_MS = 45_000;

export type MensajeHistorial = { rol: "user" | "assistant"; texto: string };

export type PedidoAgente = {
  t: Tenant;
  canal: Canal;
  historial: MensajeHistorial[];
  fragmentos: Fragmento[];
  datosYaConocidos: Record<string, string>;
  /** Todo lo que escribió la persona: se usa para verificar que no invente datos. */
  fuenteTexto: string;
  /** Resultado de una herramienta ya ejecutada, para el segundo turno. */
  resultadoHerramienta?: { herramienta: string; salida: string };
};

export type RespuestaAgente =
  | { ok: true; salida: SalidaAgente; tokens: { entrada: number; salida: number }; descartados: string[] }
  | { ok: false; motivo: "sin_clave" | "api" | "invalido" | "timeout"; detalle: string };

export function hayClaveIa(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}

export async function pensar(p: PedidoAgente): Promise<RespuestaAgente> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) return { ok: false, motivo: "sin_clave", detalle: "ANTHROPIC_API_KEY no configurada" };

  const cliente = new Anthropic({ apiKey, maxRetries: 1 });
  const system = construirPrompt({
    t: p.t,
    canal: p.canal,
    fragmentos: p.fragmentos,
    datosYaConocidos: p.datosYaConocidos,
  });

  const mensajes: Anthropic.MessageParam[] = p.historial.map((m) => ({
    role: m.rol,
    content: m.texto,
  }));

  if (p.resultadoHerramienta) {
    mensajes.push({
      role: "user",
      content:
        `[system note — tool result, not from the customer]\n` +
        `Tool ${p.resultadoHerramienta.herramienta} returned:\n${p.resultadoHerramienta.salida}\n\n` +
        `Reply to the customer using this result. If it says the action failed, do not claim it succeeded.`,
    });
  }

  let ultimoError = "";

  // Dos intentos: si el primero devuelve algo que no pasa la validación, se
  // le dice qué estuvo mal. Un tercer intento no mejora nada y multiplica el
  // costo y la latencia; a partir de ahí conviene el fallback.
  for (let intento = 0; intento < 2; intento++) {
    try {
      const r = await cliente.messages.create(
        {
          model: MODELO,
          max_tokens: 1600,
          system,
          messages:
            intento === 0
              ? mensajes
              : [
                  ...mensajes,
                  {
                    role: "user" as const,
                    content: `[system note] Your previous output was rejected: ${ultimoError}. Call the tool "${NOMBRE_HERRAMIENTA}" again with valid values. Do not invent lead data.`,
                  },
                ],
          tools: [
            {
              name: NOMBRE_HERRAMIENTA,
              description:
                "Reply to the customer and report the structured internal analysis. Must be called exactly once.",
              input_schema: ESQUEMA_SALIDA as Anthropic.Tool.InputSchema,
            },
          ],
          tool_choice: { type: "tool", name: NOMBRE_HERRAMIENTA },
        },
        { timeout: TIMEOUT_MS },
      );

      const bloque = r.content.find((c) => c.type === "tool_use");
      if (!bloque || bloque.type !== "tool_use") {
        ultimoError = "no se llamó a la herramienta";
        continue;
      }

      const validado = validarSalida(bloque.input, p.fuenteTexto, p.t.servicios);
      if (!validado.ok) {
        ultimoError = validado.motivo;
        continue;
      }

      return {
        ok: true,
        salida: validado.salida,
        descartados: validado.descartados,
        tokens: { entrada: r.usage.input_tokens, salida: r.usage.output_tokens },
      };
    } catch (e) {
      const esTimeout = e instanceof Error && /timeout|aborted/i.test(e.message);
      const detalle = redactar(e instanceof Error ? e.message : e, 300);
      // Un timeout no mejora reintentando enseguida: se corta acá.
      if (esTimeout) return { ok: false, motivo: "timeout", detalle };
      ultimoError = detalle;
      if (intento === 1) return { ok: false, motivo: "api", detalle };
    }
  }

  return { ok: false, motivo: "invalido", detalle: ultimoError || "salida inválida dos veces" };
}
