"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  const entrar = async () => {
    if (cargando || !password) return;
    setCargando(true);
    setError(null);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "No pudimos entrar.");
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setError("No pude conectar. Probá de nuevo.");
    } finally {
      setCargando(false);
    }
  };

  return (
    <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 380 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "center", marginBottom: 32 }}>
          <span className="badge" aria-hidden>J</span>
          <span style={{ fontSize: 16, fontWeight: 600 }}>Panel de JOTA agency</span>
        </div>

        <div style={{ background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 24, padding: 24 }}>
          <label htmlFor="pw" className="eyebrow" style={{ marginBottom: 10 }}>
            <span className="l" /><span className="t">Contraseña</span>
          </label>
          <input
            id="pw"
            className="jfield"
            type="password"
            autoComplete="current-password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") entrar(); }}
          />
          {error && <p className="err" role="alert">{error}</p>}
          <button className="btn-gold" style={{ width: "100%", marginTop: 16, justifyContent: "center" }} onClick={entrar} disabled={cargando || !password}>
            {cargando ? "Entrando…" : "Entrar"}
          </button>
        </div>
      </div>
    </main>
  );
}
