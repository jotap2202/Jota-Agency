"use client";

import { useMemo, useState, useTransition } from "react";
import {
  cambiarEstado,
  guardarNota,
  guardarProximoContacto,
  borrarProspecto,
  marcarAuditoria,
} from "@/app/panel/prospectos/acciones";
import { ESTADOS, ETIQUETA_ESTADO as ETIQUETA, COLOR_ESTADO as COLOR } from "@/lib/prospecto-estados";

export type ProspectoUI = {
  id: string;
  empresa: string;
  rubro: string;
  ciudad: string;
  web: string;
  telefono: string;
  email: string;
  estado: string;
  notas: string;
  /** YYYY-MM-DD, o "" si no tiene seguimiento agendado. */
  proximo: string;
  auditoria: { estado: "sin" | "esperando" | "lista"; texto: string };
  /** Solo antes del primer email: después ya no cambia nada. */
  puedeAuditar: boolean;
};

const botonChico = {
  background: "var(--panel-soft)", border: "1px solid var(--line)", color: "var(--text)",
  borderRadius: 8, padding: "5px 9px", fontSize: 11.5, cursor: "pointer", whiteSpace: "nowrap" as const,
};

const celda = { padding: "12px 14px", fontSize: 13, verticalAlign: "top" as const };

export function ProspectosTabla({ prospectos, hoy }: { prospectos: ProspectoUI[]; hoy: string }) {
  const [q, setQ] = useState("");
  const [filtro, setFiltro] = useState<string>("todos");
  const [pendiente, iniciar] = useTransition();

  const visibles = useMemo(() => {
    const t = q.trim().toLowerCase();
    return prospectos.filter((p) => {
      if (filtro === "seguimiento") {
        // Vencidos y los de hoy: es lo que hay que hacer ahora.
        if (!p.proximo || p.proximo > hoy) return false;
      } else if (filtro !== "todos" && p.estado !== filtro) {
        return false;
      }
      if (!t) return true;
      return [p.empresa, p.rubro, p.ciudad, p.notas].some((v) => v.toLowerCase().includes(t));
    });
  }, [prospectos, q, filtro, hoy]);

  const filtros: { clave: string; texto: string }[] = [
    { clave: "todos", texto: `Todos (${prospectos.length})` },
    {
      clave: "seguimiento",
      texto: `Seguir hoy (${prospectos.filter((p) => p.proximo && p.proximo <= hoy).length})`,
    },
    ...ESTADOS.map((e) => ({
      clave: e,
      texto: `${ETIQUETA[e]} (${prospectos.filter((p) => p.estado === e).length})`,
    })),
  ];

  return (
    <>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        {filtros.map((f) => (
          <button
            key={f.clave}
            onClick={() => setFiltro(f.clave)}
            className="mono"
            style={{
              borderRadius: 999,
              padding: "7px 14px",
              fontSize: 11,
              border: "1px solid var(--line)",
              background: filtro === f.clave ? "var(--panel-soft)" : "transparent",
              color: filtro === f.clave ? "var(--gold)" : "var(--dim)",
            }}
          >
            {f.texto}
          </button>
        ))}
      </div>

      <label htmlFor="buscar-prospecto" className="sr-only">Buscar prospecto</label>
      <input
        id="buscar-prospecto"
        className="jfield"
        style={{ maxWidth: 340, marginBottom: 16 }}
        placeholder="Buscar por empresa, rubro, ciudad o nota…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />

      <div style={{ overflowX: "auto", borderRadius: 20, border: "1px solid var(--line)", background: "var(--panel)", opacity: pendiente ? 0.6 : 1 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1140 }}>
          <thead>
            <tr>
              {["Empresa", "Rubro", "Estado", "Seguir el", "Auditoría", "Notas", ""].map((h) => (
                <th
                  key={h}
                  className="mono"
                  style={{ textAlign: "left", padding: "14px", fontSize: 11, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--gold)", borderBottom: "1px solid var(--line)", whiteSpace: "nowrap" }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibles.map((p) => (
              <tr key={p.id} style={{ borderBottom: "1px solid var(--line)" }}>
                <td style={celda}>
                  <div style={{ fontWeight: 500 }}>
                    {p.web ? (
                      <a href={p.web} target="_blank" rel="noopener noreferrer" style={{ color: "var(--text)", textDecoration: "underline" }}>
                        {p.empresa}
                      </a>
                    ) : (
                      p.empresa
                    )}
                  </div>
                  <div className="mono" style={{ fontSize: 11, color: "var(--dim)", marginTop: 4 }}>
                    {p.ciudad}
                    {p.telefono ? ` · ${p.telefono}` : ""}
                  </div>
                  {p.email && (
                    <a href={`mailto:${p.email}`} style={{ fontSize: 12, color: "var(--gold)", textDecoration: "underline" }}>
                      {p.email}
                    </a>
                  )}
                </td>

                <td style={{ ...celda, color: "var(--dim)", whiteSpace: "nowrap" }}>{p.rubro}</td>

                <td style={celda}>
                  <label htmlFor={`estado-${p.id}`} className="sr-only">Estado de {p.empresa}</label>
                  <select
                    id={`estado-${p.id}`}
                    defaultValue={p.estado}
                    onChange={(e) => iniciar(() => { void cambiarEstado(p.id, e.target.value); })}
                    style={{ background: "var(--panel-soft)", border: "1px solid var(--line)", color: COLOR[p.estado as keyof typeof COLOR] ?? "var(--text)", borderRadius: 8, padding: "6px 8px", fontSize: 12 }}
                  >
                    {ESTADOS.map((e) => (
                      <option key={e} value={e}>{ETIQUETA[e]}</option>
                    ))}
                  </select>
                </td>

                <td style={celda}>
                  <label htmlFor={`fecha-${p.id}`} className="sr-only">Próximo contacto con {p.empresa}</label>
                  <input
                    id={`fecha-${p.id}`}
                    type="date"
                    defaultValue={p.proximo}
                    onChange={(e) => iniciar(() => { void guardarProximoContacto(p.id, e.target.value); })}
                    style={{
                      background: "var(--panel-soft)",
                      border: "1px solid var(--line)",
                      color: p.proximo && p.proximo <= hoy ? "var(--gold)" : "var(--dim)",
                      borderRadius: 8,
                      padding: "6px 8px",
                      fontSize: 12,
                    }}
                  />
                </td>

                <td style={{ ...celda, minWidth: 190, maxWidth: 240 }}>
                  {p.auditoria.estado !== "sin" && (
                    <div style={{ fontSize: 11.5, lineHeight: 1.5, color: p.auditoria.estado === "lista" ? "var(--text)" : "var(--dim)", marginBottom: 6 }}>
                      {p.auditoria.texto}
                    </div>
                  )}
                  {p.puedeAuditar && (
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {p.auditoria.estado === "sin" ? (
                        <button
                          style={botonChico}
                          title="Mandale ahora una consulta corta por el formulario de su web y apretá este botón"
                          onClick={() => iniciar(() => { void marcarAuditoria(p.id, "enviada"); })}
                        >
                          Mandé la consulta
                        </button>
                      ) : (
                        <>
                          {p.auditoria.texto.includes("first reply") ? null : (
                            <button style={botonChico} onClick={() => iniciar(() => { void marcarAuditoria(p.id, "respuesta"); })}>
                              Respondieron
                            </button>
                          )}
                          <button
                            style={{ ...botonChico, color: "var(--dim)" }}
                            onClick={() => iniciar(() => { void marcarAuditoria(p.id, "borrar"); })}
                          >
                            Borrar
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </td>

                <td style={{ ...celda, minWidth: 260 }}>
                  <label htmlFor={`nota-${p.id}`} className="sr-only">Notas sobre {p.empresa}</label>
                  <textarea
                    id={`nota-${p.id}`}
                    defaultValue={p.notas}
                    rows={2}
                    placeholder="Qué le dijiste, qué respondió…"
                    onBlur={(e) => {
                      if (e.target.value.trim() === p.notas.trim()) return;
                      const v = e.target.value;
                      iniciar(() => { void guardarNota(p.id, v); });
                    }}
                    style={{ width: "100%", background: "var(--panel-soft)", border: "1px solid var(--line)", color: "var(--text)", borderRadius: 8, padding: "6px 8px", fontSize: 12, resize: "vertical" }}
                  />
                </td>

                <td style={{ ...celda, textAlign: "right" }}>
                  <button
                    onClick={() => {
                      if (!confirm(`¿Borrar ${p.empresa} de la lista?`)) return;
                      iniciar(() => { void borrarProspecto(p.id); });
                    }}
                    aria-label={`Borrar ${p.empresa}`}
                    style={{ background: "none", border: "none", color: "var(--dim)", fontSize: 16, cursor: "pointer" }}
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mono" style={{ marginTop: 12, fontSize: 11, color: "var(--dim)" }}>
        {visibles.length === prospectos.length
          ? `${prospectos.length} prospecto${prospectos.length === 1 ? "" : "s"}`
          : `${visibles.length} de ${prospectos.length} prospectos`}
      </p>
    </>
  );
}
