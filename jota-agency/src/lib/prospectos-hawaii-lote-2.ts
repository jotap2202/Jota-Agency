import type { ProspectoInicial } from "@/lib/prospectos-maui";

/**
 * Lote 2 de prospectos de alto ticket en Hawái — septiembre 2026.
 *
 * Mismas reglas que el lote 1 (ver prospectos-hawaii-alto-ticket.ts): salido
 * de búsquedas web reales, sin empresas inventadas, sin emails adivinados y
 * sin cadenas nacionales. Suma rubros e islas que el lote 1 no tenía:
 * Kauaʻi y Big Island, piscinas, techos, aire acondicionado, remodelaciones,
 * ortodoncia, helicópteros y abogados de sucesiones.
 *
 * Los emails los busca solo la prospección automática (workflow 21) en la
 * web de cada empresa.
 */
export const PROSPECTOS_HAWAII_LOTE_2: ProspectoInicial[] = [
  // ---------- Piscinas a medida (Oʻahu y todas las islas) ----------
  { empresa: "Homeworks Construction", rubro: "Piscinas / construcción", ciudad: "Oʻahu", web: "https://homeworkshawaii.com/" },
  { empresa: "Pacific AquaScapes", rubro: "Piscinas / construcción", ciudad: "Honolulu / Kapolei / Kahului", web: "https://www.pacificaquagroup.com/" },
  { empresa: "Tall Builders LLC", rubro: "Piscinas / construcción", ciudad: "Honolulu", web: "https://tallbuildersllc.com/" },
  { empresa: "Waves Aquatics", rubro: "Piscinas / construcción", ciudad: "Todas las islas", web: "https://www.wavesaquatics.co/" },
  { empresa: "Aquatic Solutions Hawaii", rubro: "Piscinas / construcción", ciudad: "Honolulu", web: "https://aquaticsolutionshi.com/" },
  { empresa: "Pacific Pool & Spa", rubro: "Piscinas / construcción", ciudad: "Kailua / Kapolei", web: "https://www.pacpoolandspa.com/" },
  { empresa: "Neptune Pool and Spa Service", rubro: "Piscinas / construcción", ciudad: "Oʻahu", web: "https://neptunepoolshawaii.com/" },

  // ---------- Remodelaciones de alto nivel (Oʻahu) ----------
  { empresa: "Hilweh Builders", rubro: "Remodelaciones", ciudad: "Honolulu", web: "https://hilwehbuilders.com/" },
  { empresa: "Beyond Builders", rubro: "Remodelaciones", ciudad: "Oʻahu", web: "https://bb-hi.com/" },
  { empresa: "General Contractors Oahu", rubro: "Remodelaciones", ciudad: "Oʻahu", web: "https://www.oahugeneralcontractors.com/" },
  { empresa: "Pivotto's Renovation", rubro: "Remodelaciones", ciudad: "Waialua", web: "https://pivottosrenovation.com/" },
  { empresa: "Top Level Construction", rubro: "Remodelaciones", ciudad: "Oʻahu", web: "https://toplevel.construction/" },

  // ---------- Techos (Oʻahu) ----------
  { empresa: "Surface Shield Roofing", rubro: "Techos", ciudad: "Honolulu / Waipahu", web: "https://www.surfaceshieldroofing.com/", telefono: "(808) 739-9599" },
  { empresa: "Kapili Roofing & Painting", rubro: "Techos", ciudad: "Oʻahu", web: "https://www.kapiliroof.com/" },
  { empresa: "Oahu Roofing & Repairs", rubro: "Techos", ciudad: "Honolulu", web: "https://oahu-roofing.com/" },
  { empresa: "Pamalu Roofing", rubro: "Techos", ciudad: "Todas las islas", web: "https://www.hawaiiroofingexperts.com/" },
  { empresa: "Oahu Roofing Co", rubro: "Techos", ciudad: "Oʻahu", web: "https://oahuroofingco.com/" },
  { empresa: "MRC Roofing", rubro: "Techos", ciudad: "Honolulu", web: "https://mrcroofinghawaii.com/" },
  { empresa: "Elite Roofing Honolulu", rubro: "Techos", ciudad: "Honolulu", web: "https://www.eliteroofinghonolulu.com/" },

  // ---------- Aire acondicionado (Oʻahu y Kauaʻi) ----------
  { empresa: "Island Comfort Air Conditioning", rubro: "Aire acondicionado", ciudad: "Oʻahu / Kauaʻi", web: "https://islandcomfort.com/" },
  { empresa: "AllTemp Hawaii", rubro: "Aire acondicionado", ciudad: "Oʻahu", web: "https://www.alltemphi.com/" },
  { empresa: "Standard Air", rubro: "Aire acondicionado", ciudad: "Hawaii Kai / Kailua", web: "https://standardairhawaii.com/", telefono: "(808) 302-0644" },
  { empresa: "Air Conditioning Concepts", rubro: "Aire acondicionado", ciudad: "Oʻahu", web: "https://acconceptshawaii.com/" },
  { empresa: "KW Air Conditioning", rubro: "Aire acondicionado", ciudad: "Honolulu", web: "https://www.kwachawaii.com/" },
  { empresa: "Igloo AC", rubro: "Aire acondicionado", ciudad: "Kailua", web: "https://www.iglooac.com/" },
  { empresa: "Advanced A/C Contracting", rubro: "Aire acondicionado", ciudad: "Honolulu", web: "https://www.advancedachawaii.com/" },

  // ---------- Ortodoncia (Oʻahu) ----------
  { empresa: "Morita Orthodontics", rubro: "Ortodoncia", ciudad: "Honolulu / Aiea", web: "https://www.moritaorthodontics.com/", telefono: "(808) 941-3355" },
  { empresa: "Dung Orthodontics", rubro: "Ortodoncia", ciudad: "Honolulu / Aiea", web: "https://dungorthodontics.com/" },
  { empresa: "Aloha Smiles Dental", rubro: "Ortodoncia", ciudad: "Honolulu", web: "https://www.alohasmilesdental.com/", telefono: "(808) 888-9331" },
  { empresa: "Hawaii Orthodontist", rubro: "Ortodoncia", ciudad: "Honolulu / Waipahu", web: "https://www.hawaiiorthodontist.com/" },
  { empresa: "Cui & Lin Orthodontics", rubro: "Ortodoncia", ciudad: "Honolulu / Pearl City / Kailua", web: "https://www.cuiandlinortho.com/" },

  // ---------- Estética (Maui) ----------
  { empresa: "Banyan MedSpa Maui", rubro: "Cirugía plástica / med spa", ciudad: "Kihei", web: "https://www.banyanmedspamaui.com/" },
  { empresa: "RevitalizeMaui", rubro: "Cirugía plástica / med spa", ciudad: "Maui", web: "https://www.revitalizemaui.com/" },

  // ---------- Helicópteros (Maui) ----------
  { empresa: "Air Maui Helicopters", rubro: "Charters / tours premium", ciudad: "Kahului", web: "https://airmaui.com/", telefono: "(808) 877-7005" },
  { empresa: "Blue Hawaiian Helicopters", rubro: "Charters / tours premium", ciudad: "Maui / todas las islas", web: "https://www.bluehawaiian.com/" },

  // ---------- Inmobiliarias de lujo (Big Island) ----------
  { empresa: "Locations Hawaii", rubro: "Inmobiliaria de lujo", ciudad: "Big Island / Oʻahu", web: "https://www.locationshawaii.com/" },
  { empresa: "Hawaii Luxury Real Estate", rubro: "Inmobiliaria de lujo", ciudad: "Kohala Coast", web: "https://www.hawaii-luxury-realestate.com/" },
  { empresa: "Penn Henderson, REALTOR", rubro: "Inmobiliaria de lujo", ciudad: "Kona", web: "https://pennhenderson.com/" },
  { empresa: "Marco In Kona", rubro: "Inmobiliaria de lujo", ciudad: "Kailua-Kona", web: "https://marcoinkona.com/" },
  { empresa: "The Papakea Collection", rubro: "Inmobiliaria de lujo", ciudad: "Kailua-Kona", web: "https://thepapakeacollection.com/" },
  { empresa: "Koa Realty", rubro: "Inmobiliaria de lujo", ciudad: "Big Island", web: "https://www.koarealty.com/" },

  // ---------- Villas y alquiler vacacional (Kauaʻi) ----------
  { empresa: "The Parrish Collection Kauai", rubro: "Villas de lujo", ciudad: "Princeville / Poipu", web: "https://www.parrishkauai.com/" },
  { empresa: "Kauai Exclusive Management", rubro: "Villas de lujo", ciudad: "Kauaʻi", web: "https://www.kauaiexclusive.com/" },
  { empresa: "Alekona Kauai", rubro: "Villas de lujo", ciudad: "Poipu", web: "https://alekonakauai.com/" },
  { empresa: "Princeville Vacation Rentals", rubro: "Villas de lujo", ciudad: "Princeville", web: "https://princevillevacationrentals.com/" },
  { empresa: "Dream Vacations Kauai", rubro: "Villas de lujo", ciudad: "Poipu / Princeville", web: "https://www.dreamvacationskauai.com/" },

  // ---------- Bodas de destino (Kauaʻi) ----------
  { empresa: "Alohanas Kauai Weddings", rubro: "Bodas de lujo", ciudad: "Kauaʻi", web: "https://alohanakauaiweddings.com/" },
  { empresa: "Kauai Weddings by Magenta", rubro: "Bodas de lujo", ciudad: "Kauaʻi", web: "https://kauaiweddingsbymagenta.com/" },
  { empresa: "Legacy Events Kauai", rubro: "Bodas de lujo", ciudad: "Kauaʻi", web: "https://legacyeventskauai.com/" },
  { empresa: "Lotus Events & Weddings", rubro: "Bodas de lujo", ciudad: "Kauaʻi", web: "https://www.kauaiweddingplanner.com/" },
  { empresa: "Weddings Kauai", rubro: "Bodas de lujo", ciudad: "Kauaʻi", web: "https://www.wedkauai.com/" },
  { empresa: "Ali'i Kaua'i Weddings", rubro: "Bodas de lujo", ciudad: "Kauaʻi", web: "https://www.aliikauaiweddings.com/" },
  { empresa: "Lifestyle Maven Events", rubro: "Bodas de lujo", ciudad: "Kailua (Oʻahu)", web: "https://lifestylemavenevents.com/" },

  // ---------- Abogados de sucesiones y patrimonio (Oʻahu) ----------
  { empresa: "Reese & Van Atta", rubro: "Abogados de sucesiones", ciudad: "Honolulu", web: "https://rvalawhawaii.com/" },
  { empresa: "Law Office of Keoni Souza", rubro: "Abogados de sucesiones", ciudad: "Honolulu", web: "https://www.keonisouzalaw.com/" },
  { empresa: "Hawaii Trust & Estate Counsel", rubro: "Abogados de sucesiones", ciudad: "Honolulu / Maui / Big Island", web: "https://www.hawaiitrustlaw.com/" },
  { empresa: "Law Office of Samuel K.L. Suen", rubro: "Abogados de sucesiones", ciudad: "Honolulu", web: "https://www.sklslaw.com/" },
  { empresa: "Estate Planning of Honolulu", rubro: "Abogados de sucesiones", ciudad: "Honolulu", web: "https://www.estateplanninghnl.com/" },
  { empresa: "Stephen S. Choi, Attorney at Law", rubro: "Abogados de sucesiones", ciudad: "Honolulu", web: "https://www.stephenchoilaw.com/" },
];

export const FUENTE_HAWAII_LOTE_2 = "Investigación web — Hawái alto ticket, lote 2, septiembre 2026";
