# 🚀 Sacar JOTA agency al aire (paso a paso)

Tiempo estimado: **20–30 min**. Todo lo de acá es gratis para empezar.
No hace falta saber programar: es copiar y pegar valores.

Al terminar vas a tener tu sitio en una URL pública, con login de Google + email
y captura de leads funcionando de verdad.

---

## Resumen de lo que vas a hacer

1. Crear una base de datos gratis (**Neon**)
2. Crear las credenciales de **Google** (para el botón "Continuar con Google")
3. Generar el **AUTH_SECRET**
4. Subir a **Vercel** y cargar las 4 variables → **Deploy**
5. Volver a Google y pegar la URL final

> El repo ya está listo. Vos solo conseguís 4 valores y los pegás en Vercel.

---

## 1) Base de datos — Neon (5 min)

1. Entrá a **https://neon.tech** → *Sign up* (con tu Google).
2. *Create project* → nombre "jota" → región la más cercana (ej. AWS São Paulo) → *Create*.
3. Te muestra una **Connection string**. Copiala entera. Se ve así:
   ```
   postgresql://usuario:password@ep-xxxx.sa-east-1.aws.neon.tech/neondb?sslmode=require
   ```
4. Guardala en un bloc de notas. La vas a pegar como **`DATABASE_URL`**.

> No tenés que crear tablas: se crean solas en el primer deploy.

---

## 2) Google — botón "Continuar con Google" (10 min)

1. Entrá a **https://console.cloud.google.com** → arriba, *Select a project* → *New Project* → nombre "JOTA" → *Create*.
2. Menú ☰ → **APIs y servicios → Pantalla de consentimiento de OAuth**:
   - Tipo: **Externo** → *Crear*.
   - Nombre de la app: `JOTA agency`. Email de asistencia: el tuyo. Datos de contacto: el tuyo. → Guardar y continuar hasta el final.
   - En *Usuarios de prueba* podés agregarte a vos; después publicás la app.
3. Menú ☰ → **APIs y servicios → Credenciales → Crear credenciales → ID de cliente de OAuth**:
   - Tipo de aplicación: **Aplicación web**.
   - **URIs de redireccionamiento autorizados** → *Agregar*:
     ```
     http://localhost:3000/api/auth/callback/google
     ```
     (más abajo, en el paso 5, agregás el de tu dominio de Vercel)
   - *Crear*.
4. Te da **Client ID** y **Client Secret**. Copiá los dos → serán **`AUTH_GOOGLE_ID`** y **`AUTH_GOOGLE_SECRET`**.

> ¿Querés salir al aire ya sin Google? Se puede: dejá esas dos vacías y el
> login por **email + contraseña** funciona igual. Después agregás Google.

---

## 3) AUTH_SECRET (1 min)

Es una clave aleatoria que firma las sesiones. Generá una acá:
**https://generate-secret.vercel.app/32** → copiá el texto que aparece.
Ese es tu **`AUTH_SECRET`**.

(Si tenés Node instalado, también sale con `npx auth secret`.)

---

## 4) Vercel — deploy (10 min)

1. Entrá a **https://vercel.com** → *Sign up* con tu **GitHub**.
2. *Add New… → Project* → elegí el repo **`jota-bot`** → *Import*.
3. **⚠️ Importante — Root Directory:** hacé clic en *Edit* al lado de "Root Directory"
   y seleccioná la carpeta **`jota-agency`**. (El repo tiene también el bot de trading;
   esto le dice a Vercel que despliegue solo el sitio de la agencia.)
4. Abrí **Environment Variables** y cargá estas 4 (Name → Value):

   | Name | Value |
   |---|---|
   | `DATABASE_URL` | la connection string de Neon (paso 1) |
   | `AUTH_SECRET` | la clave del paso 3 |
   | `AUTH_GOOGLE_ID` | Client ID de Google (paso 2) |
   | `AUTH_GOOGLE_SECRET` | Client Secret de Google (paso 2) |

   Opcional (para que J genere el diagnóstico con IA de verdad):
   | `ANTHROPIC_API_KEY` | tu clave de https://console.anthropic.com |

   > Sin `ANTHROPIC_API_KEY`, el diagnóstico muestra un ejemplo pero **igual captura el lead**.

5. *Deploy*. Esperá 1–2 min. Te da una URL tipo **`https://jota-bot-xxxx.vercel.app`**.

---

## 5) Cerrar el círculo con Google (2 min)

1. Copiá tu URL de Vercel (paso 4).
2. Volvé a **Google Cloud → Credenciales → tu ID de OAuth → Editar**.
3. En *URIs de redireccionamiento autorizados* → *Agregar*:
   ```
   https://TU-URL-DE-VERCEL.vercel.app/api/auth/callback/google
   ```
   (reemplazá por tu URL real) → *Guardar*.
4. Esperá ~1 min y probá el botón de Google en tu sitio.

✅ **Listo. Estás al aire.**

---

## Ver los leads que entran

Cada persona que crea cuenta o entra con Google queda guardada (nombre, email,
empresa) junto con su diagnóstico. Para verlos:

- **Rápido:** en Neon → tu proyecto → pestaña *Tables* → tablas `User` y `Diagnostico`.
- **Local (panel visual):** con el proyecto bajado, `npx prisma studio`.

---

## Correr en tu compu (opcional)

```bash
cd jota-agency
npm install
cp .env.example .env      # pegá DATABASE_URL (la misma de Neon), AUTH_SECRET, y Google
npm run db:push           # crea las tablas (una sola vez)
npm run dev               # http://localhost:3000
```

---

## Dominio propio (cuando quieras)

En Vercel → tu proyecto → *Settings → Domains* → agregá tu dominio (ej. `jotaagency.org`).
Después sumá `https://jotaagency.org/api/auth/callback/google` a los redirect URIs de Google.

---

## Antes de compartirlo con clientes (recomendado)

- Sumar **testimonios reales** (la sección se quitó: no se muestran inventados).
- El email de contacto de toda la web sale de `EMAIL_CONTACTO` en
  `src/lib/contenido.ts`. Cambiándolo ahí se actualiza en todos los CTA.
- Sumar una **Política de Privacidad** enlazada desde el portón de acceso
  (importante legalmente porque estás capturando datos de personas).
