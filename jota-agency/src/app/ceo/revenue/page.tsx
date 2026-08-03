import { prisma } from "@/lib/prisma";
import { Proximamente } from "@/components/ceo/Proximamente";

export const dynamic = "force-dynamic";
export const metadata = { title: "Revenue — JOTA CEO", robots: { index: false, follow: false } };

export default async function Pagina() {
  const n = await prisma.ingreso.count();
  return (
    <Proximamente
      titulo="Revenue"
      descripcion="Ingresos, gastos y rentabilidad."
      etapa={3}
      dato={{ valor: String(n), label: "Ingresos registrados" }}
      verEn={{ href: "/ceo", texto: "Ver ingresos por servicio en el Overview" }}
      incluye={[
        "Ingresos recurrentes y únicos, gastos, ganancia neta y margen",
        "Cuentas por cobrar, pagos pendientes y flujo de caja",
        "Lifetime value, ticket promedio y runway estimado",
        "Clasificación por cliente, servicio, mes, canal y tipo de pago",
        "Alta manual de ingresos y gastos",
      ]}
    />
  );
}
