# JOTA Agency — Ronda 1 de correcciones controladas

Fecha: 2026-07-31 · Rama: `claude/install-uiux-pro-max-skill-e0rk1p` · **Sin commit, sin push, sin deploy** (pedido explícito).

Basado en `.ai-review/jota-agency-initial-review.md`. Selección: 3 problemas de severidad Crítica/Media, verificables, que no tocan autenticación, base de datos ni producción.

## Problemas seleccionados (y uno descartado a propósito)

| ID | Problema | Severidad | Elegido |
|---|---|---|---|
| F1 | `/acceder/estado` público sin login | Crítico | ✅ |
| F5 | Next.js confunde la raíz del workspace (2 lockfiles) | Medio | ✅ |
| F10 | Sin cabeceras de seguridad HTTP | Medio | ✅ |
| F4 | Enumeración de emails en `/api/registro` | Medio | ❌ descartado esta ronda |

**Por qué descarté F4 aunque calificaba:** su único arreglo real es ocultar el mensaje "ese email ya existe, probá entrar" — pero ese mensaje hoy le dice al usuario legítimo qué hacer. Convertirlo en un mensaje genérico es una decisión de **producto** (¿vale más la seguridad marginal o la UX de conversión?), no un fix puramente técnico. Preferí no tomar esa decisión por mi cuenta en una ronda "controlada". Queda propuesto para una próxima ronda, con tu ok explícito sobre el trade-off.

---

## Cambio 1 — F1 (Crítico): gatear `/acceder/estado`

**Archivo:** `jota-agency/src/app/acceder/estado/page.tsx`

**Problema:** la página no llamaba a `auth()` en ningún punto. Cualquier visitante anónimo de internet podía entrar a `jota-agency.vercel.app/acceder/estado` y ver si `DATABASE_URL`/`AUTH_SECRET`/Google están cargados, y el `AUTH_GOOGLE_ID` exacto. No expone secretos en sí, pero es información de reconocimiento que no debería ser pública.

**Corrección mínima:** el mismo patrón ya usado (y ya probado en producción) en `panel/page.tsx` — exigir sesión, y además restringir a admin porque es información de diagnóstico interno:

```tsx
const session = await auth();
if (!session?.user) redirect("/acceder?next=/acceder/estado");
if (!(await esAdmin(session.user.email))) redirect("/");
```

**Test:** no es posible un test automatizado real — es un Server Component que necesita un servidor corriendo y una sesión real, y no hay framework de testing instalado (agregar uno está fuera de esta ronda). Verificación hecha por revisión de código: el gate es *exactamente* el mismo patrón de `panel/page.tsx:17-19`, que ya está en producción funcionando. `esAdmin()` ya tiene try/catch interno, así que un fallo de base de datos devuelve `false` (no admin) en vez de tirar una excepción — no hay riesgo de loop ni de pantalla rota.

**Riesgo de este cambio:** bajo. No toca `auth.ts`, no toca el sistema de autenticación ni sus providers — solo agrega una verificación de sesión a una página existente, igual que ya existe en `/panel` y `/diagnostico`.

**Cómo validar en producción después del deploy:** entrar a `/acceder/estado` sin sesión iniciada (o en una ventana de incógnito) → debe redirigir a `/acceder`, no mostrar contenido.

---

## Cambio 2 — F5 (Medio): `outputFileTracingRoot` explícito

**Archivo:** `jota-agency/next.config.mjs`

**Problema:** el repo tiene dos `package-lock.json` (uno en la raíz del repo — proyecto de bot de trading — y otro en `jota-agency/`). Next.js, al no saber cuál es la raíz real, elegía por error la raíz del repo. Evidencia real, del propio build:
```
Detected additional lockfiles:
  * /home/user/Jota-bot/jota-agency/package-lock.json
selected the directory of /home/user/Jota-bot/package-lock.json as the root directory.
```

**Corrección mínima:**
```js
outputFileTracingRoot: import.meta.dirname,
```

**Test:** script standalone sin dependencias nuevas (`node` puro, importa `next.config.mjs` como módulo ESM) — confirma que el valor es un string no vacío y termina en `jota-agency`. Además, comparación de build antes/después: el warning de lockfiles **desaparece por completo** tras el cambio (verificado con `next build 2>&1 | grep -i lockfile` → sin resultados).

**Riesgo de este cambio:** bajo. Es la misma raíz que Vercel ya usa como Root Directory del proyecto — no cambia qué se despliega, solo corrige lo que Next.js *cree* que es la raíz.

---

## Cambio 3 — F10 (Medio): cabeceras de seguridad HTTP base

**Archivo:** `jota-agency/next.config.mjs`

**Problema:** no había ninguna cabecera de seguridad configurada. Sin `X-Frame-Options`, el sitio es embebible en un iframe de otro dominio (clickjacking) — relevante porque hay formularios de login/registro.

**Corrección mínima (subconjunto seguro, sin CSP):**
```js
async headers() {
  return [{
    source: "/:path*",
    headers: [
      { key: "X-Frame-Options", value: "DENY" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    ],
  }];
}
```

**Por qué NO incluí una CSP completa:** armar una Content-Security-Policy que no rompa Google OAuth, GSAP y las fuentes de Google necesita probarse contra el sitio real desplegado — ya lo había marcado como "riesgo medio, necesita pruebas" en el análisis inicial. Meterla a ciegas en una ronda de "cambios mínimos verificables" sería contradictorio.

**Test:** mismo script standalone — llama a `nextConfig.headers()` y confirma que las 3 cabeceras están presentes con los valores exactos, aplicando a todas las rutas (`/:path*`).

**Riesgo de este cambio:** bajo. Confirmé que no hay ningún iframe ni Google One Tap en el proyecto (`signIn("google")` hace un redirect de página completa, no un widget embebido) — no hay nada que `X-Frame-Options: DENY` pueda romper dentro de esta app.

---

## Verificación ejecutada (los 3 cambios juntos)

| Paso | Resultado |
|---|---|
| Test standalone (`node` puro, sin deps nuevas) sobre `next.config.mjs` | ✅ 7/7 checks OK |
| `npx next lint` | ✅ "No ESLint warnings or errors" |
| `npx tsc --noEmit` | ✅ 0 errores |
| `npx next build` (con `DATABASE_URL`/`AUTH_SECRET` dummy) | ✅ compiló, generó las 7 rutas esperadas |
| Warning de lockfiles en el build | ✅ confirmado ausente (estaba presente en la línea base) |

## Revisión adversarial independiente

Chequeos hechos buscando activamente romper mi propia implementación:

- **¿`esAdmin()` puede tirar una excepción no controlada dentro del nuevo gate?** No — ya tiene `try/catch` interno (`src/lib/admin.ts:37-45`), devuelve `false` ante cualquier fallo de base de datos.
- **¿El `redirect("/")` para no-admin puede entrar en loop?** No — `/` es la landing pública, no vuelve a `/acceder/estado`.
- **¿`export const dynamic = "force-dynamic"` seguía intacto?** Sí, no lo toqué — sigue evitando que Next.js cachee la página como estática.
- **¿Hay algún iframe o Google One Tap en el proyecto que `X-Frame-Options: DENY` pudiera romper?** No — confirmado por grep (`iframe`, `One Tap`, `accounts.google.com/gsi` → 0 resultados). El login usa `signIn("google")`, que es un redirect de página completa.
- **¿Los tres `redirect()` de `/panel`, `/diagnostico` y `/acceder/estado` comparten código que un cambio en uno pueda romper en otro?** No — cada página tiene su propia llamada, no hay una función compartida que se haya modificado.
- **¿`import.meta.dirname` es soportado en este entorno?** Sí — Node v22.22.2 (soportado desde Node 20.11+); confirmado empíricamente porque el build lo resolvió correctamente (el warning de lockfiles desapareció, lo que solo pasa si el valor se leyó bien).

Ningún hallazgo de esta revisión requirió corregir algo adicional — los 3 cambios se sostienen.

## Diff completo

```diff
diff --git a/jota-agency/next.config.mjs b/jota-agency/next.config.mjs
index 81523be..fa23897 100644
--- a/jota-agency/next.config.mjs
+++ b/jota-agency/next.config.mjs
@@ -1,8 +1,24 @@
 /** @type {import('next').NextConfig} */
 const nextConfig = {
+  // El repo tiene otro package-lock.json en el directorio padre (proyecto
+  // aparte). Sin esto, Next.js infiere mal la raíz del workspace y calcula
+  // mal qué archivos empaqueta cada función serverless.
+  outputFileTracingRoot: import.meta.dirname,
   images: {
     remotePatterns: [{ protocol: "https", hostname: "images.unsplash.com" }],
   },
+  async headers() {
+    return [
+      {
+        source: "/:path*",
+        headers: [
+          { key: "X-Frame-Options", value: "DENY" },
+          { key: "X-Content-Type-Options", value: "nosniff" },
+          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
+        ],
+      },
+    ];
+  },
 };
 
 export default nextConfig;
diff --git a/jota-agency/src/app/acceder/estado/page.tsx b/jota-agency/src/app/acceder/estado/page.tsx
index 8656ca1..5241b0a 100644
--- a/jota-agency/src/app/acceder/estado/page.tsx
+++ b/jota-agency/src/app/acceder/estado/page.tsx
@@ -1,5 +1,8 @@
 import Link from "next/link";
+import { redirect } from "next/navigation";
 import { headers } from "next/headers";
+import { auth } from "@/auth";
+import { esAdmin } from "@/lib/admin";
 import { revisarClientId, revisarClientSecret, revisarAuthSecret, envLimpio } from "@/lib/config-auth";
 import { CopiarUri } from "@/components/CopiarUri";
 
@@ -21,6 +24,13 @@ function Fila({ titulo, ok, detalle }: { titulo: string; ok: boolean; detalle: s
 }
 
 export default async function EstadoLoginPage() {
+  // Página de diagnóstico interno: expone si las credenciales están cargadas
+  // (nunca su valor secreto) y el ID de cliente de Google en uso. No es apta
+  // para visitantes anónimos, así que se restringe igual que /panel.
+  const session = await auth();
+  if (!session?.user) redirect("/acceder?next=/acceder/estado");
+  if (!(await esAdmin(session.user.email))) redirect("/");
+
   const h = await headers();
   const host = h.get("x-forwarded-host") || h.get("host") || "";
   const proto = h.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
```

## Resumen

- **2 archivos modificados** (límite era 8)
- **34 líneas agregadas, 0 eliminadas**
- **0 archivos de autenticación, schema, migraciones o variables de entorno tocados**
- lint / type-check / build: **✅ los 3 limpios**
- **Sin commit, sin push, sin deploy** — cambios solo en el working tree, a la espera de tu revisión
