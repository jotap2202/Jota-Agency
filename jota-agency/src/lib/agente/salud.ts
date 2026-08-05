import { prisma } from "@/lib/prisma";
import { paraTenant } from "./tenant";
import { hayClaveIa } from "./agente";
import { hayClaveMaestra } from "./cripto";
import { hayProveedor } from "./email";
import { fuentesDesactualizadas } from "./conocimiento";
import { estadoAdmin } from "@/lib/admin";

/**
 * Workflow 19 — Health Check.
 *
 * Comprueba lo que hace falta para que el agente funcione, y dice claramente
 * qué está roto y qué consecuencia tiene. Un panel que dice "todo OK" cuando
 * el proveedor de email no está conectado es peor que no tener panel.
 */

export type Chequeo = {
  clave: string;
  titulo: string;
  estado: "ok" | "atencion" | "roto";
  detalle: string;
  /** Qué deja de funcionar si está mal. */
  consecuencia?: string;
};

export async function revisar(tenantId: string): Promise<{ estado: "ok" | "atencion" | "roto"; chequeos: Chequeo[] }> {
  const t = await prisma.tenant.findUnique({ where: { id: tenantId } });
  const chequeos: Chequeo[] = [];

  if (!t) {
    return { estado: "roto", chequeos: [{ clave: "tenant", titulo: "Negocio", estado: "roto", detalle: "No existe" }] };
  }

  // --- Modelo ---
  chequeos.push(
    hayClaveIa()
      ? { clave: "ia", titulo: "Modelo de IA", estado: "ok", detalle: "ANTHROPIC_API_KEY configurada" }
      : {
          clave: "ia", titulo: "Modelo de IA", estado: "roto",
          detalle: "Falta ANTHROPIC_API_KEY",
          consecuencia: "El agente no responde: toda consulta se deriva al equipo.",
        },
  );

  // --- Control de acceso al panel ---
  const admin = estadoAdmin();
  chequeos.push(
    admin.ok
      ? {
          clave: "admin", titulo: "Acceso al panel", estado: "ok",
          detalle: admin.detalle,
        }
      : {
          clave: "admin", titulo: "Acceso al panel", estado: "roto",
          detalle: admin.detalle,
          consecuencia: "Nadie puede entrar al panel hasta configurar ADMIN_EMAILS.",
        },
  );

  // --- Cifrado ---
  chequeos.push(
    hayClaveMaestra()
      ? { clave: "cripto", titulo: "Cifrado de credenciales", estado: "ok", detalle: "APP_ENCRYPTION_KEY configurada" }
      : {
          clave: "cripto", titulo: "Cifrado de credenciales", estado: "atencion",
          detalle: "Falta APP_ENCRYPTION_KEY",
          consecuencia: "No se pueden guardar credenciales de Gmail, Calendar, Slack ni CRM.",
        },
  );

  // --- Email ---
  const email = await hayProveedor(t);
  chequeos.push(
    email
      ? { clave: "email", titulo: "Envío de email", estado: "ok", detalle: "Proveedor conectado" }
      : {
          clave: "email", titulo: "Envío de email", estado: "atencion",
          detalle: "Sin proveedor conectado",
          consecuencia: "Los emails quedan en la bandeja de salida marcados como simulados, no salen.",
        },
  );

  // --- Base de conocimiento ---
  const [fragmentos, viejas] = await Promise.all([
    prisma.knowledgeChunk.count({ where: paraTenant(tenantId) }),
    fuentesDesactualizadas(tenantId, 60),
  ]);
  chequeos.push(
    fragmentos === 0
      ? {
          clave: "kb", titulo: "Base de conocimiento", estado: "roto",
          detalle: "No hay contenido cargado",
          consecuencia: "El agente no puede responder nada específico del negocio.",
        }
      : viejas.length > 0
        ? {
            clave: "kb", titulo: "Base de conocimiento", estado: "atencion",
            detalle: `${fragmentos} fragmentos · ${viejas.length} fuente(s) sin actualizar hace más de 60 días`,
          }
        : { clave: "kb", titulo: "Base de conocimiento", estado: "ok", detalle: `${fragmentos} fragmentos indexados` },
  );

  // --- Equipo ---
  const equipo = await prisma.tenantMember.count({ where: paraTenant(tenantId, { recibeAvisos: true }) });
  chequeos.push(
    equipo > 0
      ? { clave: "equipo", titulo: "Destinatarios de avisos", estado: "ok", detalle: `${equipo} persona(s)` }
      : {
          clave: "equipo", titulo: "Destinatarios de avisos", estado: "roto",
          detalle: "Nadie recibe los avisos",
          consecuencia: "Un hot lead a las 3am no le llega a ninguna persona.",
        },
  );

  // --- Cola de errores ---
  const dlq = await prisma.workflowEvent.count({
    where: paraTenant(tenantId, { tipo: "dlq", createdAt: { gte: new Date(Date.now() - 7 * 86_400_000) } }),
  });
  chequeos.push(
    dlq === 0
      ? { clave: "dlq", titulo: "Errores sin recuperar", estado: "ok", detalle: "Ninguno en 7 días" }
      : {
          clave: "dlq", titulo: "Errores sin recuperar", estado: "atencion",
          detalle: `${dlq} en los últimos 7 días`,
          consecuencia: "Son consultas o acciones que necesitan una persona.",
        },
  );

  // --- Consultas sin responder dentro del SLA ---
  const atrasadas = await prisma.message.count({
    where: paraTenant(tenantId, {
      direccion: "entrante", estadoFinal: null,
      createdAt: { lt: new Date(Date.now() - t.slaRespuestaMin * 60_000) },
    }),
  });
  chequeos.push(
    atrasadas === 0
      ? { clave: "sla", titulo: "Consultas dentro del SLA", estado: "ok", detalle: `Ninguna atrasada (SLA ${t.slaRespuestaMin} min)` }
      : {
          clave: "sla", titulo: "Consultas dentro del SLA", estado: "roto",
          detalle: `${atrasadas} sin resolver hace más de ${t.slaRespuestaMin} min`,
          consecuencia: "Es exactamente lo que el servicio promete que no pasa.",
        },
  );

  // --- Integraciones en error ---
  const rotas = await prisma.tenantIntegration.findMany({
    where: paraTenant(tenantId, { estado: "error" }),
    select: { tipo: true, ultimoError: true },
  });
  if (rotas.length > 0) {
    chequeos.push({
      clave: "integraciones", titulo: "Integraciones", estado: "roto",
      detalle: rotas.map((r) => `${r.tipo}: ${r.ultimoError ?? "error"}`).join(" · "),
      consecuencia: "Puede ser una credencial vencida.",
    });
  }

  const estado = chequeos.some((c) => c.estado === "roto")
    ? "roto"
    : chequeos.some((c) => c.estado === "atencion")
      ? "atencion"
      : "ok";

  return { estado, chequeos };
}
