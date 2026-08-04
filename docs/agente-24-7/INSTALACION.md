# Instalación

De cero a la app funcionando. Son unos 20 minutos, casi todo esperando que
otros servicios te den una clave.

---

## Lo que hace falta

| Servicio | Para qué | Plan | Obligatorio |
| --- | --- | --- | --- |
| **Neon** (o cualquier Postgres) | La base de datos | Gratis hasta 0,5 GB | Sí |
| **Anthropic** | El modelo que responde | Pago por uso, ~US$0,03 por conversación | Sí — sin esto el agente no responde |
| **Vercel** | Donde vive la app | Hobby gratis · Pro US$20/mes | Sí para producción |
| **Resend** | Enviar los emails | 3.000/mes gratis, después US$20 | Sí — sin esto los emails no salen |
| **Google Cloud** | Login con Google | Gratis | No, se puede entrar con email y contraseña |
| **Slack** | Avisos al equipo | Gratis | No |

No hace falta n8n, ni una base vectorial, ni un CRM externo.

---

## Variables de entorno

Todas van en `jota-agency/.env` (local) y en Vercel → Settings → Environment
Variables (producción). Ninguna se sube a Git: `.env*` está en `.gitignore`.

### Obligatorias

| Variable | Qué es | Si falta |
| --- | --- | --- |
| `DATABASE_URL` | Connection string de Neon | La app no arranca |
| `AUTH_SECRET` | Firma las sesiones. `npx auth secret` | No se puede iniciar sesión |
| `ADMIN_EMAILS` | Quién entra al panel, separados por coma | **En producción no entra nadie** |
| `ANTHROPIC_API_KEY` | Clave de console.anthropic.com | El agente no responde: guarda la consulta y la deriva al equipo |

### Necesarias para que funcione completo

| Variable | Qué es | Si falta |
| --- | --- | --- |
| `APP_ENCRYPTION_KEY` | Cifra las credenciales de los clientes. `openssl rand -base64 48` | No se pueden guardar integraciones |
| `RESEND_API_KEY` | Envío de email | Los emails quedan como "simulados": se ven en el panel pero no salen |
| `CRON_SECRET` | Protege el cron de seguimientos | Cualquiera puede dispararlo |
| `SITIO_URL` | URL canónica, ej. `https://jotaagency.org` | Los emails y el widget apuntan al default |

### Opcionales

| Variable | Qué es |
| --- | --- |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | Login con Google |
| `AGENTE_MODELO` | Por defecto `claude-opus-4-8`. `claude-sonnet-5` cuesta bastante menos |

### Solo para probar el envío de email

`ALLOW_REAL_EMAIL_TEST` y `TEST_EMAIL_RECIPIENT`. **No las dejes en
producción.**

---

## Instalación local

```bash
git clone <el repo>
cd Jota-bot/jota-agency
npm install
cp .env.example .env      # completá los valores
npx prisma db push        # crea las tablas
npm run preview:seed      # usuario demo + negocio de demostración
npm run dev
```

Abrí **http://localhost:3000/ceo/agent**

Entrás por `/acceder` → pestaña **Entrar**:
- `demo@jotaagency.local`
- `JotaDemo2026!`

Para que ese usuario tenga acceso, su email tiene que estar en `ADMIN_EMAILS`.

---

## Producción (Vercel)

1. Importá el repo en Vercel. **Root Directory: `jota-agency`**.
2. Cargá las variables de arriba en Production, Preview y Development.
3. Deploy.

El build corre `prisma db push`, así que las tablas se crean solas contra la
`DATABASE_URL` configurada. Es cómodo y es un riesgo: apunta a la base que
tenga esa variable, sin preguntar. Revisá que sea la correcta antes del primer
deploy.

El cron de seguimientos y recuperación queda configurado en `vercel.json`:
corre cada 15 minutos contra `/api/agente/cron`.

### Después del primer deploy

- Entrá a `/ceo/agent/health` y revisá que no haya nada en rojo.
- Si `ADMIN_EMAILS` no está seteada, **el panel queda cerrado para todos**. Es
  a propósito: antes, sin esa variable, el sistema le daba acceso de
  administrador a la primera cuenta que se registrara en la web.

---

## Instalarla como app (PWA)

La app se instala sin pasar por ninguna tienda.

**Celular (Android/Chrome):** abrí la URL → menú ⋮ → *Instalar aplicación*.
**iPhone (Safari):** compartir → *Agregar a pantalla de inicio*.
**Computadora (Chrome/Edge):** ícono de instalar en la barra de direcciones.

Queda como una app con su ícono, sin barra del navegador, y con accesos
directos a Conversaciones, Leads y Salud.

Requiere HTTPS, así que en producción funciona y en `localhost` también
(el navegador lo trata como seguro). El service worker **no guarda datos**: el
panel muestra leads y conversaciones de clientes, y dejar copias en el
dispositivo sería una filtración. Sin conexión muestra una pantalla que lo
explica, no una versión vieja del panel.

---

## Verificar que funciona

```bash
npm run test:secretos     # ninguna clave llega al navegador
npm run test:agente       # 161 pruebas, sin base ni claves
npm run test:agente-db    # 109 pruebas contra Postgres real
npm run test:e2e          # el flujo completo con IA real
```

`test:e2e` es el que importa antes de mostrárselo a un cliente: da de alta un
negocio, entra una consulta, el agente responde con IA real, califica el lead,
arma los emails y deriva a un humano. Cuesta unos US$0,15 en tokens.

Para que además **envíe los emails de verdad**, a tu propia casilla:

```bash
ALLOW_REAL_EMAIL_TEST=true TEST_EMAIL_RECIPIENT=vos@correo.com npm run test:e2e
```

---

## Problemas comunes

**"No puedo entrar al panel en producción."** Falta `ADMIN_EMAILS`, o tu email
no está en la lista. Es lo primero que muestra `/ceo/agent/health`.

**"El agente contesta siempre lo mismo y deriva todo."** Falta
`ANTHROPIC_API_KEY`. La consulta igual queda guardada, no se pierde nada.

**"Los emails dicen simulado."** Falta `RESEND_API_KEY`, o el dominio no está
verificado en Resend. Sin dominio verificado, Resend solo deja enviar desde
`onboarding@resend.dev` y solo a la casilla dueña de la cuenta.

**"El widget no aparece en el sitio del cliente."** El negocio tiene que estar
en estado *activo*, y `website_chat` habilitado en Settings → Canales.
