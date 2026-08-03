import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { esAdmin } from "@/lib/admin";
import { Marco } from "@/components/ceo/Marco";
import type { ItemBusqueda } from "@/components/ceo/navegacion";
import { dinero } from "@/lib/ceo/dinero";
import { fechaHora } from "@/lib/zona";
import "./ceo.css";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "JOTA CEO Command Center",
  robots: { index: false, follow: false },
  alternates: { canonical: "/ceo" },
};

/**
 * Evita el parpadeo de tema: se ejecuta antes del primer pintado, así la
 * página no aparece oscura y salta a clara. Sin esto, el usuario de modo
 * claro ve un fogonazo negro en cada navegación.
 */
const SCRIPT_TEMA = `try{var d=document.documentElement;var t=localStorage.getItem('ceo-tema');if(t==='claro'||t==='oscuro'){d.dataset.tema=t}var s=localStorage.getItem('ceo-side');if(s==='min'||s==='ancho'){d.dataset.side=s}}catch(e){}`;

export default async function CeoLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/acceder?next=/ceo");
  if (!(await esAdmin(session.user.email))) redirect("/panel");

  const [notis, prospectos, clientes, campanias, tareas, demo] = await Promise.all([
    prisma.notificacion.findMany({ orderBy: [{ leida: "asc" }, { createdAt: "desc" }], take: 25 }),
    prisma.prospecto.findMany({ select: { id: true, empresa: true, estado: true, ciudad: true }, take: 400 }),
    prisma.cliente.findMany({ select: { id: true, empresa: true, servicio: true }, take: 200 }),
    prisma.campania.findMany({ select: { id: true, nombre: true, canal: true, gastado: true }, take: 200 }),
    prisma.tareaCeo.findMany({ where: { estado: { not: "hecha" } }, select: { id: true, titulo: true, categoria: true }, take: 200 }),
    prisma.prospecto.count({ where: { esDemo: true } }),
  ]);

  const indice: ItemBusqueda[] = [
    ...prospectos.map((p) => ({
      id: `l-${p.id}`, titulo: p.empresa, detalle: `${p.ciudad ?? "—"} · ${p.estado}`,
      tipo: "Lead" as const, href: "/ceo/leads",
    })),
    ...clientes.map((c) => ({
      id: `c-${c.id}`, titulo: c.empresa, detalle: c.servicio,
      tipo: "Cliente" as const, href: "/ceo/clients",
    })),
    ...campanias.map((c) => ({
      id: `k-${c.id}`, titulo: c.nombre, detalle: `${c.canal} · ${dinero(c.gastado)} gastados`,
      tipo: "Campaña" as const, href: "/ceo/campaigns",
    })),
    ...tareas.map((t) => ({
      id: `t-${t.id}`, titulo: t.titulo, detalle: t.categoria,
      tipo: "Tarea" as const, href: "/ceo/tasks",
    })),
  ];

  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: SCRIPT_TEMA }} />
      <div className="ceo">
        <Marco
          email={session.user.email ?? "CEO"}
          hayDemo={demo > 0}
          indice={indice}
          notificaciones={notis.map((n) => ({
            id: n.id, tipo: n.tipo, titulo: n.titulo,
            detalle: n.detalle ?? "", url: n.url ?? "/ceo",
            leida: n.leida, cuando: fechaHora(n.createdAt),
          }))}
        >
          {children}
        </Marco>
      </div>
    </>
  );
}
