import { prisma } from "@/lib/prisma";
import { Proximamente } from "@/components/ceo/Proximamente";

export const dynamic = "force-dynamic";
export const metadata = { title: "Leads — JOTA CEO", robots: { index: false, follow: false } };

export default async function Pagina() {
  const n = await prisma.prospecto.count();
  return (
    <Proximamente
      titulo="Leads"
      descripcion="CRM de potenciales clientes."
      etapa={2}
      dato={{ valor: String(n), label: "Leads cargados" }}
      verEn={{ href: "/ceo", texto: "Ver los mejores leads en el Overview" }}
      incluye={[
        "Tabla completa con los 24 campos del lead (cargo, industria, país, LinkedIn, empleados, facturación estimada)",
        "Filtros por industria, estado, servicio, responsable, país y fuente",
        "Importar y exportar CSV, con detección de duplicados",
        "Registro de llamadas, emails y notas con historial de actividad",
        "Selección múltiple y acciones masivas",
        "Lead score de 0 a 100 con el detalle de por qué",
      ]}
    />
  );
}
