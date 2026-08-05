import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { fechaHora } from "@/lib/zona";
import { pendientesParaActivar } from "@/lib/agente/onboarding";
import { Cabecera, resolverTenant, enlace, type Params } from "../comun";
import {
  accionCrearNegocio, accionActivarNegocio, accionPausarNegocio,
  accionCargarDemo, accionBorrarDemo,
} from "../acciones";

export const dynamic = "force-dynamic";
export const metadata = { title: "Businesses — JOTA CEO", robots: { index: false, follow: false } };

export default async function Pagina({ searchParams }: { searchParams: Promise<Params> }) {
  const sp = await searchParams;
  const { t, todos } = await resolverTenant(sp);

  const negocios = await prisma.tenant.findMany({
    orderBy: [{ esDemo: "asc" }, { createdAt: "asc" }],
    include: {
      _count: { select: { conversaciones: true, leads: true, fragmentos: true, miembros: true } },
    },
  });

  const pendientes = Object.fromEntries(
    await Promise.all(negocios.map(async (n) => [n.id, await pendientesParaActivar(n.id)] as const)),
  ) as Record<string, string[]>;

  const hayDemo = negocios.some((n) => n.esDemo);

  return (
    <div className="ceo-anim">
      <Cabecera
        titulo="Negocios"
        descripcion="Cada cliente con su configuración, su conocimiento y sus datos, separados."
        tenant={t}
        todos={todos}
        activo="/ceo/agent/businesses"
        extra={
          hayDemo ? (
            <form action={accionBorrarDemo}>
              <button className="ceo-btn" type="submit">Borrar demo</button>
            </form>
          ) : (
            <form action={accionCargarDemo}>
              <button className="ceo-btn ceo-btn-gold" type="submit">Cargar negocio de demo</button>
            </form>
          )
        }
      />

      {negocios.length > 0 && (
        <div className="ceo-card ceo-card-pad-0" style={{ marginBottom: 20 }}>
          <div className="ceo-scroll-x">
            <table className="ceo-tabla">
              <thead>
                <tr>
                  <th>Negocio</th><th>Estado</th><th>Modo</th>
                  <th>Conversaciones</th><th>Leads</th><th>Conocimiento</th>
                  <th>Acciones</th><th>Alta</th>
                </tr>
              </thead>
              <tbody>
                {negocios.map((n) => (
                  <tr key={n.id}>
                    <td>
                      <Link href={enlace("/ceo/agent", n.slug)} style={{ color: "var(--c-text)" }}>
                        {n.nombreNegocio}
                      </Link>
                      {n.esDemo && <span className="ceo-chip ceo-chip-gris" style={{ marginLeft: 6 }}>demo</span>}
                      <div style={{ fontSize: 11.5, color: "var(--c-dim)" }}>
                        {n.slug} · {n.zonaHoraria}
                      </div>
                    </td>
                    <td>
                      <span className={`ceo-chip ${n.estado === "activo" ? "ceo-chip-green" : n.estado === "pausado" ? "ceo-chip-red" : "ceo-chip-gold"}`}>
                        {n.estado}
                      </span>
                    </td>
                    <td>{n.modo}</td>
                    <td>{n._count.conversaciones}</td>
                    <td>{n._count.leads}</td>
                    <td>
                      {n._count.fragmentos} fragmentos
                      <div style={{ fontSize: 11.5, color: "var(--c-dim)" }}>{n._count.miembros} en el equipo</div>
                    </td>
                    <td>
                      {n.estado === "activo" ? (
                        <form action={accionPausarNegocio}>
                          <input type="hidden" name="tenantId" value={n.id} />
                          <button className="ceo-btn" type="submit" style={{ fontSize: 12, padding: "4px 8px" }}>Pausar</button>
                        </form>
                      ) : pendientes[n.id]?.length ? (
                        <div style={{ fontSize: 11.5, color: "var(--c-gold)" }}>
                          Falta:
                          <ul style={{ margin: "2px 0 0", paddingLeft: 16 }}>
                            {pendientes[n.id].map((p) => <li key={p}>{p}</li>)}
                          </ul>
                          <Link href={enlace("/ceo/agent/settings", n.slug)} style={{ fontSize: 11.5 }}>Configurar →</Link>
                        </div>
                      ) : (
                        <form action={accionActivarNegocio}>
                          <input type="hidden" name="tenantId" value={n.id} />
                          <button className="ceo-btn ceo-btn-gold" type="submit" style={{ fontSize: 12, padding: "4px 8px" }}>Activar</button>
                        </form>
                      )}
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>{fechaHora(n.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="ceo-card">
        <div className="ceo-label" style={{ marginBottom: 6 }}>Dar de alta un negocio</div>
        <p className="ceo-sub" style={{ margin: "0 0 16px", fontSize: 12.5 }}>
          Con esto se crea el tenant, se indexa el conocimiento y se genera la línea de instalación.
          <strong> Arranca siempre en modo supervisado y sin activar</strong>: el agente no le contesta
          a nadie hasta que probaste las respuestas y lo activaste vos.
        </p>

        <form action={accionCrearNegocio}>
          <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", marginBottom: 12 }}>
            <C label="Nombre del negocio *" name="nombreNegocio" req placeholder="Valley Isle Plumbing & Air" />
            <C label="Sitio web" name="sitioWeb" placeholder="https://…" />
            <C label="Zona horaria" name="zonaHoraria" def="Pacific/Honolulu" />
            <C label="Nombre del agente" name="nombreAgente" placeholder="Ava" />
            <label style={{ display: "block", fontSize: 12.5 }}>
              <span style={{ color: "var(--c-dim)", display: "block", marginBottom: 4 }}>Idioma</span>
              <select name="idioma" className="ceo-input" style={{ width: "100%" }}>
                <option value="en">en</option>
                <option value="es">es</option>
              </select>
            </label>
            <label style={{ display: "block", fontSize: 12.5 }}>
              <span style={{ color: "var(--c-dim)", display: "block", marginBottom: 4 }}>Tono</span>
              <select name="tono" className="ceo-input" style={{ width: "100%" }}>
                <option value="profesional">profesional</option>
                <option value="cercano">cercano</option>
                <option value="formal">formal</option>
                <option value="directo">directo</option>
              </select>
            </label>
          </div>

          <A label="Qué hace el negocio" name="descripcion" rows={3} placeholder="Dos o tres líneas. Es lo que el agente puede decir sobre la empresa." />
          <A label="Servicios (uno por línea) *" name="servicios" rows={6} placeholder={"Emergency plumbing repair\nWater heater replacement\nDrain cleaning"} />
          <C label="Área de servicio" name="areaServicio" placeholder="Maui: Kahului, Wailuku, Kihei…" full />
          <A
            label="Precios que el agente PUEDE mencionar"
            name="reglasPrecio"
            rows={4}
            placeholder="Si lo dejás vacío, el agente no habla de precios: dice que depende del caso y ofrece pasar con el equipo."
          />
          <A label="Políticas" name="politicas" rows={3} placeholder="Garantías, formas de pago, cancelaciones, qué NO hacen." />
          <A label="Preguntas frecuentes" name="faq" rows={6} placeholder={"Q: ¿Atienden los fines de semana?\nA: Sábados de 8 a 12."} />
          <A label="Emails del equipo que recibe avisos (uno por línea)" name="equipo" rows={2} placeholder="owner@negocio.com" />

          <button className="ceo-btn ceo-btn-gold" type="submit">Crear negocio</button>
        </form>
      </div>
    </div>
  );
}

function C({ label, name, def, placeholder, req, full }: {
  label: string; name: string; def?: string; placeholder?: string; req?: boolean; full?: boolean;
}) {
  return (
    <label style={{ display: "block", fontSize: 12.5, marginBottom: full ? 12 : 0 }}>
      <span style={{ color: "var(--c-dim)", display: "block", marginBottom: 4 }}>{label}</span>
      <input name={name} defaultValue={def} placeholder={placeholder} required={req} className="ceo-input" style={{ width: "100%" }} />
    </label>
  );
}

function A({ label, name, rows, placeholder }: { label: string; name: string; rows: number; placeholder?: string }) {
  return (
    <label style={{ display: "block", fontSize: 12.5, marginBottom: 12 }}>
      <span style={{ color: "var(--c-dim)", display: "block", marginBottom: 4 }}>{label}</span>
      <textarea name={name} rows={rows} placeholder={placeholder} className="ceo-input" style={{ width: "100%", fontSize: 13 }} />
    </label>
  );
}
