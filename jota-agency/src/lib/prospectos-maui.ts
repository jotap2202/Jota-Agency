/**
 * Lista inicial de prospectos en Maui, Hawái.
 *
 * IMPORTANTE — cómo se armó y qué NO tiene:
 *
 * Cada empresa de acá salió de una búsqueda web real y su sitio se vio
 * listado en los resultados. NO hay ninguna empresa inventada.
 *
 * Deliberadamente NO se incluyen emails: los buscadores no los devuelven de
 * forma confiable y un email inventado no solo no llega — hace que el
 * dominio de JOTA quede marcado como spam, que es un daño difícil de
 * revertir. El email se completa a mano entrando al sitio de cada empresa.
 *
 * Los teléfonos solo están donde aparecieron textualmente en los resultados.
 *
 * Antes de escribirle a cualquiera de estas empresas conviene abrir su web:
 * los datos pueden haber cambiado, y además vas a necesitar el contexto para
 * que el primer mensaje no parezca un envío masivo.
 */
export type ProspectoInicial = {
  empresa: string;
  rubro: string;
  ciudad: string;
  web: string;
  telefono?: string;
};

export const PROSPECTOS_MAUI: ProspectoInicial[] = [
  // ---------- Estudios contables ----------
  { empresa: "Levin & Tabon CPAs", rubro: "Estudio contable", ciudad: "Kahului", web: "https://maui.cpa/" },
  { empresa: "Khalsa CPA Services, LLC", rubro: "Estudio contable", ciudad: "Kahului", web: "https://www.khalsacpaservices.com/", telefono: "(808) 871-8822" },
  { empresa: "Patrick L. Ing CPA Inc", rubro: "Estudio contable", ciudad: "Wailuku", web: "https://www.patrickingcpa.com/" },
  { empresa: "HiAccounting (Hawaii Accounting LLC)", rubro: "Estudio contable", ciudad: "Wailuku", web: "https://hi-accounting.com/", telefono: "(808) 356-4357" },
  { empresa: "James & Associates CPAs", rubro: "Estudio contable", ciudad: "Wailuku", web: "https://www.cpamaui.com/" },
  { empresa: "Kawahara + Hu LLP", rubro: "Estudio contable", ciudad: "Maui", web: "https://www.mauicpa.net/" },

  // ---------- Inmobiliarias ----------
  { empresa: "The Maui Real Estate Team, Inc.", rubro: "Inmobiliaria", ciudad: "Maui", web: "https://mauirealestate.com/" },
  { empresa: "E Maui Real Estate", rubro: "Inmobiliaria", ciudad: "Kihei / Wailea", web: "https://www.emauirealestate.com/" },
  { empresa: "McEntire Realty", rubro: "Inmobiliaria", ciudad: "Kihei", web: "https://mcentirerealty.com/" },
  { empresa: "Maui Real Estate Advisors", rubro: "Inmobiliaria", ciudad: "Wailea", web: "https://mauirealestateadvisors.com/" },
  { empresa: "The Smith Team", rubro: "Inmobiliaria", ciudad: "Maui", web: "https://www.mauisales.com/" },
  { empresa: "Roger Pleski — Coldwell Banker Island Properties", rubro: "Inmobiliaria", ciudad: "Kihei", web: "https://www.buyorsellmauirealestate.com/" },
  { empresa: "Maui Property Team (Compass)", rubro: "Inmobiliaria", ciudad: "Wailea", web: "https://www.compass.com/agents/maui-property-team/" },

  // ---------- Administración de propiedades / alquiler temporario ----------
  { empresa: "Rentals Maui Inc.", rubro: "Administración de propiedades", ciudad: "Kihei", web: "https://www.rentalsmaui.com/" },
  { empresa: "South Maui Property Management", rubro: "Administración de propiedades", ciudad: "Kihei", web: "https://www.southmauipropertymanagement.com/" },
  { empresa: "Valley Isle Property Group", rubro: "Administración de propiedades", ciudad: "Kihei / Wailea", web: "https://www.valleyislepropertygroup.com/" },
  { empresa: "Luxe Maui Properties", rubro: "Administración de propiedades", ciudad: "Wailea / Kihei", web: "https://www.luxemauiproperties.com/" },
  { empresa: "Maui Rental Management", rubro: "Administración de propiedades", ciudad: "Kihei", web: "https://www.mauirentalmanagement.com/" },
  { empresa: "My Perfect Stays", rubro: "Administración de propiedades", ciudad: "Kihei", web: "https://www.myperfectstays.com/" },
  { empresa: "Maui Beachfront Rentals", rubro: "Administración de propiedades", ciudad: "Lahaina", web: "https://www.mauibeachfront.com/" },
  { empresa: "Destination Maui", rubro: "Administración de propiedades", ciudad: "Maui", web: "https://www.destinationmaui.net/" },

  // ---------- Salud y estética ----------
  { empresa: "MediSpa Maui & Wellness Center", rubro: "Clínica / estética", ciudad: "Kihei", web: "https://www.medispamaui.com/" },
  { empresa: "Maui Cosmetic Laser & Medical Spa", rubro: "Clínica / estética", ciudad: "Maui", web: "https://www.mauicosmeticlaser.com/" },
  { empresa: "Dental Care of Maui", rubro: "Odontología", ciudad: "Kahului", web: "https://www.dentalcareofmaui.com/" },
];

/** De dónde salió esta tanda, para poder medir qué canal rinde. */
export const FUENTE_MAUI = "Investigación web — Maui, agosto 2026";
