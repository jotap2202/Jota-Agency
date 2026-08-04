import type { MetadataRoute } from "next";

/**
 * Manifiesto de la PWA.
 *
 * Es lo que hace que el navegador ofrezca "Instalar" y que, una vez instalada,
 * la app se abra en su propia ventana sin barra de direcciones — en Android,
 * iOS, Windows y Mac.
 *
 * `start_url` apunta al panel y no a la home: quien instala esto es Jota
 * Agency para trabajar, no un visitante. Los atajos llevan directo a lo que se
 * mira quince veces por día.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "JOTA Command Center",
    short_name: "JOTA",
    description:
      "Panel de JOTA agency: leads, conversaciones del agente 24/7 y estado del negocio.",
    start_url: "/ceo/agent",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#071316",
    theme_color: "#071316",
    lang: "es",
    dir: "ltr",
    categories: ["business", "productivity"],
    icons: [
      { src: "/icono-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icono-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // Android recorta el icono a la forma del sistema. Sin una versión
      // "maskable" con margen, la J queda cortada por la mitad.
      { src: "/icono-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Conversaciones", short_name: "Inbox", url: "/ceo/agent/inbox" },
      { name: "Leads", short_name: "Leads", url: "/ceo/agent/leads" },
      { name: "Salud del agente", short_name: "Salud", url: "/ceo/agent/health" },
    ],
  };
}
