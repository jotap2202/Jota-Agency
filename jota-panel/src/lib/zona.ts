/**
 * Zona horaria y formato de fecha del negocio: JOTA opera desde Maui.
 *
 * Duplicado a propósito de jota-agency/src/lib/zona.ts: las dos apps son
 * independientes y no comparten código (mismo criterio que rate-limit.ts).
 * Si cambia la zona, hay que cambiarla en los dos lados.
 *
 * Sin `timeZone` explícita, el servidor de Vercel formatea en UTC, que va
 * 10 horas adelante de Hawái, y las fechas de los leads salían corridas un
 * día. Hawái no tiene horario de verano: es UTC-10 todo el año.
 */
export const ZONA = "Pacific/Honolulu";

export const fechaHora = (d: Date) =>
  new Intl.DateTimeFormat("en-US", {
    timeZone: ZONA,
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
