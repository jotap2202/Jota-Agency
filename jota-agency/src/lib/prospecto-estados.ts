/**
 * Estados del embudo de prospección, con su etiqueta y color.
 *
 * Vive en su propio módulo (y no junto a las server actions) porque un
 * archivo "use server" solo puede exportar funciones asíncronas: exportar
 * una constante desde ahí rompe el build.
 */
export const ESTADOS = ["nuevo", "contactado", "reunion", "cliente", "descartado"] as const;

export type Estado = (typeof ESTADOS)[number];

export const esEstado = (v: string): v is Estado =>
  (ESTADOS as readonly string[]).includes(v);

export const ETIQUETA_ESTADO: Record<Estado, string> = {
  nuevo: "Sin contactar",
  contactado: "Contactado",
  reunion: "Reunión agendada",
  cliente: "Cliente",
  descartado: "Descartado",
};

export const COLOR_ESTADO: Record<Estado, string> = {
  nuevo: "var(--gold)",
  contactado: "var(--text)",
  reunion: "var(--green)",
  cliente: "var(--green)",
  descartado: "var(--dim)",
};
