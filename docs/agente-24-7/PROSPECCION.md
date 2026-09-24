# Prospección automática (workflow 21)

> El agente 24/7 atiende a quien ya escribió. La prospección sale a buscar a
> quien todavía no escribió, y le pasa la conversación a J apenas responde.

Código: `jota-agency/src/lib/agente/prospeccion.ts`. Pruebas:
`npm run test:prospeccion`.

---

## Cómo funciona

```
 /panel/prospectos (las 136 empresas investigadas + las que sumes)
        │
        ▼
 1. BUSCAR EMAIL ─── en la web del propio prospecto (home y /contact).
        │            Solo emails de SU dominio. Nunca adivinados.
        ▼
 2. REDACTAR ─────── Claude escribe el primer email con los datos del
        │            prospecto y tus notas. Si en las notas está el resultado
        │            de la auditoría ("tardaron 37 horas"), abre con eso.
        │            Reglas: sin links, sin %, sin datos inventados.
        ▼
 3. APROBAR ──────── modo borrador: lo revisás en el panel.
        │            modo automático: sale sin revisión.
        ▼
 4. ENVIAR ───────── por la bandeja de salida del agente (EmailOutbox), en
        │            horario hábil de Hawái, repartido en el día, con tope.
        │            Se abre una Conversation con ese Message-ID como hilo.
        ▼
 5. SEGUIR ───────── 2 seguimientos en el mismo hilo: día 3 y día 7.
        │
        ▼
 6. RESPONDE ─────── la respuesta entra por /api/agente/email, cae en ESA
        │            conversación, y J la contesta: califica y agenda.
        ▼
 7. PANEL ────────── el prospecto se actualiza solo:
                     respondió → "para seguir hoy" · J agendó → "reunión"
                     · baja o rebote → "descartado" y no se le escribe más.
```

Lo corre el cron que ya existe (`/api/agente/cron`, cada 15 minutos). No hay
servidor nuevo.

## Activarla (una sola vez)

1. **Dominio secundario para enviar.** Por ejemplo `getjota.com`. No uses
   `jotaagency.org`: si algo sale mal, se quema el dominio de la web.
   Verificalo en Resend (SPF, DKIM, DMARC) y dejalo calentar 2 semanas.
2. **Negocio de JOTA en el agente.** En `/ceo/agent/businesses`, el negocio
   de JOTA tiene que estar **activo**, con sus servicios cargados (es lo que
   J va a ofrecer cuando respondan). En sus ajustes:
   - `emailRemitente`: `Joaquín <joaquin@getjota.com>`
   - `emailResponderA`: la casilla cuyas respuestas llegan al webhook
     `/api/agente/email?tenant=<slug>` (Resend inbound, Cloudflare Email
     Workers o n8n, como el resto del agente).
3. **Variables en Vercel** (están explicadas en `.env.example`):

   | Variable | Valor |
   |---|---|
   | `PROSPECCION_TENANT` | el slug de ese negocio |
   | `PROSPECCION_DIRECCION` | tu dirección postal (la exige CAN-SPAM) |
   | `PROSPECCION_LIMITE_DIARIO` | `20` al principio |
   | `PROSPECCION_MODO` | `borrador` |
   | `RESEND_API_KEY` | ya la usa el agente |
   | `ANTHROPIC_API_KEY` | ya la usa el agente (sin ella, plantilla fija) |

4. Entrá a `/panel/prospectos`. Arriba aparece la sección **Prospección
   automática**: si falta algo, lo dice ahí en rojo.

## Uso diario

- A la mañana: revisá los borradores, corregí lo que haga falta y aprobá.
  Salen solos en el día, repartidos.
- Antes de aprobar, lo que más sube las respuestas es hacer la auditoría de
  tiempo de respuesta y anotarla en las **notas** del prospecto: el borrador
  la usa.
- Las respuestas las ves en `/ceo/agent/inbox`. J contesta según el modo del
  negocio (supervisado = te pide aprobación).

## Subir el volumen

| Semana | `PROSPECCION_LIMITE_DIARIO` | Condición para subir |
|---|---|---|
| 1–2 | 20 | menos de 2% de rebotes y ninguna queja |
| 3 | 30 | ídem |
| 4 | 40 | ídem |
| 5+ | 50 | el tope; más que esto se hace con un segundo dominio |

Cuando los borradores salgan bien sin tocarlos durante una semana, podés
pasar `PROSPECCION_MODO` a `automatico`.

## Lo que la automatización NO hace (a propósito)

- **No compra listas ni adivina emails** (`nombre@empresa.com`). Un email
  adivinado que rebota le baja la reputación a todo el dominio.
- **No escribe fuera de horario ni en fin de semana.**
- **No le escribe a quien pidió la baja**, ni aunque vuelva a aparecer como
  prospecto nuevo con el mismo email.
- **No busca empresas nuevas sola.** Las listas se investigan y se cargan
  (hoy son 136). Automatizar la búsqueda necesita una fuente de datos paga
  (Google Places, Apollo); se puede sumar como paso 0.
