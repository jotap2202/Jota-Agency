import { prisma } from "@/lib/prisma";
import { Proximamente } from "@/components/ceo/Proximamente";

export const dynamic = "force-dynamic";
export const metadata = { title: "CEO Tasks — JOTA CEO", robots: { index: false, follow: false } };

export default async function Pagina() {
  const n = await prisma.tareaCeo.count({ where: { estado: { not: "hecha" } } });
  return (
    <Proximamente
      titulo="CEO Tasks"
      descripcion="Tareas ordenadas por impacto en ingresos."
      etapa={4}
      dato={{ valor: String(n), label: "Tareas pendientes" }}
      incluye={[
        "Las 8 categorías con prioridad Critical / High / Medium / Low",
        "Vista Today's Highest-Impact Actions con priorización automática",
        "Vínculo de cada tarea con un lead, cliente, campaña u objetivo",
        "Impacto estimado en ingresos por tarea",
      ]}
    />
  );
}
