"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { esAdmin } from "@/lib/admin";
import { PROSPECTOS_MAUI, FUENTE_MAUI } from "@/lib/prospectos-maui";
import { esEstado } from "@/lib/prospecto-estados";

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
 * Carga la lista inicial de Maui. Se puede apretar más de una vez sin
 * miedo: salta las empresas que ya existen (comparando por nombre), así que
 * no duplica ni pisa las notas o el estado que ya hayas cargado.
 */
export async function importarMaui() {
  await exigirAdmin();

  const yaEstan = new Set(
    (await prisma.prospecto.findMany({ select: { empresa: true } })).map((p) =>
      p.empresa.trim().toLowerCase(),
    ),
  );

  const nuevos = PROSPECTOS_MAUI.filter(
    (p) => !yaEstan.has(p.empresa.trim().toLowerCase()),
  ).map((p) => ({
    empresa: p.empresa,
    rubro: p.rubro,
    ciudad: p.ciudad,
    web: p.web,
    telefono: p.telefono ?? null,
    fuente: FUENTE_MAUI,
  }));

  if (nuevos.length) await prisma.prospecto.createMany({ data: nuevos });
  revalidatePath("/panel/prospectos");
}
