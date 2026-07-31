import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Panel — JOTA agency",
  description: "Panel privado de leads.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
