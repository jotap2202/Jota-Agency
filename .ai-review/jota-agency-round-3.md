# JOTA Agency — Ronda 3: implementación

Fecha: 2026-07-31 · Rama: `claude/install-uiux-pro-max-skill-e0rk1p` · **Sin commit, sin push, sin deploy.**

Basado en `.ai-review/jota-agency-round-3-analysis.md` (análisis profundo desde cero, 24 roles, ignorando conclusiones anteriores). De los 5 hallazgos con evidencia (G1–G5), implemento los 3 de mayor ROI y menor riesgo; los otros 2 quedan explícitamente sin tocar porque necesitan una decisión tuya, no una corrección técnica.

## Lo que se implementa vs. lo que se deja para vos

| ID | Hallazgo | Severidad | ¿Se implementa? |
|---|---|---|---|
| G1 | `AuthForm`/`AuthGate` duplicados (~180 líneas), ya causó un bug real de i18n | Alto | ✅ |
| G2 | Race condition de doble-submit en 3 formularios | Alto | ✅ |
| G3 | Memory leak menor: listener/timeout de GSAP sin limpiar | Bajo | ✅ |
| G4 | `allowDangerousEmailAccountLinking: true` en `auth.ts` | **Crítico** | ❌ es autenticación, excluido — necesito tu decisión |
| G5 | `/diagnostico` + `DiagnosticoClient.tsx` parecen código muerto | Medio | ❌ podría ser una URL que uses en marketing — necesito que confirmes |

---

## Cambio 1 — G1: extraer `useAuthSubmit`

**Problema:** `AuthForm.tsx` (129 líneas) y la función `AuthGate` dentro de `Landing.tsx` (93 líneas) tenían el mismo estado, la misma validación y el mismo flujo de `submit` copiados dos veces. Ya había divergido de verdad: `AuthForm.tsx` tenía sus mensajes de error hardcodeados en español, mientras `AuthGate` usaba el sistema de traducción — resultado, `/acceder` no es bilingüe aunque el resto del sitio sí.

**Corrección:** nuevo `src/lib/useAuthSubmit.ts` (85 líneas) con todo el estado y la lógica de envío. Cada componente lo llama pasándole **sus propios textos exactos de antes** — no cambié ni un carácter de copy en ninguno de los dos:
- `AuthForm.tsx`: sigue pasando sus strings hardcodeados en español (la falta de bilingüismo en `/acceder` **sigue existiendo**, a propósito no la until "arreglé" de arriba abajo agregando un selector de idioma ahí — eso sería agregar una feature nueva, no deduplicar).
- `AuthGate`: sigue usando `d.emailError`, `d.passError`, etc. de `T[lang].diag`, sin cambios.

**Efecto colateral bueno, verificado:** de paso quedó arreglada la validación de email débil que también estaba duplicada (antes `!email.includes("@") || !email.includes(".")`, aceptaba `"a@."` como válido) — ahora usa una regex real, en un solo lugar, así que ambos formularios la heredan.

**Test:** corrí la regex nueva contra los casos que la vieja aceptaba mal:
```
OK: rechaza "a@." (la validación vieja lo aceptaba)
OK: rechaza "@.com"
OK: rechaza un string sin @
OK: acepta juan@jota.agency
OK: acepta email con + y subdominio
✅ TODO OK (5/5)
```

**Balance de líneas (evidencia de que es deduplicación real, no solo mover código):** `AuthForm.tsx` y `Landing.tsx` juntos perdieron 92 líneas y ganaron 53 (mayormente los `useAuthSubmit(...)` con sus objetos de mensajes); el hook nuevo tiene 85. **Neto: -39 líneas en todo el proyecto**, y la lógica de negocio quedó en un solo lugar en vez de dos.

**Riesgo:** bajo. No cambié el JSX/estilos de ningún componente — solo de dónde viene el estado y las funciones que ya usaban.

---

## Cambio 2 — G2: guard de doble-submit

**Problema:** el guard `if (cargando) return` lee `cargando` de la clausura del render en curso — un doble-click rápido, antes de que React repinte el `disabled` del botón, puede disparar la función dos veces con `cargando` todavía en `false` en ambas.

**Corrección:** un `useRef` que se setea **sincrónicamente** antes de cualquier `await`, sin depender del ciclo de render de React:
- Incluido dentro de `useAuthSubmit` (cubre `AuthForm` y `AuthGate` de una sola vez, como parte del Cambio 1).
- Agregado por separado en `DiagChat.pedir` (`Landing.tsx`), que no comparte lógica con el hook de auth (es streaming, no login).

**Test:** no hay un test de integración posible sin un navegador real simulando doble-click (fuera de alcance, no hay framework de testing). Verificado por revisión de código: el guard se lee y se setea en la primera línea de cada función, antes de cualquier `await fetch(...)`.

**Riesgo:** muy bajo. No cambia el flujo feliz (un solo click sigue funcionando exactamente igual); solo agrega una salida temprana para el caso de doble invocación.

---

## Cambio 3 — G3: limpiar listener y timeout de GSAP

**Problema:** el efecto de parallax agregaba `window.addEventListener("load", refresh)` y `setTimeout(refresh, 400)` pero el cleanup solo hacía `ctx?.revert()` — nunca removía el listener ni cancelaba el timeout.

**Corrección:**
```tsx
return () => {
  cancelled = true;
  ctx?.revert();
  if (refreshFn) window.removeEventListener("load", refreshFn);
  if (timeoutId) clearTimeout(timeoutId);
};
```

**Riesgo:** muy bajo — 4 líneas, mismo patrón de cleanup que ya usa el resto del componente (`IntersectionObserver.disconnect()`, `removeEventListener` del scroll).

---

## Verificación ejecutada (los 3 cambios juntos)

| Paso | Resultado |
|---|---|
| Test de la regex de email (casos reales que la vieja aceptaba mal) | ✅ 5/5 |
| `npx next lint` | ✅ "No ESLint warnings or errors" |
| `npx tsc --noEmit` | ✅ 0 errores |
| `npx next build` | ✅ compiló, 9 rutas, sizes casi sin cambio (`/` 6.07→6.39 kB, `/acceder` 2.51→2.76 kB — esperable al compartir un módulo nuevo) |

## Revisión adversarial independiente

- **¿Algún call site de `submit()` quedó sin el argumento `destino`?** No — los 4 call sites (2 en `AuthForm.tsx`, 2 en `AuthGate`) pasan `next` o `"/#diagnostico"` correctamente.
- **¿El botón de Google se rompió con el refactor?** No — `signIn("google", ...)` sigue igual en ambos archivos, no forma parte del hook.
- **¿Quedó algún `useState<"signup"|"login">` viejo colgado sin usarse?** No, confirmado por grep — ninguno.
- **¿Los dos `enVueloRef` (el de `useAuthSubmit` y el de `DiagChat`) pueden pisarse entre sí?** No — cada uno vive en su propio closure de hook/componente; React aísla el estado por instancia, no hay nada global compartido.
- **¿Algo más en el repo llamaba a `AuthForm` o a piezas internas esperando la firma vieja?** Solo `/acceder/page.tsx`, que sigue pasándole `next`/`google` exactamente como antes — su contrato público no cambió.
- **¿El fix de G3 puede llamar a `ScrollTrigger.refresh()` después de que el componente ya se desmontó?** Ya no — el `clearTimeout` cancela el timeout pendiente, y `removeEventListener` evita que un `"load"` tardío dispare `refresh` sobre un contexto ya revertido.

Ningún hallazgo de esta revisión requirió corregir algo adicional.

## Resumen

- **3 archivos tocados** (2 modificados + 1 nuevo)
- **Balance neto: -39 líneas** en el código existente (deduplicación real, no solo reordenar)
- **0 archivos de autenticación, schema, migraciones o variables de entorno tocados**
- lint / type-check / build: **✅ los 3 limpios**
- **Sin commit, sin push, sin deploy**

## Necesito algo tuyo, no código

1. **G4 — `allowDangerousEmailAccountLinking: true`.** El hallazgo de mayor severidad de todo este análisis. Es la propia librería la que lo llama "dangerous": alguien puede registrar una cuenta con **tu** email por contraseña, y si vos después entrás con Google usando ese mismo email, Auth.js fusiona las cuentas sin verificar que seas la misma persona. Necesito que me digas cómo lo resolvemos (sacar la opción y aceptar cuentas separadas por proveedor, o agregar verificación de email antes de registrar) — toca `auth.ts`, así que no lo hago sin tu ok explícito.
2. **G5 — `/diagnostico` + `DiagnosticoClient.tsx`.** Parecen código no alcanzable desde ningún link real del sitio. ¿Usás esa URL en algún lado externo (mail, anuncio, etc.)? Si no, la saco en la próxima ronda; si sí, la dejamos como está.
3. **F2 (testimonios inventados) y F4 (enumeración de email)** de rondas anteriores siguen pendientes — mismo pedido de siempre.
