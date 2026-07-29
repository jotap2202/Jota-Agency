/**
 * Lectura defensiva de las variables de entorno del login.
 *
 * Al copiar y pegar credenciales en el panel de Vercel es muy fácil que se
 * cuele un espacio o un salto de línea invisible. Google no perdona eso: el
 * cliente deja de existir para él y devuelve "401 invalid_client". Por eso
 * todo pasa por acá y se limpia antes de usarse.
 */
export function envLimpio(nombre: string): string | undefined {
  const v = process.env[nombre];
  if (typeof v !== "string") return undefined;
  const limpio = v.trim();
  return limpio.length > 0 ? limpio : undefined;
}

/** ¿Están cargadas las dos credenciales de Google? Si no, no mostramos el botón. */
export function googleConfigurado(): boolean {
  return Boolean(envLimpio("AUTH_GOOGLE_ID") && envLimpio("AUTH_GOOGLE_SECRET"));
}

/** Revisa el formato de una credencial sin exponer su valor. */
export type Chequeo = { ok: boolean; detalle: string };

export function revisarClientId(): Chequeo {
  const crudo = process.env.AUTH_GOOGLE_ID;
  if (!crudo?.trim()) return { ok: false, detalle: "No está cargada en Vercel." };
  if (crudo !== crudo.trim()) return { ok: false, detalle: "Tiene un espacio o salto de línea de más al copiarla." };
  if (!crudo.endsWith(".apps.googleusercontent.com")) {
    return { ok: false, detalle: "No termina en .apps.googleusercontent.com — parece incompleta o es otro valor." };
  }
  return { ok: true, detalle: "Formato correcto." };
}

export function revisarClientSecret(): Chequeo {
  const crudo = process.env.AUTH_GOOGLE_SECRET;
  if (!crudo?.trim()) return { ok: false, detalle: "No está cargada en Vercel." };
  if (crudo !== crudo.trim()) return { ok: false, detalle: "Tiene un espacio o salto de línea de más al copiarla." };
  if (!crudo.startsWith("GOCSPX-")) {
    return { ok: false, detalle: "No empieza con GOCSPX- — puede que hayas pegado otra cosa (¿el ID?)." };
  }
  return { ok: true, detalle: "Formato correcto." };
}

export function revisarAuthSecret(): Chequeo {
  const v = envLimpio("AUTH_SECRET");
  if (!v) return { ok: false, detalle: "No está cargada. Sin esto no se pueden firmar las sesiones." };
  if (v.length < 24) return { ok: false, detalle: "Es demasiado corta; generá una nueva." };
  return { ok: true, detalle: "Cargada." };
}
