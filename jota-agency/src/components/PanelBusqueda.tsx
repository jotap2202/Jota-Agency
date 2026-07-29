"use client";

import { useMemo, useState } from "react";

export type Lead = {
  id: string;
  nombre: string;
  empresa: string;
  email: string;
  origen: string;
  fecha: string;
  diagnosticos: number;
};

export function PanelBusqueda({ leads }: { leads: Lead[] }) {
  const [q, setQ] = useState("");

  const filtrados = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return leads;
    return leads.filter((l) =>
      [l.nombre, l.empresa, l.email].some((v) => v.toLowerCase().includes(t)),
    );
  }, [q, leads]);

  return (
    <>
      <label htmlFor="buscar" className="sr-only">Buscar lead</label>
      <input
        id="buscar"
        className="jfield"
        style={{ maxWidth: 340, marginBottom: 16 }}
        placeholder="Buscar por nombre, empresa o email…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />

      <div style={{ overflowX: "auto", borderRadius: 20, border: "1px solid var(--line)", background: "var(--panel)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 720 }}>
          <thead>
            <tr>
              {["Nombre", "Empresa", "Email", "Origen", "Alta", "Diag."].map((h) => (
                <th key={h} className="font-mono"
                  style={{ textAlign: "left", padding: "14px 16px", fontSize: 11, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--gold)", borderBottom: "1px solid var(--line)", whiteSpace: "nowrap" }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtrados.map((l) => (
              <tr key={l.id} style={{ borderBottom: "1px solid var(--lineSoft)" }}>
                <td style={{ padding: "14px 16px", fontSize: 14 }}>{l.nombre}</td>
                <td style={{ padding: "14px 16px", fontSize: 14, color: "var(--gold)" }}>{l.empresa}</td>
                <td style={{ padding: "14px 16px", fontSize: 13 }}>
                  <a href={`mailto:${l.email}`} style={{ color: "var(--text)", textDecoration: "underline" }}>{l.email}</a>
                </td>
                <td className="font-mono" style={{ padding: "14px 16px", fontSize: 11, color: "var(--dim)" }}>{l.origen}</td>
                <td className="font-mono" style={{ padding: "14px 16px", fontSize: 11, color: "var(--dim)", whiteSpace: "nowrap" }}>{l.fecha}</td>
                <td className="font-mono" style={{ padding: "14px 16px", fontSize: 13, color: l.diagnosticos ? "var(--green)" : "var(--dim)" }}>{l.diagnosticos}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="font-mono" style={{ marginTop: 12, fontSize: 11, color: "var(--dim)" }}>
        {filtrados.length === leads.length
          ? `${leads.length} contacto${leads.length === 1 ? "" : "s"}`
          : `${filtrados.length} de ${leads.length} contactos`}
      </p>
    </>
  );
}
