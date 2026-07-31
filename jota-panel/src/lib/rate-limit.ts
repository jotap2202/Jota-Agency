type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

/**
 * Limitador simple en memoria, por ventana fija — mismo patrón que
 * jota-agency/src/lib/rate-limit.ts. No es distribuido (por instancia
 * serverless), pero frena la fuerza bruta contra /api/login, que acá es
 * la única puerta de entrada de todo el panel.
 */
export function limitar(clave: string, maxIntentos: number, ventanaMs: number): { permitido: boolean; reintentarEnSeg: number } {
  const ahora = Date.now();

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
