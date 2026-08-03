import { prisma } from "@/lib/prisma";
import { Proximamente } from "@/components/ceo/Proximamente";

export const dynamic = "force-dynamic";
export const metadata = { title: "Goals — JOTA CEO", robots: { index: false, follow: false } };

export default async function Pagina() {
  const n = await prisma.objetivo.count();
  return (
    <Proximamente
      titulo="Goals"
      descripcion="Objetivos mensuales, trimestrales y anuales."
      etapa={3}
      dato={{ valor: String(n), label: "Objetivos" }}
      verEn={{ href: "/ceo", texto: "Ver el objetivo del mes en el Overview" }}
      incluye={[
        "Objetivos por métrica: ingresos, clientes, reuniones, leads, MRR, tasa de cierre",
        "Valor inicial, actual, objetivo, porcentaje y fecha límite",
        "Estados On Track / At Risk / Behind / Completed",
        "Cuánto producir por día o semana para recuperar un objetivo atrasado",
      ]}
    />
  );
}
