"use server";

import { reservarLlamada, tenantDeJota, validarReserva } from "@/lib/agente/reserva";

export type EstadoReserva =
  | { estado: "inicial" }
  | { estado: "ok"; cuando: string }
  | { estado: "error"; motivo: string };

/**
 * Pública a propósito: es la reserva de la web. Todo lo que protege a la
 * agenda (honeypot, topes, hueco libre) está en lib/agente/reserva.ts.
 */
export async function reservar(_previo: EstadoReserva, fd: FormData): Promise<EstadoReserva> {
  const t = await tenantDeJota();
  if (!t) return { estado: "error", motivo: "cerrado" };

  const datos = validarReserva(Object.fromEntries(fd.entries()));
  if ("error" in datos) {
    // Al bot se le dice que salió bien: así no aprende a esquivar la trampa.
    if (datos.error === "bot") return { estado: "ok", cuando: "" };
    return { estado: "error", motivo: datos.error };
  }

  const r = await reservarLlamada(t, datos);
  return r.ok ? { estado: "ok", cuando: r.cuando } : { estado: "error", motivo: r.motivo };
}
