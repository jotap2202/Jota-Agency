import { cookies } from "next/headers";
import { COOKIE_IDIOMA, IDIOMA_POR_DEFECTO, type Idioma } from "./contenido";

/**
 * Idioma elegido por el visitante, leído de la cookie que escribe el toggle
 * de la landing. Inglés si nunca eligió.
 *
 * Solo para componentes de servidor: importa `next/headers`, así que no se
 * puede usar desde un componente cliente.
 */
export async function idiomaActual(): Promise<Idioma> {
  const elegido = (await cookies()).get(COOKIE_IDIOMA)?.value;
  return elegido === "es" || elegido === "en" ? elegido : IDIOMA_POR_DEFECTO;
}
