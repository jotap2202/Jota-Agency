# JOTA Agency — Auditoría final: nivel agencia SaaS premium

Fecha: 2026-07-31 · Rama: `claude/install-uiux-pro-max-skill-e0rk1p` · **Solo análisis — cero cambios de código en este documento.**

Se hace **después** de implementar las 3 decisiones pendientes (`.ai-review/jota-agency-round-4-decisiones.md`): sin `allowDangerousEmailAccountLinking`, `/diagnostico` con metadata/canonical/robots correctos, testimonios eliminados sin espacio vacío.

**Método:** cada puntaje está atado a evidencia concreta del código (archivo, línea, o comportamiento verificado con `grep`/lectura directa), no a impresión. Donde no pude verificar algo con certeza (ej. contraste de color real, que necesita un navegador con Lighthouse/axe), lo digo explícitamente en vez de inventar un número.

---

## Puntuación por categoría

| Categoría | Puntaje | Mayor gap |
|---|---|---|
| UX | **7/10** | Pared de registro completo antes de cualquier valor |
| UI | **8/10** | Estilos mezclados (Tailwind en un archivo, CSS+inline en el resto) |
| Conversión | **6/10** | Sin prueba social (recién se sacaron los testimonios falsos) ni FAQ de objeciones |
| Copywriting | **7/10** | Fuerte en el hero, débil en manejo de objeciones (precio, duración) |
| Performance | **7/10** | La landing nunca se sirve desde caché/edge |
| SEO | **6/10** | Una sola página indexable, sin contenido, sin datos estructurados |
| Accesibilidad | **7/10** *(con incertidumbre — ver nota)* | `aria-live` puede ser ruidoso en respuestas largas en streaming |
| Arquitectura | **7/10** | `DiagChat` y `DiagnosticoClient.tsx` son la misma lógica escrita 2 veces |
| Seguridad | **7/10** | Sin CSP, sin verificación de email al registrarse |
| Escalabilidad | **6/10** | Panel con tope duro de 500 leads, sin paginación |
| Calidad del código | **6/10** | Cero tests automatizados, cero CI |

Ninguna categoría llega a 9/10 todavía — es coherente con lo que es hoy: un MVP bien construido y ya bastante asegurado (4 rondas de trabajo lo probaron), no todavía un producto con la profundidad operativa de un SaaS premium.

---

## UX — 7/10

**Bien:** un solo camino de conversión claro y repetido, animaciones con `prefers-reduced-motion` respetado, feedback en streaming que genera enganche antes de pedir nada, mensajes de error legibles, guard de doble-submit ya arreglado (ronda 3).

**Gaps, priorizados:**

1. **[Alto impacto] Pared de registro completa antes de cualquier valor.** Para ver el diagnóstico hay que dar nombre, empresa, email y contraseña — cero valor mostrado antes de pedir el compromiso más alto. Patrón CRO estándar: mostrar algo de valor primero, pedir el dato después.
   - *Propuesta:* dejar escribir la descripción del negocio ANTES del gate, y recién pedir registro para "ver" el resultado ya generado (el texto ya se generó server-side, se muestra tras el registro sin tener que re-pedirlo). Requiere guardar el resultado en sesión/token temporal.
2. **[Medio] Sin camino de baja fricción.** Alguien que no quiere crear cuenta no tiene alternativa visible durante el gate — el mailto de contacto existe pero solo en el footer/cierre, no se ofrece como salida durante el formulario.
   - *Propuesta:* un link chico "¿Preferís que te escribamos nosotros?" dentro del propio portón de acceso, no solo al final de la página.
3. **[Bajo] Campo de contraseña sin mostrar/ocultar.** Detalle esperable en un producto premium 2026.

---

## UI — 8/10

**Bien:** identidad visual consistente (dorado sobre verde oscuro), tipografía con jerarquía clara, parallax con GSAP, favicon de marca (ronda 2), imágenes responsivas (ronda 2).

**Gaps:**

1. **[Medio] Dos paradigmas de estilos mezclados en el mismo proyecto.** `AuthForm.tsx` usa clases utilitarias de Tailwind (`className="w-full rounded-xl px-4 py-3..."`), mientras `Landing.tsx` usa clases custom de `globals.css` + cientos de `style={{...}}` inline. Evidencia: comparación directa de ambos archivos (son, además, el mismo formulario desde la ronda 3 — comparten lógica pero no estilo).
   - *Propuesta:* elegir un solo enfoque y migrar. Dado que `globals.css` ya tiene el sistema de diseño completo (280+ líneas, variables de marca), lo más barato es llevar `AuthForm.tsx` a las mismas clases que `AuthGate`, no al revés.
2. **[Medio] La sección de testimonios recién eliminada deja la página con menos elementos de confianza visual** que antes (correcto por la decisión tomada, pero es un hueco de diseño a llenar cuando haya contenido real — ver Conversión).

---

## Conversión — 6/10

**Bien:** CTA repetido en nav/hero/cierre, garantía concreta y con condición clara ("si no llegamos, el mes siguiente trabajamos gratis"), diagnóstico personalizado como gancho.

**Gaps, priorizados:**

1. **[Alto impacto] Sin prueba social ahora mismo.** Correcto haber sacado los testimonios inventados (F2), pero mientras no haya reales, la página no tiene ningún elemento de confianza de terceros — ni logos de clientes, ni casos, ni números verificables más allá del contador de `stats`.
   - *Propuesta inmediata (sin esperar testimonios):* logos de clientes (si podés mostrarlos, aunque sea sin cita), o un caso de estudio concreto con números reales de un cliente, si existe alguno.
2. **[Alto impacto] Sin FAQ de objeciones.** No hay nada que responda "¿cuánto sale?", "¿cuánto dura el contrato?", "¿qué pasa si no funciona?" antes de pedir la llamada — el guarantee cubre parcialmente la última, pero precio/duración quedan sin abordar en ningún lado del sitio.
   - *Propuesta:* sección FAQ corta (4-6 preguntas) antes del cierre, sin comprometerse a precios exactos (coherente con la regla que ya sigue el prompt de J de "no menciones precios").
3. **[Medio] Ver punto UX #1** — la pared de registro es también un problema de conversión, no solo de UX.

---

## Copywriting — 7/10

**Bien:** voz consistente en rioplatense (vos, cercano pero profesional), hero fuerte y memorable ("Convertimos empresas desconocidas en empresas buscadas"), garantía redactada con condición concreta en vez de vaguedad, el prompt de J (`DIAG_PROMPT`) está muy bien pensado — reglas explícitas contra inventar datos o prometer resultados.

**Gaps:**

1. **[Medio] Sin manejo de objeciones en copy** (mismo gap que Conversión #2, desde el ángulo de texto).
2. **[Bajo] Metadata genérica.** El `title`/`description` son los mismos para todo el sitio — para una agencia que sirve varios rubros (`sectores.items`: contadores, clínicas, etc.), landing pages o metadata segmentada por vertical ayudarían a SEO y a relevancia percibida, pero es una inversión de otro orden (contenido nuevo, no solo copy).
3. **Nota:** la calidad fina de copy (tono, persuasión línea por línea) conviene que la revise una persona con native fluency en el rubro — puedo verificar consistencia y estructura, no reemplazar un criterio humano de copywriting puro.

---

## Performance — 7/10

**Bien:** First Load JS ~103-118kB (liviano para un sitio con animaciones), GSAP con `import()` dinámico, fuentes con `next/font` + `display: swap`, imágenes con `srcSet`/`sizes` (ronda 2), rate limiting protege el endpoint caro de IA.

**Gaps, priorizados:**

1. **[Alto impacto, verificado] La landing (`/`) nunca se sirve desde caché de borde.** `page.tsx` llama a `auth()`, que lee cookies — eso fuerza render dinámico en cada visita (confirmado: no hay `export const dynamic = "force-static"` en ningún punto de la cadena, y `auth()` usa `cookies()` de Next.js, API que automáticamente opta por dinámico). Para un visitante anónimo esto NO dispara una consulta a la base (lo verifiqué: `faltaEmpresa()` corta temprano con `if (!e) return false` cuando no hay email — un supuesto que tenía antes de revisar el código y que descarté al comprobarlo), pero sí pierde el cacheo en el edge de Vercel, que es la ganancia de performance más grande y más barata disponible para una landing pública.
   - *Propuesta:* separar la landing pública (estática, cacheable) del gate de sesión — renderizar `/` como página estática y resolver `userEmail`/`faltaEmpresa` del lado del cliente con un fetch liviano tras la hidratación, o con un Route Handler chico. Es un cambio de arquitectura real, no trivial, pero es la mejora de performance de mayor impacto disponible.
2. **[Medio] Sin `next/image`.** Ya evaluado en rondas anteriores — se decidió no migrar para no arriesgar el parallax de GSAP. Sigue siendo una oportunidad real (mejor negociación de formato/tamaño) si en algún momento se prueba que el parallax sigue funcionando con `next/image`.
3. **[Bajo] Dependencia de Unsplash como CDN de imágenes** — sin control propio sobre disponibilidad/latencia de un tercero.

---

## SEO — 6/10

**Bien (post rondas 2 y 4):** metadata Open Graph, canonical correcto en cada ruta, `robots.txt` consistente, favicon, páginas gateadas correctamente marcadas `noindex`.

**Gaps, priorizados:**

1. **[Alto impacto] Una sola página indexable en todo el sitio.** No hay ningún contenido (blog, casos, guías) que pueda posicionar para búsquedas informativas del rubro — la única superficie indexable es la home. Para una agencia que compite por visibilidad orgánica, esto es la limitación más grande.
   - *Propuesta:* 3-5 artículos de autoridad por vertical (contadores, clínicas, etc. — ya están en `sectores.items`) es la inversión de mayor ROI a mediano plazo, aunque es contenido nuevo, no solo código.
2. **[Medio] Sin datos estructurados (JSON-LD).** Cero schema markup — ni `Organization`, ni `Service`. Barato de agregar, mejora cómo Google entiende y puede enriquecer el resultado.
3. **[Medio] Sin imagen Open Graph.** Compartir el link no muestra preview visual — se decidió dejarlo afuera en la ronda 2 por alcance, sigue pendiente.
4. **[Bajo] Sin `sitemap.xml`.** Se descartó en la ronda 2 por ser una sola página — si se agrega contenido (punto 1), pasa a ser necesario.
5. **[Bajo, ya señalado antes] El toggle ES/EN es 100% client-side** — el contenido en inglés nunca tiene URL propia, Google nunca lo indexa. Sigue sin resolverse (requeriría rutas `/en`, cambio de arquitectura de contenido).

---

## Accesibilidad — 7/10 *(con incertidumbre real)*

**Bien, verificado en código:** `:focus-visible` bien manejado con skip-link (`globals.css:69`), `aria-pressed` en el toggle de idioma, labels `sr-only` en todos los inputs, `document.documentElement.lang` se actualiza dinámicamente al cambiar idioma, `prefers-reduced-motion` respetado en 2 lugares distintos.

**Gaps:**

1. **[Medio, patrón conocido] `aria-live="polite"` sobre una respuesta que se actualiza token por token.** El resultado del diagnóstico se anuncia a lectores de pantalla en cada actualización del streaming — para una respuesta larga, eso puede leer fragmentos de oración repetidamente, una mala experiencia para un usuario de asistencia técnica. Es un problema conocido de los patrones "IA escribiendo en vivo", no exclusivo de este sitio.
   - *Propuesta:* throttlear las actualizaciones del `aria-live` (ej. anunciar cada ~2 segundos o al completar oraciones), o mover el `aria-live` a un anuncio único al terminar el streaming, dejando la animación visual sin anunciar cada token.
2. **[No verificable desde acá] Contraste de color real.** No tengo forma de correr Lighthouse/axe en este entorno (sin navegador). Los colores están en `globals.css` como variables — recomiendo una pasada real con esas herramientas antes de dar por bueno el contraste, en particular `--dim` sobre fondos oscuros, que se usa mucho para texto secundario.
3. **[Bajo] Sin toggle de mostrar/ocultar contraseña**, mismo punto que en UX.

---

## Arquitectura — 7/10

**Bien:** separación limpia `lib/`/`components/`/`app/`, dos apps del repo (bot + agencia) completamente desacopladas, patrones de NextAuth/Prisma estándar, `useAuthSubmit` (ronda 3) ya redujo duplicación real, `rate-limit.ts` documentado con sus límites explícitos.

**Gaps, priorizados:**

1. **[Alto impacto, verificado] `DiagChat` (en `Landing.tsx`) y `DiagnosticoClient.tsx` son la misma lógica de streaming escrita dos veces.** Con la decisión de esta sesión de **mantener** `/diagnostico`, este ya no es "código posiblemente muerto" (G5) — es duplicación activa y real, igual que era `AuthForm`/`AuthGate` antes de la ronda 3. Evidencia concreta: `DiagnosticoClient.tsx` **todavía tiene** el mismo bug de race condition de doble-submit que se arregló en `DiagChat` en la ronda 3 (`if (!consulta || cargando) return`, sin guard sincrónico) — es la prueba en vivo de que la duplicación ya volvió a divergir.
   - *Propuesta:* mismo patrón que `useAuthSubmit` — extraer un hook `useDiagnostico` con el estado y el streaming compartido.
2. **[Medio] Estructura de "monorepo" informal.** Dos apps con su propio `package.json`/lockfile conviviendo en el mismo repo sin herramienta de workspace (npm/pnpm workspaces, Turborepo) — ya causó un bug real (la confusión de `outputFileTracingRoot`, arreglada en la ronda 1). Sin formalizarlo, el mismo tipo de problema puede repetirse.
3. **[Bajo] Sin helper compartido para forma de respuesta de error de las API routes** — cada ruta arma su propio `Response.json({error: ...})`, funciona bien hoy pero es otro punto donde la duplicación podría divergir a futuro (mismo patrón que ya pasó dos veces).

---

## Seguridad — 7/10

**Bien (post 4 rondas):** página de diagnóstico interno gateada (ronda 1), cabeceras de seguridad base (ronda 1), rate limiting en registro/diagnóstico (ronda 2), `allowDangerousEmailAccountLinking` sacado con la UX segura ya lista (esta ronda), CSV export con protección contra inyección de fórmulas, `esAdmin()` con manejo de errores correcto.

**Gaps, priorizados:**

1. **[Alto impacto, ya señalado, sigue abierto] Sin verificación de email al registrarse.** Es la causa raíz del riesgo residual que quedó documentado en la decisión de G4 — cualquiera puede registrar el email de otra persona. No se resolvió hoy porque no estaba en el pedido, pero es la pieza que falta para cerrar el tema del todo.
   - *Propuesta:* verificación por magic-link (Auth.js/Resend, o un token simple con expiración) antes de permitir login con contraseña en una cuenta nueva.
2. **[Medio, deferido desde ronda 1] Sin Content-Security-Policy.** Se agregó el subconjunto seguro de cabeceras (`X-Frame-Options`, etc.) pero la CSP completa se dejó afuera a propósito por el riesgo de romper Google OAuth sin poder probarla en vivo desde este entorno. Sigue siendo la pieza de seguridad HTTP que falta.
3. **[Bajo] Rate limiting solo en memoria**, ya documentado como limitación conocida — un store distribuido (Redis) requeriría una dependencia nueva, decisión pendiente.
4. **[Bajo] Sin pipeline de CI que corra `npm audit`/Dependabot** — no hay forma automática de enterarse de una vulnerabilidad nueva en una dependencia.

---

## Escalabilidad — 6/10

**Bien:** Postgres en producción (no SQLite), Prisma como capa de abstracción, streaming evita bloquear requests largos, Vercel serverless escala horizontalmente por defecto.

**Gaps, priorizados:**

1. **[Alto impacto, verificado] El panel de leads tiene un tope duro de 500 registros, sin paginación ni aviso.** `src/app/panel/page.tsx:49` → `take: 500`. Pasado ese número, los leads más nuevos simplemente no aparecen — sin ningún indicador visual de que la lista está truncada. Para una agencia que target ea escalar su generación de leads, este es el techo más bajo y más silencioso de todo el sistema.
   - *Propuesta:* paginación real (cursor-based con Prisma) o al menos un aviso visible ("mostrando los últimos 500 de X") mientras se construye la paginación completa.
2. **[Medio] Rate limiting en memoria no es distribuido** (mismo punto que Seguridad #3, desde el ángulo de escala).
3. **[Medio] Sin awareness de connection pooling para Prisma + serverless.** No hay evidencia en `.env.example` ni en el schema de una configuración de pooling (PgBouncer/Neon pooled connection) — es un cuello de botella conocido de Prisma en funciones serverless bajo carga real. No puedo confirmar si Neon ya lo resuelve del lado de su infraestructura sin ver la configuración real de la cuenta.
4. **[Bajo] Sin cola/worker para la generación del diagnóstico** — hoy es síncrono con streaming (razonable a este volumen), sería un límite si el tráfico creciera mucho.

---

## Calidad del código — 6/10

**Bien:** 0 warnings de lint y 0 errores de tipos mantenidos a lo largo de 4 rondas de cambios, comentarios que explican el *por qué* no el *qué* (buena práctica ya presente antes de esta auditoría), la deduplicación de `useAuthSubmit` bajó el conteo de líneas en vez de subirlo.

**Gaps, priorizados:**

1. **[Alto impacto] Cero tests automatizados en todo el repo**, sigue siendo cierto después de 4 rondas — cada verificación de esta sesión fue manual (lint/tsc/build + revisión adversarial mía). Es el gap de mayor impacto a largo plazo: nada impide que un cambio futuro rompa el login o el panel sin que nadie lo note hasta producción.
2. **[Alto impacto] Cero CI.** Sin `.github/workflows`, no hay ninguna verificación automática en cada cambio — el "verde" de esta sesión depende de que yo (o quien sea) se acuerde de correrlo a mano.
3. **[Medio] Duplicación activa `DiagChat`/`DiagnosticoClient`** (mismo hallazgo que en Arquitectura).
4. **[Bajo] Sin pre-commit hooks** (husky/lint-staged) que fuercen lint/type-check antes de cada commit.

---

## Prioridad cruzada — qué atacaría primero si tuviera que elegir 3

No implementadas todavía, para tu aprobación:

1. **Tests + CI mínimos** (Calidad del código). Es la base que hace seguro todo lo demás — sin esto, cada mejora nueva es un riesgo no medido. Requiere agregar una dependencia de testing (Vitest/Playwright), que ya está fuera del alcance que definiste sin tu ok explícito.
2. **`useDiagnostico` compartido** entre `DiagChat` y `DiagnosticoClient.tsx` (Arquitectura). Mismo patrón ya probado con `useAuthSubmit`, mismo tipo de beneficio demostrado (la duplicación ya divergió, literalmente el mismo bug que ya arreglé una vez).
3. **Paginación del panel** (Escalabilidad). Es el techo más silencioso del sistema — hoy no se nota porque hay pocos leads, pero el día que la agencia tenga éxito, deja de ver a sus propios clientes nuevos sin ningún aviso.

El resto (contenido SEO, testimonios reales, CSP completa, verificación de email, edge caching de la landing) son mejoras reales pero de mayor esfuerzo o que dependen de decisiones de producto/contenido que no son solo código.

Quedo esperando tu aprobación antes de tocar nada de esto.
