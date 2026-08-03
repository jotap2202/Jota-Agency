import { prisma } from "@/lib/prisma";
import { Proximamente } from "@/components/ceo/Proximamente";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pipeline — JOTA CEO", robots: { index: false, follow: false } };

export default async function Pagina() {
  const n = await prisma.prospecto.count();
  return (
    <Proximamente
      titulo="Pipeline"
      descripcion="Embudo de ventas estilo Kanban."
      etapa={2}
      dato={{ valor: String(n), label: "Oportunidades" }}
      verEn={{ href: "/ceo", texto: "Ver el embudo en el Overview" }}
      incluye={[
        "Tablero Kanban con las 9 etapas y arrastrar y soltar",
        "Valor total y valor ponderado por probabilidad",
        "Tiempo promedio hasta el cierre y conversión por etapa",
        "Marcado visual de oportunidades estancadas",
        "Próximos cierres estimados",
      ]}
    />
  );
}
