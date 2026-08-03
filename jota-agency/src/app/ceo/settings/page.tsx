import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { CargarDemo } from "@/components/ceo/CargarDemo";
import { MONEDA } from "@/lib/ceo/dinero";
import { ZONA } from "@/lib/zona";

export const dynamic = "force-dynamic";
export const metadata = { title: "Settings — JOTA CEO", robots: { index: false, follow: false } };

export default async function SettingsPage() {
  const session = await auth();

  const [demoLeads, demoClientes, demoIngresos, demoCampanias, demoTareas, realLeads, realClientes, realIngresos] =
    await Promise.all([
      prisma.prospecto.count({ where: { esDemo: true } }),
      prisma.cliente.count({ where: { esDemo: true } }),
      prisma.ingreso.count({ where: { esDemo: true } }),
      prisma.campania.count({ where: { esDemo: true } }),
      prisma.tareaCeo.count({ where: { esDemo: true } }),
      prisma.prospecto.count({ where: { esDemo: false } }),
      prisma.cliente.count({ where: { esDemo: false } }),
      prisma.ingreso.count({ where: { esDemo: false } }),
    ]);

  const totalDemo = demoLeads + demoClientes + demoIngresos + demoCampanias + demoTareas;

  return (
    <div className="ceo-anim">
      <div className="ceo-seccion-head" style={{ marginBottom: 18 }}>
        <div>
          <h1 className="ceo-h2" style={{ fontSize: 20 }}>Settings</h1>
          <p className="ceo-sub">Configuración del Command Center.</p>
        </div>
      </div>

      {/* ---------- datos demo ---------- */}
      <div className="ceo-card" style={{ marginBottom: 16 }}>
        <h2 className="ceo-h2">Datos de ejemplo</h2>
        <p className="ceo-sub" style={{ marginTop: 5, lineHeight: 1.65, maxWidth: 620 }}>
          Empresas ficticias para probar el tablero sin cargar nada. Están marcadas en la base
          de datos, así que se borran todas de una sin tocar lo que cargues vos.
        </p>

        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", margin: "18px 0" }}>
          {[
            ["Leads", demoLeads, realLeads],
            ["Clientes", demoClientes, realClientes],
            ["Ingresos", demoIngresos, realIngresos],
            ["Campañas", demoCampanias, null],
            ["Tareas", demoTareas, null],
          ].map(([l, demo, real]) => (
            <div key={String(l)} style={{ border: "1px solid var(--c-line)", borderRadius: 10, padding: "11px 13px" }}>
              <div style={{ fontSize: 11, color: "var(--c-dim)" }}>{String(l)}</div>
              <div style={{ fontSize: 19, fontWeight: 600, marginTop: 3 }}>{String(demo)}</div>
              <div style={{ fontSize: 10.5, color: "var(--c-dim)" }}>
                demo{real !== null ? ` · ${real} reales` : ""}
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <CargarDemo />
          {totalDemo > 0 && <CargarDemo modo="borrar" />}
        </div>

        {totalDemo > 0 && (
          <p style={{ fontSize: 12, color: "var(--c-dim)", marginTop: 12 }}>
            Volver a cargar reemplaza los datos demo actuales por un juego nuevo.
          </p>
        )}
      </div>

      {/* ---------- configuración ---------- */}
      <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(290px, 1fr))" }}>
        <div className="ceo-card">
          <h2 className="ceo-h2">Sesión y permisos</h2>
          <dl style={{ marginTop: 12, display: "grid", gap: 10, fontSize: 13 }}>
            <div>
              <dt style={{ fontSize: 11, color: "var(--c-dim)" }}>Cuenta</dt>
              <dd style={{ fontFamily: "var(--font-mono), monospace", wordBreak: "break-all" }}>{session?.user?.email}</dd>
            </div>
            <div>
              <dt style={{ fontSize: 11, color: "var(--c-dim)" }}>Rol</dt>
              <dd>CEO / Administrador</dd>
            </div>
          </dl>
          <p style={{ fontSize: 12, color: "var(--c-dim)", marginTop: 14, lineHeight: 1.6 }}>
            Quién puede entrar se controla con la variable <code>ADMIN_EMAILS</code> en Vercel,
            separando los correos con comas. Sin esa variable, entra la primera cuenta creada en
            el sitio.
          </p>
        </div>

        <div className="ceo-card">
          <h2 className="ceo-h2">Región y moneda</h2>
          <dl style={{ marginTop: 12, display: "grid", gap: 10, fontSize: 13 }}>
            <div>
              <dt style={{ fontSize: 11, color: "var(--c-dim)" }}>Moneda</dt>
              <dd>{MONEDA}</dd>
            </div>
            <div>
              <dt style={{ fontSize: 11, color: "var(--c-dim)" }}>Zona horaria</dt>
              <dd>{ZONA} (UTC−10, sin horario de verano)</dd>
            </div>
          </dl>
          <p style={{ fontSize: 12, color: "var(--c-dim)", marginTop: 14, lineHeight: 1.6 }}>
            Todos los cortes de mes, los vencimientos y el cálculo de “hoy” usan la hora de Maui,
            no la del servidor.
          </p>
        </div>

        <div className="ceo-card">
          <h2 className="ceo-h2">Integraciones</h2>
          <p className="ceo-sub" style={{ marginTop: 5, lineHeight: 1.65 }}>
            Todavía no hay ninguna conectada. Los datos se cargan a mano o con el importador CSV.
          </p>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 14 }}>
            {["Gmail", "Google Calendar", "Stripe", "LinkedIn", "Meta Ads", "Google Ads", "Analytics", "Calendly", "Slack", "Apollo", "Instantly", "Zapier", "n8n"].map((i) => (
              <span key={i} className="ceo-chip ceo-chip-gris">{i}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
