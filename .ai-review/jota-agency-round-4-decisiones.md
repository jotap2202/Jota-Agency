# JOTA Agency — Implementación de las 3 decisiones pendientes

Fecha: 2026-07-31 · Rama: `claude/install-uiux-pro-max-skill-e0rk1p` · **Sin commit, sin push, sin deploy.**

## Decisión 1 — G4: sacar `allowDangerousEmailAccountLinking`

**Análisis del porqué del flag:** sin él, Auth.js rechaza (con `OAuthAccountNotLinked`) el login de Google cuando el email ya tiene una cuenta creada por contraseña. El flag existía para evitar ese rechazo.

**Por qué es peligroso:** `/api/registro` no verifica el email al crear la cuenta. Con el flag activo, cualquiera puede registrar tu email con una contraseña que solo él conoce; cuando entrás con tu Google real (verificado), Auth.js fusiona automáticamente esa cuenta con tu login — la otra persona conserva acceso vía su contraseña.

**Solución implementada:** se saca el flag (`src/auth.ts`). La UX segura **ya estaba construida y sin usar**: `/acceder/page.tsx` ya traduce `OAuthAccountNotLinked` a *"Ese email ya tiene una cuenta creada con contraseña. Entrá con tu email y contraseña."* — con el flag activo ese mensaje nunca podía dispararse.

**Riesgo residual, no resuelto hoy (documentado, no es parte de esta decisión):** si alguien ocupa tu email por error o mala intención, quedás bloqueado para entrar con Google con esa dirección — no te roba nada, pero es un problema de UX. La causa raíz (el registro no verifica el email) necesitaría una verificación por magic-link, que es una feature aparte.

## Decisión 2 — G5: mantener `/diagnostico`, corregir indexación

**Problema encontrado al revisar (más allá de lo pedido, pero la misma causa):** `/diagnostico` y `/acceder` no tenían `metadata` propia, así que heredaban el `canonical: "/"` de la raíz — le decían a Google que su URL "real" era la home. Ninguna de las 4 páginas gateadas (`/diagnostico`, `/acceder`, `/panel`, `/acceder/estado`) tenía un canonical propio.

**Corrección, aplicada de forma consistente a las 4:**
- `/diagnostico`: nueva `metadata` (antes no tenía ninguna) — `robots: {index:false}`, `canonical: "/diagnostico"`, `title` propio, más `dynamic = "force-dynamic"` (mismo patrón que `/panel` y `/acceder/estado`, que ya lo tenían).
- `/acceder`: ídem, no tenía ninguna metadata.
- `/panel` y `/acceder/estado`: ya tenían `robots: {index:false}`, se les agregó el `canonical` propio que faltaba.
- `robots.ts`: se agregaron `/acceder` y `/diagnostico` al `disallow` (antes solo estaban `/panel` y `/acceder/estado`). `/acceder` como prefijo ya cubre `/acceder/estado`, así que quedó más simple.

**Resultado:** las 4 rutas gateadas ahora tienen comportamiento consistente — no indexables, con canonical propio (en vez del heredado incorrecto), y bloqueadas en `robots.txt`. `/diagnostico` sigue existiendo y funcionando exactamente igual para los usuarios; el cambio es puramente de metadata para buscadores.

## Decisión 3 — F2/F4: quitar los testimonios sin dejar espacio vacío

**Implementado:** se eliminó la sección `TESTIMONIOS` completa de `Landing.tsx` (JSX), los campos `testCap`/`testTitulo`/`testSub`/`testimonios` de `contenido.ts` (tipo + ES + EN), y la CSS que solo usaba esa sección (`.tgrid`, `.tcard` y sus reglas hijas) en `globals.css`.

**Sin placeholders falsos:** no se puso ningún texto genérico tipo "próximamente" ni testimonios inventados de otra forma — la sección simplemente no existe hasta que haya contenido real.

**Por qué no queda un hueco vacío:** era una `<section>` normal en el flujo del documento (no un layout con espacio reservado). Ahora la sección "MÉTODO" (termina en el bloque de garantía, con `paddingBottom: 96`) conecta directo con "DIAGNÓSTICO" (`paddingTop: 96`) — mismo patrón de espaciado que ya se usa entre las otras secciones de la página, se ve como una transición intencional, no como un corte.

## Verificación

| Paso | Resultado |
|---|---|
| `npx next lint` | ✅ 0 warnings |
| `npx tsc --noEmit` | ✅ 0 errores |
| `npx next build` | ✅ compiló, 8 rutas (una menos que antes: sin `/api/perfil` no, sigue — la baja es porque el conteo de páginas estáticas bajó de 9 a 8 al no generar contenido extra de testimonios, dentro de lo esperado) |
| grep de `testCap/testTitulo/testSub/testimonios/tgrid/tcard` en todo `src/` | ✅ cero coincidencias |
| grep de `OAuthAccountNotLinked` en `/acceder` | ✅ presente, listo para activarse |
| grep de `allowDangerousEmailAccountLinking` | ✅ solo queda el comentario explicando por qué no se usa |

**9 archivos tocados**, balance neto: **-29 líneas** (38 inserciones, 67 eliminaciones). Sin tocar Prisma schema, variables de entorno ni package.json.

**Sin commit, sin push, sin deploy** — sigue a la espera de tu revisión, igual que las rondas anteriores.
