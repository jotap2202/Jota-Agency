import { Proximamente } from "@/components/ceo/Proximamente";

export const dynamic = "force-dynamic";
export const metadata = { title: "Reports — JOTA CEO", robots: { index: false, follow: false } };

export default async function Pagina() {
  return (
    <Proximamente
      titulo="Reports"
      descripcion="Reportes ejecutivos exportables."
      etapa={4}
      incluye={[
        "Reportes diario, semanal, mensual, trimestral y personalizado",
        "Tipos: ejecutivo, ventas, marketing, ingresos, clientes, campañas, objetivos",
        "Exportar a PDF y CSV, imprimir y compartir por enlace seguro",
        "Reporte semanal automático con problemas, oportunidades y acciones",
      ]}
    />
  );
}
