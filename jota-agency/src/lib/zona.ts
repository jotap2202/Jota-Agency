/**
 * Zona horaria y formato de fecha del negocio: JOTA opera desde Maui y sus
 * clientes también están ahí.
 *
 * Declararla explícitamente no es un detalle cosmético. Sin `timeZone`, el
 * servidor de Vercel formatea en UTC, que va 10 horas adelante de Hawái: un
 * lead que entra a las 3 de la tarde en Maui aparecía con la fecha del día
 * siguiente. Y para los seguimientos del panel, "hoy" se adelantaba medio
 * día, marcando como vencido algo que todavía no lo estaba.
 *
 * Hawái no tiene horario de verano, así que Pacific/Honolulu es UTC-10 todo
 * el año.
 */
export const ZONA = "Pacific/Honolulu";

/** Formato local: mes/día/año, como se lee en Estados Unidos. */
export const LOCALE = "en-US";

/** Fecha y hora legibles, en hora de Maui. */
export const fechaHora = (d: Date) =>
  new Intl.DateTimeFormat(LOCALE, {
    timeZone: ZONA,
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);

/**
 * YYYY-MM-DD en hora de Maui — el formato que usan los <input type="date">.
 * Se usa "en-CA" solo porque es el locale que produce ese orden.
 */
export const fechaISO = (d: Date) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: ZONA }).format(d);
