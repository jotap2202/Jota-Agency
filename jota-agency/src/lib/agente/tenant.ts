import type { Tenant } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { descifrar } from "./cripto";
import type { Canal, ModoOperacion } from "./tipos";

/**
 * Workflow 01 — Tenant Configuration Loader.
 *
 * Todo lo que el agente sabe del negocio sale de acá. Si un dato no está en
 * la configuración del tenant, el agente no lo tiene: no lo deduce ni lo
 * inventa.
 */

export type Horario = [string, string]; // ["09:00", "17:00"]
export type Horarios = Record<string, Horario[]>;

export const DIAS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
export type Dia = (typeof DIAS)[number];

export const HORARIOS_POR_DEFECTO: Horarios = {
  mon: [["09:00", "17:00"]],
  tue: [["09:00", "17:00"]],
  wed: [["09:00", "17:00"]],
  thu: [["09:00", "17:00"]],
  fri: [["09:00", "17:00"]],
};

// ---------------------------------------------------------------------------
//  Carga
// ---------------------------------------------------------------------------

export async function cargarTenant(id: string): Promise<Tenant | null> {
  return prisma.tenant.findUnique({ where: { id } });
}

/** Por clave pública: es como se identifica el widget del sitio del cliente. */
export async function tenantPorClave(clave: string): Promise<Tenant | null> {
  const c = clave?.trim();
  if (!c) return null;
  const t = await prisma.tenant.findUnique({ where: { clavePublica: c } });
  return t && t.estado !== "pausado" ? t : null;
}

export async function tenantPorSlug(slug: string): Promise<Tenant | null> {
  return prisma.tenant.findUnique({ where: { slug: slug.trim().toLowerCase() } });
}

// ---------------------------------------------------------------------------
//  Aislamiento
// ---------------------------------------------------------------------------

/**
 * La única puerta a los datos del agente.
 *
 * Ninguna herramienta arma un `where` a mano: pide el filtro acá y recibe uno
 * que ya tiene el tenantId. Suena obvio hasta que alguien escribe
 * `findFirst({ where: { email } })` y le contesta a un cliente con los datos
 * de otro. Con esto, ese error no compila: el helper siempre agrega el tenant.
 */
export function paraTenant<T extends object>(tenantId: string, filtro?: T): T & { tenantId: string } {
  if (!tenantId) throw new Error("paraTenant: falta tenantId");
  return { ...(filtro ?? ({} as T)), tenantId };
}

/**
 * Confirma que una fila pertenece al tenant antes de tocarla.
 * Devuelve la fila o null: nunca lanza datos de otro tenant.
 */
export function esDelTenant<T extends { tenantId: string }>(fila: T | null, tenantId: string): T | null {
  return fila && fila.tenantId === tenantId ? fila : null;
}

// ---------------------------------------------------------------------------
//  Configuración derivada
// ---------------------------------------------------------------------------

export function horariosDe(t: Tenant): Horarios {
  const h = t.horarios as Horarios | null;
  if (!h || Object.keys(h).length === 0) return HORARIOS_POR_DEFECTO;
  return h;
}

/** Modo efectivo para un canal: el del canal si está definido, si no el general. */
export function modoDe(t: Tenant, canal: Canal): ModoOperacion {
  const porCanal = (t.modoPorCanal as Record<string, string> | null) ?? {};
  const v = porCanal[canal] ?? t.modo;
  return v === "draft" || v === "autonomo" ? v : "supervisado";
}

export function canalHabilitado(t: Tenant, canal: Canal): boolean {
  return lineas(t.canales).includes(canal);
}

export function requiereAprobacion(t: Tenant, accion: string): boolean {
  return lineas(t.requiereAprobacion).includes(accion);
}

/** Texto multilínea → lista limpia. Lo usan servicios, políticas y prohibiciones. */
export function lineas(texto: string | null | undefined): string[] {
  return (texto ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

/**
 * ¿El negocio está abierto ahora, en SU zona horaria?
 *
 * Importa para dos cosas: el agente no promete que "alguien te llama en un
 * rato" a las 3am, y las métricas pueden mostrar cuántas consultas llegaron
 * fuera de horario, que es justamente lo que se le vende al cliente.
 */
export function estaAbierto(t: Tenant, ahora = new Date()): boolean {
  const { dia, minutos } = enZona(ahora, t.zonaHoraria);
  const tramos = horariosDe(t)[dia] ?? [];
  return tramos.some(([desde, hasta]) => minutos >= aMinutos(desde) && minutos < aMinutos(hasta));
}

export function aMinutos(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function aHhmm(minutos: number): string {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * Qué día y qué hora es en la zona del negocio.
 *
 * Sin esto, un servidor en UTC cree que en Maui son las 3am cuando son las
 * 5pm del día anterior, y el agente contesta "estamos cerrados" en pleno
 * horario comercial.
 */
export function enZona(d: Date, zona: string): { dia: Dia; minutos: number; fechaISO: string } {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: zona,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (t: string) => partes.find((p) => p.type === t)?.value ?? "";
  const dia = get("weekday").toLowerCase().slice(0, 3) as Dia;
  const hora = Number(get("hour")) % 24;
  const min = Number(get("minute"));
  const fechaISO = new Intl.DateTimeFormat("en-CA", { timeZone: zona }).format(d);
  return { dia, minutos: hora * 60 + min, fechaISO };
}

/** Fecha y hora legibles en la zona del negocio, para meter en el prompt. */
export function ahoraLegible(t: Tenant, ahora = new Date()): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: t.zonaHoraria,
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(ahora);
}

// ---------------------------------------------------------------------------
//  Integraciones
// ---------------------------------------------------------------------------

export type Integracion = {
  tipo: string;
  config: Record<string, unknown>;
  /** Ya descifrado. Solo se usa en el servidor, jamás se serializa al cliente. */
  secreto: string | null;
  estado: string;
};

/**
 * Trae una integración con su credencial descifrada.
 * Devuelve null si no está configurada o si la credencial no se puede
 * descifrar (clave maestra rotada, fila corrupta): mejor tratarla como
 * ausente que operar con datos rotos.
 */
export async function integracion(tenantId: string, tipo: string): Promise<Integracion | null> {
  const fila = await prisma.tenantIntegration.findUnique({
    where: { tenantId_tipo: { tenantId, tipo } },
  });
  if (!fila || fila.estado !== "activo") return null;
  const secreto = fila.cifrado ? descifrar(fila.cifrado) : null;
  if (fila.cifrado && secreto === null) return null;
  return {
    tipo: fila.tipo,
    config: (fila.config as Record<string, unknown>) ?? {},
    secreto,
    estado: fila.estado,
  };
}

/** Miembros que reciben avisos. Si no hay ninguno, no se inventa un destinatario. */
export async function destinatarios(tenantId: string) {
  return prisma.tenantMember.findMany({
    where: paraTenant(tenantId, { recibeAvisos: true }),
    orderBy: { createdAt: "asc" },
  });
}
