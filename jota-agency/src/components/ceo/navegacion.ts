/** Secciones del Command Center. Fuente única para el sidebar y el CMD+K. */
export const SECCIONES = [
  { href: "/ceo", nombre: "Overview", ico: "◧" },
  { href: "/ceo/leads", nombre: "Leads", ico: "◇" },
  { href: "/ceo/pipeline", nombre: "Pipeline", ico: "⇥" },
  { href: "/ceo/clients", nombre: "Clients", ico: "◉" },
  { href: "/ceo/agent", nombre: "24/7 AI Agent", ico: "◆" },
  { href: "/ceo/marketing", nombre: "Marketing", ico: "◈" },
  { href: "/ceo/campaigns", nombre: "Campaigns", ico: "✦" },
  { href: "/ceo/revenue", nombre: "Revenue", ico: "$" },
  { href: "/ceo/goals", nombre: "Goals", ico: "◎" },
  { href: "/ceo/tasks", nombre: "CEO Tasks", ico: "✓" },
  { href: "/ceo/insights", nombre: "AI Insights", ico: "✳" },
  { href: "/ceo/reports", nombre: "Reports", ico: "▤" },
  { href: "/ceo/settings", nombre: "Settings", ico: "⚙" },
] as const;

export type ItemBusqueda = {
  id: string;
  titulo: string;
  detalle: string;
  tipo: "Lead" | "Cliente" | "Campaña" | "Tarea" | "Sección";
  href: string;
};
