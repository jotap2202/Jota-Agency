"use client";

import { useRef, useState } from "react";

export type MensajesDiagnostico = {
  error: string;
};

/**
 * Estado y streaming compartidos entre DiagChat (portón embebido en la
 * landing) y DiagnosticoClient (la página /diagnostico) — antes cada uno
 * tenía su propia copia de esta lógica, y ya habían divergido: solo
 * DiagChat tenía el guard sincrónico contra doble-submit (ver hallazgo de
 * la auditoría de la ronda 4 "Arquitectura").
 */
export function useDiagnostico(idioma: string, mensajes: MensajesDiagnostico) {
  const [desc, setDesc] = useState("");
  const [resultado, setResultado] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [esDemo, setEsDemo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const enVueloRef = useRef(false);

  const pedir = async () => {
    const consulta = desc.trim();
    if (!consulta || enVueloRef.current) return;
    enVueloRef.current = true;
    setCargando(true);
    setError(null);
    setResultado(null);
    setEsDemo(false);
    try {
      const res = await fetch("/api/diagnostico", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ consulta, idioma }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || mensajes.error);
      }

      setEsDemo(res.headers.get("X-Diagnostico-Modo") === "demo");

      // J va escribiendo: mostramos el texto a medida que llega
      const reader = res.body?.getReader();
      if (!reader) throw new Error(mensajes.error);
      const decoder = new TextDecoder();
      let acumulado = "";
      setResultado("");
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acumulado += decoder.decode(value, { stream: true });
        setResultado(acumulado);
      }
      if (!acumulado.trim()) throw new Error(mensajes.error);
    } catch (e) {
      setResultado(null);
      setError(e instanceof Error ? e.message : mensajes.error);
    } finally {
      enVueloRef.current = false;
      setCargando(false);
    }
  };

  const reiniciar = () => {
    setResultado(null);
    setDesc("");
    setEsDemo(false);
  };

  return { desc, setDesc, resultado, cargando, esDemo, error, pedir, reiniciar };
}
