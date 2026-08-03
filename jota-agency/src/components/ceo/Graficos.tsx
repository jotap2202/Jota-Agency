"use client";

import { useId, useState } from "react";
import { dinero, dineroCorto, numero } from "@/lib/ceo/dinero";

/**
 * Gráficos en SVG propio, sin librería.
 *
 * Para barras, líneas y embudos el código es corto y evita sumar una
 * dependencia (Recharts todavía arrastra fricción con React 19) y además
 * permite usar exactamente los tokens de marca. Si en algún momento hacen
 * falta gráficos más complejos, la interfaz de estos componentes ya está
 * pensada para cambiarse por dentro sin tocar las páginas.
 *
 * Todos declaran los datos en texto accesible: un lector de pantalla no ve
 * un <path>, así que cada gráfico incluye una tabla oculta equivalente.
 *
 * El formato se pide por NOMBRE, no pasando la función: estos componentes
 * son de cliente y las páginas que los usan son de servidor — React no puede
 * serializar una función a través de esa frontera. Pasar `formato={dinero}`
 * compila y tipa bien, pero explota en ejecución.
 */

const FORMATOS = { dinero, dineroCorto, numero } as const;
export type Formato = keyof typeof FORMATOS;

export type Punto = { etiqueta: string; valor: number; segundo?: number };

const GOLD = "var(--c-gold)";
const DIM = "var(--c-dim)";

function TablaAccesible({ titulo, datos, formato }: { titulo: string; datos: Punto[]; formato: Formato }) {
  return (
    <table className="sr-only">
      <caption>{titulo}</caption>
      <tbody>
        {datos.map((d) => (
          <tr key={d.etiqueta}>
            <th scope="row">{d.etiqueta}</th>
            <td>{FORMATOS[formato](d.valor)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Barras verticales con línea de objetivo opcional. */
export function Barras({
  datos, formato, objetivo, titulo, alto = 190,
}: {
  datos: Punto[];
  formato: Formato;
  objetivo?: number;
  titulo: string;
  alto?: number;
}) {
  const [sobre, setSobre] = useState<number | null>(null);
  const f = FORMATOS[formato];
  const max = Math.max(...datos.map((d) => d.valor), objetivo ?? 0, 1);
  const anchoBarra = 100 / Math.max(datos.length, 1);

  return (
    <figure style={{ margin: 0 }}>
      <div style={{ position: "relative", height: alto }}>
        <svg viewBox={`0 0 100 ${alto}`} preserveAspectRatio="none" style={{ width: "100%", height: alto, overflow: "visible" }} aria-hidden>
          {objetivo != null && objetivo > 0 && (
            <line
              x1="0" x2="100"
              y1={alto - (objetivo / max) * (alto - 26)}
              y2={alto - (objetivo / max) * (alto - 26)}
              stroke={DIM} strokeWidth="1" strokeDasharray="3 3" vectorEffect="non-scaling-stroke"
            />
          )}
          {datos.map((d, i) => {
            const h = (d.valor / max) * (alto - 26);
            return (
              <rect
                key={d.etiqueta}
                x={i * anchoBarra + anchoBarra * 0.18}
                y={alto - h}
                width={anchoBarra * 0.64}
                height={Math.max(h, 1)}
                rx="1.4"
                fill={sobre === i ? "var(--c-gold)" : "var(--c-gold)"}
                opacity={sobre === null || sobre === i ? 1 : 0.42}
                onMouseEnter={() => setSobre(i)}
                onMouseLeave={() => setSobre(null)}
                style={{ transition: "opacity .12s" }}
              />
            );
          })}
        </svg>

        {sobre !== null && (
          <div
            style={{
              position: "absolute", top: 0, left: `${(sobre + 0.5) * anchoBarra}%`,
              transform: "translateX(-50%)", pointerEvents: "none",
              background: "var(--c-surface-2)", border: "1px solid var(--c-line)",
              borderRadius: 8, padding: "5px 9px", fontSize: 11.5, whiteSpace: "nowrap",
              boxShadow: "var(--c-shadow)",
            }}
          >
            <strong>{f(datos[sobre].valor)}</strong>
            <span style={{ color: DIM }}> · {datos[sobre].etiqueta}</span>
          </div>
        )}
      </div>

      <div style={{ display: "flex", marginTop: 7 }}>
        {datos.map((d) => (
          <span key={d.etiqueta} style={{ width: `${anchoBarra}%`, textAlign: "center", fontSize: 10.5, color: DIM }}>
            {d.etiqueta}
          </span>
        ))}
      </div>

      {objetivo != null && objetivo > 0 && (
        <p style={{ fontSize: 11, color: DIM, marginTop: 8 }}>
          — — línea punteada: objetivo de {f(objetivo)}
        </p>
      )}
      <TablaAccesible titulo={titulo} datos={datos} formato={formato} />
    </figure>
  );
}

/** Línea suave, para series de tiempo. */
export function Linea({
  datos, formato, titulo, alto = 160,
}: { datos: Punto[]; formato: Formato; titulo: string; alto?: number }) {
  const id = useId();
  const [sobre, setSobre] = useState<number | null>(null);
  const f = FORMATOS[formato];
  const max = Math.max(...datos.map((d) => d.valor), 1);
  const paso = datos.length > 1 ? 100 / (datos.length - 1) : 100;
  const y = (v: number) => alto - 16 - (v / max) * (alto - 32);
  const puntos = datos.map((d, i) => `${i * paso},${y(d.valor)}`).join(" ");

  return (
    <figure style={{ margin: 0 }}>
      <div style={{ position: "relative", height: alto }}>
        <svg viewBox={`0 0 100 ${alto}`} preserveAspectRatio="none" style={{ width: "100%", height: alto, overflow: "visible" }} aria-hidden>
          <defs>
            <linearGradient id={`g-${id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--c-gold)" stopOpacity="0.26" />
              <stop offset="100%" stopColor="var(--c-gold)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <polygon points={`0,${alto} ${puntos} 100,${alto}`} fill={`url(#g-${id})`} />
          <polyline points={puntos} fill="none" stroke={GOLD} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
          {datos.map((d, i) => (
            <circle
              key={d.etiqueta}
              cx={i * paso} cy={y(d.valor)} r={sobre === i ? 3.5 : 2}
              fill="var(--c-surface)" stroke={GOLD} strokeWidth="1.6"
              vectorEffect="non-scaling-stroke"
              onMouseEnter={() => setSobre(i)} onMouseLeave={() => setSobre(null)}
            />
          ))}
        </svg>

        {sobre !== null && (
          <div
            style={{
              position: "absolute", top: 0, left: `${sobre * paso}%`,
              transform: "translateX(-50%)", pointerEvents: "none",
              background: "var(--c-surface-2)", border: "1px solid var(--c-line)",
              borderRadius: 8, padding: "5px 9px", fontSize: 11.5, whiteSpace: "nowrap",
              boxShadow: "var(--c-shadow)",
            }}
          >
            <strong>{f(datos[sobre].valor)}</strong>
            <span style={{ color: DIM }}> · {datos[sobre].etiqueta}</span>
          </div>
        )}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 7 }}>
        {datos.map((d) => (
          <span key={d.etiqueta} style={{ fontSize: 10.5, color: DIM }}>{d.etiqueta}</span>
        ))}
      </div>
      <TablaAccesible titulo={titulo} datos={datos} formato={formato} />
    </figure>
  );
}

/** Barras horizontales, para comparar categorías (canales, servicios). */
export function BarrasH({
  datos, formato, titulo,
}: { datos: Punto[]; formato: Formato; titulo: string }) {
  const f = FORMATOS[formato];
  const max = Math.max(...datos.map((d) => d.valor), 1);

  if (datos.length === 0) {
    return <p style={{ fontSize: 12.5, color: DIM, padding: "18px 0" }}>Sin datos todavía.</p>;
  }

  return (
    <figure style={{ margin: 0, display: "grid", gap: 11 }}>
      {datos.map((d) => (
        <div key={d.etiqueta}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 12.5, marginBottom: 4 }}>
            <span style={{ color: "var(--c-text-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.etiqueta}</span>
            <strong style={{ whiteSpace: "nowrap" }}>{f(d.valor)}</strong>
          </div>
          <div className="ceo-barra" style={{ height: 6 }}>
            <i style={{ width: `${(d.valor / max) * 100}%`, background: "linear-gradient(90deg,#d9a636,#f0c75e)" }} />
          </div>
        </div>
      ))}
      <TablaAccesible titulo={titulo} datos={datos} formato={formato} />
    </figure>
  );
}

/** Embudo del pipeline: ancho proporcional a la cantidad en cada etapa. */
export function Embudo({
  datos, formatoValor, titulo,
}: { datos: (Punto & { valorDinero: number })[]; formatoValor: Formato; titulo: string }) {
  const f = FORMATOS[formatoValor];
  const max = Math.max(...datos.map((d) => d.valor), 1);

  return (
    <figure style={{ margin: 0, display: "grid", gap: 7 }}>
      {datos.map((d) => (
        <div key={d.etiqueta} style={{ display: "flex", alignItems: "center", gap: 11 }}>
          <span style={{ width: 118, fontSize: 12.5, color: "var(--c-text-2)", flexShrink: 0 }}>{d.etiqueta}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                height: 26, borderRadius: 6, display: "flex", alignItems: "center",
                paddingLeft: 9, minWidth: 34,
                width: `${Math.max((d.valor / max) * 100, 8)}%`,
                background: "var(--c-gold-soft)",
                borderLeft: `2px solid var(--c-gold)`,
                fontSize: 12, fontWeight: 500,
              }}
            >
              {d.valor}
            </div>
          </div>
          <span style={{ fontSize: 12, color: DIM, width: 76, textAlign: "right", flexShrink: 0 }}>
            {f(d.valorDinero)}
          </span>
        </div>
      ))}
      <TablaAccesible titulo={titulo} datos={datos} formato="numero" />
    </figure>
  );
}
