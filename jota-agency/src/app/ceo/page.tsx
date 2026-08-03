import Link from "next/link";
import { cargarOverview } from "@/lib/ceo/datos";
import { generarBriefing, COLOR_PRIORIDAD, ETIQUETA_PRIORIDAD } from "@/lib/ceo/briefing";
import { dinero, numero, porcentaje } from "@/lib/ceo/dinero";
import { Barras, BarrasH, Embudo } from "@/components/ceo/Graficos";
import { CargarDemo } from "@/components/ceo/CargarDemo";
import { COLOR_SCORE } from "@/lib/ceo/score";

export const dynamic = "force-dynamic";

/** "—" cuando el dato no existe. Nunca 0: son cosas distintas. */
const oNada = (v: number | null, f: (n: number) => string) => (v === null ? "—" : f(v));

function Kpi({ label, valor, sub, color }: { label: string; valor: string; sub?: string; color?: string }) {
  return (
    <div className="ceo-kpi">
      <div className="k-l">{label}</div>
      <div className="k-v" style={color ? { color } : undefined}>{valor}</div>
      {sub && <div className="k-s">{sub}</div>}
    </div>
  );
}

export default async function OverviewPage() {
  const d = await cargarOverview();
  const briefing = generarBriefing(d);
  const { meta, embudo, clientes, marketing, dinero: din } = d;

  const vacio = embudo.leadsTotales === 0 && clientes.total === 0 && din.recaudadoMes === 0;

  if (vacio) {
    return (
      <div className="ceo-card ceo-anim">
        <div className="ceo-vacio">
          <h3>Tu Command Center está vacío</h3>
          <p>
            Todavía no hay leads, clientes ni ingresos cargados. Podés empezar con datos de
            ejemplo para ver cómo funciona el tablero, y borrarlos cuando quieras — no se
            mezclan con lo que cargues vos.
          </p>
          <div style={{ marginTop: 22, display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            <CargarDemo />
            <Link href="/ceo/leads" className="ceo-btn">Cargar mi primer lead</Link>
          </div>
        </div>
      </div>
    );
  }

  const kpis = [
    { label: "Ingresos del mes", valor: dinero(din.recaudadoMes) },
    { label: "Objetivo mensual", valor: d.objetivoDefinido ? dinero(meta.objetivo) : "—", sub: d.objetivoDefinido ? undefined : "Definilo en Goals" },
    { label: "% del objetivo", valor: d.objetivoDefinido ? porcentaje(meta.progreso) : "—" },
    { label: "Falta para el objetivo", valor: d.objetivoDefinido ? dinero(meta.restante) : "—" },
    { label: "MRR", valor: dinero(din.mrr), sub: `${clientes.activos} clientes activos` },
    { label: "Proyección 30 días", valor: dinero(din.proyeccion[0].total), sub: `${dinero(din.proyeccion[0].comprometido)} comprometido` },
    { label: "Leads nuevos (mes)", valor: numero(embudo.leadsNuevosMes), sub: `${numero(embudo.leadsTotales)} en total` },
    { label: "Leads calificados", valor: numero(embudo.calificados) },
    { label: "Reuniones agendadas", valor: numero(embudo.reuniones) },
    { label: "Propuestas enviadas", valor: numero(embudo.propuestas) },
    { label: "Clientes cerrados", valor: numero(embudo.ganados) },
    { label: "Tasa de conversión", valor: oNada(embudo.conversion, (n) => porcentaje(n)) },
    { label: "Ticket promedio", valor: oNada(din.ticket, dinero) },
    { label: "Costo de adquisición", valor: oNada(marketing.cac, dinero), sub: marketing.cac === null ? "Falta gasto o cierres" : undefined },
    { label: "ROI de marketing", valor: oNada(marketing.roiMes, (n) => porcentaje(n)), color: (marketing.roiMes ?? 0) < 0 ? "var(--c-red)" : undefined },
    { label: "Clientes activos", valor: numero(clientes.activos) },
    { label: "Clientes en riesgo", valor: numero(clientes.enRiesgo.length), color: clientes.enRiesgo.length > 0 ? "var(--c-red)" : undefined },
    { label: "Campañas activas", valor: numero(marketing.campaniasActivas) },
  ];

  return (
    <div className="ceo-anim">
      <div className="ceo-seccion-head" style={{ marginBottom: 18 }}>
        <div>
          <h1 className="ceo-h2" style={{ fontSize: 20 }}>Executive Overview</h1>
          <p className="ceo-sub">Estado completo de la agencia, en hora de Maui.</p>
        </div>
      </div>

      {/* ---------- objetivo del mes ---------- */}
      <div className="ceo-card" style={{ marginBottom: 22, padding: 22 }}>
        <div className="ceo-meta">
          <div>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <h2 className="ceo-h2">Monthly Revenue Goal</h2>
              <span className={`ceo-chip ${
                meta.estado === "completed" || meta.estado === "onTrack" ? "ceo-chip-green"
                : meta.estado === "atRisk" ? "ceo-chip-gold" : "ceo-chip-red"}`}>
                {{ completed: "Cumplido", onTrack: "On Track", atRisk: "At Risk", behind: "Behind" }[meta.estado]}
              </span>
            </div>

            {d.objetivoDefinido ? (
              <>
                <div style={{ display: "flex", alignItems: "baseline", gap: 10, margin: "16px 0 12px" }}>
                  <span style={{ fontSize: 36, fontWeight: 600, fontFamily: "var(--font-display), sans-serif", letterSpacing: "-0.03em" }}>
                    {dinero(meta.recaudado)}
                  </span>
                  <span style={{ fontSize: 15, color: "var(--c-dim)" }}>de {dinero(meta.objetivo)}</span>
                </div>

                <div className="ceo-barra" aria-label={`Progreso ${porcentaje(meta.progreso)}`}>
                  <i style={{ width: `${Math.min(meta.progreso, 100)}%` }} />
                </div>

                <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(108px, 1fr))", marginTop: 18 }}>
                  {[
                    ["Restante", dinero(meta.restante)],
                    ["Progreso", porcentaje(meta.progreso)],
                    ["Días restantes", String(meta.diasRestantes)],
                    ["Necesario/día", dinero(meta.diarioNecesario)],
                    ["Necesario/semana", dinero(meta.semanalNecesario)],
                    ["Proyección", dinero(meta.proyeccion)],
                  ].map(([l, v]) => (
                    <div key={l}>
                      <div style={{ fontSize: 11, color: "var(--c-dim)" }}>{l}</div>
                      <div style={{ fontSize: 16, fontWeight: 600, marginTop: 3 }}>{v}</div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div style={{ padding: "26px 0" }}>
                <p className="ceo-sub" style={{ lineHeight: 1.7, maxWidth: 420 }}>
                  No hay objetivo de facturación cargado para este mes. Sin él no se puede
                  calcular cuánto falta ni el ritmo diario necesario.
                </p>
                <Link href="/ceo/goals" className="ceo-btn ceo-btn-gold" style={{ marginTop: 14 }}>
                  Definir objetivo →
                </Link>
              </div>
            )}
          </div>

          <div className="ceo-meta-lado">
            <h3 className="ceo-h2" style={{ fontSize: 13 }}>Proyección de ingresos</h3>
            <p className="ceo-sub" style={{ marginBottom: 14 }}>
              Recurrente comprometido + pipeline ponderado por probabilidad.
            </p>
            <div style={{ display: "grid", gap: 11 }}>
              {din.proyeccion.map((p) => (
                <div key={p.dias}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 4 }}>
                    <span style={{ color: "var(--c-text-2)" }}>{p.dias} días</span>
                    <strong>{dinero(p.total)}</strong>
                  </div>
                  <div style={{ display: "flex", height: 6, borderRadius: 999, overflow: "hidden", background: "var(--c-surface-2)" }}>
                    <i style={{ width: `${(p.comprometido / Math.max(p.total, 1)) * 100}%`, background: "var(--c-green)" }} />
                    <i style={{ width: `${(p.probable / Math.max(p.total, 1)) * 100}%`, background: "var(--c-gold)" }} />
                  </div>
                  <div style={{ fontSize: 10.5, color: "var(--c-dim)", marginTop: 3 }}>
                    {dinero(p.comprometido)} comprometido · {dinero(p.probable)} probable
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ---------- KPIs ---------- */}
      <div className="ceo-kpis">
        {kpis.map((k) => <Kpi key={k.label} {...k} />)}
      </div>

      {/* ---------- CEO Daily Briefing ---------- */}
      <section className="ceo-seccion">
        <div className="ceo-seccion-head">
          <div>
            <h2 className="ceo-h2">CEO Daily Briefing</h2>
            <p className="ceo-sub">
              Reglas sobre tus datos reales, ordenadas por urgencia e impacto. Cuando falta un dato lo dice en vez de suponerlo.
            </p>
          </div>
        </div>

        {briefing.length === 0 ? (
          <div className="ceo-card ceo-vacio">
            <h3>Nada urgente hoy</h3>
            <p>No hay seguimientos vencidos, clientes en riesgo ni canales perdiendo dinero.</p>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {briefing.map((b) => (
              <div key={b.id} className="ceo-card" style={{ padding: 16 }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
                  <span className={`ceo-chip ${COLOR_PRIORIDAD[b.prioridad]}`}>{ETIQUETA_PRIORIDAD[b.prioridad]}</span>
                  <div style={{ flex: 1, minWidth: 240 }}>
                    <div style={{ fontSize: 14, fontWeight: 500 }}>{b.situacion}</div>
                    <p style={{ fontSize: 12.5, color: "var(--c-text-2)", marginTop: 5, lineHeight: 1.6 }}>{b.motivo}</p>
                    <p style={{ fontSize: 12.5, marginTop: 8 }}>
                      <span style={{ color: "var(--c-gold)" }}>→ </span>{b.accion}
                    </p>
                  </div>
                  <div style={{ textAlign: "right", minWidth: 96 }}>
                    {b.impacto > 0 && (
                      <div style={{ fontSize: 15, fontWeight: 600 }}>{dinero(b.impacto)}</div>
                    )}
                    <div style={{ fontSize: 10.5, color: "var(--c-dim)", marginTop: 2 }}>{b.metrica}</div>
                    {b.href && (
                      <Link href={b.href} style={{ fontSize: 11.5, color: "var(--c-gold)", textDecoration: "underline", display: "inline-block", marginTop: 6 }}>
                        Ver →
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ---------- gráficos ---------- */}
      <section className="ceo-seccion">
        <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
          <div className="ceo-card">
            <h3 className="ceo-h2">Ingresos por mes</h3>
            <p className="ceo-sub" style={{ marginBottom: 16 }}>Últimos 6 meses contra el objetivo.</p>
            <Barras
              datos={din.serieMeses}
              formato="dineroCorto"
              objetivo={d.objetivoDefinido ? meta.objetivo : undefined}
              titulo="Ingresos por mes"
            />
          </div>

          <div className="ceo-card">
            <h3 className="ceo-h2">Pipeline por etapa</h3>
            <p className="ceo-sub" style={{ marginBottom: 16 }}>
              {dinero(embudo.pipelineTotal)} total · {dinero(embudo.pipelinePond)} ponderado por probabilidad.
            </p>
            <Embudo datos={embudo.porEtapa} formatoValor="dineroCorto" titulo="Pipeline por etapa" />
          </div>

          <div className="ceo-card">
            <h3 className="ceo-h2">Ingresos por servicio</h3>
            <p className="ceo-sub" style={{ marginBottom: 16 }}>Este mes.</p>
            <BarrasH datos={din.porServicio} formato="dinero" titulo="Ingresos por servicio" />
          </div>

          <div className="ceo-card">
            <h3 className="ceo-h2">Retorno por canal</h3>
            <p className="ceo-sub" style={{ marginBottom: 16 }}>Ingresos atribuidos a cada canal de adquisición.</p>
            <BarrasH
              datos={marketing.porCanal.map((c) => ({ etiqueta: c.nombre, valor: c.ingresos }))}
              formato="dinero"
              titulo="Ingresos por canal"
            />
          </div>
        </div>
      </section>

      {/* ---------- canales en detalle ---------- */}
      {marketing.porCanal.length > 0 && (
        <section className="ceo-seccion">
          <div className="ceo-seccion-head">
            <div>
              <h2 className="ceo-h2">Conversión por canal</h2>
              <p className="ceo-sub">Dónde conviene poner el próximo dólar.</p>
            </div>
            <Link href="/ceo/marketing" className="ceo-btn">Ver Marketing →</Link>
          </div>
          <div className="ceo-card ceo-card-pad-0">
            <div className="ceo-scroll-x">
              <table className="ceo-tabla">
                <thead>
                  <tr>
                    <th>Canal</th><th>Invertido</th><th>Leads</th><th>Reuniones</th>
                    <th>Ventas</th><th>Ingresos</th><th>CPL</th><th>Costo/reunión</th><th>CAC</th><th>ROI</th>
                  </tr>
                </thead>
                <tbody>
                  {marketing.porCanal.map((c) => (
                    <tr key={c.canal}>
                      <td style={{ fontWeight: 500 }}>{c.nombre}</td>
                      <td>{dinero(c.gastado)}</td>
                      <td>{numero(c.leads)}</td>
                      <td>{numero(c.reuniones)}</td>
                      <td>{numero(c.ventas)}</td>
                      <td>{dinero(c.ingresos)}</td>
                      <td>{oNada(c.cpl, dinero)}</td>
                      <td>{oNada(c.cpr, dinero)}</td>
                      <td>{oNada(c.cac, dinero)}</td>
                      <td style={{ color: (c.roi ?? 0) < 0 ? "var(--c-red)" : (c.roi ?? 0) > 0 ? "var(--c-green)" : undefined, fontWeight: 500 }}>
                        {oNada(c.roi, (n) => porcentaje(n, 0))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* ---------- mejores oportunidades ---------- */}
      {embudo.topLeads.length > 0 && (
        <section className="ceo-seccion">
          <div className="ceo-seccion-head">
            <div>
              <h2 className="ceo-h2">Mejores oportunidades abiertas</h2>
              <p className="ceo-sub">Ordenadas por lead score.</p>
            </div>
            <Link href="/ceo/leads" className="ceo-btn">Ver todos →</Link>
          </div>
          <div className="ceo-card ceo-card-pad-0">
            <div className="ceo-scroll-x">
              <table className="ceo-tabla">
                <thead>
                  <tr><th>Empresa</th><th>Industria</th><th>Etapa</th><th>Valor</th><th>Prob.</th><th>Score</th></tr>
                </thead>
                <tbody>
                  {embudo.topLeads.map((p) => {
                    const cls = p.score >= 80 ? "hot" : p.score >= 60 ? "strong" : p.score >= 40 ? "nurture" : "low";
                    return (
                      <tr key={p.id}>
                        <td style={{ fontWeight: 500 }}>{p.empresa}</td>
                        <td style={{ color: "var(--c-dim)" }}>{p.industria ?? p.rubro}</td>
                        <td>{p.estado}</td>
                        <td>{dinero(p.valorEstimado)}</td>
                        <td>{p.probabilidad}%</td>
                        <td style={{ color: COLOR_SCORE[cls], fontWeight: 600 }}>{p.score}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
