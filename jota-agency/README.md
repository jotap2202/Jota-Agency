# JOTA agency — sitio con login y captura de leads

Landing de JOTA agency (Next.js) con **login real** (Google + email/contraseña),
base de datos y el **diagnóstico con J gateado**: cualquiera ve la landing, pero
para usar el diagnóstico hay que crear cuenta o entrar — y así quedan sus datos.

## Qué incluye
- Landing pública (`/`)
- Portón de acceso (`/acceder`) — Google + crear cuenta / entrar (contraseña)
- Diagnóstico protegido (`/diagnostico`) — solo con sesión iniciada
- Captura de leads: cada usuario (nombre, email, empresa) y cada diagnóstico quedan en la base
- Auth con **Auth.js (NextAuth v5)** + **Prisma**; diagnóstico con la **API de Anthropic**

## 🚀 Sacarlo al aire

**El paso a paso completo (Neon + Google + Vercel) está en [`DEPLOY.md`](./DEPLOY.md).**
Son ~25 min copiando y pegando 4 valores. No necesitás saber programar.

## Puesta en marcha (local)

```bash
npm install
cp .env.example .env      # pegá DATABASE_URL (Neon), AUTH_SECRET y Google (ver abajo)
npm run db:push           # crea las tablas en tu base (una sola vez)
npm run dev               # http://localhost:3000
```

Usamos **Postgres** (Neon/Supabase) tanto local como en producción — la misma
`DATABASE_URL` para los dos. En el primer deploy de Vercel las tablas se crean
solas (el build corre `prisma db push`), así que no hay paso manual de base.

### Variables de entorno (`.env`)
| Variable | Para qué | Obligatoria |
|---|---|---|
| `DATABASE_URL` | Base Postgres (Neon/Supabase). Connection string | Sí |
| `AUTH_SECRET` | Firma de sesión. `npx auth secret` o https://generate-secret.vercel.app/32 | Sí |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | Botón "Continuar con Google" | Solo si querés Google |
| `ANTHROPIC_API_KEY` | Que J genere el diagnóstico con IA | No (sin ella, muestra un ejemplo) |

Sin `AUTH_GOOGLE_ID/SECRET`, el email+contraseña funciona igual; solo no aparecerá el login de Google real.
Sin `ANTHROPIC_API_KEY`, el diagnóstico devuelve un texto de ejemplo (pero igual guarda el lead).

## Costo del diagnóstico
La API de diagnóstico usa el modelo `claude-opus-4-8` (el más capaz). Para un tool
público y de alto volumen podés bajar costo cambiándolo por `claude-haiku-4-5` en
`src/app/api/diagnostico/route.ts` (línea del `model`).

## Panel de leads (`/panel`)

Pantalla privada para ver quién se registró y qué le consultó a J:
números del mes, tabla de contactos con buscador, las últimas consultas y
un botón para **descargar todo en Excel**.

- Se entra desde el logo **J** del pie de página, o directo en `tudominio.com/panel`.
- **Quién puede entrar:** por defecto solo el dueño. Para cambiarlo o sumar
  gente, definí `ADMIN_EMAILS` en Vercel separando con comas:
  `ADMIN_EMAILS="vos@jota.agency,socio@jota.agency"`
- A cualquier otro usuario logueado le aparece un aviso de que es privado.

## Ver / exportar los leads
Los datos quedan en las tablas `User` y `Diagnostico`. Para inspeccionarlos:

```bash
npx prisma studio      # abre un panel visual de la base
```

## Pendiente de tu lado
- Reemplazar los **testimonios de ejemplo** (`src/app/page.tsx`) por reales.
- Poner tu email real en el CTA "Agendar llamada" (`src/components/DiagnosticoClient.tsx`).
- Sumar una **Política de Privacidad** enlazada desde el portón de acceso.
