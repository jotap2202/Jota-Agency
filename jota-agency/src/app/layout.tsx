import type { Metadata } from "next";
import { Space_Grotesk, IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import { Providers } from "@/components/Providers";
import { EMAIL_CONTACTO } from "@/lib/contenido";
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

const SITIO = "https://jota-agency.vercel.app";
const TITULO = "JOTA agency — Generación de clientes B2B";
const DESCRIPCION =
  "Nos dedicamos a una sola cosa: conseguirte clientes. Reuniones calificadas en tu agenda, todos los meses.";

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
    locale: "es_AR",
    type: "website",
  },
  // La imagen sale de app/opengraph-image.tsx; Twitter/X la reusa como
  // twitter:image cuando no hay un twitter-image propio.
  twitter: {
    card: "summary_large_image",
    title: TITULO,
    description: DESCRIPCION,
  },
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
  availableLanguage: ["es", "en"],
  serviceType: "Generación de clientes B2B",
  areaServed: "AR",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
        />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
