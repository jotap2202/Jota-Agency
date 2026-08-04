import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { fechaHora } from "@/lib/zona";
import { citaLegible } from "@/lib/agente/agenda";
import { resolverTenant, enlace, type Params } from "../../comun";
import {
  accionResponder, accionPausarIa, accionDerivar, accionAsignar,
  accionNota, accionEstadoConversacion, accionAprobacion,
} from "../../acciones";

export const dynamic = "force-dynamic";
export const metadata = { title: "Conversación — JOTA CEO", robots: { index: false, follow: false } };

type Factor = { clave: string; peso: number; valor: number | null; motivo: string };
type Detalle = { positivos?: string[]; negativos?: string[]; faltantes?: string[]; factores?: Factor[] };

export default async function Pagina({
  params, searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Params>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const { t } = await resolverTenant(sp);
  if (!t) notFound();

  // El filtro por tenantId no es decorativo: sin él, cambiar el id en la URL
  // mostraría la conversación de otro negocio.
  const conv = await prisma.conversation.findFirst({
    where: { id, tenantId: t.id },
    include: {
      contacto: true,
      asignado: true,
      mensajes: { orderBy: { createdAt: "asc" }, take: 200 },
      leads: { orderBy: { createdAt: "desc" }, take: 1 },
      citas: { orderBy: { inicio: "asc" } },
      aprobaciones: { where: { estado: "pendiente" }, orderBy: { createdAt: "desc" } },
    },
  });
  if (!conv) notFound();

  const equipo = await prisma.tenantMember.findMany({ where: { tenantId: t.id }, orderBy: { nombre: "asc" } });
  const lead = conv.leads[0];
  const detalle = (lead?.scoreDetalle ?? {}) as Detalle;
  const oculto = { tenantId: t.id, conversationId: conv.id };

  return (
    <div className="ceo-anim">
      <div className="ceo-seccion-head" style={{ marginBottom: 14 }}>
        <div>
          <Link href={enlace("/ceo/agent/inbox", t.slug)} style={{ fontSize: 12.5, color: "var(--c-dim)" }}>
            ← Live Inbox
          </Link>
          <h1 className="ceo-h2" style={{ fontSize: 20, marginTop: 4 }}>
            {[conv.contacto.nombre, conv.contacto.apellido].filter(Boolean).join(" ") ||
              conv.contacto.email ||
              "Contacto sin identificar"}
          </h1>
          <p className="ceo-sub">
            {t.nombreNegocio} · {conv.canal} · {conv.intencion ?? "sin clasificar"} ·{" "}
            {conv.urgencia ? `urgencia ${conv.urgencia}` : "urgencia desconocida"}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <span className={`ceo-chip ${conv.iaActiva ? "ceo-chip-green" : "ceo-chip-gold"}`}>
            IA {conv.iaActiva ? "activa" : "pausada"}
          </span>
          <span className="ceo-chip ceo-chip-gris">{conv.estado.replace("_", " ")}</span>
        </div>
      </div>

      {/* ---- Aprobaciones pendientes ---- */}
      {conv.aprobaciones.map((a) => (
        <div key={a.id} className="ceo-card" style={{ marginBottom: 14, borderColor: "var(--c-gold)" }}>
          <div className="ceo-label" style={{ marginBottom: 6 }}>
            Esperando aprobación · {a.accion.replace(/_/g, " ")}
          </div>
          <p className="ceo-sub" style={{ margin: "0 0 10px" }}>
            {a.motivo} · confianza {a.confianza === null ? "—" : a.confianza.toFixed(2)}
          </p>
          {a.riesgos.length > 0 && (
            <ul style={{ margin: "0 0 10px", paddingLeft: 18, fontSize: 13, color: "var(--c-red)" }}>
              {a.riesgos.map((r) => <li key={r}>{r}</li>)}
            </ul>
          )}
          <form action={accionAprobacion}>
            <input type="hidden" name="tenantId" value={t.id} />
            <input type="hidden" name="aprobacionId" value={a.id} />
            <textarea
              name="textoFinal"
              className="ceo-input"
              rows={4}
              defaultValue={a.propuesta}
              aria-label="Mensaje que se enviaría"
              style={{ width: "100%", marginBottom: 10 }}
            />
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button className="ceo-btn ceo-btn-gold" type="submit" name="decision" value="aprobar">
                Aprobar y enviar
              </button>
              <button className="ceo-btn" type="submit" name="decision" value="editar">
                Enviar editado
              </button>
              <button className="ceo-btn" type="submit" name="decision" value="rechazar">
                Rechazar
              </button>
            </div>
          </form>
        </div>
      ))}

      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "minmax(0, 1.7fr) minmax(260px, 1fr)" }}>
        {/* ---- Hilo ---- */}
        <div>
          <div className="ceo-card" style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: "62vh", overflowY: "auto" }}>
              {conv.mensajes.map((m) => {
                const nota = m.contenido.startsWith("[nota interna]");
                const mio = m.direccion === "saliente";
                return (
                  <div
                    key={m.id}
                    style={{
                      alignSelf: nota ? "center" : mio ? "flex-end" : "flex-start",
                      maxWidth: nota ? "100%" : "84%",
                      background: nota ? "transparent" : mio ? "var(--c-surface-2)" : "var(--c-bg)",
                      border: `1px solid ${nota ? "transparent" : "var(--c-line)"}`,
                      borderRadius: 12,
                      padding: nota ? "4px 8px" : "9px 12px",
                      fontSize: nota ? 12 : 13.5,
                      color: nota ? "var(--c-dim)" : "var(--c-text)",
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                    }}
                  >
                    {!nota && (
                      <div style={{ fontSize: 11, color: "var(--c-dim)", marginBottom: 3 }}>
                        {etiqueta(m.remitente)} · {fechaHora(m.createdAt)}
                        {m.confianza !== null && ` · confianza ${m.confianza.toFixed(2)}`}
                        {m.fuentes.length > 0 && ` · ${m.fuentes.length} fuente(s)`}
                        {m.estadoFinal && ` · ${m.estadoFinal}`}
                      </div>
                    )}
                    {m.contenido}
                  </div>
                );
              })}
            </div>
          </div>

          {/* ---- Responder ---- */}
          <div className="ceo-card" style={{ marginBottom: 14 }}>
            <form action={accionResponder}>
              <input type="hidden" name="tenantId" value={oculto.tenantId} />
              <input type="hidden" name="conversationId" value={oculto.conversationId} />
              <label className="ceo-label" htmlFor="mensaje">Responder como {t.nombreNegocio}</label>
              <textarea
                id="mensaje" name="mensaje" className="ceo-input" rows={3} required
                placeholder="Escribí tu respuesta…"
                style={{ width: "100%", margin: "8px 0 10px" }}
              />
              <p className="ceo-sub" style={{ margin: "0 0 10px", fontSize: 12 }}>
                Al responder vos, la IA se pausa en esta conversación para que no contesten los dos.
                {conv.canal === "email" && " La respuesta sale por email dentro del mismo hilo."}
              </p>
              <button className="ceo-btn ceo-btn-gold" type="submit">Enviar respuesta</button>
            </form>
          </div>

          <div className="ceo-card">
            <form action={accionNota}>
              <input type="hidden" name="tenantId" value={oculto.tenantId} />
              <input type="hidden" name="conversationId" value={oculto.conversationId} />
              <label className="ceo-label" htmlFor="nota">Nota interna</label>
              <input
                id="nota" name="nota" className="ceo-input" required
                placeholder="Solo la ve el equipo. No se le manda al contacto."
                style={{ width: "100%", margin: "8px 0 10px" }}
              />
              <button className="ceo-btn" type="submit">Guardar nota</button>
            </form>
          </div>
        </div>

        {/* ---- Lateral ---- */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="ceo-card">
            <div className="ceo-label" style={{ marginBottom: 10 }}>Control</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <form action={accionPausarIa}>
                <input type="hidden" name="tenantId" value={oculto.tenantId} />
                <input type="hidden" name="conversationId" value={oculto.conversationId} />
                <input type="hidden" name="activar" value={conv.iaActiva ? "no" : "si"} />
                <button className="ceo-btn" type="submit" style={{ width: "100%" }}>
                  {conv.iaActiva ? "Pausar la IA y tomar el control" : "Devolverle la conversación a la IA"}
                </button>
              </form>

              {conv.estado !== "esperando_humano" && (
                <form action={accionDerivar}>
                  <input type="hidden" name="tenantId" value={oculto.tenantId} />
                  <input type="hidden" name="conversationId" value={oculto.conversationId} />
                  <button className="ceo-btn" type="submit" style={{ width: "100%" }}>
                    Derivar al equipo
                  </button>
                </form>
              )}

              <form action={accionEstadoConversacion} style={{ display: "flex", gap: 6 }}>
                <input type="hidden" name="tenantId" value={oculto.tenantId} />
                <input type="hidden" name="conversationId" value={oculto.conversationId} />
                <select name="estado" className="ceo-input" defaultValue={conv.estado} aria-label="Estado" style={{ flex: 1 }}>
                  <option value="abierta">Abierta</option>
                  <option value="esperando_humano">Espera al equipo</option>
                  <option value="resuelta">Resuelta</option>
                  <option value="descartada">Spam / descartada</option>
                </select>
                <button className="ceo-btn" type="submit">Guardar</button>
              </form>

              <form action={accionAsignar} style={{ display: "flex", gap: 6 }}>
                <input type="hidden" name="tenantId" value={oculto.tenantId} />
                <input type="hidden" name="conversationId" value={oculto.conversationId} />
                <select name="miembroId" className="ceo-input" defaultValue={conv.asignadoA ?? ""} aria-label="Responsable" style={{ flex: 1 }}>
                  <option value="">Sin asignar</option>
                  {equipo.map((m) => (
                    <option key={m.id} value={m.id}>{m.nombre}</option>
                  ))}
                </select>
                <button className="ceo-btn" type="submit">Asignar</button>
              </form>
            </div>
          </div>

          <div className="ceo-card">
            <div className="ceo-label" style={{ marginBottom: 8 }}>Datos capturados</div>
            <Dato k="Nombre" v={[conv.contacto.nombre, conv.contacto.apellido].filter(Boolean).join(" ")} />
            <Dato k="Email" v={conv.contacto.email} />
            <Dato k="Teléfono" v={conv.contacto.telefono} />
            <Dato k="Empresa" v={conv.contacto.empresa} />
            <Dato k="Ubicación" v={conv.contacto.ubicacion} />
            <Dato k="Idioma" v={conv.contacto.idioma} />
            <Dato k="Servicio" v={lead?.servicio} />
            <Dato k="Problema" v={lead?.problema} />
            <Dato k="Plazo" v={lead?.plazo} />
            <Dato k="Presupuesto" v={lead?.presupuesto ? `US$ ${(lead.presupuesto / 100).toLocaleString("en-US")}` : null} />
            <Dato k="No contactar" v={conv.contacto.noContactar ? "sí" : null} />
          </div>

          {lead && (
            <div className="ceo-card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
                <div className="ceo-label">Lead score</div>
                <div style={{ fontSize: 22, fontWeight: 600 }}>{lead.score}</div>
              </div>
              <p className="ceo-sub" style={{ margin: "0 0 10px", fontSize: 12 }}>
                Confianza del cálculo: {lead.confianza}. Un factor sin datos no suma ni resta:
                se declara como faltante.
              </p>
              <Lista titulo="A favor" items={detalle.positivos ?? []} color="var(--c-green)" />
              <Lista titulo="En contra" items={detalle.negativos ?? []} color="var(--c-red)" />
              <Lista titulo="Falta saber" items={detalle.faltantes ?? []} color="var(--c-dim)" />
            </div>
          )}

          {conv.citas.length > 0 && (
            <div className="ceo-card">
              <div className="ceo-label" style={{ marginBottom: 8 }}>Reuniones</div>
              {conv.citas.map((c) => (
                <div key={c.id} style={{ fontSize: 13, marginBottom: 6 }}>
                  <div>{citaLegible(c.inicio, c.zonaHoraria)}</div>
                  <div style={{ fontSize: 11.5, color: "var(--c-dim)" }}>
                    {c.estado} · {c.titulo}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function etiqueta(remitente: string): string {
  return { contacto: "Cliente", agente: "IA", humano: "Equipo", sistema: "Sistema" }[remitente] ?? remitente;
}

function Dato({ k, v }: { k: string; v?: string | null }) {
  return (
    <div style={{ display: "flex", gap: 10, fontSize: 13, padding: "3px 0", borderBottom: "1px solid var(--c-line-soft)" }}>
      <span style={{ color: "var(--c-dim)", minWidth: 92 }}>{k}</span>
      <span style={{ wordBreak: "break-word" }}>{v || "—"}</span>
    </div>
  );
}

function Lista({ titulo, items, color }: { titulo: string; items: string[]; color: string }) {
  if (items.length === 0) return null;
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: 11.5, color, marginBottom: 3 }}>{titulo}</div>
      <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12.5 }}>
        {items.map((i) => <li key={i} style={{ marginBottom: 2 }}>{i}</li>)}
      </ul>
    </div>
  );
}
