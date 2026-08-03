import { prisma } from "@/lib/prisma";
import { Proximamente } from "@/components/ceo/Proximamente";

export const dynamic = "force-dynamic";
export const metadata = { title: "Marketing — JOTA CEO", robots: { index: false, follow: false } };

export default async function Pagina() {
  const n = await prisma.campania.count();
  return (
    <Proximamente
      titulo="Marketing"
      descripcion="Rendimiento por canal de adquisición."
      etapa={3}
      dato={{ valor: String(n), label: "Campañas" }}
      verEn={{ href: "/ceo", texto: "Ver la tabla por canal en el Overview" }}
      incluye={[
        "Los 12 canales con inversión, leads, reuniones, ventas e ingresos",
        "Costo por lead, costo por reunión, CAC, conversión y ROI por canal",
        "Comparación entre canales: cuál escalar y cuál pausar",
        "Recomendación de reasignación de presupuesto",
      ]}
    />
  );
}
