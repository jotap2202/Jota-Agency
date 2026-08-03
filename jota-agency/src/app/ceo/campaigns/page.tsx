import { prisma } from "@/lib/prisma";
import { Proximamente } from "@/components/ceo/Proximamente";

export const dynamic = "force-dynamic";
export const metadata = { title: "Campaigns — JOTA CEO", robots: { index: false, follow: false } };

export default async function Pagina() {
  const n = await prisma.campania.count();
  return (
    <Proximamente
      titulo="Campaigns"
      descripcion="Administración de campañas."
      etapa={3}
      dato={{ valor: String(n), label: "Campañas" }}
      incluye={[
        "Alta y edición de campañas con presupuesto, público e industria",
        "Estados Draft / Scheduled / Active / Paused / Completed",
        "Métricas de envío: enviados, respuestas, respuestas positivas",
        "Comparador de campañas por mensaje, audiencia y resultado",
      ]}
    />
  );
}
