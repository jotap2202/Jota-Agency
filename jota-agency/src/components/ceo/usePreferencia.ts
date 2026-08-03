"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Preferencias de interfaz (tema, sidebar minimizado) guardadas como
 * atributos en <html> y espejadas en localStorage.
 *
 * Por qué así y no con useState + useEffect: el valor real ya lo aplicó el
 * script inline del layout ANTES del primer pintado, para que no haya
 * parpadeo. Copiarlo a estado de React dentro de un efecto sería duplicar la
 * fuente de verdad y provocar un render en cascada — que es justamente lo
 * que el compilador de React marca como error.
 *
 * useSyncExternalStore es la herramienta pensada para esto: React lee el DOM
 * como fuente externa y se entera de los cambios sin estado espejo.
 */
export function usePreferencia<T extends string>(
  atributo: string,
  clave: string,
  valores: readonly T[],
  porDefecto: T,
): [T, (v: T) => void] {
  const suscribir = useCallback((avisar: () => void) => {
    const obs = new MutationObserver(avisar);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: [`data-${atributo}`] });
    return () => obs.disconnect();
  }, [atributo]);

  const leer = useCallback((): T => {
    const v = document.documentElement.getAttribute(`data-${atributo}`);
    return valores.includes(v as T) ? (v as T) : porDefecto;
  }, [atributo, valores, porDefecto]);

  // En el servidor no hay DOM: se devuelve el valor por defecto, que es el
  // mismo que el script inline aplica cuando no hay nada guardado.
  const enServidor = useCallback(() => porDefecto, [porDefecto]);

  const valor = useSyncExternalStore(suscribir, leer, enServidor);

  const fijar = useCallback((v: T) => {
    document.documentElement.setAttribute(`data-${atributo}`, v);
    try { localStorage.setItem(clave, v); } catch { /* modo privado sin storage */ }
  }, [atributo, clave]);

  return [valor, fijar];
}
