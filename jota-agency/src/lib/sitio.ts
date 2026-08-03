/**
 * Dirección pública y canónica del sitio.
 *
 * De acá salen el canonical de cada página, las URL de Open Graph y el
 * JSON-LD. Tiene que ser SIEMPRE el dominio definitivo, incluso cuando el
 * código corre en un preview de Vercel: si un preview declarara su propia
 * URL como canónica, Google podría indexar el preview en vez del sitio.
 *
 * Se puede pisar con la variable SITIO_URL en Vercel sin tocar el código
 * (por ejemplo, para volver al subdominio de Vercel si el dominio propio
 * llegara a caerse).
 *
 * Solo para el servidor: SITIO_URL no lleva prefijo NEXT_PUBLIC_, así que
 * en el navegador valdría undefined. No importar desde un componente
 * cliente.
 */
export const SITIO_URL = process.env.SITIO_URL?.trim() || "https://jotaagency.org";
