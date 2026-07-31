# JOTA Agency — Ronda 2 de correcciones controladas

Fecha: 2026-07-31 · Rama: `claude/install-uiux-pro-max-skill-e0rk1p` · **Sin commit, sin push, sin deploy.**

Continuación de `.ai-review/jota-agency-round-1.md`, mismas reglas: hasta 3 problemas Crítico/Alto/Medio, cambios verificables, sin tocar autenticación, base de datos ni producción, máximo 8 archivos.

## Problemas seleccionados (y el que sigo dejando afuera)

| ID | Problema | Severidad | Elegido |
|---|---|---|---|
| F3 (parcial) | Sin rate limiting en `/api/registro` y `/api/diagnostico` | Alto | ✅ |
| F6/F6b | Sin metadata OG/canonical, sin favicon, sin `robots.txt` | Medio | ✅ |
| F8 | Imágenes a resolución fija, mismo peso en mobile y desktop | Medio | ✅ |
| F2 | Testimonios inventados presentados como reales | Alto | ❌ sigue afuera |

**F2 sigue sin tocarse, van dos rondas.** Es el único Alto que queda sin abordar, y sigue siendo así a propósito: no tengo testimonios reales para reemplazarlos, y no es mi lugar decidir si se borra la prueba social del sitio. Se lo pido directo al final de este documento.

**F3 solo parcial:** implementé el límite en registro y diagnóstico (rutas de negocio, no tocan `auth.ts`). El límite de intentos de login por credenciales necesitaría tocar el `authorize()` de `src/auth.ts` — sigue excluido.

---

## Cambio 1 — F3 (Alto, parcial): rate limiting en registro y diagnóstico

**Archivos:** `jota-agency/src/lib/rate-limit.ts` (nuevo), `jota-agency/src/app/api/registro/route.ts`, `jota-agency/src/app/api/diagnostico/route.ts`.

**Problema:** ningún endpoint tenía límite de uso. `/api/registro` permitía crear cuentas ilimitadas (spam del panel de leads); `/api/diagnostico`, aunque exige sesión, no limitaba cuántas veces por minuto un usuario autenticado podía llamar a la API de Anthropic (costo).

**Corrección mínima:** un limitador simple en memoria, por ventana fija (`src/lib/rate-limit.ts`), sin dependencias nuevas:
- `/api/registro`: 5 intentos cada 10 minutos, por IP — se evalúa antes de parsear el body.
- `/api/diagnostico`: 8 consultas cada 10 minutos, por usuario (no por IP, porque ya hay sesión) — se evalúa después de validar la consulta pero **antes** de llamar a Anthropic, para no gastar la llamada cara.

**Limitación documentada a propósito:** es en memoria, por instancia — en Vercel serverless no es un límite distribuido. Frena abuso repetido contra una misma instancia tibia, no un ataque coordinado desde muchas IPs en paralelo. Un límite realmente distribuido necesita un store compartido (ej. Upstash Redis), que es una dependencia nueva — **decisión para pedir aparte, no la tomé por mi cuenta.**

**Test:** corrí la lógica real de `rate-limit.ts` con `node --experimental-strip-types` (Node 22, sin transpilar ni agregar dependencias) contra el archivo TypeScript real, no una réplica:

```
OK: primeros 3 intentos (límite 3) permitidos
OK: el 4to intento (límite 3) es rechazado
OK: reintentarEnSeg > 0 cuando se rechaza
OK: una clave distinta (t2) no hereda el límite de t1
OK: t3 se bloquea dentro de la ventana
OK: pasada la ventana (resetAt), se vuelve a permitir
✅ TODO OK (6/6)
```

**Riesgo de este cambio:** bajo-medio. El principal riesgo es calibrar mal los umbrales (bloquear a alguien legítimo); 5 registros/10min y 8 diagnósticos/10min son generosos para uso humano normal y ajustables después si hace falta. Verifiqué que el manejo de errores del lado del cliente (`DiagnosticoClient.tsx` y `Landing.tsx`) ya lee genéricamente `data.error` de cualquier respuesta no-ok — un 429 nuevo se muestra sin tocar el cliente.

**Cómo validar:** llamar a `/api/registro` 6 veces seguidas desde el mismo origen → la 6ta debe devolver 429 con `Retry-After`.

---

## Cambio 2 — F6/F6b (Medio): metadata OG/canonical, favicon y `robots.txt`

**Archivos:** `jota-agency/src/app/layout.tsx`, `jota-agency/src/app/robots.ts` (nuevo), `jota-agency/src/app/icon.svg` (nuevo).

**Problema:** `metadata` solo tenía `title`/`description`; no había `openGraph`, `canonical` ni `metadataBase`; no existía ningún favicon ni `robots.txt` en todo el proyecto.

**Corrección mínima:**
- `layout.tsx`: agregué `metadataBase` (`https://jota-agency.vercel.app`), `alternates.canonical` y un bloque `openGraph` básico (título, descripción, url, siteName, locale, type) — **sin imagen OG**, a propósito: generar una imagen custom es un cambio más grande, lo dejo para otra ronda.
- `robots.ts`: convención nativa de Next.js (`MetadataRoute.Robots`, sin dependencias). Permite todo excepto `/panel`, `/acceder/estado` y `/api/` — las tres rutas privadas o sin valor para un buscador.
- `icon.svg`: favicon con la "J" dorada de la marca, mismos colores que ya usa `.gold-grad` en `globals.css` (`#f0c75e → #e3b341 → #c99427`). Convención nativa de Next.js (`src/app/icon.svg`), se sirve solo sin configuración adicional.

**No agregué `sitemap.ts`:** el sitio tiene una sola página pública indexable (`/`); un sitemap no aporta valor real con un solo URL.

**Test:** no aplica un test de lógica (es metadata declarativa). Verificación real: el build generó explícitamente las rutas nuevas `/icon.svg` y `/robots.txt` como estáticas (confirmando que Next.js las reconoció y las sirve), y `tsc` validó el objeto `Metadata` contra los tipos oficiales de Next.js.

**Riesgo de este cambio:** bajo. Es metadata puramente aditiva, no cambia ningún comportamiento visible del sitio ni ninguna ruta existente.

**Cómo validar en producción:** `/robots.txt` y `/icon.svg` deben responder 200; compartir el link del sitio en Slack/WhatsApp debería mostrar título y descripción (sin imagen).

---

## Cambio 3 — F8 (Medio): imágenes responsivas sin migrar a `next/image`

**Archivo:** `jota-agency/src/components/Landing.tsx`.

**Problema:** el hero (`w=1800`) y las dos imágenes de sección (`w=1400`) pedían siempre la misma resolución fija a Unsplash sin importar el tamaño de pantalla — un celular descargaba lo mismo que un monitor de escritorio.

**Corrección mínima:** agregué `srcSet`/`sizes` a los `<img>` que ya existen, **sin migrar a `next/image`** (eso cambiaría el DOM y arriesgaría el parallax de GSAP, que apunta a estos elementos por clase `.hero-img`/`.frame-img`):

```ts
function unsplashSrcSet(url: string, anchos: number[]): string {
  return anchos.map((w) => `${url.replace(/([?&])w=\d+/, `$1w=${w}`)} ${w}w`).join(", ");
}
```

- Hero: `srcSet` con 800/1200/1800/2400px, `sizes="100vw"` (es un fondo a todo el ancho).
- Las dos imágenes de sección (`.frame-img`): `srcSet` con 480/768/1000/1400px, `sizes="(max-width: 768px) 100vw, 50vw"` (están en un layout de dos columnas en desktop).

El `className`, `alt`, `loading`/`fetchPriority` y `decoding` de cada `<img>` quedaron exactamente igual — cero cambios de estructura del DOM.

**Test:** corrí `unsplashSrcSet` de forma aislada (lógica pura, sin dependencias) contra URLs de prueba y contra la URL real de `IMG_HERO`:

```
OK: reemplaza w= manteniendo el resto de la query (800/1200/1800)
OK: genera exactamente 3 variantes separadas por coma+espacio
OK: no deja el w= original pegado en las otras variantes
OK: IMG_HERO real: 4 variantes
OK: conserva el ID de la foto original
✅ TODO OK (7/7)
```

**Riesgo de este cambio:** bajo. `srcSet`/`sizes` solo influyen en qué variante de imagen descarga el navegador — no tocan `className` ni la estructura del DOM, así que el selector de GSAP (`gsap.utils.toArray(".frame-img")`, `document.querySelectorAll` equivalente) sigue encontrando exactamente los mismos elementos.

**Cómo validar:** DevTools → pestaña Network con "Mobile" emulado → confirmar que se pide la variante de 480-800px, no la de 1800-2400px.

---

## Verificación ejecutada (los 3 cambios juntos)

| Paso | Resultado |
|---|---|
| Test de `rate-limit.ts` (Node real, sin deps nuevas) | ✅ 6/6 |
| Test de `unsplashSrcSet` (lógica pura, sin deps nuevas) | ✅ 7/7 |
| `npx next lint` | ✅ "No ESLint warnings or errors" |
| `npx tsc --noEmit` | ✅ 0 errores |
| `npx next build` (con `DATABASE_URL`/`AUTH_SECRET` dummy) | ✅ compiló, 9 rutas (7 anteriores + `/icon.svg` + `/robots.txt`) |

## Revisión adversarial independiente

- **¿El rate limit de `/diagnostico` se evalúa antes de gastar la llamada a Anthropic?** Sí — confirmado por línea: el chequeo está antes de `client.messages.stream(...)`.
- **¿El cliente (`DiagnosticoClient.tsx`, `Landing.tsx`) sabe mostrar un 429 nuevo?** Sí, sin cambios — ambos ya leen `data.error` de cualquier respuesta `!res.ok` de forma genérica; no hay manejo especial por código de estado que hubiera que actualizar.
- **¿El rate limit de `/registro` cuenta también los intentos inválidos (nombre vacío, etc.)?** Sí, a propósito — se evalúa antes de parsear el body, protege también contra flooding con requests malformados.
- **¿`srcSet`/`sizes` cambia el elemento que GSAP anima?** No — mismo `<img>`, mismo `className`, mismos atributos previos intactos; solo se agregaron `srcSet`/`sizes`.
- **¿La ausencia de imagen en `openGraph` deja el objeto de metadata inválido?** No — `images` es opcional en el tipo `OpenGraph` de Next.js; el build lo confirma (0 errores de tipos).
- **¿El límite en memoria puede bloquear a un usuario legítimo detrás de un NAT/IP compartida (oficina, 4G)?** Es un riesgo real pero inherente a cualquier rate-limit por IP, no algo que este cambio empeore; 5 registros/10min es generoso para ese escenario y ya está documentado como limitación conocida del enfoque en memoria.

Ningún hallazgo de esta revisión requirió corregir algo adicional.

## Diff — resumen

```
 jota-agency/src/app/api/diagnostico/route.ts | 14 ++++++++++++++
 jota-agency/src/app/api/registro/route.ts    | 10 ++++++++++
 jota-agency/src/app/layout.tsx               | 19 ++++++++++++++++---
 jota-agency/src/components/Landing.tsx       | 17 ++++++++++++++---
 4 files changed, 54 insertions(+), 6 deletions(-)

 + jota-agency/src/app/icon.svg
 + jota-agency/src/app/robots.ts
 + jota-agency/src/lib/rate-limit.ts
```

## Resumen

- **7 archivos tocados** (4 modificados + 3 nuevos), límite era 8
- **0 archivos de autenticación, schema, migraciones o variables de entorno tocados**
- lint / type-check / build: **✅ los 3 limpios**
- **Sin commit, sin push, sin deploy**

## Pendiente que necesito de vos, no de código

**F2 — testimonios de `src/lib/contenido.ts`.** Van dos rondas evitándolo a propósito. Dos caminos, los dos válidos:
1. Me pasás 2-3 testimonios reales (nombre, rol, cita) y los reemplazo.
2. Me confirmás que los saque de la web hasta que tengas reales, y ajusto el layout de esa sección.

Mientras no me digas cuál, sigue publicado tal cual está.
