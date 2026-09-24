import type { ProspectoInicial } from "@/lib/prospectos-maui";

/**
 * Lote 1 de prospectos de ALTO TICKET en Hawái (Maui + Oʻahu).
 *
 * Mismas reglas que la lista de Maui: cada empresa salió de una búsqueda web
 * real (septiembre 2026) y su sitio apareció en los resultados. No hay
 * empresas inventadas ni emails adivinados. Los teléfonos solo están donde
 * aparecieron textualmente en los resultados.
 *
 * Criterio de "alto ticket": negocios donde UN cliente nuevo vale miles de
 * dólares (una casa, un implante, un caso de accidente, una boda, un sistema
 * solar, una semana de villa). Para ellos un retainer de USD 2.000–4.000/mes
 * se paga con uno o dos clientes extra por mes.
 *
 * Quedaron afuera a propósito las cadenas nacionales (ClearChoice, Morgan &
 * Morgan, Exotic Estates…): deciden el marketing en otra ciudad y no le
 * compran a una agencia local.
 *
 * Los sitios no se abrieron uno por uno desde acá: antes de escribirle a
 * cualquiera, entrá a su web, confirmá que sigue operando y sacá de ahí el
 * email y el nombre del dueño.
 */
export const PROSPECTOS_HAWAII_ALTO_TICKET: ProspectoInicial[] = [
  // ---------- Villas y alquiler vacacional de lujo (Maui) ----------
  { empresa: "Island Property Management (Wailea)", rubro: "Villas de lujo", ciudad: "Wailea", web: "https://vrentals.vacationrentaldesk.com/islandpropertymanagement/homepage.html" },
  { empresa: "Maui Resort Rentals", rubro: "Villas de lujo", ciudad: "Kaanapali / Wailea", web: "https://www.mauiresortrentals.com/" },
  { empresa: "Maui Westside Properties", rubro: "Villas de lujo", ciudad: "Lahaina / Westside", web: "https://mauiwestside.com/" },
  { empresa: "Aloha Villas", rubro: "Villas de lujo", ciudad: "South Maui", web: "https://www.alohavillas.com/" },
  { empresa: "Maui Life Realty", rubro: "Villas de lujo", ciudad: "Maui", web: "https://mauilifevacations.com/" },
  { empresa: "Hawaii Luxury Rentals", rubro: "Villas de lujo", ciudad: "Maui", web: "https://hiluxuryrentals.com/" },
  { empresa: "Elite Pacific Vacations", rubro: "Villas de lujo", ciudad: "Maui", web: "https://evrhi.com/maui-rentals/" },

  // ---------- Constructoras de casas de lujo (Maui) ----------
  { empresa: "Maui Built Homes", rubro: "Constructora de lujo", ciudad: "Maui", web: "https://www.mauibuilthomes.com/" },
  { empresa: "Boyd Construction", rubro: "Constructora de lujo", ciudad: "Maui", web: "https://www.boydmaui.com/" },
  { empresa: "Crescent Homes Maui", rubro: "Constructora de lujo", ciudad: "Maui", web: "https://www.crescenthomesmaui.com/" },
  { empresa: "H-1 Construction LLC", rubro: "Constructora de lujo", ciudad: "Maui", web: "https://h1constructionhawaii.com/" },
  { empresa: "Honua Builders", rubro: "Constructora de lujo", ciudad: "Maui", web: "https://honuabuilders.com/" },
  { empresa: "Armour Construction Maui", rubro: "Constructora de lujo", ciudad: "Maui", web: "https://armourconstructionmaui.com/" },

  // ---------- Charters privados y tours premium (Maui) ----------
  { empresa: "Trilogy Excursions", rubro: "Charters / tours premium", ciudad: "Maui", web: "https://sailtrilogy.com/" },
  { empresa: "Pride of Maui", rubro: "Charters / tours premium", ciudad: "Māʻalaea", web: "https://www.prideofmaui.com/" },
  { empresa: "Island Star Maui", rubro: "Charters / tours premium", ciudad: "Māʻalaea", web: "https://www.islandstarmaui.com/", telefono: "808-669-7827" },
  { empresa: "Alii Nui Maui", rubro: "Charters / tours premium", ciudad: "Maui", web: "https://aliinuimaui.com/" },
  { empresa: "Sea Maui", rubro: "Charters / tours premium", ciudad: "Kaʻanapali", web: "https://seamaui.com/" },
  { empresa: "Kainani Sails", rubro: "Charters / tours premium", ciudad: "Maui", web: "https://www.kainanisails.com/" },
  { empresa: "Maui Magic Snorkel", rubro: "Charters / tours premium", ciudad: "Maui", web: "https://www.mauimagicsnorkel.com/" },

  // ---------- Bodas de destino (Maui) ----------
  { empresa: "Maui Love Weddings", rubro: "Bodas de lujo", ciudad: "Maui", web: "https://mauiloveweddings.com/" },
  { empresa: "Opihi Love", rubro: "Bodas de lujo", ciudad: "Maui", web: "https://opihilove.com/" },
  { empresa: "Mauna Wedding + Events", rubro: "Bodas de lujo", ciudad: "Maui", web: "https://www.maunacreative.com/" },
  { empresa: "Tropical Maui Weddings", rubro: "Bodas de lujo", ciudad: "Maui", web: "https://www.tropicalmauiweddings.com/" },
  { empresa: "Happily Maui'd", rubro: "Bodas de lujo", ciudad: "Maui", web: "https://happilymauid.com/" },

  // ---------- Implantes dentales y cirugía oral (Oʻahu) ----------
  { empresa: "Kaizen Dental Center", rubro: "Implantes dentales", ciudad: "Honolulu", web: "https://kaizendentalhawaii.com/" },
  { empresa: "Smiles Forever", rubro: "Implantes dentales", ciudad: "Honolulu", web: "https://thesmilesforever.com/" },
  { empresa: "Honolulu Smile Design", rubro: "Implantes dentales", ciudad: "Honolulu", web: "https://www.honolulusmiledesign.com/" },
  { empresa: "All Star Dental Care", rubro: "Implantes dentales", ciudad: "Honolulu", web: "https://allstardentalimplantcenter.com/", telefono: "(808) 536-5090" },
  { empresa: "Pacific Dental & Implant Solutions", rubro: "Implantes dentales", ciudad: "Honolulu", web: "https://pdishawaii.com/" },
  { empresa: "Oral Surgery Hawaii", rubro: "Implantes dentales", ciudad: "Honolulu / Aiea / Kaneohe", web: "https://www.oralsurgeryhawaii.com/", telefono: "(808) 973-3747" },
  { empresa: "OMS Hawaii (oms-hawaii.com)", rubro: "Implantes dentales", ciudad: "Honolulu / Aiea", web: "https://www.oms-hawaii.com/" },
  { empresa: "Pacific Maxillofacial Center", rubro: "Implantes dentales", ciudad: "Honolulu", web: "https://www.pacificmaxcenter.com/" },

  // ---------- Cirugía plástica y med spa (Oʻahu) ----------
  { empresa: "Healy Plastic Surgery & Med Spa", rubro: "Cirugía plástica / med spa", ciudad: "Honolulu", web: "https://healyplasticsurgery.com/" },
  { empresa: "The Ferguson Clinic", rubro: "Cirugía plástica / med spa", ciudad: "Honolulu", web: "https://thefergusonclinic.com/" },
  { empresa: "Face and Body Laser", rubro: "Cirugía plástica / med spa", ciudad: "Honolulu", web: "https://faceandbodylaser.com/" },
  { empresa: "Infinity Life Center", rubro: "Cirugía plástica / med spa", ciudad: "Honolulu", web: "https://infinitylifecenter.com/" },

  // ---------- Abogados de accidentes (Oʻahu) ----------
  { empresa: "Cronin, Fried, Sekiya, Kekina & Fairbanks", rubro: "Abogados de accidentes", ciudad: "Honolulu", web: "https://www.croninfried.com/" },
  { empresa: "Davis Levin Livingston", rubro: "Abogados de accidentes", ciudad: "Honolulu", web: "https://www.davislevin.com/" },
  { empresa: "Shim & Chang", rubro: "Abogados de accidentes", ciudad: "Honolulu", web: "https://www.shimchanglawyers.com/" },
  { empresa: "Miyashita & O'Steen", rubro: "Abogados de accidentes", ciudad: "Honolulu", web: "https://molawhawaii.com/" },
  { empresa: "Turbin Chu Heidt", rubro: "Abogados de accidentes", ciudad: "Honolulu", web: "https://www.turbin.net/", telefono: "808-796-5685" },
  { empresa: "Potts & Potts", rubro: "Abogados de accidentes", ciudad: "Hawái", web: "https://www.pottsalc.com/" },

  // ---------- Energía solar (Oʻahu + Maui) ----------
  { empresa: "Independent Energy Hawaii", rubro: "Energía solar", ciudad: "Oʻahu / Maui", web: "https://independentenergyhawaii.com/" },
  { empresa: "ProVision Solar", rubro: "Energía solar", ciudad: "Oʻahu / Maui / Big Island", web: "https://provisionsolar.com/" },
  { empresa: "Pacific Energy Solar", rubro: "Energía solar", ciudad: "Todas las islas", web: "https://www.pacificenergy.solar/" },
  { empresa: "Family First Solar", rubro: "Energía solar", ciudad: "Oʻahu / Maui / Kauaʻi", web: "https://familyfirstsolar.com/" },
  { empresa: "Sunspear Energy", rubro: "Energía solar", ciudad: "Oʻahu / Big Island", web: "https://sunspearenergy.com/" },

  // ---------- Inmobiliarias de lujo (Oʻahu) ----------
  { empresa: "Tracy Allen Hawaii", rubro: "Inmobiliaria de lujo", ciudad: "Honolulu", web: "https://tracyallenhawaii.com/" },
  { empresa: "Alesia Barnes", rubro: "Inmobiliaria de lujo", ciudad: "Honolulu", web: "https://alesiabarnes.com/" },
  { empresa: "Anne Hogan Perry", rubro: "Inmobiliaria de lujo", ciudad: "Honolulu", web: "https://annehoganperry.com/" },
  { empresa: "Kahala Collective", rubro: "Inmobiliaria de lujo", ciudad: "Kahala", web: "https://www.kahalacollective.com/" },
];

export const FUENTE_HAWAII_ALTO_TICKET = "Investigación web — Hawái alto ticket, lote 1, septiembre 2026";
