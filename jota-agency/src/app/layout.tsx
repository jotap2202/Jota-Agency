import type { Metadata, Viewport } from "next";
import { Space_Grotesk, IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import { Providers } from "@/components/Providers";
import { RegistrarSW } from "@/components/RegistrarSW";
import { EMAIL_CONTACTO } from "@/lib/contenido";
import { idiomaActual } from "@/lib/idioma-servidor";
import { SITIO_URL } from "@/lib/sitio";
import "./globals.css";

const display = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "700"],
  variable: "--font-display",
  display: "swap",
});
const body = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-body",
  display: "swap",
});
const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["500"],
  variable: "--font-mono",
  display: "swap",
});

// La web habla inglés por defecto, así que la metadata —lo que ve Google y
// lo que se muestra al compartir el link— va en inglés. El castellano es la
// alternativa que el visitante elige con el toggle, pero no tiene URL propia,
// así que no hay una versión en castellano que indexar (ni hreflang que
// declarar apuntando a una URL que no existe).
const SITIO = SITIO_URL;
const TITULO = "JOTA agency — B2B client generation";
const DESCRIPCION =
  "We do one thing: get you clients. Qualified meetings on your calendar, every month.";

export const metadata: Metadata = {
  metadataBase: new URL(SITIO),
  title: TITULO,
  description: DESCRIPCION,
  alternates: { canonical: "/" },
  openGraph: {
    title: TITULO,
    description: DESCRIPCION,
    url: "/",
    siteName: "JOTA agency",
    locale: "en_US",
    alternateLocale: "es_US",
    type: "website",
  },
  // La imagen sale de app/opengraph-image.tsx; Twitter/X la reusa como
  // twitter:image cuando no hay un twitter-image propio.
  twitter: {
    card: "summary_large_image",
    title: TITULO,
    description: DESCRIPCION,
  },
  // PWA. iOS ignora buena parte del manifiesto, así que hace falta repetirle
  // las cosas por separado: sin esto, "Agregar a inicio" abre Safari con la
  // barra de direcciones en vez de una app, y usa una captura de la página
  // como ícono.
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "JOTA", statusBarStyle: "black-translucent" },
  icons: {
    icon: "/icon.svg",
    apple: [{ url: "/icono-192.png", sizes: "180x180", type: "image/png" }],
  },
  other: {
    // Next 15 emite el `mobile-web-app-capable` moderno. Safari recién lo
    // entiende en versiones nuevas, así que se agrega también el viejo: los
    // iPhone que no estén al día abren la app con la barra de direcciones.
    "apple-mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  themeColor: "#071316",
  width: "device-width",
  initialScale: 1,
  // El notch del iPhone: sin esto, la app instalada deja franjas negras.
  viewportFit: "cover",
};

// Datos estructurados para que Google entienda qué es JOTA (y no lo deduzca
// del texto). Solo afirmamos lo que es verificable en el sitio: nombre, qué
// hace, idiomas y cómo contactarnos — nada de reviews, ratings ni direcciones
// inventadas, que además Google penaliza si no son reales.
const JSON_LD = {
  "@context": "https://schema.org",
  "@type": "ProfessionalService",
  "@id": `${SITIO}/#organizacion`,
  name: "JOTA agency",
  url: SITIO,
  description: DESCRIPCION,
  email: EMAIL_CONTACTO,
  availableLanguage: ["en", "es"],
  serviceType: "B2B client generation",
  // JOTA opera desde Maui y sus clientes están ahí: decírselo a Google es
  // lo que hace que aparezca en búsquedas locales del rubro. Solo se afirma
  // isla, estado y país — sin dirección postal, que no corresponde inventar.
  areaServed: { "@type": "Place", name: "Maui, Hawaii" },
  address: { "@type": "PostalAddress", addressRegion: "HI", addressCountry: "US" },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // El <html lang> tiene que coincidir con el idioma que realmente se
  // renderiza, o los lectores de pantalla leen el texto con la pronunciación
  // del idioma equivocado.
  const lang = await idiomaActual();

  return (
    <html lang={lang} className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
        />
        <Providers>{children}</Providers>
        <RegistrarSW />
      </body>
    </html>
  );
}
