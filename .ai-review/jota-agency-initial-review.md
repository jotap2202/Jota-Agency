# JOTA Agency — Revisión inicial multiagente (Fase 1: solo análisis)

Fecha: 2026-07-31 · Rama: `claude/install-uiux-pro-max-skill-e0rk1p` · Sin cambios de código en esta fase.

## Alcance y método

- **App analizada:** `jota-agency/` (Next.js 15.1.6, React 19, NextAuth v5 beta, Prisma + Postgres). Es la que corresponde a `jota-agency.vercel.app` — confirmado por el Root Directory configurado en Vercel y por el historial de deploys de este proyecto.
- **Fuera de alcance:** la carpeta raíz del repo (`mi-trading-bot`, Next.js 16, bot de grid trading) es una app completamente distinta, sin código ni dependencias compartidas con `jota-agency/`. Solo se la menciona donde afecta al build de jota-agency (ver F5).
- **git status al iniciar:** limpio, sin cambios pendientes (rama al día con `origin/claude/install-uiux-pro-max-skill-e0rk1p`).
- **Comandos descubiertos** (`jota-agency/package.json`):
  | Script | Comando |
  |---|---|
  | `dev` | `next dev` |
  | `build` | `prisma generate && prisma db push && next build` |
  | `start` | `next start` |
  | `lint` | `next lint` |
  | `postinstall` | `prisma generate` |
  | *(no existe)* | type-check → se corrió manualmente `npx tsc --noEmit` |
  | *(no existe)* | tests → **no hay ningún script ni framework de testing instalado** |
- **Línea base ejecutada ahora mismo:**
  - `npx tsc --noEmit` → ✅ 0 errores
  - `npx next lint` → ✅ "No ESLint warnings or errors" (con una advertencia de Next.js, ver F5)
  - `npx next build` (con `DATABASE_URL`/`AUTH_SECRET` dummy) → ✅ compiló, generó las 7 rutas esperadas, sin errores
  - Tests → **no aplica, no existen** (0 archivos `*.test.*`/`*.spec.*` en todo el repo, no hay `.github/workflows`, no hay Jest/Vitest/Playwright configurado)

La app parte de una línea base sana: compila, tipa y lintea limpio. Los hallazgos de abajo son de diseño/seguridad/contenido/performance, no errores de compilación.

---

## Hallazgos por agente

Cada hallazgo tiene un ID (F1…F14) usado también en la consolidación final para marcar duplicados entre agentes.

### 1. Product Strategist

| Severidad | Archivo | Evidencia | Impacto | Solución propuesta | Riesgo de modificar | Cómo validar |
|---|---|---|---|---|---|---|
| **Alto — F2** | `src/lib/contenido.ts:128-131` (ES) y `:243+` (EN) | Comentario propio en el código: `// NOTA: testimonios de ejemplo... Reemplazá nombre, rol y texto por clientes reales.` — y sin embargo están publicados en el sitio en vivo con nombre, rol y cita entre comillas, indistinguibles de testimonios reales. | Una agencia que vende "generación de clientes B2B" mostrando prueba social inventada arriesga su credibilidad si se descubre, y en varias jurisdicciones presentar reseñas fabricadas como genuinas es sancionable (ej. lineamientos de la FTC sobre testimonios). | Reemplazar por testimonios reales de clientes, o quitar la sección hasta tenerlos. | Ninguno técnico — es contenido. | Revisión visual de la sección "Testimonios" en `/`. |
| Medio | `src/lib/contenido.ts` (`diag.eyebrow`, oferta general) | La oferta lista 7 servicios (prospección, LinkedIn, email frío, agente IA, reputación, ads, playbook) sin ningún indicio de precio ni de por dónde empieza un cliente nuevo, más allá de "agendar llamada". | Es una decisión de negocio válida (vender por llamada, no por precio en la web), pero **no hay evidencia de que sea un error** — se anota como observación, no como bug. | *(sin acción — no es un problema, es una decisión de producto)* | — | — |

### 2. Senior UX/UI Designer

No se detectaron problemas de UI concretos con evidencia de código (el diseño con GSAP/parallax, `prefers-reduced-motion` y estados de carga ya está implementado correctamente — verificado en `Landing.tsx:56,92` y `globals.css:277,290`). Los hallazgos de este rol que sí tienen evidencia concreta quedaron mejor encuadrados como SEO/Accesibilidad (F6) y Performance (F8), para no duplicar.

### 3. Conversion Rate Optimization Specialist

| Severidad | Archivo | Evidencia | Impacto | Solución propuesta | Riesgo | Validación |
|---|---|---|---|---|---|---|
| Alto (compartido con Product) — **F2** | `src/lib/contenido.ts:128-131` | Ver arriba. | La prueba social es uno de los mayores drivers de conversión B2B; si se descubre que es falsa, el efecto es negativo (destruye confianza en vez de construirla). | Ídem F2. | — | — |
| Bajo | Formulario de registro pide nombre+empresa+email+password antes de mostrar el diagnóstico | `src/components/Landing.tsx` `AuthGate` — 4 campos obligatorios antes de la primera respuesta de valor. | Fricción esperable y ya es una decisión consciente de producto (gatear el diagnóstico es la estrategia central de captura de leads, documentada en el README). No hay evidencia de que esté mal calibrado. | *(sin acción — decisión de producto, no bug)* | — | — |

### 4. Senior Frontend Engineer

| Severidad | Archivo | Evidencia | Impacto | Solución propuesta | Riesgo | Validación |
|---|---|---|---|---|---|---|
| Medio — **F8** | `src/components/Landing.tsx:179,254,293` | `<img>` crudo (`eslint-disable-next-line @next/next/no-img-element`) con URLs de Unsplash a resolución fija (`w=1800`, `w=1400`) en vez de `next/image`, pese a que `next.config.mjs` ya declara `remotePatterns` para `images.unsplash.com`. | Un celular descarga la misma imagen de 1800px que un monitor de escritorio — peor LCP en el hero, que es la primera impresión del sitio. | Migrar a `next/image` (sigue renderizando un `<img>` real, compatible con las animaciones de GSAP) o generar `srcset` manual variando `w=` de Unsplash por breakpoint. | Medio — hay que confirmar que el parallax de GSAP (que apunta a `.hero-img`/`.frame-img` por clase) siga funcionando igual. | Lighthouse Performance + inspección de Network en emulación mobile. |
| Bajo — **F7** | `src/app/api/registro/route.ts:17`, `src/components/AuthForm.tsx:32`, `src/components/Landing.tsx:442` | La validación de email es literalmente `!email.includes("@") || !email.includes(".")`, duplicada igual en los 3 archivos. Acepta strings como `"a@."` como válidos. | Lógica repetida que puede divergir con el tiempo; permite emails con formato inválido. | Centralizar en una función compartida (ej. `src/lib/validacion.ts`) con una regex real, usada en los 3 puntos. | Bajo. | Probar registro con emails malformados variados. |

### 5. Senior Backend Engineer

| Severidad | Archivo | Evidencia | Impacto | Solución propuesta | Riesgo | Validación |
|---|---|---|---|---|---|---|
| Alto — **F3** | `src/app/api/registro/route.ts`, `src/app/api/diagnostico/route.ts`, `src/auth.ts` (Credentials) | `grep -rn "ratelimit\|rate-limit\|upstash"` en `src/` y `package.json` → 0 resultados. No existe `middleware.ts`. | `/api/registro` permite crear cuentas ilimitadas (spam del panel de leads); el login por credenciales no tiene límite de intentos (fuerza bruta de contraseñas); `/api/diagnostico`, aunque exige sesión, no limita cuántas veces por minuto un usuario autenticado puede llamar a la API de Anthropic (costo). | Agregar rate limiting básico (por IP y/o por usuario) en `/api/registro` y `/api/diagnostico` sin tocar el sistema de auth; el límite de intentos de login requeriría tocar `authorize()` en `src/auth.ts`, que está **excluido en esta fase** — queda pendiente de aprobación explícita. | Medio si se calibra mal (bloquear usuarios legítimos). | Script que golpee los endpoints N veces seguidas y confirme el corte. |
| Medio — **F4** | `src/app/api/registro/route.ts:26-28` | `if (existe) return Response.json({ error: "Ya existe una cuenta con ese email..." }, { status: 409 })` | Enumeración de emails: cualquiera puede confirmar si un email está registrado en JOTA agency probando uno por uno. | Responder de forma genérica sin confirmar existencia, o al menos no filtrar el motivo exacto. | Bajo — cambio de copy/status. | Probar con un email existente y uno nuevo, comparar respuestas. |
| Bajo — **F12** | `src/app/api/registro/route.ts:20` | `if (password.length < 6)` — sin regla de complejidad. | Contraseñas triviales ("123456") son válidas. | Subir el mínimo (8+) y opcionalmente pedir al menos una letra y un número. | Bajo. | Registrar con `"123456"`. |

### 6. Database Engineer

| Severidad | Archivo | Evidencia | Impacto | Solución propuesta | Riesgo | Validación |
|---|---|---|---|---|---|---|
| Bajo (crece con volumen) — **F9** | `prisma/schema.prisma` | Los únicos índices declarados son los `@@unique` compuestos de `Account` y `VerificationToken`. `Diagnostico.userId`, `Account.userId` y `Session.userId` no tienen `@@index`. A diferencia de MySQL, Postgres **no** indexa automáticamente las columnas de foreign key generadas por relaciones de Prisma. | Con pocos leads no se nota. Cuando el panel tenga miles de registros, el conteo por usuario (`_count.diagnosticos`) y el listado de "últimos diagnósticos" van a hacer table scans. | Agregar `@@index([userId])` en `Diagnostico`, `Account` y `Session`. | Bajo (índice no destructivo) — pero es un cambio de `schema.prisma`, **explícitamente excluido en esta fase**. | `EXPLAIN ANALYZE` sobre las queries del panel antes/después, en una base con volumen simulado. |
| Sin hallazgos adicionales | — | El modelo de datos (`User`/`Account`/`Session`/`VerificationToken`/`Diagnostico`) sigue el esquema estándar de Auth.js + una tabla propia razonable; las relaciones tienen `onDelete: Cascade` correctamente configurado. | — | — | — | — |

### 7. Security Engineer

| Severidad | Archivo | Evidencia | Impacto | Solución propuesta | Riesgo | Validación |
|---|---|---|---|---|---|---|
| **Crítico — F1** | `src/app/acceder/estado/page.tsx` (archivo completo) | `grep -n "auth(\|session\|redirect"` sobre el archivo → **0 coincidencias**. La página no llama a `auth()` ni verifica sesión de ningún tipo. | Cualquier visitante anónimo de internet puede entrar a `jota-agency.vercel.app/acceder/estado` y ver si `DATABASE_URL`/`AUTH_SECRET`/Google están cargados y bien formateados, y el valor exacto de `AUTH_GOOGLE_ID` — información de reconocimiento útil para un atacante y mala práctica dejar un endpoint de diagnóstico interno público en producción (aunque no exponga secretos en sí). | Gatear la página igual que `/panel`: `const session = await auth(); if (!session?.user) redirect(...)`, y opcionalmente restringir a admin con `esAdmin()`. | Bajo — mismo patrón ya usado en `panel/page.tsx`, no toca el sistema de auth en sí. | Visitar `/acceder/estado` sin sesión iniciada → debe redirigir, no mostrar contenido. |
| Alto (compartido con Backend) — **F3** | Ver Backend Engineer arriba. | — | — | — | — | — |
| Medio (compartido con Backend) — **F4** | Ver Backend Engineer arriba. | — | — | — | — | — |
| Medio — **F10** | `next.config.mjs` | El archivo solo define `images.remotePatterns`; no hay función `headers()`. | Sin `X-Frame-Options`/`frame-ancestors` el sitio es clickjackeable (relevante porque hay formularios de login/registro); sin `Referrer-Policy`/`X-Content-Type-Options`/CSP básica, falta una capa de defensa estándar. | Agregar `headers()` en `next.config.mjs` con un set base (`X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`) y evaluar una CSP compatible con Google OAuth + Unsplash + fonts de Google + Anthropic. | Medio — una CSP mal armada puede romper el login de Google o las fuentes/GSAP si no se prueba bien; el set base sin CSP es de bajo riesgo. | `securityheaders.com` contra el dominio; probar login de Google y landing después del cambio. |
| Bajo, a monitorear — **F14** | `src/lib/admin.ts` | Documentado en el propio código: sin `ADMIN_EMAILS` seteada, el dueño del panel es "quien creó la primera cuenta del sitio" (`prisma.user.findFirst({ orderBy: { createdAt: "asc" } })`). Según esta misma sesión, `ADMIN_EMAILS` **no está seteada** en producción hoy. | Riesgo solo si la base se resetea alguna vez sin volver a fijar `ADMIN_EMAILS` antes: el próximo que se registre —cualquiera— se vuelve dueño del panel de leads. Con la base actual (el dueño ya tiene cuenta creada) el riesgo hoy es bajo. | Definir `ADMIN_EMAILS` explícitamente en Vercel para dejar de depender del fallback. | Ninguno técnico — es solo una variable de entorno, pero **tocar variables de entorno está excluido en esta fase**. | Revisar el valor de `ADMIN_EMAILS` en el dashboard de Vercel. |

### 8. QA Engineer

**Estrategia de testing para los flujos críticos** (no existe ninguno automatizado hoy — F11):

| Flujo | Cobertura actual | Riesgo si se rompe sin aviso |
|---|---|---|
| Registro con email/contraseña | Manual únicamente | Alto — es la puerta de entrada de leads |
| Login con Google | Manual únicamente (ya tuvo una falla real de `invalid_client` esta sesión, detectada por el usuario en producción, no por ningún test) | Alto |
| Logout | Manual únicamente | Bajo |
| Diagnóstico (streaming IA) | Manual únicamente | Alto — es el producto central de captura |
| Guardado de leads | Manual únicamente | Alto |
| Cambio de idioma ES/EN | Manual únicamente | Bajo |
| Panel admin (acceso + export CSV) | Manual únicamente | Alto — expone datos de leads si el gate falla |

| Severidad | Evidencia | Impacto | Solución propuesta | Riesgo | Validación |
|---|---|---|---|---|---|
| Alto (proceso) — **F11** | `find . -iname "*.test.*" -o -iname "*.spec.*"` → 0 resultados en todo el repo; no hay `.github/workflows`; no hay Jest/Vitest/Playwright en `package.json`. | Cada cambio (incluidos los de esta sesión) se valida a mano con `tsc`/`lint`/`build`, pero ningún flujo de usuario real tiene verificación automática — una regresión silenciosa en login o en el gate del panel solo se detecta si alguien la prueba manualmente en producción. | Fuera de alcance de esta Fase 1 (requiere agregar dependencias de testing, explícitamente restringido ahora). Propuesta para una fase futura: un puñado de tests E2E con Playwright cubriendo registro+login por credenciales, gate de `/diagnostico` sin sesión, y que `/api/panel/export` devuelva 403 sin ser admin. | Bajo agregar, pero es trabajo nuevo no pedido todavía y requiere `npm install` de una dependencia nueva. | Correr la suite en CI en cada PR. |

### 9. Performance Engineer

| Severidad | Archivo | Evidencia | Impacto | Solución propuesta | Riesgo | Validación |
|---|---|---|---|---|---|---|
| Medio (duplicado) — **F8** | Ver Frontend Engineer arriba. | — | — | — | — | — |
| Info | `src/app/layout.tsx:6-23` | Fuentes vía `next/font/google` con `display: "swap"` — ya es la práctica recomendada, no requiere cambios. | — | *(sin acción — ya está bien)* | — | — |
| Info | GSAP | Import dinámico dentro de `useEffect` (confirmado en sesiones previas) — evita cargar GSAP en el bundle inicial. Ya está bien. | — | *(sin acción)* | — | — |

### 10. SEO Specialist

| Severidad | Archivo | Evidencia | Impacto | Solución propuesta | Riesgo | Validación |
|---|---|---|---|---|---|---|
| Medio — **F6** | `src/app/layout.tsx:25-29`, `src/components/Landing.tsx:29` | `metadata` solo tiene `title`/`description` — sin `openGraph`, sin `alternates`, sin `metadataBase`. El toggle ES/EN (`useState<Idioma>("es")`) es 100% client-side, no existen rutas `/en`; `<html lang="es">` queda fijo en `layout.tsx:33` aun cuando el usuario ve la versión en inglés. | Google nunca indexa el contenido en inglés (no tiene URL propia que rastrear); compartir el link en redes no muestra imagen/descripción (no hay OG); el atributo `lang` mal etiquetado afecta lectores de pantalla cuando el sitio está en modo inglés. | Agregar metadata Open Graph + canonical + `metadataBase`; evaluar si vale la pena un routing real `/en` para SEO, o al menos actualizar el atributo `lang` del `<html>` dinámicamente según el toggle. | Bajo-medio, cambios aditivos de metadata; el routing `/en` sería un cambio más grande (fuera de alcance de esta fase). | Lighthouse SEO audit; inspeccionar `<head>` generado. |
| Medio — **F6b** | `jota-agency/` (repo completo) | No existe carpeta `public/`; no hay `favicon`/`icon.*` en `src/app/`; no hay `robots.txt` ni `sitemap.xml`. | El sitio no tiene ícono en la pestaña del navegador ni al compartir, y no guía a los rastreadores de buscadores. | Agregar `src/app/icon.svg` (o `favicon.ico`), `src/app/robots.ts` y `src/app/sitemap.ts` (soportados nativamente por el App Router, sin dependencias nuevas). | Bajo, aditivo. | Ver la pestaña del navegador y `/robots.txt` / `/sitemap.xml` en producción. |

### 11. DevOps Engineer

| Severidad | Archivo | Evidencia | Impacto | Solución propuesta | Riesgo | Validación |
|---|---|---|---|---|---|---|
| Medio — **F5** | `package-lock.json` (raíz) + `jota-agency/package-lock.json` | Output real de `next lint`/`next build` en esta sesión: *"Detected additional lockfiles: /home/user/Jota-bot/jota-agency/package-lock.json"* y *"selected the directory of /home/user/Jota-bot/package-lock.json as the root directory."* | Next.js infiere mal la raíz del workspace por tener dos lockfiles en el árbol (raíz + `jota-agency/`). El *output file tracing* (qué archivos empaqueta cada función serverless) puede calcularse mal. Hoy el impacto real es limitado porque el Root Directory de Vercel ya está fijado a `jota-agency`, pero es una fuente de bugs difíciles de diagnosticar si el setup cambia. | Setear `outputFileTracingRoot` explícitamente en `jota-agency/next.config.mjs` apuntando a la carpeta `jota-agency`. | Bajo — es una línea de configuración, no afecta build ni deploy actuales. | Correr `next build` y confirmar que el warning de lockfiles desaparece. |
| Info | `jota-agency/package.json` build script | `"build": "prisma generate && prisma db push && next build"` — corre `db push` contra la base real en cada build de producción. | Ya documentado y es una decisión consciente (cero pasos manuales de DB); el riesgo es que un `schema.prisma` mal escrito rompa el build contra la base real — no hay evidencia de que esto esté pasando hoy. | *(sin acción — comportamiento intencional, ya documentado en README/DEPLOY.md)* | — | — |

### 12. Adversarial Reviewer

Revisión cruzada de los hallazgos de los demás agentes:

- **F1 (estado sin auth) confirmado, no es falso positivo** — se verificó leyendo el archivo completo y con grep dirigido; no hay ningún wrapper de autenticación en ese route ni en un `layout.tsx` intermedio dentro de `acceder/`.
- **F2 (testimonios falsos) confirmado con evidencia directa** — el propio comentario en el código lo admite ("testimonios de ejemplo"); no es una opinión estética, es un hecho verificable en el archivo.
- **F3/F4 (rate limiting / enumeración) confirmados por ausencia verificable** — se buscó explícitamente cualquier mecanismo de límite (`middleware.ts`, librerías conocidas) y no existe ninguno.
- **Se descartaron** como hallazgos "hipotéticos sin evidencia": posibles problemas de contraste de color, "podría haber" problemas de escalabilidad del motor de diagnóstico, o sugerencias de rediseño — ninguno tiene evidencia concreta en el código actual y se excluyeron para no inflar el reporte.
- **Se descartó** el hallazgo inicial de "el panel podría filtrar el hash de la contraseña al cliente" tras revisar `panel/page.tsx` y `PanelBusqueda.tsx`: el campo `password` se consulta en el servidor solo para derivar `origen: "Email"/"Google"` y **nunca** se pasa al componente cliente ni al CSV como valor — es un falso positivo, no se incluye en la lista final.
- **F9 (falta de índices)** es válido pero de severidad baja *hoy*; se mantiene con severidad "Bajo, crece con volumen" en vez de "Alto" para no exagerar un problema que todavía no afecta el rendimiento real.
- **F14 (primer usuario = admin)** ya era una decisión consciente tomada y explicada al usuario en esta misma sesión — se incluye solo como recordatorio operacional, no como bug nuevo.

---

## Consolidación — Lead Engineer

Duplicados fusionados (mismo ID en más de un agente): F2 (Product + CRO), F3 (Backend + Security), F4 (Backend + Security), F8 (Frontend + Performance), F6/F6b (SEO, dos partes del mismo problema). Total de hallazgos únicos: **14** (F1–F14).

Descartados explícitamente por no tener evidencia concreta o ser puramente estéticos: contraste de color, "el motor de diagnóstico podría no escalar", sugerencias de rediseño visual sin justificación, y el falso positivo de fuga de password hash en el panel.

### Resumen priorizado

| # | Hallazgo | Severidad | ¿Tocable ahora? (respetando tus restricciones) |
|---|---|---|---|
| F1 | `/acceder/estado` público, sin auth — expone estado de configuración | **Crítico** | ✅ Sí — mismo patrón que `/panel`, no toca el sistema de auth |
| F2 | Testimonios inventados presentados como reales | **Alto** | ✅ Sí — es contenido |
| F3 | Sin rate limiting (registro, diagnóstico, login) | **Alto** | ⚠️ Parcial — registro/diagnóstico sí; el límite de intentos de login toca `src/auth.ts` (excluido, necesita tu ok explícito) |
| F11 | Cero tests automatizados en todo el repo | **Alto** (proceso) | ⚠️ Requiere agregar una dependencia nueva (Playwright/Vitest) — excluido por "no agregues dependencias" hasta que lo confirmes |
| F4 | Enumeración de emails en `/api/registro` | Medio | ✅ Sí |
| F6/F6b | SEO: sin OG/canonical/favicon/robots/sitemap; `lang` fijo en "es" | Medio | ✅ Sí (metadata/robots/sitemap/favicon son aditivos, sin nuevas deps) |
| F10 | Sin cabeceras de seguridad HTTP | Medio | ✅ Sí (el set base); la CSP completa necesita más pruebas |
| F5 | Next.js confunde el workspace root por 2 lockfiles | Medio | ✅ Sí — una línea en `next.config.mjs` |
| F8 | Imágenes hero sin `next/image`, mismo peso en mobile y desktop | Medio | ✅ Sí, con cuidado de no romper el parallax de GSAP |
| F7 | Validación de email débil, duplicada en 3 archivos | Bajo-medio | ✅ Sí |
| F9 | Sin índices en foreign keys (`Diagnostico.userId`, etc.) | Bajo (crece con volumen) | ❌ No — es `schema.prisma`, explícitamente excluido |
| F12 | Contraseña mínima de 6 caracteres sin reglas | Bajo | ✅ Sí |
| F13 | README desactualizado (rutas de archivos que ya cambiaron) | Bajo | ✅ Sí |
| F14 | Fallback "primer usuario = admin" sigue activo (sin `ADMIN_EMAILS`) | Bajo, a monitorear | ❌ No — es una variable de entorno, explícitamente excluida |

**No se encontraron errores críticos de compilación, tipado ni build** — la línea base está sana. Los hallazgos son de seguridad (F1 el más urgente), contenido/confianza (F2), y huecos de proceso (F3 parcial, F11) más una cola de mejoras de SEO/performance/calidad de código de severidad media-baja.
