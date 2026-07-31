type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

/**
 * Limitador simple en memoria, por ventana fija.
 *
 * OJO: esto NO es un límite distribuido. En Vercel cada instancia serverless
 * tiene su propio estado en memoria, así que esto frena abuso repetido contra
 * una misma instancia tibia, no un ataque coordinado desde muchas IPs o contra
 * muchas instancias en paralelo. Para eso hace falta un store compartido (ej.
 * Upstash Redis) — deuda técnica documentada a propósito: no se agregó una
 * dependencia nueva en esta ronda.
 */
export function limitar(clave: string, maxIntentos: number, ventanaMs: number): { permitido: boolean; reintentarEnSeg: number } {
  const ahora = Date.now();

  // Barrido perezoso: si el mapa crece de más, tira lo vencido. Sin timers
  // de fondo (no conviene en serverless).
  if (buckets.size > 500) {
    for (const [k, b] of buckets) if (ahora > b.resetAt) buckets.delete(k);
  }

  const actual = buckets.get(clave);
  if (!actual || ahora > actual.resetAt) {
    buckets.set(clave, { count: 1, resetAt: ahora + ventanaMs });
    return { permitido: true, reintentarEnSeg: 0 };
  }
  if (actual.count >= maxIntentos) {
    return { permitido: false, reintentarEnSeg: Math.max(1, Math.ceil((actual.resetAt - ahora) / 1000)) };
  }
  actual.count++;
  return { permitido: true, reintentarEnSeg: 0 };
}
