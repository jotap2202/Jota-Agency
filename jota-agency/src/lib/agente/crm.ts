import type { Tenant } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { paraTenant, integracion } from "./tenant";
import { firmar } from "./cripto";
import { redactar } from "./seguridad";
import * as ev from "./eventos";

/**
 * Workflow 08 — CRM Sync.
 *
 * Hay dos CRMs posibles y no compiten:
 *
 *  · El interno: las tablas Lead/Contact de esta misma base. Siempre está y
 *    es el que ve el panel. Para la mayoría de los clientes alcanza.
 *  · El externo: cualquier CRM, vía webhook firmado. Ahí es donde entra n8n
 *    si un cliente tiene un CRM raro: se engancha a este webhook y hace la
 *    traducción, sin tocar el núcleo.
 *
 * Además, si el tenant es la propia Jota Agency, un lead calificado se copia
 * al pipeline de Prospecto del CEO Command Center. El agente deja de ser una
 * caja aparte y alimenta el panel que ya se usa todos los días.
 */

export async function sincronizar(t: Tenant, leadId: string): Promise<{ externo: boolean; interno: boolean }> {
  const correlationId = ev.nuevaCorrelacion();
  const lead = await prisma.lead.findFirst({
    where: paraTenant(t.id, { id: leadId }),
    include: { contacto: true, conversacion: { select: { canal: true } } },
  });
  if (!lead) return { externo: false, interno: false };

  const payload = {
    tenant: t.slug,
    lead_id: lead.id,
    name: [lead.contacto.nombre, lead.contacto.apellido].filter(Boolean).join(" ") || null,
    email: lead.contacto.email,
    phone: lead.contacto.telefono,
    company: lead.contacto.empresa,
    channel: lead.conversacion?.canal ?? null,
    service: lead.servicio,
    problem: lead.problema,
    budget_cents: lead.presupuesto,
    timeline: lead.plazo,
    location: lead.ubicacion,
    score: lead.score,
    score_confidence: lead.confianza,
    status: lead.estado,
    next_action: lead.proximaAccion,
    created_at: lead.createdAt.toISOString(),
  };

  let externo = false;
  const integ = await integracion(t.id, "crm_webhook");
  const url = typeof integ?.config.url === "string" ? integ.config.url : null;
  if (url && integ?.secreto) {
    try {
      const cuerpo = JSON.stringify(payload);
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // El receptor verifica esta firma: sin ella, cualquiera que sepa la
          // URL puede meterle leads falsos al CRM del cliente.
          "X-Jota-Signature": `sha256=${firmar(cuerpo, integ.secreto)}`,
          "X-Jota-Event": "lead.upserted",
        },
        body: cuerpo,
      });
      if (!res.ok) throw new Error(`crm ${res.status}`);
      externo = true;
      await ev.ok({ tenantId: t.id, workflow: "08-crm-sync", correlationId, referencia: leadId });
    } catch (e) {
      await ev.fallo({ tenantId: t.id, workflow: "08-crm-sync", correlationId, referencia: leadId, error: e });
    }
  }

  const interno = await alPipelineDeJota(t, lead).catch((e) => {
    console.error("[crm] pipeline interno", redactar(e));
    return false;
  });

  return { externo, interno };
}

/**
 * Copia el lead al pipeline de Prospecto del CEO Command Center.
 * Solo para el tenant de Jota Agency, y solo si está calificado: el panel del
 * CEO no es un buzón, es la lista de a quién hay que ir a buscar.
 */
async function alPipelineDeJota(t: Tenant, lead: {
  id: string; servicio: string | null; score: number; estado: string; problema: string | null;
  ubicacion: string | null; presupuesto: number | null;
  contacto: { nombre: string | null; apellido: string | null; email: string | null; telefono: string | null; empresa: string | null };
}): Promise<boolean> {
  const ajustes = (t.ajustes as Record<string, unknown> | null) ?? {};
  if (ajustes.crmInterno !== true) return false;
  if (lead.score < t.umbralAviso) return false;

  const empresa = lead.contacto.empresa
    ?? [lead.contacto.nombre, lead.contacto.apellido].filter(Boolean).join(" ")
    ?? null;
  if (!empresa) return false;

  const ya = await prisma.prospecto.findFirst({
    where: { OR: [{ email: lead.contacto.email ?? "___" }, { empresa }] },
    select: { id: true },
  });
  const datos = {
    empresa,
    rubro: lead.servicio ?? "Consulta 24/7",
    ciudad: lead.ubicacion,
    telefono: lead.contacto.telefono,
    contacto: [lead.contacto.nombre, lead.contacto.apellido].filter(Boolean).join(" ") || null,
    email: lead.contacto.email,
    fuente: "Agente IA 24/7",
    servicioInteres: lead.servicio,
    notas: lead.problema,
    score: lead.score,
    valorEstimado: lead.presupuesto ?? 0,
    esDemo: t.esDemo,
  };

  if (ya) {
    await prisma.prospecto.update({ where: { id: ya.id }, data: { score: datos.score, notas: datos.notas } });
    return false;
  }
  await prisma.prospecto.create({ data: { ...datos, estado: "contactado" } });
  await ev.auditar({
    tenantId: t.id, actorTipo: "sistema", accion: "crm.prospecto_creado",
    entidad: "Lead", entidadId: lead.id,
  });
  return true;
}
