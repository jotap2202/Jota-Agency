# jota-panel — panel de CEO, sitio aparte

Panel privado de leads de JOTA agency, desplegado como sitio **independiente** de
`jota-agency.vercel.app` — dominio propio, deploy propio en Vercel — pero leyendo
de la **misma base de datos**, así que los leads que capture `jota-agency` aparecen
acá sin ningún paso extra.

## Por qué es una app aparte y no solo `/panel` de nuevo

- No comparte el sistema de login de `jota-agency` (Google/NextAuth): entra con
  **una sola contraseña** (`PANEL_PASSWORD`), porque es para una sola persona.
- No corre `prisma db push`: el schema y las migraciones de la base los sigue
  administrando exclusivamente `jota-agency`. Este panel solo lee/exporta.

## 🚀 Sacarlo al aire (nuevo proyecto en Vercel)

1. En Vercel → **Add New → Project** → importá el mismo repo de GitHub
   (`jotap2202/Jota-Agency`)
2. **Root Directory** → elegí `jota-panel` (no `jota-agency`)
3. Cargá 3 variables de entorno:
   - `DATABASE_URL` → **copiá el mismo valor** que ya tiene `jota-agency` en Vercel
     (Settings → Environment Variables de ese otro proyecto)
   - `PANEL_PASSWORD` → una contraseña larga, elegida por vos
   - `PANEL_SECRET` → generala con `openssl rand -hex 32` (o pegá cualquier
     string random de 32+ caracteres)
4. **Deploy**

Vercel te va a dar un dominio propio (ej. `jota-panel.vercel.app`). Podés
ponerle un dominio lindo después desde Settings → Domains (ej.
`panel.jota.agency`), igual que se podría hacer con `jota-agency`.

## Puesta en marcha (local)

```bash
npm install
cp .env.example .env      # pegá el mismo DATABASE_URL de jota-agency + elegí PANEL_PASSWORD/PANEL_SECRET
npm run dev                # http://localhost:3000
```

## Qué muestra

Lo mismo que tenía `/panel` dentro de jota-agency: números del mes, tabla de
leads con buscador, últimas consultas al diagnóstico, y exportar a Excel
(`/api/export`).
