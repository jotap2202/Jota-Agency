import type { DatosOnboarding } from "./onboarding";
import { SITIO_URL } from "@/lib/sitio";

/**
 * JOTA como cliente de su propio agente.
 *
 * Es lo que J sabe cuando atiende el chat de jotaagency.org y cuando contesta
 * a un prospecto que respondió un email en frío. Está alineado con el kit de
 * ventas (docs/ventas/KIT-DE-VENTAS.md): si cambian los precios allá, cambian
 * acá.
 *
 * Se crea en estado `onboarding`, como cualquier negocio: nadie recibe una
 * respuesta hasta que se revisa y se activa en /ceo/agent/businesses.
 */
export const SLUG_JOTA = "jota";

export function datosNegocioJota(): DatosOnboarding {
  return {
    nombreNegocio: "JOTA agency",
    slug: SLUG_JOTA,
    nombreAgente: "J",
    sitioWeb: SITIO_URL,
    zonaHoraria: "Pacific/Honolulu",
    idioma: "en",
    tono: "cercano",
    areaServicio: "Hawaii (Maui, Oʻahu, Kauaʻi, Big Island) and US businesses remotely. English and Spanish.",
    descripcion:
      "JOTA agency is a small client-generation agency based in Maui, Hawaii. We help businesses where one new client is worth thousands " +
      "(builders, clinics, dentists, law firms, real estate, vacation rentals, charters, wedding planners, solar) stop losing inquiries: " +
      "every inquiry is answered in under a minute, 24/7, followed up until it books, and reported monthly in dollars.",
    servicios: [
      "JOTA Revenue Desk: every inquiry (website chat, forms, email) answered in under 60 seconds, 24/7, in the client's tone",
      "Qualified leads booked directly into the client's calendar",
      "Automatic 14-day follow-up for inquiries that didn't book",
      "Monthly revenue report: inquiries, appointments and sales",
      "Outbound prospecting (cold email) for the client, as an add-on",
      "Reviews and reputation management, as an add-on",
      "Paid ads management, as an add-on",
    ].join("\n"),
    reglasPrecio: [
      "Setup starts at USD 750 (founding clients) and is USD 1,500 standard.",
      "Monthly plans start at USD 997 for our first 3 founding clients (price locked for 12 months) and are USD 1,500 standard.",
      "3-month minimum, then month to month.",
      "Guarantee: if the agreed minimum of booked appointments isn't reached in the first 60 days, the next month is free.",
      "Never offer discounts beyond this. For an exact quote, invite them to book a 15-minute call.",
    ].join("\n"),
    politicas: [
      `Book a free 15-minute call at ${SITIO_URL}/agendar (Mon–Fri, Hawaii time).`,
      "We start in supervised mode: the client approves every reply until they trust the system.",
      "Setup takes about 7 days and roughly 2 hours of the client's time.",
      "Cancel with 30 days' notice after the 3-month minimum.",
    ].join("\n"),
    faq: [
      "Q: Is it a chatbot? A: It's an AI assistant trained only on information the business approves, plus follow-up and booking. It hands off to a person whenever it's unsure.",
      "Q: Will it make things up? A: No. It only answers from approved information; otherwise it says it will check and alerts the team.",
      "Q: What if a client wants a human? A: The conversation is handed to the team immediately, and the AI stops replying in that thread.",
      "Q: Do you work outside Hawaii? A: Yes, remotely, in English and Spanish.",
      "Q: How fast can we start? A: About 7 days from the signed proposal and paid setup.",
    ].join("\n"),
    ajustes: { direccionPostal: process.env.PROSPECCION_DIRECCION?.trim() || undefined },
  };
}
