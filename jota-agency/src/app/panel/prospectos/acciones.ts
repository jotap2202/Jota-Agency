"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { esAdmin } from "@/lib/admin";
import { LISTAS_INVESTIGADAS } from "@/lib/prospectos-listas";
import { esEstado } from "@/lib/prospecto-estados";
import { ciclo, configDesdeEnv } from "@/lib/agente/prospeccion";
import { crearTenant } from "@/lib/agente/onboarding";
import { datosNegocioJota, SLUG_JOTA } from "@/lib/agente/negocio-jota";

/**
 * Cada server action es un endpoint HTTP público: que la página /panel esté
 * gateada NO protege a estas funciones. Cualquiera que sepa el ID de la
 * action podría invocarla. Por eso se revalida el permiso acá adentro, en
 * todas, sin excepción.
 */
async function exigirAdmin() {
  const session = await auth();
  if (!session?.user || !(await esAdmin(session.user.email))) {
    throw new Error("No autorizado");
  }
}

const texto = (v: FormDataEntryValue | null, max: number) =>
  String(v ?? "").trim().slice(0, max) || null;

export async function cambiarEstado(id: string, estado: string) {
  await exigirAdmin();
  if (!esEstado(estado)) throw new Error("Estado inválido");
  await prisma.prospecto.update({ where: { id }, data: { estado } });
  revalidatePath("/panel/prospectos");
}

export async function guardarNota(id: string, notas: string) {
  await exigirAdmin();
  await prisma.prospecto.update({
    where: { id },
    data: { notas: notas.trim().slice(0, 4000) || null },
  });
  revalidatePath("/panel/prospectos");
}

export async function guardarProximoContacto(id: string, fecha: string) {
  await exigirAdmin();
  // El input date manda "" cuando lo vaciás: eso significa "sin seguimiento".
  const d = fecha ? new Date(`${fecha}T12:00:00`) : null;
  if (d && Number.isNaN(d.getTime())) throw new Error("Fecha inválida");
  await prisma.prospecto.update({ where: { id }, data: { proximoContacto: d } });
  revalidatePath("/panel/prospectos");
}

export async function agregarProspecto(formData: FormData) {
  await exigirAdmin();
  const empresa = texto(formData.get("empresa"), 160);
  if (!empresa) throw new Error("Falta el nombre de la empresa");

  await prisma.prospecto.create({
    data: {
      empresa,
      rubro: texto(formData.get("rubro"), 80) ?? "Sin rubro",
      ciudad: texto(formData.get("ciudad"), 80),
      web: texto(formData.get("web"), 300),
      email: texto(formData.get("email"), 160),
      telefono: texto(formData.get("telefono"), 60),
      contacto: texto(formData.get("contacto"), 120),
      fuente: texto(formData.get("fuente"), 160) ?? "Carga manual",
    },
  });
  revalidatePath("/panel/prospectos");
}

export async function borrarProspecto(id: string) {
  await exigirAdmin();
  await prisma.prospecto.delete({ where: { id } });
  revalidatePath("/panel/prospectos");
}

/**
 * Carga las listas investigadas (Maui + Hawái alto ticket). Se puede apretar
 * más de una vez sin miedo: salta las empresas que ya existen (comparando por
 * nombre), así que no duplica ni pisa las notas o el estado que ya hayas
 * cargado.
 */
export async function importarMaui() {
  await exigirAdmin();

  const yaEstan = new Set(
    (await prisma.prospecto.findMany({ select: { empresa: true } })).map((p) =>
      p.empresa.trim().toLowerCase(),
    ),
  );

  const nuevos = LISTAS_INVESTIGADAS.filter(
    (p) => !yaEstan.has(p.empresa.trim().toLowerCase()),
  ).map((p) => ({
    empresa: p.empresa,
    rubro: p.rubro,
    ciudad: p.ciudad,
    web: p.web,
    telefono: p.telefono ?? null,
    fuente: p.fuente,
  }));

  if (nuevos.length) await prisma.prospecto.createMany({ data: nuevos });
  revalidatePath("/panel/prospectos");
}

// ---------------------------------------------------------------------------
//  Prospección automática (workflow 21)
// ---------------------------------------------------------------------------

/** Aprueba un borrador, con las correcciones que se le hayan hecho. */
export async function aprobarBorrador(formData: FormData) {
  await exigirAdmin();
  const id = texto(formData.get("id"), 40);
  const asunto = texto(formData.get("asunto"), 80);
  const cuerpo = texto(formData.get("cuerpo"), 3000);
  if (!id || !asunto || !cuerpo) throw new Error("Falta el asunto o el texto");
  // Solo se aprueban los que todavía no salieron: aprobar dos veces no manda dos.
  await prisma.prospecto.updateMany({
    where: { id, secuenciaPaso: 0 },
    data: { borradorAsunto: asunto, borradorTexto: cuerpo, borradorAprobado: true },
  });
  revalidatePath("/panel/prospectos");
}

export async function aprobarTodos() {
  await exigirAdmin();
  await prisma.prospecto.updateMany({
    where: { estado: "nuevo", secuenciaPaso: 0, borradorTexto: { not: null }, borradorAprobado: false },
    data: { borradorAprobado: true },
  });
  revalidatePath("/panel/prospectos");
}

/** "No le escribas": el prospecto pasa a descartado y no se vuelve a redactar. */
export async function descartarBorrador(formData: FormData) {
  await exigirAdmin();
  const id = texto(formData.get("id"), 40);
  if (!id) return;
  await prisma.prospecto.updateMany({
    where: { id, secuenciaPaso: 0 },
    data: { estado: "descartado", borradorAprobado: false },
  });
  revalidatePath("/panel/prospectos");
}

/**
 * Corre una pasada ya, sin esperar al cron. Respeta el horario y el tope.
 * Con menos reloj que el cron: es un clic, no puede colgar la página.
 */
export async function correrProspeccion() {
  await exigirAdmin();
  await ciclo(new Date(), 40_000);
  revalidatePath("/panel/prospectos");
}

/**
 * Auditoría de tiempo de respuesta. Se marca con un botón en el momento en que
 * pasa ("mandé la consulta", "contestaron"), para que la hora sea la real y no
 * una que haya que tipear después de memoria.
 */
export async function marcarAuditoria(id: string, que: "enviada" | "respuesta" | "borrar") {
  await exigirAdmin();
  const ahora = new Date();
  const data =
    que === "enviada"
      ? { auditoriaEnviada: ahora, auditoriaRespuesta: null }
      : que === "respuesta"
        ? { auditoriaRespuesta: ahora }
        : { auditoriaEnviada: null, auditoriaRespuesta: null };
  // Si ya había un borrador sin el dato, se descarta para rehacerlo con él.
  await prisma.prospecto.updateMany({
    where: { id, secuenciaPaso: 0 },
    data: { ...data, ...(que !== "borrar" ? { borradorTexto: null, borradorAsunto: null, borradorAprobado: false } : {}) },
  });
  revalidatePath("/panel/prospectos");
}

/**
 * Crea el negocio de JOTA en el agente con la oferta del kit de ventas.
 * Queda en `onboarding`: hay que revisarlo y activarlo en /ceo/agent/businesses.
 */
export async function crearNegocioJota() {
  await exigirAdmin();
  const session = await auth();
  const slug = configDesdeEnv().tenantSlug ?? SLUG_JOTA;
  const ya = await prisma.tenant.findUnique({ where: { slug } });
  if (!ya) {
    await crearTenant({ ...datosNegocioJota(), slug, equipo: session?.user?.email ?? "" });
  }
  revalidatePath("/panel/prospectos");
}
