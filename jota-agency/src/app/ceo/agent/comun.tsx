import Link from "next/link";
import type { Tenant } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/** Piezas compartidas por las páginas del 24/7 AI Agent. */

export const SUBSECCIONES = [
  { href: "/ceo/agent", nombre: "Overview" },
  { href: "/ceo/agent/inbox", nombre: "Live Inbox" },
  { href: "/ceo/agent/leads", nombre: "Leads" },
  { href: "/ceo/agent/knowledge", nombre: "Knowledge" },
  { href: "/ceo/agent/settings", nombre: "Settings" },
  { href: "/ceo/agent/health", nombre: "Health" },
  { href: "/ceo/agent/businesses", nombre: "Businesses" },
] as const;

export type Params = { [k: string]: string | string[] | undefined };

/**
 * Qué negocio se está mirando.
 *
 * Va en la URL (`?n=slug`) y no en una cookie a propósito: así un link a una
 * conversación siempre abre el negocio correcto, aunque lo mande otra persona.
 */
export async function resolverTenant(sp: Params): Promise<{ t: Tenant | null; todos: { id: string; slug: string; nombreNegocio: string; estado: string; esDemo: boolean }[] }> {
  const todos = await prisma.tenant.findMany({
    select: { id: true, slug: true, nombreNegocio: true, estado: true, esDemo: true },
    orderBy: [{ esDemo: "asc" }, { createdAt: "asc" }],
  });
  if (todos.length === 0) return { t: null, todos };

  const pedido = typeof sp.n === "string" ? sp.n : null;
  const elegido = (pedido && todos.find((x) => x.slug === pedido)) || todos[0];
  const t = await prisma.tenant.findUnique({ where: { id: elegido.id } });
  return { t, todos };
}

export function enlace(href: string, slug?: string): string {
  return slug ? `${href}?n=${encodeURIComponent(slug)}` : href;
}

export function Cabecera({
  titulo,
  descripcion,
  tenant,
  todos,
  activo,
  extra,
}: {
  titulo: string;
  descripcion: string;
  tenant: Tenant | null;
  todos: { slug: string; nombreNegocio: string; estado: string }[];
  activo: string;
  extra?: React.ReactNode;
}) {
  return (
    <>
      <div className="ceo-seccion-head" style={{ marginBottom: 14 }}>
        <div>
          <h1 className="ceo-h2" style={{ fontSize: 20 }}>{titulo}</h1>
          <p className="ceo-sub">{descripcion}</p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {extra}
          {tenant && (
            <span className={`ceo-chip ${tenant.estado === "activo" ? "ceo-chip-green" : "ceo-chip-gris"}`}>
              {tenant.estado}
            </span>
          )}
        </div>
      </div>

      {todos.length > 1 && (
        <div className="ceo-scroll-x" style={{ marginBottom: 12 }}>
          <div style={{ display: "flex", gap: 6 }}>
            {todos.map((x) => (
              <Link
                key={x.slug}
                href={enlace(activo, x.slug)}
                className={`ceo-chip ${tenant?.slug === x.slug ? "ceo-chip-gold" : "ceo-chip-gris"}`}
                style={{ textDecoration: "none", whiteSpace: "nowrap" }}
              >
                {x.nombreNegocio}
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="ceo-scroll-x" style={{ marginBottom: 18 }}>
        <nav style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--c-line)" }}>
          {SUBSECCIONES.map((s) => (
            <Link
              key={s.href}
              href={enlace(s.href, tenant?.slug)}
              style={{
                padding: "8px 12px", fontSize: 13, textDecoration: "none", whiteSpace: "nowrap",
                color: activo === s.href ? "var(--c-text)" : "var(--c-dim)",
                borderBottom: activo === s.href ? "2px solid var(--c-gold)" : "2px solid transparent",
                marginBottom: -1,
              }}
            >
              {s.nombre}
            </Link>
          ))}
        </nav>
      </div>
    </>
  );
}

/** Estado vacío honesto: dice exactamente qué hacer, con los dos botones. */
export function SinNegocios() {
  return (
    <div className="ceo-card" style={{ textAlign: "center", padding: "48px 24px" }}>
      <h2 className="ceo-h2" style={{ fontSize: 17 }}>Todavía no hay ningún negocio configurado</h2>
      <p className="ceo-sub" style={{ maxWidth: 460, margin: "8px auto 20px" }}>
        El 24/7 AI Agent es multiempresa: cada negocio tiene su configuración, su base de
        conocimiento y sus datos, completamente separados. Cargá el negocio de demostración para
        ver el sistema funcionando de punta a punta, o dá de alta un cliente real.
      </p>
      <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
        <Link href="/ceo/agent/businesses" className="ceo-btn ceo-btn-gold" style={{ textDecoration: "none" }}>
          Dar de alta un negocio
        </Link>
      </div>
    </div>
  );
}

export function Kpi({ label, valor, sub }: { label: string; valor: string; sub?: string }) {
  return (
    <div className="ceo-kpi">
      <div className="k-l">{label}</div>
      <div className="k-v">{valor}</div>
      {sub && <div className="k-s">{sub}</div>}
    </div>
  );
}

/** Un número que puede no existir. Nunca muestra 0 cuando el dato falta. */
export function num(v: number | null | undefined, sufijo = ""): string {
  return v === null || v === undefined ? "—" : `${Math.round(v * 10) / 10}${sufijo}`;
}

export function pct(v: number | null): string {
  return v === null ? "—" : `${Math.round(v * 100)}%`;
}

export function centavos(v: number | null): string {
  if (v === null) return "—";
  return `US$ ${(v / 100).toFixed(2)}`;
}
