import { pathToFileURL, fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import path from "node:path";

/**
 * Hace que Node pueda ejecutar el código real del proyecto tal como lo escribe
 * TypeScript, sin compilarlo antes:
 *
 *  1. Resuelve el alias `@/` de tsconfig a `src/`.
 *  2. Completa la extensión de los imports relativos (`./seguridad` → `.ts`),
 *     que TypeScript permite omitir y Node no.
 */

const EXTENSIONES = ["", ".ts", ".tsx", "/index.ts", "/index.tsx"];

function primerExistente(base) {
  for (const ext of EXTENSIONES) {
    const cand = `${base}${ext}`;
    if (existsSync(cand) && !cand.endsWith("/")) return cand;
  }
  return null;
}

export async function resolve(specifier, context, next) {
  if (specifier.startsWith("@/")) {
    const hallado = primerExistente(path.resolve(process.cwd(), "src", specifier.slice(2)));
    if (hallado) return next(pathToFileURL(hallado).href, context);
  }

  if (specifier.startsWith(".") && context.parentURL?.startsWith("file:")) {
    const desde = path.dirname(fileURLToPath(context.parentURL));
    const hallado = primerExistente(path.resolve(desde, specifier));
    if (hallado) return next(pathToFileURL(hallado).href, context);
  }

  return next(specifier, context);
}
