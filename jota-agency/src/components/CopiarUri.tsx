"use client";

import { useState } from "react";

/** Caja con un valor para pegar en Google Cloud y un botón que lo copia. */
export function CopiarUri({ valor }: { valor: string }) {
  const [copiado, setCopiado] = useState(false);

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(valor);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      setCopiado(false);
    }
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <code
        className="font-mono"
        style={{
          flex: "1 1 260px", fontSize: 12, wordBreak: "break-all", color: "var(--text)",
          background: "var(--panel-soft)", padding: "12px 14px", borderRadius: 12, border: "1px solid var(--line)",
        }}
      >
        {valor}
      </code>
      <button onClick={copiar} className="btn-ghost" style={{ padding: "10px 18px", fontSize: 13, whiteSpace: "nowrap" }}>
        {copiado ? "¡Copiado!" : "Copiar"}
      </button>
    </div>
  );
}
