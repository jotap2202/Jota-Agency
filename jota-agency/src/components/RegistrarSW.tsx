"use client";

import { useEffect } from "react";

/**
 * Registra el service worker, que es lo que hace que el navegador ofrezca
 * instalar la app.
 *
 * En desarrollo no se registra: un service worker activo sirve versiones
 * viejas mientras se está editando y hace perder media hora averiguando por
 * qué un cambio "no se aplica".
 */
export function RegistrarSW() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    const alta = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Que falle el registro no puede romper la app: sin service worker
        // el panel funciona igual, solo no se puede instalar.
      });
    };

    // Después de load, para no competir con el primer render.
    if (document.readyState === "complete") alta();
    else window.addEventListener("load", alta, { once: true });
  }, []);

  return null;
}
