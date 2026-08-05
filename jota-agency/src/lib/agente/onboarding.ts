import type { Tenant } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { tokenNuevo } from "./cripto";
import { sincronizarFuente } from "./conocimiento";
import { normalizarEmail } from "./seguridad";
import { HORARIOS_POR_DEFECTO, type Horarios } from "./tenant";
import * as ev from "./eventos";

/**
 * Workflow 20 — Tenant Onboarding.
 *
 * Sumar un cliente nuevo tiene que ser cargar un formulario, no duplicar
 * workflows. Esta función es lo que hace que el sistema sea un producto y no
 * una instalación a medida por cliente.
 *
 * Arranca SIEMPRE en modo supervisado y con estado `onboarding`: el agente no
 * le contesta a nadie hasta que una persona revisó las pruebas y lo activó.
 */

export type DatosOnboarding = {
  nombreNegocio: string;
  slug?: string;
  descripcion?: string;
  sitioWeb?: string;
  zonaHoraria?: string;
  idioma?: string;
  nombreAgente?: string;
  tono?: string;
  servicios?: string;
  areaServicio?: string;
  reglasPrecio?: string;
  politicas?: string;
  faq?: string;
  horarios?: Horarios;
  /** Emails del equipo que recibe avisos, separados por coma o salto de línea. */
  equipo?: string;
  secuenciaHoras?: number[];
  esDemo?: boolean;
  ajustes?: Record<string, unknown>;
};

export type ResultadoOnboarding = {
  tenant: Tenant;
  fuentes: number;
  fragmentos: number;
  miembros: number;
  /** Lo que falta para poder activarlo. Si está vacío, se puede activar. */
  pendientes: string[];
};

export async function crearTenant(d: DatosOnboarding): Promise<ResultadoOnboarding> {
  const correlationId = ev.nuevaCorrelacion();
  const slug = (d.slug ?? d.nombreNegocio)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);

  const tenant = await prisma.tenant.create({
    data: {
      slug: await slugLibre(slug),
      clavePublica: tokenNuevo("pk"),
      secretoWebhook: tokenNuevo("whs"),
      nombreNegocio: d.nombreNegocio.trim().slice(0, 200),
      descripcion: d.descripcion?.trim() || null,
      sitioWeb: d.sitioWeb?.trim() || null,
      zonaHoraria: d.zonaHoraria || "Pacific/Honolulu",
      idioma: d.idioma || "en",
      nombreAgente: d.nombreAgente?.trim() || "Ava",
      tono: d.tono || "profesional",
      servicios: d.servicios ?? "",
      areaServicio: d.areaServicio ?? null,
      reglasPrecio: d.reglasPrecio ?? "",
      politicas: d.politicas ?? "",
      horarios: (d.horarios ?? HORARIOS_POR_DEFECTO) as object,
      secuenciaHoras: d.secuenciaHoras ?? [24, 72, 168],
      // No se activa solo. Nunca.
      estado: "onboarding",
      modo: "supervisado",
      esDemo: d.esDemo ?? false,
      ajustes: (d.ajustes ?? {}) as object,
    },
  });

  // --- Equipo ---
  const emails = (d.equipo ?? "")
    .split(/[,\n]/)
    .map((e) => normalizarEmail(e))
    .filter((e): e is string => Boolean(e));
  for (const email of [...new Set(emails)]) {
    await prisma.tenantMember.create({
      data: { tenantId: tenant.id, nombre: email.split("@")[0], email, rol: "owner", recibeAvisos: true },
    }).catch(() => {});
  }

  // --- Conocimiento inicial: lo que el negocio ya cargó en el formulario ---
  const fuentes: { tipo: string; titulo: string; contenido: string }[] = [];
  if (d.servicios?.trim()) fuentes.push({ tipo: "servicios", titulo: "Services", contenido: d.servicios });
  if (d.reglasPrecio?.trim()) fuentes.push({ tipo: "precios", titulo: "Pricing", contenido: d.reglasPrecio });
  if (d.politicas?.trim()) fuentes.push({ tipo: "politicas", titulo: "Policies", contenido: d.politicas });
  if (d.faq?.trim()) fuentes.push({ tipo: "faq", titulo: "FAQ", contenido: d.faq });
  if (d.descripcion?.trim()) {
    fuentes.push({
      tipo: "manual",
      titulo: `About ${tenant.nombreNegocio}`,
      contenido: [d.descripcion, d.areaServicio ? `Service area: ${d.areaServicio}` : ""].filter(Boolean).join("\n\n"),
    });
  }

  let fragmentos = 0;
  for (const f of fuentes) {
    const fuente = await prisma.knowledgeSource.create({
      data: { tenantId: tenant.id, tipo: f.tipo, titulo: f.titulo, contenido: f.contenido },
    });
    const r = await sincronizarFuente(tenant.id, fuente.id, correlationId);
    fragmentos += r.fragmentos;
  }

  await ev.ok({ tenantId: tenant.id, workflow: "20-onboarding", correlationId, referencia: tenant.id });
  await ev.auditar({
    tenantId: tenant.id, actorTipo: "humano", accion: "tenant.creado",
    entidad: "Tenant", entidadId: tenant.id,
  });

  return {
    tenant,
    fuentes: fuentes.length,
    fragmentos,
    miembros: emails.length,
    pendientes: await pendientesParaActivar(tenant.id),
  };
}

/**
 * Qué falta para poder activar. El botón "Activar" del panel usa esto: si hay
 * pendientes, no se activa. Un agente sin conocimiento y sin nadie a quien
 * avisarle no es un agente, es un contestador que dice "no sé".
 */
export async function pendientesParaActivar(tenantId: string): Promise<string[]> {
  const [t, fragmentos, miembros] = await Promise.all([
    prisma.tenant.findUnique({ where: { id: tenantId } }),
    prisma.knowledgeChunk.count({ where: { tenantId } }),
    prisma.tenantMember.count({ where: { tenantId, recibeAvisos: true } }),
  ]);
  const faltan: string[] = [];
  if (!t) return ["El negocio no existe"];
  if (!t.servicios.trim()) faltan.push("Cargar los servicios que ofrece el negocio");
  if (fragmentos === 0) faltan.push("Cargar al menos una fuente de conocimiento");
  if (miembros === 0) faltan.push("Agregar al menos una persona que reciba los avisos");
  if (!t.horarios) faltan.push("Definir los horarios de atención");
  return faltan;
}

export async function activar(tenantId: string): Promise<{ ok: boolean; pendientes: string[] }> {
  const pendientes = await pendientesParaActivar(tenantId);
  if (pendientes.length > 0) return { ok: false, pendientes };
  await prisma.tenant.update({ where: { id: tenantId }, data: { estado: "activo" } });
  await ev.auditar({ tenantId, actorTipo: "humano", accion: "tenant.activado", entidad: "Tenant", entidadId: tenantId });
  return { ok: true, pendientes: [] };
}

async function slugLibre(base: string): Promise<string> {
  const raiz = base || "negocio";
  for (let i = 0; i < 50; i++) {
    const intento = i === 0 ? raiz : `${raiz}-${i + 1}`;
    const ya = await prisma.tenant.findUnique({ where: { slug: intento }, select: { id: true } });
    if (!ya) return intento;
  }
  return `${raiz}-${Date.now().toString(36)}`;
}
