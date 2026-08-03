import { prisma } from "@/lib/prisma";
import { Proximamente } from "@/components/ceo/Proximamente";

export const dynamic = "force-dynamic";
export const metadata = { title: "Clients — JOTA CEO", robots: { index: false, follow: false } };

export default async function Pagina() {
  const n = await prisma.cliente.count();
  return (
    <Proximamente
      titulo="Clients"
      descripcion="Clientes activos, salud y rentabilidad."
      etapa={2}
      dato={{ valor: String(n), label: "Clientes" }}
      verEn={{ href: "/ceo", texto: "Ver clientes en riesgo en el Overview" }}
      incluye={[
        "Ficha por cliente con contrato, precio, costo operativo y rentabilidad",
        "Clasificación Healthy / Needs Attention / At Risk / Paused / Cancelled",
        "Alertas de renovación, factura pendiente y caída de comunicación",
        "Resultados entregados: reuniones conseguidas y leads",
        "Recomendaciones de upsell y cross-sell",
      ]}
    />
  );
}
