import { ImageResponse } from "next/og";

// Preview que se ve al compartir el link (WhatsApp, LinkedIn, Slack, iMessage).
// Se genera con next/og, que ya viene con Next — no agrega ninguna dependencia.
// Los colores están hardcodeados porque el runtime de la imagen no lee
// globals.css: son los mismos valores de :root (--bg, --gold, --gold-2, --dim).

export const alt = "JOTA agency — Generación de clientes B2B";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#081619",
          backgroundImage:
            "radial-gradient(900px 460px at 50% 0%, rgba(227,179,65,0.16), transparent)",
          padding: 72,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: 20,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "linear-gradient(135deg,#f0c75e,#c99427)",
              color: "#171204",
              fontSize: 40,
              fontWeight: 700,
            }}
          >
            J
          </div>
          <div style={{ color: "#eff6f5", fontSize: 30, fontWeight: 600 }}>
            JOTA agency
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div
            style={{
              color: "#eff6f5",
              fontSize: 66,
              fontWeight: 700,
              lineHeight: 1.15,
              letterSpacing: -1.5,
              maxWidth: 940,
            }}
          >
            Convertimos empresas desconocidas en empresas buscadas
          </div>
          <div style={{ color: "#8fb0ae", fontSize: 30, lineHeight: 1.4, maxWidth: 880 }}>
            Reuniones calificadas en tu agenda, todos los meses.
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 44, height: 3, background: "#e3b341" }} />
          <div
            style={{
              color: "#e3b341",
              fontSize: 22,
              letterSpacing: 3,
              textTransform: "uppercase",
            }}
          >
            Diagnóstico gratis con J
          </div>
        </div>
      </div>
    ),
    size,
  );
}
