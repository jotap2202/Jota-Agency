import { Proximamente } from "@/components/ceo/Proximamente";

export const dynamic = "force-dynamic";
export const metadata = { title: "AI Insights — JOTA CEO", robots: { index: false, follow: false } };

export default async function Pagina() {
  return (
    <Proximamente
      titulo="AI Insights"
      descripcion="JOTA AI Advisor."
      etapa={4}
      verEn={{ href: "/ceo", texto: "El motor ya funciona: mirá el CEO Daily Briefing" }}
      incluye={[
        "Recomendaciones con situación, motivo, impacto, acción y métrica a mejorar",
        "Análisis de qué industrias convierten mejor",
        "Detección de propuestas sin seguimiento y clientes en riesgo",
        "Comparación de costo por reunión entre canales",
        "Aviso explícito cuando falta información en vez de suponerla",
      ]}
    />
  );
}
