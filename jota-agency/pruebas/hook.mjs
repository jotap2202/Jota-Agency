import { pathToFileURL } from "node:url";
import { existsSync } from "node:fs";
import path from "node:path";

/** Resuelve el alias @/ de tsconfig a src/, para poder ejecutar el código real. */
export async function resolve(specifier, context, next) {
  if (specifier.startsWith("@/")) {
    const base = path.resolve(process.cwd(), "src", specifier.slice(2));
    for (const cand of [base, `${base}.ts`, `${base}.tsx`, path.join(base, "index.ts")]) {
      if (existsSync(cand)) return next(pathToFileURL(cand).href, context);
    }
  }
  return next(specifier, context);
}
