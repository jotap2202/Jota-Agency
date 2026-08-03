/**
 * Lead score de 0 a 100.
 *
 * Principio de diseño: un factor sin dato NO suma ni resta — se declara como
 * faltante. La alternativa (asumir un valor medio) produce scores que
 * parecen informados y no lo están, y eso es peor que no tener score: te
 * hace priorizar mal con confianza.
 *
 * Por eso el resultado incluye `sobre`: el puntaje se calcula sobre los
 * puntos realmente evaluables y después se normaliza a 100. Un lead del que
 * solo sabés la industria puede sacar 80, pero con `confianza: "baja"` — y
 * la interfaz lo muestra.
 */

export type DatosScore = {
  industria?: string | null;
  empleados?: number | null;
  ingresosEstimados?: number | null; // centavos, anuales
  cargo?: string | null;
  web?: string | null;
  linkedin?: string | null;
  servicioInteres?: string | null;
  estado: string;
  ultimoContacto?: Date | null;
};

export type ResultadoScore = {
  score: number;
  clasificacion: "hot" | "strong" | "nurture" | "low";
  etiqueta: string;
  confianza: "alta" | "media" | "baja";
  /** Qué sumó, con cuánto. */
  factores: { nombre: string; puntos: number; sobre: number; motivo: string }[];
  /** Qué no se pudo evaluar por falta de dato. */
  faltantes: string[];
};

/** Industrias donde JOTA ya tiene método probado (según sectores del sitio). */
const INDUSTRIAS_FUERTES = [
  "contab", "account", "cpa",
  "clinic", "salud", "health", "dental", "medic",
  "inmobiliar", "real estate", "realty", "propiedad", "property",
  "legal", "abogad", "law",
  "saas", "software",
  "agencia", "agency", "studio",
];

const CARGOS_DECISORES = [
  "ceo", "founder", "fundador", "owner", "dueñ", "president", "partner", "socio",
  "director", "principal", "managing", "gerente general", "vp", "chief",
];

/** Estados que prueban interés real, con su peso. */
const INTERES_POR_ESTADO: Record<string, number> = {
  nuevo: 0,
  contactado: 4,
  replied: 12,
  qualified: 16,
  reunion: 20,
  propuesta: 18,
  negociacion: 20,
  cliente: 20,
  descartado: 0,
};

const incluye = (texto: string | null | undefined, agujas: string[]) =>
  !!texto && agujas.some((a) => texto.toLowerCase().includes(a));

export function calcularScore(d: DatosScore): ResultadoScore {
  const factores: ResultadoScore["factores"] = [];
  const faltantes: string[] = [];

  // --- Industria (20) ---
  if (d.industria) {
    const fuerte = incluye(d.industria, INDUSTRIAS_FUERTES);
    factores.push({
      nombre: "Industria",
      puntos: fuerte ? 20 : 8,
      sobre: 20,
      motivo: fuerte
        ? `${d.industria} es uno de los rubros donde JOTA ya tiene método probado`
        : `${d.industria} está fuera de los rubros habituales de JOTA`,
    });
  } else faltantes.push("Industria");

  // --- Tamaño (20) ---
  if (d.empleados != null) {
    // El punto dulce son empresas con presupuesto pero sin equipo de marketing
    // propio. Muy chicas no pueden pagar; muy grandes ya lo tienen adentro.
    const p = d.empleados < 3 ? 5 : d.empleados <= 50 ? 20 : d.empleados <= 200 ? 13 : 7;
    factores.push({
      nombre: "Tamaño",
      puntos: p,
      sobre: 20,
      motivo:
        d.empleados < 3
          ? `${d.empleados} empleados: probablemente sin presupuesto`
          : d.empleados <= 50
            ? `${d.empleados} empleados: tiene presupuesto y no tiene equipo de marketing propio`
            : `${d.empleados} empleados: puede tener marketing interno`,
    });
  } else faltantes.push("Cantidad de empleados");

  // --- Presupuesto estimado (15) ---
  if (d.ingresosEstimados != null && d.ingresosEstimados > 0) {
    const anualUSD = d.ingresosEstimados / 100;
    const p = anualUSD >= 2_000_000 ? 15 : anualUSD >= 500_000 ? 11 : anualUSD >= 150_000 ? 6 : 2;
    factores.push({
      nombre: "Presupuesto estimado",
      puntos: p,
      sobre: 15,
      motivo: `Facturación anual estimada de ${Math.round(anualUSD).toLocaleString("en-US")} USD`,
    });
  } else faltantes.push("Facturación estimada");

  // --- Autoridad del contacto (15) ---
  if (d.cargo) {
    const decisor = incluye(d.cargo, CARGOS_DECISORES);
    factores.push({
      nombre: "Autoridad del contacto",
      puntos: decisor ? 15 : 6,
      sobre: 15,
      motivo: decisor
        ? `${d.cargo} decide sin pedir permiso`
        : `${d.cargo} probablemente necesita aprobación de un tercero`,
    });
  } else faltantes.push("Cargo del contacto");

  // --- Presencia digital (10) ---
  if (d.web || d.linkedin) {
    const p = (d.web ? 6 : 0) + (d.linkedin ? 4 : 0);
    factores.push({
      nombre: "Presencia digital",
      puntos: p,
      sobre: 10,
      motivo: [d.web && "tiene sitio web", d.linkedin && "tiene LinkedIn"]
        .filter(Boolean)
        .join(" y ")
        .replace(/^./, (c) => c.toUpperCase()),
    });
  } else faltantes.push("Sitio web o LinkedIn");

  // --- Interés demostrado (20) — siempre evaluable, el estado siempre existe ---
  const interes = INTERES_POR_ESTADO[d.estado] ?? 0;
  factores.push({
    nombre: "Interés demostrado",
    puntos: interes,
    sobre: 20,
    motivo:
      interes === 0
        ? "Todavía no hubo interacción"
        : `Avanzó hasta la etapa "${d.estado}" del embudo`,
  });

  // --- Servicio identificado: bonus, no penaliza si falta ---
  if (d.servicioInteres) {
    factores.push({
      nombre: "Necesidad identificada",
      puntos: 10,
      sobre: 10,
      motivo: `Sabemos qué venderle: ${d.servicioInteres}`,
    });
  }

  const obtenidos = factores.reduce((t, f) => t + f.puntos, 0);
  const posibles = factores.reduce((t, f) => t + f.sobre, 0);
  const score = posibles > 0 ? Math.round((obtenidos / posibles) * 100) : 0;

  // La confianza depende de cuánto del total pudimos evaluar, no del puntaje.
  const confianza = posibles >= 80 ? "alta" : posibles >= 50 ? "media" : "baja";

  const clasificacion =
    score >= 80 ? "hot" : score >= 60 ? "strong" : score >= 40 ? "nurture" : "low";

  const etiqueta = {
    hot: "Hot Lead",
    strong: "Strong Opportunity",
    nurture: "Nurture",
    low: "Low Priority",
  }[clasificacion];

  return { score, clasificacion, etiqueta, confianza, factores, faltantes };
}

export const COLOR_SCORE: Record<ResultadoScore["clasificacion"], string> = {
  hot: "var(--red)",
  strong: "var(--gold)",
  nurture: "var(--green)",
  low: "var(--dim)",
};

/** Texto compacto para guardar en Prospecto.scoreDetalle. */
export function resumirScore(r: ResultadoScore): string {
  const partes = r.factores.map((f) => `${f.nombre}: ${f.puntos}/${f.sobre}`);
  if (r.faltantes.length) partes.push(`Sin datos de: ${r.faltantes.join(", ")}`);
  return partes.join(" · ");
}
