import Link from "next/link";

/**
 * Placeholder honesto para las secciones que todavía no se construyeron.
 *
 * Muestra el dato real que ya existe en la base y dice explícitamente en qué
 * etapa se construye. Un "coming soon" vacío no le sirve a nadie; esto al
 * menos responde "¿cuántos tengo?" y "¿cuándo lo tengo?".
 */
export function Proximamente({
  titulo,
  descripcion,
  etapa,
  dato,
  incluye,
  verEn,
}: {
  titulo: string;
  descripcion: string;
  etapa: number;
  dato?: { valor: string; label: string };
  incluye: string[];
  verEn?: { href: string; texto: string };
}) {
  return (
    <div className="ceo-anim">
      <div className="ceo-seccion-head" style={{ marginBottom: 18 }}>
        <div>
          <h1 className="ceo-h2" style={{ fontSize: 20 }}>{titulo}</h1>
          <p className="ceo-sub">{descripcion}</p>
        </div>
        <span className="ceo-chip ceo-chip-gris">Etapa {etapa}</span>
      </div>

      {dato && (
        <div className="ceo-kpis" style={{ marginBottom: 18 }}>
          <div className="ceo-kpi">
            <div className="k-l">{dato.label}</div>
            <div className="k-v">{dato.valor}</div>
            <div className="k-s">Ya está en la base de datos</div>
          </div>
        </div>
      )}

      <div className="ceo-card">
        <h2 className="ceo-h2">Qué va a incluir esta sección</h2>
        <ul style={{ marginTop: 12, display: "grid", gap: 7 }}>
          {incluye.map((i) => (
            <li key={i} style={{ display: "flex", gap: 9, fontSize: 13, color: "var(--c-text-2)" }}>
              <span aria-hidden style={{ color: "var(--c-gold)" }}>·</span>
              <span>{i}</span>
            </li>
          ))}
        </ul>

        <p style={{ fontSize: 12.5, color: "var(--c-dim)", marginTop: 18, lineHeight: 1.65, maxWidth: 560 }}>
          Los datos ya se guardan y el Overview los usa. Lo que falta es la pantalla
          para administrarlos, que se construye en la etapa {etapa}.
        </p>

        <div style={{ display: "flex", gap: 10, marginTop: 18, flexWrap: "wrap" }}>
          <Link href="/ceo" className="ceo-btn">← Volver al Overview</Link>
          {verEn && <Link href={verEn.href} className="ceo-btn ceo-btn-gold">{verEn.texto}</Link>}
        </div>
      </div>
    </div>
  );
}
