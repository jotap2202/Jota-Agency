import { LOCALE, ZONA } from "@/lib/zona";

/**
 * El dinero vive en CENTAVOS enteros en toda la aplicación.
 *
 * Motivo: 0.1 + 0.2 !== 0.3 en punto flotante. Sumando cientos de ingresos
 * el error se acumula y aparece en un reporte con un centavo de más o de
 * menos, que es exactamente el tipo de detalle que hace desconfiar de un
 * número. Con enteros no puede pasar.
 */

export const MONEDA = "USD";

/** $16,800 — sin decimales, que es como se lee un tablero. */
export function dinero(centavos: number): string {
  return new Intl.NumberFormat(LOCALE, {
    style: "currency",
    currency: MONEDA,
    maximumFractionDigits: 0,
  }).format(centavos / 100);
}

/** $16,800.50 — para importes donde el centavo importa. */
export function dineroExacto(centavos: number): string {
  return new Intl.NumberFormat(LOCALE, {
    style: "currency",
    currency: MONEDA,
    minimumFractionDigits: 2,
  }).format(centavos / 100);
}

/** $16.8k — para ejes de gráficos, donde no entra el número entero. */
export function dineroCorto(centavos: number): string {
  const d = centavos / 100;
  if (Math.abs(d) >= 1_000_000) return `$${(d / 1_000_000).toFixed(1)}M`;
  if (Math.abs(d) >= 1_000) return `$${(d / 1_000).toFixed(d >= 10_000 ? 0 : 1)}k`;
  return `$${Math.round(d)}`;
}

/** Convierte lo que escribe una persona ("1.500,50" o "1500.5") a centavos. */
export function aCentavos(entrada: string | number): number {
  if (typeof entrada === "number") return Math.round(entrada * 100);
  const limpio = entrada.replace(/[^\d.,-]/g, "").replace(/,/g, ".");
  // Si quedó más de un punto, los primeros eran separadores de miles.
  const partes = limpio.split(".");
  const normal = partes.length > 2 ? partes.slice(0, -1).join("") + "." + partes.at(-1) : limpio;
  const n = Number(normal);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

export const porcentaje = (n: number, decimales = 1): string =>
  `${n.toFixed(decimales).replace(/\.0$/, "")}%`;

export const numero = (n: number): string => new Intl.NumberFormat(LOCALE).format(n);

/** Fecha corta en hora de Maui: "Aug 3". */
export const fechaCorta = (d: Date): string =>
  new Intl.DateTimeFormat(LOCALE, { timeZone: ZONA, month: "short", day: "numeric" }).format(d);

/** Mes y año: "Aug 2026". */
export const mesCorto = (d: Date): string =>
  new Intl.DateTimeFormat(LOCALE, { timeZone: ZONA, month: "short", year: "numeric" }).format(d);
