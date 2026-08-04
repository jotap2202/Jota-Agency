import { prisma } from "@/lib/prisma";
import { paraTenant } from "./tenant";
import { comoDatos, normalizar } from "./seguridad";
import * as ev from "./eventos";

/**
 * Workflows 06 (Knowledge Retrieval) y 15 (Knowledge Base Sync).
 *
 * DECISIÓN: la búsqueda es LÉXICA, no vectorial.
 *
 * Anthropic no ofrece embeddings, así que RAG vectorial obligaba a sumar un
 * proveedor extra (OpenAI/Voyage/Cohere): otra dependencia, otro costo, otro
 * secreto que rotar, y una base vectorial que administrar. Para la base de
 * conocimiento de un negocio chico —FAQ, servicios, precios, políticas,
 * horarios: decenas o pocos cientos de fragmentos— un ranking léxico bien
 * hecho encuentra lo mismo, es determinista y se puede probar sin red.
 *
 * El límite está documentado: arriba de ~500 fragmentos por cliente conviene
 * pgvector. La interfaz de `buscarConocimiento` no cambia el día que se haga.
 */

const MAX_FRAGMENTOS_EN_MEMORIA = 500;

/** Palabras que no aportan a la búsqueda en inglés ni en español. */
const VACIAS = new Set([
  "the", "and", "for", "you", "your", "are", "can", "with", "what", "how", "does", "did",
  "have", "has", "our", "this", "that", "there", "from", "about", "would", "could", "will",
  "los", "las", "una", "unos", "unas", "para", "por", "con", "que", "como", "cual", "cuales",
  "del", "sus", "mis", "pero", "esta", "este", "esto", "son", "hay", "muy", "mas", "sobre",
]);

export function terminos(consulta: string): string[] {
  return normalizar(consulta)
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((p) => p.length >= 3 && !VACIAS.has(p));
}

export type Fragmento = {
  id: string;
  titulo: string;
  texto: string;
  fuenteId: string;
  puntaje: number;
};

/**
 * Busca en la base del tenant. Devuelve los fragmentos más pertinentes, ya
 * saneados para entrar al prompt como datos.
 *
 * Si no encuentra nada, devuelve lista vacía — y el agente tiene que decir
 * que no lo sabe. Ese es exactamente el comportamiento buscado: sin fuente,
 * no hay respuesta.
 */
export async function buscarConocimiento(
  tenantId: string,
  consulta: string,
  limite = 5,
): Promise<Fragmento[]> {
  const t = terminos(consulta);
  if (t.length === 0) return [];

  const filas = await prisma.knowledgeChunk.findMany({
    where: paraTenant(tenantId),
    select: { id: true, titulo: true, texto: true, indice: true, sourceId: true },
    take: MAX_FRAGMENTOS_EN_MEMORIA,
    orderBy: { createdAt: "asc" },
  });
  if (filas.length === 0) return [];

  // Cuántos fragmentos contienen cada término: los términos raros pesan más.
  // Es la idea de IDF sin la maquinaria de un motor de búsqueda.
  const documentos = filas.length;
  const apariciones = new Map<string, number>();
  for (const term of t) {
    let n = 0;
    for (const f of filas) if (f.indice.includes(term)) n++;
    apariciones.set(term, n);
  }

  const puntuados = filas.map((f) => {
    const tituloNorm = normalizar(f.titulo);
    let puntaje = 0;
    for (const term of t) {
      const n = apariciones.get(term) ?? 0;
      if (n === 0) continue;
      const idf = Math.log(1 + documentos / n);
      const veces = contar(f.indice, term);
      if (veces > 0) {
        // Saturación: la quinta aparición no vale como la primera.
        puntaje += idf * (veces / (veces + 1.2));
      }
      // Un término en el título es una señal mucho más fuerte que en el cuerpo.
      if (tituloNorm.includes(term)) puntaje += idf * 0.8;
    }
    return { ...f, puntaje };
  });

  return puntuados
    .filter((f) => f.puntaje > 0)
    .sort((a, b) => b.puntaje - a.puntaje)
    .slice(0, limite)
    .map((f) => ({
      id: f.id,
      titulo: f.titulo,
      texto: comoDatos(f.texto),
      fuenteId: f.sourceId,
      puntaje: Number(f.puntaje.toFixed(3)),
    }));
}

function contar(texto: string, term: string): number {
  let n = 0;
  let i = texto.indexOf(term);
  while (i !== -1) {
    n++;
    i = texto.indexOf(term, i + term.length);
  }
  return n;
}

// ---------------------------------------------------------------------------
//  Sincronización (workflow 15)
// ---------------------------------------------------------------------------

/**
 * Parte un texto largo en fragmentos.
 *
 * Corta por párrafos, no por cantidad de caracteres: partir una lista de
 * precios al medio produce fragmentos que dicen "…$150" sin decir de qué.
 * Cuando un párrafo solo ya es más largo que el máximo, ahí sí se corta duro.
 */
export function fragmentar(texto: string, max = 900): string[] {
  const parrafos = texto
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  const salida: string[] = [];
  let actual = "";
  for (const p of parrafos) {
    if (p.length > max) {
      if (actual) { salida.push(actual); actual = ""; }
      for (let i = 0; i < p.length; i += max) salida.push(p.slice(i, i + max));
      continue;
    }
    if ((actual + "\n\n" + p).trim().length > max) {
      salida.push(actual);
      actual = p;
    } else {
      actual = actual ? `${actual}\n\n${p}` : p;
    }
  }
  if (actual) salida.push(actual);
  return salida;
}

/**
 * Reindexa una fuente: borra sus fragmentos viejos y escribe los nuevos.
 *
 * Se borra y se reescribe entero a propósito. Actualizar "solo lo que cambió"
 * exige diffear textos y deja huérfanos cuando falla a la mitad; en una base
 * de este tamaño, rehacer la fuente es más simple y no puede quedar
 * inconsistente.
 */
export async function sincronizarFuente(
  tenantId: string,
  sourceId: string,
  correlationId = ev.nuevaCorrelacion(),
): Promise<{ fragmentos: number }> {
  await ev.inicio({ tenantId, workflow: "15-kb-sync", correlationId, referencia: sourceId });
  try {
    const fuente = await prisma.knowledgeSource.findFirst({
      where: paraTenant(tenantId, { id: sourceId }),
    });
    if (!fuente) throw new Error("fuente inexistente para este tenant");

    const trozos = fragmentar(fuente.contenido);

    await prisma.$transaction([
      prisma.knowledgeChunk.deleteMany({ where: paraTenant(tenantId, { sourceId }) }),
      prisma.knowledgeChunk.createMany({
        data: trozos.map((texto, orden) => ({
          tenantId,
          sourceId,
          orden,
          titulo: fuente.titulo,
          texto,
          indice: normalizar(`${fuente.titulo} ${texto}`),
        })),
      }),
      prisma.knowledgeSource.update({
        where: { id: sourceId },
        data: { estado: "activa", ultimoError: null, sincronizadaEn: new Date() },
      }),
    ]);

    await ev.ok({ tenantId, workflow: "15-kb-sync", correlationId, referencia: sourceId });
    return { fragmentos: trozos.length };
  } catch (e) {
    await prisma.knowledgeSource
      .updateMany({
        where: paraTenant(tenantId, { id: sourceId }),
        data: { estado: "error", ultimoError: String(e instanceof Error ? e.message : e).slice(0, 300) },
      })
      .catch(() => {});
    await ev.fallo({ tenantId, workflow: "15-kb-sync", correlationId, referencia: sourceId, error: e });
    throw e;
  }
}

/** Fuentes que hace mucho no se sincronizan. El health check las mira. */
export async function fuentesDesactualizadas(tenantId: string, dias = 30) {
  const limite = new Date(Date.now() - dias * 86_400_000);
  return prisma.knowledgeSource.findMany({
    where: paraTenant(tenantId, {
      estado: { in: ["activa", "error"] },
      OR: [{ sincronizadaEn: null }, { sincronizadaEn: { lt: limite } }],
    }),
    select: { id: true, titulo: true, estado: true, sincronizadaEn: true },
  });
}
