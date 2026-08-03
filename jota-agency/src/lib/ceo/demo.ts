/**
 * Datos de ejemplo del Command Center.
 *
 * Son empresas FICTICIAS, a propósito. La lista real de prospectos de Maui
 * (lib/prospectos-maui.ts) son negocios que existen y no deben mezclarse con
 * números inventados de facturación o de reuniones: si un día mirás el
 * tablero apurado, tenés que poder distinguir de un vistazo qué es real.
 *
 * Todo lo que crea esta función queda con esDemo: true y se borra completo
 * con un botón, sin tocar nada que hayas cargado vos.
 */

export const SERVICIOS = [
  "B2B Prospecting",
  "LinkedIn Management",
  "Cold Email",
  "AI Agent",
  "Reviews & Reputation",
  "Paid Ads",
  "Website Development",
  "Automations",
] as const;

export const CANALES = [
  "coldEmail",
  "linkedin",
  "instagram",
  "googleAds",
  "metaAds",
  "referidos",
  "seo",
  "directo",
  "contenido",
  "web",
  "aiAgent",
] as const;

export const ETIQUETA_CANAL: Record<string, string> = {
  coldEmail: "Cold email",
  linkedin: "LinkedIn",
  instagram: "Instagram",
  googleAds: "Google Ads",
  metaAds: "Meta Ads",
  referidos: "Referidos",
  seo: "SEO",
  directo: "Contacto directo",
  contenido: "Contenido orgánico",
  web: "Formulario web",
  aiAgent: "Agente IA",
  otros: "Otros",
};

const USD = (d: number) => Math.round(d * 100);

/** Hace N días desde ahora. */
const hace = (dias: number) => new Date(Date.now() - dias * 86_400_000);
/** Dentro de N días. */
const en = (dias: number) => new Date(Date.now() + dias * 86_400_000);

// ---------------------------------------------------------------------------
//  Prospectos (30)
// ---------------------------------------------------------------------------

type LeadDemo = {
  empresa: string; rubro: string; industria: string; ciudad: string;
  contacto: string; cargo: string; empleados: number; facturacion: number;
  estado: string; servicio: string; fuente: string; valor: number; prob: number;
  diasDesdeContacto: number | null; seguimientoEnDias: number | null;
};

const L = (
  empresa: string, industria: string, ciudad: string, contacto: string, cargo: string,
  empleados: number, facturacionK: number, estado: string, servicio: string,
  fuente: string, valorMes: number, prob: number,
  diasDesdeContacto: number | null, seguimientoEnDias: number | null,
): LeadDemo => ({
  empresa, rubro: industria, industria, ciudad, contacto, cargo, empleados,
  facturacion: USD(facturacionK * 1000), estado, servicio, fuente,
  valor: USD(valorMes), prob, diasDesdeContacto, seguimientoEnDias,
});

export const LEADS_DEMO: LeadDemo[] = [
  L("Pacific Ridge Accounting", "Estudio contable", "Kahului", "Marcus Yoshida", "Managing Partner", 14, 1800, "negociacion", "B2B Prospecting", "referidos", 2400, 70, 2, 1),
  L("Haleakala Dental Group", "Odontología", "Pukalani", "Dr. Alana Reyes", "Owner", 22, 3100, "propuesta", "Reviews & Reputation", "coldEmail", 1800, 55, 5, 2),
  L("Kihei Coast Realty", "Inmobiliaria", "Kihei", "Brandon Kalani", "Broker / Owner", 9, 2400, "reunion", "AI Agent", "linkedin", 2200, 45, 3, 4),
  L("Valley Isle Legal", "Servicios legales", "Wailuku", "Priya Nakamura", "Founding Attorney", 6, 950, "qualified", "Cold Email", "seo", 1500, 35, 8, 3),
  L("Upcountry Wellness Clinic", "Clínica", "Makawao", "Dr. Sam Ferreira", "Director", 18, 2200, "replied", "Paid Ads", "googleAds", 1900, 25, 6, 5),
  L("Napili Property Partners", "Administración de propiedades", "Napili", "Christine Wong", "Principal", 31, 4200, "contactado", "B2B Prospecting", "coldEmail", 3000, 20, 11, 0),
  L("Maui Sunrise Tours", "Turismo", "Lahaina", "Kekoa Silva", "Owner", 12, 1400, "nuevo", "Paid Ads", "instagram", 1200, 10, null, null),
  L("Iao Valley Physical Therapy", "Salud", "Wailuku", "Dana Kobayashi", "Clinic Manager", 8, 780, "contactado", "Reviews & Reputation", "web", 900, 20, 14, -2),
  L("South Shore Architects", "Arquitectura", "Kihei", "Trevor Lindsey", "Principal Architect", 11, 1900, "qualified", "Website Development", "referidos", 2800, 40, 4, 6),
  L("Kula Organic Farms", "Agroindustria", "Kula", "Nalani Fisher", "Co-Founder", 26, 2700, "nuevo", "Automations", "contenido", 1600, 10, null, null),
  L("Wailea Financial Advisors", "Servicios financieros", "Wailea", "Gregory Tanaka", "Managing Director", 16, 5100, "cliente", "LinkedIn Management", "linkedin", 3200, 100, 1, null),
  L("Maui Auto Care Center", "Automotriz", "Kahului", "Rico Delgado", "Owner", 19, 2100, "descartado", "Paid Ads", "coldEmail", 1100, 0, 22, null),
  L("Ocean Breeze Med Spa", "Estética", "Kihei", "Leilani Vargas", "Owner", 7, 890, "propuesta", "AI Agent", "instagram", 1700, 60, 3, 1),
  L("Central Maui Insurance", "Seguros", "Kahului", "Walter Chun", "Agency Principal", 24, 3600, "replied", "Cold Email", "coldEmail", 2100, 30, 7, 4),
  L("Lahaina Rebuild Contractors", "Construcción", "Lahaina", "Manuel Ortiz", "General Manager", 41, 6800, "qualified", "B2B Prospecting", "referidos", 4200, 45, 5, 2),
  L("Paia Boutique Hotel", "Hotelería", "Paia", "Sophie Marchand", "General Manager", 33, 4900, "contactado", "Reviews & Reputation", "seo", 1800, 20, 9, 7),
  L("Maui Tech Solutions", "Software / SaaS", "Kahului", "Devon Park", "CTO", 15, 2300, "nuevo", "LinkedIn Management", "linkedin", 2500, 10, null, null),
  L("Kaanapali Vacation Homes", "Administración de propiedades", "Kaanapali", "Rachel Ing", "Operations Director", 28, 5400, "negociacion", "AI Agent", "web", 3400, 75, 1, 1),
  L("Pukalani Veterinary", "Veterinaria", "Pukalani", "Dr. Hana Oshiro", "Owner", 10, 1100, "replied", "Automations", "googleAds", 1300, 25, 6, 5),
  L("Maui Coffee Roasters", "Alimentos", "Wailuku", "Jonah Bell", "Founder", 21, 2600, "nuevo", "Paid Ads", "contenido", 1400, 10, null, null),
  L("Island Title & Escrow", "Servicios legales", "Kahului", "Carmen Fuentes", "Branch Manager", 17, 2900, "qualified", "Cold Email", "coldEmail", 2000, 35, 10, 3),
  L("Wailuku Family Dentistry", "Odontología", "Wailuku", "Dr. Eric Sasaki", "Owner", 9, 1200, "contactado", "Reviews & Reputation", "seo", 1100, 20, 13, -1),
  L("North Shore Surf School", "Deportes", "Paia", "Kai Anderson", "Owner", 6, 540, "descartado", "Paid Ads", "instagram", 700, 0, 30, null),
  L("Maui Solar & Energy", "Energía", "Kihei", "Bianca Reyes", "VP Sales", 37, 7200, "cliente", "B2B Prospecting", "linkedin", 4800, 100, 2, null),
  L("Makena Estate Group", "Inmobiliaria", "Makena", "Douglas Whitmore", "Managing Broker", 13, 8100, "propuesta", "Website Development", "referidos", 5200, 65, 4, 1),
  L("Kahului Physical Medicine", "Clínica", "Kahului", "Dr. Nina Aquino", "Practice Owner", 12, 1700, "nuevo", "AI Agent", "web", 1600, 10, null, null),
  L("Maui Event Rentals", "Eventos", "Wailuku", "Tyler Kaneshiro", "Owner", 14, 1500, "contactado", "Automations", "directo", 1200, 20, 8, 6),
  L("Hana Ranch Provisions", "Alimentos", "Hana", "Marisol Duarte", "GM", 23, 2000, "replied", "LinkedIn Management", "contenido", 1500, 30, 5, 4),
  L("Pacific Shores CPA", "Estudio contable", "Kihei", "Alan Fujimoto", "Partner", 11, 1600, "qualified", "B2B Prospecting", "coldEmail", 2300, 40, 6, 3),
  L("Maui Home Inspectors", "Servicios profesionales", "Kahului", "Grant Oliveira", "Owner", 5, 620, "nuevo", "Cold Email", "seo", 800, 10, null, null),
];

// ---------------------------------------------------------------------------
//  Clientes activos (5)
// ---------------------------------------------------------------------------

export const CLIENTES_DEMO = [
  { empresa: "Kihei Dental Partners", contacto: "Dr. Ryan Matsuda", email: "ryan@kiheidentalpartners.example", servicio: "Reviews & Reputation", precioMensual: USD(1800), costoOperativo: USD(520), mesesAtras: 8, reuniones: 34, leads: 128, satisfaccion: 5, salud: "healthy", ultimoContactoDias: 3, pasos: "Proponer sumar AI Agent para responder consultas fuera de hora" },
  { empresa: "Wailea Luxury Rentals", contacto: "Amanda Ho", email: "amanda@waileluxury.example", servicio: "B2B Prospecting", precioMensual: USD(3200), costoOperativo: USD(1150), mesesAtras: 5, reuniones: 41, leads: 96, satisfaccion: 4, salud: "healthy", ultimoContactoDias: 6, pasos: "Reporte mensual y revisión de segmentos" },
  { empresa: "Maui Coast Law", contacto: "Steven Aguilar", email: "steven@mauicoastlaw.example", servicio: "Paid Ads", precioMensual: USD(2400), costoOperativo: USD(1380), mesesAtras: 4, reuniones: 12, leads: 38, satisfaccion: 3, salud: "atencion", ultimoContactoDias: 12, pasos: "Bajó el volumen de leads dos meses seguidos: revisar creativos y audiencias" },
  { empresa: "Upcountry Builders", contacto: "Paul Nakagawa", email: "paul@upcountrybuilders.example", servicio: "LinkedIn Management", precioMensual: USD(1500), costoOperativo: USD(430), mesesAtras: 11, reuniones: 27, leads: 61, satisfaccion: 4, salud: "healthy", ultimoContactoDias: 9, pasos: "Renovación anual en 3 semanas: preparar caso de resultados" },
  { empresa: "Island Fitness Collective", contacto: "Tara Beaumont", email: "tara@islandfitness.example", servicio: "Cold Email", precioMensual: USD(1200), costoOperativo: USD(690), mesesAtras: 3, reuniones: 6, leads: 19, satisfaccion: 2, salud: "riesgo", ultimoContactoDias: 21, pasos: "No respondió los últimos 2 reportes y los resultados están por debajo de lo acordado" },
];

// ---------------------------------------------------------------------------
//  Campañas (6)
// ---------------------------------------------------------------------------

export const CAMPANIAS_DEMO = [
  { nombre: "Maui CPAs — Q3 Cold Email", canal: "coldEmail", publico: "Estudios contables 5-50 empleados", industria: "Estudio contable", presupuesto: USD(900), gastado: USD(740), enviados: 1240, respuestas: 118, positivas: 41, leads: 22, reuniones: 9, ventas: 2, ingresos: USD(4700), estado: "active", diasAtras: 52 },
  { nombre: "LinkedIn — Real Estate Brokers", canal: "linkedin", publico: "Brokers y owners de inmobiliarias", industria: "Inmobiliaria", presupuesto: USD(700), gastado: USD(610), enviados: 480, respuestas: 96, positivas: 38, leads: 19, reuniones: 11, ventas: 3, ingresos: USD(8100), estado: "active", diasAtras: 68 },
  { nombre: "Google Ads — Lead Gen Maui", canal: "googleAds", publico: "Búsquedas locales de marketing", industria: "Varios", presupuesto: USD(2200), gastado: USD(2050), enviados: 0, respuestas: 0, positivas: 0, leads: 14, reuniones: 4, ventas: 1, ingresos: USD(2400), estado: "active", diasAtras: 45 },
  { nombre: "Meta Ads — Clínicas y estética", canal: "metaAds", publico: "Dueños de clínicas y med spas", industria: "Clínica", presupuesto: USD(1400), gastado: USD(1390), enviados: 0, respuestas: 0, positivas: 0, leads: 8, reuniones: 2, ventas: 0, ingresos: 0, estado: "paused", diasAtras: 80 },
  { nombre: "Referidos — Clientes activos", canal: "referidos", publico: "Cartera actual", industria: "Varios", presupuesto: 0, gastado: 0, enviados: 0, respuestas: 0, positivas: 0, leads: 7, reuniones: 6, ventas: 3, ingresos: USD(9400), estado: "active", diasAtras: 120 },
  { nombre: "SEO local — Maui", canal: "seo", publico: "Búsquedas orgánicas locales", industria: "Varios", presupuesto: USD(600), gastado: USD(600), enviados: 0, respuestas: 0, positivas: 0, leads: 11, reuniones: 3, ventas: 1, ingresos: USD(1800), estado: "active", diasAtras: 150 },
];

// ---------------------------------------------------------------------------
//  Tareas del CEO (12)
// ---------------------------------------------------------------------------

export const TAREAS_DEMO = [
  { titulo: "Cerrar la negociación con Kaanapali Vacation Homes", descripcion: "Está en 75% de probabilidad y es el negocio más grande del mes. Falta definir el alcance del agente IA.", prioridad: "critical", categoria: "sales", venceEnDias: 1, impacto: USD(3400) },
  { titulo: "Recuperar a Island Fitness Collective", descripcion: "21 días sin contacto y resultados por debajo de lo acordado. Riesgo real de cancelación.", prioridad: "critical", categoria: "delivery", venceEnDias: 0, impacto: USD(1200) },
  { titulo: "Seguimiento a la propuesta de Makena Estate Group", descripcion: "Propuesta de $5,200/mes enviada hace 4 días, sin respuesta.", prioridad: "high", categoria: "sales", venceEnDias: 1, impacto: USD(5200) },
  { titulo: "Revisar creativos de Maui Coast Law", descripcion: "Dos meses seguidos de caída en leads. Es el cliente con peor margen.", prioridad: "high", categoria: "delivery", venceEnDias: 2, impacto: USD(2400) },
  { titulo: "Preparar caso de resultados para renovación de Upcountry Builders", descripcion: "Renueva en 3 semanas. 27 reuniones conseguidas en 11 meses.", prioridad: "high", categoria: "delivery", venceEnDias: 5, impacto: USD(1500) },
  { titulo: "Decidir qué hacer con Meta Ads", descripcion: "Gastó $1,390 y no cerró ninguna venta. Es el peor ROI de la cartera.", prioridad: "high", categoria: "marketing", venceEnDias: 2, impacto: USD(1390) },
  { titulo: "Escalar presupuesto de LinkedIn outreach", descripcion: "Mejor costo por reunión de todos los canales. Está limitado por presupuesto, no por demanda.", prioridad: "medium", categoria: "marketing", venceEnDias: 4, impacto: USD(2700) },
  { titulo: "Publicar el perfil de Google Business", descripcion: "JOTA es local en Maui y no aparece en el paquete local. Es el canal orgánico más barato disponible.", prioridad: "high", categoria: "marketing", venceEnDias: 3, impacto: USD(1800) },
  { titulo: "Contactar los 6 leads sin tocar", descripcion: "Seis prospectos en estado Nuevo, ninguno contactado todavía.", prioridad: "medium", categoria: "sales", venceEnDias: 1, impacto: USD(1500) },
  { titulo: "Definir precio del paquete AI Agent", descripcion: "Tres prospectos lo pidieron y todavía no hay precio de lista.", prioridad: "medium", categoria: "strategy", venceEnDias: 7, impacto: USD(5000) },
  { titulo: "Cerrar facturación pendiente del mes", descripcion: "Hay cobros del mes anterior sin conciliar.", prioridad: "medium", categoria: "finance", venceEnDias: 3, impacto: 0 },
  { titulo: "Armar caso de estudio con Kihei Dental Partners", descripcion: "Cliente 5 estrellas hace 8 meses. Sirve como prueba social, que hoy el sitio no tiene.", prioridad: "medium", categoria: "marketing", venceEnDias: 10, impacto: USD(3000) },
];

// ---------------------------------------------------------------------------
//  Ingresos: 6 meses
// ---------------------------------------------------------------------------

/** Facturación mensual base por mes hacia atrás (0 = mes actual). */
export const INGRESOS_POR_MES = [
  { mesesAtras: 5, total: 9800 },
  { mesesAtras: 4, total: 12400 },
  { mesesAtras: 3, total: 11900 },
  { mesesAtras: 2, total: 15600 },
  { mesesAtras: 1, total: 18200 },
  { mesesAtras: 0, total: 16800 },
];

export const OBJETIVO_MENSUAL = USD(25000);

export const GASTOS_DEMO = [
  { concepto: "Google Ads", categoria: "marketing", canal: "googleAds", mensual: USD(2050) },
  { concepto: "Meta Ads", categoria: "marketing", canal: "metaAds", mensual: USD(1390) },
  { concepto: "Herramientas de prospección", categoria: "herramientas", canal: "coldEmail", mensual: USD(740) },
  { concepto: "LinkedIn Sales Navigator", categoria: "herramientas", canal: "linkedin", mensual: USD(610) },
  { concepto: "SEO y contenido", categoria: "marketing", canal: "seo", mensual: USD(600) },
  { concepto: "Infraestructura y software", categoria: "herramientas", canal: null, mensual: USD(380) },
  { concepto: "Colaboradores", categoria: "equipo", canal: null, mensual: USD(4200) },
];

export { hace, en, USD };
