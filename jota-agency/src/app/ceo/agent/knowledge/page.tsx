import { prisma } from "@/lib/prisma";
import { fechaHora } from "@/lib/zona";
import { Cabecera, SinNegocios, Kpi, resolverTenant, type Params } from "../comun";
import { accionGuardarFuente, accionBorrarFuente, accionResincronizar } from "../acciones";

export const dynamic = "force-dynamic";
export const metadata = { title: "Knowledge Base — JOTA CEO", robots: { index: false, follow: false } };

const TIPOS = ["manual", "faq", "servicios", "precios", "politicas", "web", "pdf"];

export default async function Pagina({ searchParams }: { searchParams: Promise<Params> }) {
  const sp = await searchParams;
  const { t, todos } = await resolverTenant(sp);
  if (!t) return <div className="ceo-anim"><SinNegocios /></div>;

  const editando = typeof sp.e === "string" ? sp.e : null;

  const [fuentes, fragmentos] = await Promise.all([
    prisma.knowledgeSource.findMany({
      where: { tenantId: t.id },
      orderBy: { createdAt: "asc" },
      include: { _count: { select: { fragmentos: true } } },
    }),
    prisma.knowledgeChunk.count({ where: { tenantId: t.id } }),
  ]);

  const enEdicion = editando ? fuentes.find((f) => f.id === editando) : null;

  return (
    <div className="ceo-anim">
      <Cabecera
        titulo="Base de conocimiento"
        descripcion="Lo único que el agente puede decir sobre este negocio. Si no está acá, no lo dice."
        tenant={t}
        todos={todos}
        activo="/ceo/agent/knowledge"
      />

      <div className="ceo-kpis" style={{ marginBottom: 16 }}>
        <Kpi label="Fuentes" valor={String(fuentes.length)} />
        <Kpi label="Fragmentos indexados" valor={String(fragmentos)} sub="Búsqueda léxica, hasta ~500" />
        <Kpi label="Con error" valor={String(fuentes.filter((f) => f.estado === "error").length)} />
      </div>

      <div className="ceo-card" style={{ marginBottom: 18 }}>
        <div className="ceo-label" style={{ marginBottom: 10 }}>
          {enEdicion ? `Editar: ${enEdicion.titulo}` : "Agregar una fuente"}
        </div>
        <form action={accionGuardarFuente}>
          <input type="hidden" name="tenantId" value={t.id} />
          {enEdicion && <input type="hidden" name="fuenteId" value={enEdicion.id} />}
          <div style={{ display: "flex", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
            <input
              name="titulo" className="ceo-input" required maxLength={200}
              defaultValue={enEdicion?.titulo ?? ""}
              placeholder="Título (ej: Preguntas frecuentes)"
              aria-label="Título"
              style={{ flex: "1 1 260px" }}
            />
            <select name="tipo" className="ceo-input" defaultValue={enEdicion?.tipo ?? "manual"} aria-label="Tipo">
              {TIPOS.map((x) => <option key={x} value={x}>{x}</option>)}
            </select>
          </div>
          <textarea
            name="contenido" className="ceo-input" required rows={10}
            defaultValue={enEdicion?.contenido ?? ""}
            placeholder={"Pegá acá el contenido. Se parte en fragmentos por párrafo.\n\nEj:\nQ: ¿Atienden los fines de semana?\nA: Sábados de 8 a 12."}
            aria-label="Contenido"
            style={{ width: "100%", marginBottom: 10, fontFamily: "var(--font-mono, monospace)", fontSize: 13 }}
          />
          <div style={{ display: "flex", gap: 8 }}>
            <button className="ceo-btn ceo-btn-gold" type="submit">
              {enEdicion ? "Guardar y reindexar" : "Agregar e indexar"}
            </button>
            {enEdicion && (
              <a href={`/ceo/agent/knowledge?n=${t.slug}`} className="ceo-btn" style={{ textDecoration: "none" }}>
                Cancelar
              </a>
            )}
          </div>
        </form>
      </div>

      {fuentes.length === 0 ? (
        <div className="ceo-card">
          <p className="ceo-vacio">
            Sin conocimiento cargado el agente no puede responder nada específico del negocio:
            va a derivar todo al equipo. Cargá al menos los servicios y las preguntas frecuentes.
          </p>
        </div>
      ) : (
        <div className="ceo-card ceo-card-pad-0">
          <div className="ceo-scroll-x">
            <table className="ceo-tabla">
              <thead>
                <tr><th>Fuente</th><th>Tipo</th><th>Fragmentos</th><th>Estado</th><th>Actualizada</th><th></th></tr>
              </thead>
              <tbody>
                {fuentes.map((f) => (
                  <tr key={f.id}>
                    <td>
                      <a href={`/ceo/agent/knowledge?n=${t.slug}&e=${f.id}`} style={{ color: "var(--c-text)" }}>
                        {f.titulo}
                      </a>
                      <div style={{ fontSize: 11.5, color: "var(--c-dim)" }}>
                        {f.contenido.slice(0, 90)}{f.contenido.length > 90 ? "…" : ""}
                      </div>
                    </td>
                    <td>{f.tipo}</td>
                    <td>{f._count.fragmentos}</td>
                    <td>
                      <span className={`ceo-chip ${f.estado === "error" ? "ceo-chip-red" : "ceo-chip-green"}`}>
                        {f.estado}
                      </span>
                      {f.ultimoError && (
                        <div style={{ fontSize: 11, color: "var(--c-red)" }}>{f.ultimoError}</div>
                      )}
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      {f.sincronizadaEn ? fechaHora(f.sincronizadaEn) : "nunca"}
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 6 }}>
                        <form action={accionResincronizar}>
                          <input type="hidden" name="tenantId" value={t.id} />
                          <input type="hidden" name="fuenteId" value={f.id} />
                          <button className="ceo-btn" type="submit" style={{ fontSize: 12, padding: "4px 8px" }}>
                            Reindexar
                          </button>
                        </form>
                        <form action={accionBorrarFuente}>
                          <input type="hidden" name="tenantId" value={t.id} />
                          <input type="hidden" name="fuenteId" value={f.id} />
                          <button className="ceo-btn" type="submit" style={{ fontSize: 12, padding: "4px 8px" }}>
                            Borrar
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
