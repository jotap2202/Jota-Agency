# JOTA Agency — Ronda 3: análisis profundo desde cero

Fecha: 2026-07-31 · Rama: `claude/install-uiux-pro-max-skill-e0rk1p` · Fase de análisis, sin cambios todavía.

**Método:** relectura completa del código de `jota-agency/`, ignorando las conclusiones de `jota-agency-initial-review.md`. 24 roles (los 12 originales + los 12 nuevos pedidos). Cada hallazgo tiene evidencia verificable — grep, lectura de código o comparación directa entre archivos — antes de entrar a la lista. Donde un rol no encontró nada con evidencia real, se dice explícitamente en vez de rellenar con opiniones.

Estado de partida: las rondas 1 y 2 ya están commiteadas localmente (sin push) — este análisis parte del código **después** de esos cambios (gate de `/acceder/estado`, rate limiting, SEO básico, imágenes responsivas).

---

## Hallazgos con evidencia (G1–G5)

### G1 — [Alto] `AuthForm.tsx` y `AuthGate` (dentro de `Landing.tsx`) están duplicados casi línea por línea, y ya generaron una divergencia real de producto

**Roles que lo detectaron:** Staff Software Engineer, Principal Frontend Engineer, Code Reviewer, Senior QA.

**Archivos:** `src/components/AuthForm.tsx` (129 líneas) y la función `AuthGate` dentro de `src/components/Landing.tsx` (líneas 439-531, ~93 líneas).

**Evidencia:** comparación directa —
- Mismo estado: `tab`, `nombre`, `empresa`, `email`, `password`, `error`, `cargando`.
- Misma función `submit`: misma validación, mismo `fetch("/api/registro")`, mismo `signIn("credentials", ...)`, mismo manejo de error.
- Mismo `GoogleIcon` (SVG idéntico, copiado en los dos archivos).
- **La divergencia ya pasó:** `AuthForm.tsx` tiene los mensajes de error **hardcodeados en español** ("Ingresá un email válido.", "La contraseña debe tener al menos 6 caracteres.") mientras que `AuthGate` usa el sistema de i18n (`T[lang].diag.emailError`, etc.). Resultado concreto: **`/acceder` no es bilingüe**, aunque el resto del sitio sí — nadie lo decidió así, es una consecuencia directa de tener la misma lógica escrita dos veces y solo actualizada en un lugar.

**Impacto:** cualquier corrección futura (una validación, un mensaje, un flujo nuevo) tiene que hacerse dos veces o se repite este mismo tipo de divergencia silenciosa.

**Severidad:** Alta — no es cosmético, ya produjo un bug de producto real (falta de i18n en `/acceder`).

---

### G2 — [Alto] Race condition de doble-submit en 3 formularios

**Roles:** Senior QA, Pentester, Staff Software Engineer.

**Archivos:** `AuthGate.submit` y `DiagChat.pedir` (`Landing.tsx`), `AuthForm.submit` (`AuthForm.tsx`).

**Evidencia:** el guard es `if (!consulta || cargando) return;` (o equivalente). `cargando` se lee de la clausura del render en curso. Un doble-click rápido —antes de que React vuelva a renderizar y el atributo `disabled` del botón se actualice en el DOM real— dispara la función dos veces con `cargando` todavía en `false` en ambas invocaciones. No hay ningún guard sincrónico (ref) que no dependa del ciclo de render de React.

**Impacto real:** dos requests concurrentes a `/api/registro` (posible intento de creación de cuenta duplicado, aunque el `findUnique` en el servidor lo frena) o a `/api/diagnostico` (dos streams simultáneos escribiendo sobre el mismo estado `resultado`, UI parpadeante). Desde la ronda 2 el rate limiter del servidor amortigua el peor caso, pero el bug del lado del cliente sigue ahí — el usuario ve un parpadeo o un 429 confuso en vez de que el botón simplemente ignore el segundo click.

**Severidad:** Alta como bug de UX/confiabilidad; no es una vulnerabilidad de seguridad grave por sí sola (el servidor ya valida todo), pero es un bug real y reproducible.

---

### G3 — [Bajo] Memory leak menor: listener y timeout sin limpiar en el efecto de GSAP

**Roles:** Performance Auditor, Senior QA.

**Archivo:** `src/components/Landing.tsx`, líneas 144-151.

**Evidencia:**
```tsx
window.addEventListener("load", refresh);
setTimeout(refresh, 400);
// ...
return () => {
  cancelled = true;
  ctx?.revert();
};
```
El cleanup revierte el contexto de GSAP pero **nunca** llama a `window.removeEventListener("load", refresh)` ni cancela el `setTimeout`.

**Impacto real:** bajo — el evento `"load"` dispara una sola vez, muy temprano en la vida de la página, y es infrecuente que este componente se desmonte antes de eso. No es un leak que crezca con el uso normal. Pero es un leak real y el fix es de una línea cada uno.

**Severidad:** Baja, pero barata de arreglar con evidencia clara.

---

### G4 — [Crítico, NO se toca esta ronda] `allowDangerousEmailAccountLinking: true`

**Roles:** Security Auditor, Pentester.

**Archivo:** `src/auth.ts`, línea 22.

**Evidencia:** la propia librería Auth.js nombra la opción "dangerous". Con esto activo: si alguien crea una cuenta con contraseña usando el email de **otra persona** (no hace falta verificar el email para registrarse — confirmado en `src/app/api/registro/route.ts`, no hay paso de verificación), y esa persona real después entra con **su** Google usando el mismo email, Auth.js **fusiona automáticamente** ambas cuentas sin confirmar que sea la misma persona. El atacante que registró la cuenta primero conserva su contraseña sobre lo que ahora es la cuenta "verificada" por Google de la víctima.

**Por qué no lo toco:** es el sistema de autenticación, explícitamente excluido de esta ronda ("No cambies autenticación"). Lo marco como el hallazgo de mayor severidad de todo este análisis para que lo veas y decidas — el fix típico (exigir verificación de email antes de permitir el link, o sacar la opción y aceptar que un mismo email por Google y por contraseña generen cuentas separadas) es una decisión de producto/seguridad, no algo que deba resolver por mi cuenta.

**Severidad:** Crítica, pendiente de tu decisión explícita.

---

### G5 — [Medio, NO se toca esta ronda] `/diagnostico` + `DiagnosticoClient.tsx` parecen código muerto en la práctica

**Roles:** Staff Software Engineer, Senior Product Designer, Growth Engineer.

**Archivos:** `src/app/diagnostico/page.tsx`, `src/components/DiagnosticoClient.tsx`.

**Evidencia:** re-implementan el mismo chat que ya vive embebido en la landing (`DiagChat` dentro de `Landing.tsx`) — propio `fetch`, propio streaming, propio manejo de estado — pero **ningún link de la interfaz real apunta a la ruta `/diagnostico`**. Grep completo del código:
- La nav, el hero y el cierre de la landing linkean a `#diagnostico` (ancla dentro de la misma página, usa `DiagChat`), no a la ruta `/diagnostico`.
- El único lugar de toda la app que linkea a `/acceder` **sin** `?next=` (lo que activaría el fallback `next = "/diagnostico"`) es el enlace "← Volver al acceso" dentro de `/acceder/estado`, una página que ahora es solo para admins (ronda 1).

**Impacto:** es codigo duplicado (una tercera implementación del mismo chat, además de `DiagChat` y de la lógica de `AuthGate`/`AuthForm`) que aparentemente nadie visita en el flujo real.

**Por qué no lo toco:** no puedo confirmar con certeza que sea código muerto — podría ser una URL pensada para compartir directo (ej. en un mail o anuncio) sin pasar por la landing completa. Borrar una página es una decisión de producto, no una limpieza técnica neutra. Te lo pregunto en vez de decidir.

**Severidad:** Media — no es un bug, es deuda técnica con impacto incierto hasta que confirmes el uso real de esa URL.

---

## Checklist pedido — resultado por ítem

| Ítem pedido | Resultado |
|---|---|
| Deuda técnica | G1 (auth duplicada), G5 (`/diagnostico` posible código muerto) |
| Código duplicado | G1 (auth), y en menor medida `DiagnosticoClient.tsx` vs `DiagChat` (misma lógica de streaming escrita dos veces) |
| Componentes innecesarios | G5, a confirmar |
| Lógica repetida | G1 |
| Oportunidades de simplificación | Extraer el hook de G1 es la única con beneficio demostrado; no encontré otras con evidencia real (ver nota sobre `key={lang-i}` abajo) |
| Problemas de UX | G2 (doble-submit sin feedback claro) |
| Problemas de conversión | Sin hallazgos nuevos con evidencia esta ronda — el embudo (landing → gate → diagnóstico → CTA de llamada) ya se revisó en la ronda 1 (F2, F4 siguen pendientes, ver abajo) |
| Generación de leads | Sin hallazgos nuevos — el único camino de conversión sigue siendo el diagnóstico gateado; no until encontré fricción nueva no reportada antes |
| SEO | Sin hallazgos nuevos — round 2 ya cubrió OG/canonical/robots/favicon |
| Performance | G3 (leak menor). Bundle ya es liviano: 103kB compartido + 1-6kB por ruta (confirmado en el build de la ronda 2), sin evidencia de que haga falta optimizar más |
| Accesibilidad | Revisé `:focus-visible` (`globals.css:69`) — está bien manejado, con skip-link. `aria-live`, `aria-pressed`, labels `sr-only` ya presentes. **Sin hallazgos nuevos con evidencia** |
| Seguridad | G4 (crítico, no se toca) |
| Bugs silenciosos | G2 |
| Race conditions | G2 |
| Errores de hidratación | Revisé usos de `window`/`document`/fechas/random en render — todos están dentro de `useEffect` o gateados por `"use client"` con montado post-hidratación. **Sin hallazgos con evidencia** |
| Memory leaks | G3 |
| Imports innecesarios | Revisé imports de los archivos tocados en rondas 1-2 y los de `Landing.tsx`/`AuthForm.tsx` — **sin hallazgos**, `next lint` (que incluye `no-unused-vars`) sigue en 0 |
| Bundle size | Sin hallazgos — GSAP ya se carga con `import()` dinámico, dependencias del `package.json` confirmadas en uso (ver tabla abajo) |
| Re-renderizados | Revisé `Landing.tsx` buscando funciones/objetos recreados en cada render que causen renders innecesarios en hijos costosos — no encontré ninguno con impacto medible (los componentes son livianos, no hay listas grandes ni renders costosos que justifiquen memoización) |
| Código muerto | G5 (a confirmar) |
| Dependencias sin usar | **Ninguna** — verifiqué cada dependencia de `package.json` contra el código real: |

| Dependencia | Usada en |
|---|---|
| `@anthropic-ai/sdk` | `api/diagnostico/route.ts` |
| `@auth/prisma-adapter` | `auth.ts` |
| `@prisma/client` | `lib/prisma.ts` (generado) |
| `bcryptjs` | `auth.ts`, `api/registro/route.ts` |
| `gsap` | `Landing.tsx` (import dinámico) |
| `next-auth` | 5 archivos (`auth.ts`, `Providers.tsx`, `AuthForm.tsx`, `Landing.tsx`, `panel/page.tsx`) |

---

## Lead Engineer — síntesis y selección por ROI

De los 5 hallazgos con evidencia, descarto por ahora los que no tienen beneficio demostrado sin una decisión tuya primero (G4 toca autenticación; G5 podría romper una URL que uses activamente en marketing). Quedan **3 con alta confianza y beneficio demostrado, bajo riesgo de implementación:**

| # | Hallazgo | Severidad | Beneficio demostrado | Riesgo |
|---|---|---|---|---|
| G1 | Auth duplicada (`AuthForm`/`AuthGate`) | Alto | Ya causó un bug real (i18n roto en `/acceder`) | Bajo — extracción mecánica, sin cambiar el JSX/estilos de ningún call site |
| G2 | Doble-submit sin guard sincrónico | Alto | Bug reproducible, confirmado por lectura de código | Bajo — agregar un `useRef`, no cambia el flujo feliz |
| G3 | Listener/timeout de GSAP sin limpiar | Bajo | Leak real, aunque de bajo impacto | Muy bajo — 2 líneas |

**No implemento** (necesitan tu decisión, no son fixes técnicos neutros):
- **G4** — `allowDangerousEmailAccountLinking`. El de mayor severidad de este análisis. Necesito que confirmes cómo lo resolvemos.
- **G5** — `/diagnostico` posible código muerto. Necesito que confirmes si esa URL se usa en algún link externo antes de tocarla.
- **F2** (testimonios inventados) y **F4** (enumeración de email) de rondas anteriores — siguen pendientes de tu decisión, no de código.

Voy a implementar G1, G2 y G3 ahora, con el mismo rigor de las rondas anteriores (test cuando sea posible, lint, type-check, build, revisión adversarial).
