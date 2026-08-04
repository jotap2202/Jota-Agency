# 24/7 AI Agent — arquitectura

> Zero lost inquiries. Ninguna consulta desaparece en silencio.

Este documento es el paso 1 obligatorio: qué hay hoy, qué falta, qué se
decidió y por qué. La implementación vive en `jota-agency/src/lib/agente/`.

---

## 1. Análisis del proyecto actual

Se revisó el repositorio completo antes de escribir una línea.

| Qué se buscó | Qué se encontró |
| --- | --- |
| Instancia de n8n (self-hosted o Cloud) | **No existe.** Cero referencias en todo el repo: ni docker-compose, ni URL, ni credencial, ni workflow exportado. |
| Base de datos | Postgres (Neon) con Prisma 6. Ya en producción. |
| Modelo de IA | `@anthropic-ai/sdk` ya instalado y en uso (`/api/diagnostico`). Clave: `ANTHROPIC_API_KEY`. |
| Base vectorial | No existe. Sin pgvector, sin Pinecone, sin Supabase vector. |
| Proveedor de email | No existe. Hay casilla Google Workspace (`jotaagency@jotaagency.org`) pero ninguna integración SMTP/API. |
| Calendario | No existe integración. Google OAuth está configurado, pero solo con scope de login. |
| CRM | No existe CRM externo. El CRM real hoy es la tabla `Prospecto` + el CEO Command Center. |
| Slack / SMS / WhatsApp | No existe. |
| Hosting | Vercel (serverless + cron). Next.js 15.5 App Router, React 19, TypeScript estricto. |
| Auth | NextAuth v5 (Google + credenciales) con `esAdmin()`. |

Variables de entorno que el código ya espera: `DATABASE_URL`, `AUTH_SECRET`,
`AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `ANTHROPIC_API_KEY`, `ADMIN_EMAILS`,
`SITIO_URL`, `PANEL_SECRET`, `PANEL_PASSWORD`.

---

## 2. Decisión de arquitectura (y por qué no es n8n-first)

El pedido proponía **n8n-first**. Analizado el proyecto, la recomendación es
distinta, y conviene decirlo antes de construir:

**Recomendación: orquestador propio en Next.js + Postgres, con n8n como capa
opcional de conectores por cliente.**

Motivos concretos, no de preferencia:

1. **No hay n8n.** Adoptarlo hoy significa levantar y mantener un servidor
   nuevo (o pagar n8n Cloud), con su propia base, backups, actualizaciones y
   superficie de ataque. Es infraestructura nueva para una agencia de una
   persona.
2. **n8n no es un runtime multiempresa.** Sus credenciales viven a nivel
   instancia, no a nivel tenant. Aislar 20 clientes dentro de un n8n exige
   convenciones manuales; un error de convención mezcla datos de dos clientes.
   El pedido prohíbe explícitamente esa mezcla. Con `tenantId` en la base y
   un guard en cada consulta, el aislamiento se puede *probar*.
3. **El panel ya hay que escribirlo en Next.js.** El propio pedido lo admite
   ("un panel administrativo en Next.js si n8n no es suficiente"). Con la
   lógica en TypeScript, el panel y el agente comparten tipos, validaciones y
   pruebas. Con n8n en el medio, se duplica todo y el panel queda hablándole
   a workflows por HTTP.
4. **Ya se paga Vercel + Neon.** Latencia de respuesta menor, cero salto de
   red extra, y el cron de Vercel cubre seguimientos y recuperación.
5. **Se puede versionar y probar.** Los workflows de n8n son JSON en una base
   ajena: no entran a CI, no tienen `tsc --noEmit`, no tienen pruebas.

**Dónde sí entra n8n:** como *conector* cuando un cliente pide una
integración exótica (su CRM viejo, su ERP, Yelp, un webhook raro). El
orquestador expone webhooks de entrada y salida; n8n se engancha ahí sin
tocar el núcleo. Esa puerta queda abierta en el diseño (`TenantIntegration`
tipo `webhook_saliente`), no hay que reescribir nada para usarla.

Los 20 workflows del pedido **existen igual**: son módulos con el mismo
nombre y la misma responsabilidad, en `src/lib/agente/`. La tabla de
equivalencia está en la sección 5.

---

## 3. Diagrama

```
                    CANALES DE ENTRADA
   ┌──────────┬──────────┬──────────┬──────────┬──────────┐
   │ Chat web │ Formu-   │ Email    │ Webhook  │ (futuro) │
   │ (widget) │ larios   │ entrante │ genérico │ WA / SMS │
   └────┬─────┴────┬─────┴────┬─────┴────┬─────┴────┬─────┘
        │          │          │          │          │
        └──────────┴────┬─────┴──────────┴──────────┘
                        ▼
              ┌───────────────────────┐
              │  NORMALIZAR           │  → formato interno común
              │  (normalizar.ts)      │    + idempotencyKey
              └──────────┬────────────┘
                         ▼
              ┌───────────────────────┐
              │  INTAKE               │  1. validar firma / payload
              │  (intake.ts)          │  2. resolver tenant
              │                       │  3. deduplicar
              │  ▸ GUARDA ANTES DE    │  4. contacto (buscar o crear)
              │    PROCESAR           │  5. conversación (hilo)
              └──────────┬────────────┘  6. GUARDAR MENSAJE  ← punto sin retorno
                         │
                         ▼
              ┌───────────────────────┐
              │  ORQUESTADOR          │
              │  (orquestador.ts)     │
              └──┬────────────────┬───┘
                 │                │
     ┌───────────▼──────┐   ┌─────▼──────────────┐
     │ CONOCIMIENTO     │   │ AGENTE (Claude)    │
     │ (conocimiento.ts)│──▶│ prompt.ts          │
     │ búsqueda léxica  │   │ esquema.ts (JSON)  │
     │ por tenant       │   │ guardas anti-      │
     └──────────────────┘   │ inyección          │
                            └─────┬──────────────┘
                                  │ salida estructurada validada
                                  ▼
              ┌────────────────────────────────────┐
              │  HERRAMIENTAS (herramientas.ts)    │
              │  16 tools · validan tenant ·       │
              │  idempotentes · auditadas          │
              └──┬───┬───┬───┬───┬───┬───┬─────────┘
                 │   │   │   │   │   │   │
        ┌────────┘   │   │   │   │   │   └────────┐
        ▼            ▼   ▼   ▼   ▼   ▼            ▼
   ┌─────────┐  ┌──────┐ ┌──────┐ ┌───────┐  ┌─────────┐
   │ Lead +  │  │Agenda│ │Email │ │Segui- │  │ Handoff │
   │ score   │  │      │ │outbox│ │mientos│  │ + notif │
   └─────────┘  └──────┘ └──────┘ └───────┘  └─────────┘
        │            │       │        │           │
        └────────────┴───┬───┴────────┴───────────┘
                         ▼
              ┌───────────────────────┐
              │  Postgres (Neon)      │  todo con tenantId
              │  16 tablas            │
              └──────────┬────────────┘
                         │
        ┌────────────────┼─────────────────┐
        ▼                ▼                 ▼
   ┌─────────┐   ┌──────────────┐   ┌─────────────┐
   │ Panel   │   │ CRON (Vercel)│   │ workflow_   │
   │ /ceo/   │   │ seguimientos │   │ events +    │
   │ agent   │   │ recuperación │   │ audit_logs  │
   │         │   │ salud        │   │ + DLQ       │
   └─────────┘   └──────────────┘   └─────────────┘
```

### Estados terminales de una consulta

Toda consulta termina en uno de estos siete estados, y el estado se persiste:

| Estado | Cómo se llega |
| --- | --- |
| `respondida` | El agente respondió con confianza suficiente |
| `calificada` | Se extrajo lead con score ≥ umbral |
| `agendada` | Se creó una cita real |
| `seguimiento` | Se programó un `FollowUp` |
| `handoff` | Derivada a una persona |
| `descartada` | Spam o irrelevante |
| `error` | Falló algo: queda en DLQ, se reintenta y alerta |

El cron de recuperación (`16 — Daily Lead Recovery`) busca mensajes entrantes
sin estado terminal pasado el SLA y los reprocesa o alerta.

---

## 4. Tablas

16 tablas, todas con `tenantId` salvo `Tenant`. Los índices arrancan siempre
por `tenantId` para que ninguna consulta pueda barrer datos de otro cliente.

| Tabla | Para qué |
| --- | --- |
| `Tenant` | El negocio. Marca, tono, horarios, modo de operación, umbrales. |
| `TenantIntegration` | Credenciales **cifradas** (AES-256-GCM) por integración. |
| `TenantMember` | Equipo, responsables de handoff, destinatarios de alertas. |
| `Contact` | Persona. Consentimiento y `doNotContact`. |
| `Conversation` | Hilo por canal. Intención, sentimiento, urgencia, IA on/off. |
| `Message` | Cada mensaje. `idempotencyKey` único por tenant. |
| `Lead` | Oportunidad. Score explicable, próxima acción, estado terminal. |
| `Appointment` | Cita. Disponibilidad real, sin dobles reservas. |
| `KnowledgeSource` | Fuente del conocimiento (web, FAQ, PDF, manual). |
| `KnowledgeChunk` | Fragmento indexado, con referencia a la fuente. |
| `FollowUp` | Paso de secuencia programado, con condiciones de corte. |
| `EmailOutbox` | Cola de salida con cabeceras de hilo y estado de entrega. |
| `Suppression` | Bajas y rebotes duros. Se respeta siempre. |
| `ApprovalRequest` | Acciones sensibles esperando aprobación humana. |
| `WorkflowEvent` | Traza + DLQ: correlationId, reintentos, error. |
| `AuditLog` | Quién hizo qué, sobre qué entidad. |

El esquema completo con tipos, índices y comentarios está en
`jota-agency/prisma/schema.prisma`.

**Aislamiento:** el helper `paraTenant()` de `src/lib/agente/tenant.ts` es la
única puerta a estas tablas desde el agente. Recibe el `tenantId` y devuelve
consultas ya filtradas; ninguna herramienta del agente construye un `where`
a mano.

---

## 5. Workflows

Los 20 workflows del pedido, implementados como módulos:

| # | Workflow | Módulo |
| --- | --- | --- |
| 01 | Tenant Configuration Loader | `tenant.ts` → `cargarTenant()` |
| 02 | Website Chat Intake | `api/agente/chat` → `normalizar.ts` + `intake.ts` |
| 03 | Website Form Intake | `api/agente/form` → mismo intake |
| 04 | Inbound Email Processor | `api/agente/email` → `email.ts` (hilos) |
| 05 | Conversation Orchestrator | `orquestador.ts` |
| 06 | Knowledge Retrieval | `conocimiento.ts` → `buscarConocimiento()` |
| 07 | Lead Extraction and Qualification | `puntaje.ts` + `orquestador.ts` |
| 08 | CRM Sync | `crm.ts` (interno + webhook saliente) |
| 09 | Calendar Availability | `agenda.ts` → `huecosDisponibles()` |
| 10 | Appointment Booking | `agenda.ts` → `crearCita/reprogramar/cancelar` |
| 11 | Outbound Email Sender | `email.ts` → `encolar()` + `despachar()` |
| 12 | Follow-Up Scheduler | `seguimientos.ts` |
| 13 | Human Handoff | `handoff.ts` |
| 14 | Internal Notifications | `notificaciones.ts` |
| 15 | Knowledge Base Sync | `conocimiento.ts` → `sincronizarFuente()` |
| 16 | Daily Lead Recovery | `recuperacion.ts` |
| 17 | Reporting and Analytics | `metricas.ts` |
| 18 | Error Handler + DLQ | `eventos.ts` |
| 19 | Health Check | `salud.ts` |
| 20 | Tenant Onboarding | `onboarding.ts` |

Cada uno es una función pura o casi pura, con sus tipos, y se puede probar
sin levantar un servidor.

---

## 6. Seguridad

| Riesgo | Mitigación implementada |
| --- | --- |
| Mezcla de datos entre clientes | `tenantId` obligatorio + `paraTenant()` + índices compuestos + prueba de aislamiento |
| Credenciales expuestas | AES-256-GCM con `APP_ENCRYPTION_KEY`, nunca en el frontend, nunca en el repo |
| Webhooks falsos | HMAC-SHA256 con secreto por tenant, comparación en tiempo constante |
| Spam / abuso del widget | Rate limit por tenant + por IP, honeypot, largo máximo |
| Prompt injection | El conocimiento entra al prompt **delimitado y etiquetado como datos**, con instrucción explícita de que nada dentro puede cambiar reglas; además se filtran patrones de instrucción antes de inyectar |
| Fuga de datos en logs | `redactar()` en `seguridad.ts`: emails, teléfonos y claves salen enmascarados |
| El modelo inventa datos | Salida estructurada validada; los campos del lead solo se aceptan si aparecen textualmente en la conversación (`verificarCitado()`) |
| El modelo confirma acciones no hechas | El texto al cliente se genera *antes* de ejecutar herramientas; si una herramienta falla, se reemplaza por el mensaje de fallback |
| Borrado de datos a pedido | `olvidarContacto()` en `privacidad.ts` |

**La clave pública del widget no es un secreto** y no permite leer nada: solo
crear mensajes entrantes en ese tenant. Todo lo que lee está detrás de sesión.

---

## 7. Costos estimados por cliente

Con Claude Sonnet 5 (entrada $3/1M, salida $15/1M) y una conversación
promedio de 6 mensajes:

| Concepto | Por conversación |
| --- | --- |
| Prompt de sistema + config + conocimiento | ~2.500 tokens de entrada |
| Historial acumulado (6 turnos) | ~3.000 tokens de entrada |
| Salida estructurada | ~600 tokens de salida |
| **Costo IA** | **~US$ 0,03** |

| Volumen mensual | Costo IA | Notas |
| --- | --- | --- |
| 100 conversaciones | ~US$ 3 | Negocio chico |
| 500 conversaciones | ~US$ 15 | Negocio mediano |
| 2.000 conversaciones | ~US$ 60 | Alto volumen |

Infraestructura compartida entre todos los clientes: Vercel Pro (US$ 20/mes),
Neon (gratis hasta ~0,5 GB, después US$ 19/mes), proveedor de email
transaccional (Resend: 3.000 emails/mes gratis, después US$ 20/mes).

Con precio de venta de tres cifras por cliente/mes, el margen bruto por
cliente está muy por encima del 90%. El costo real de escalar no es la IA:
es el tiempo de onboarding.

---

## 8. Limitaciones conocidas

Están listadas sin adornos en `LIMITACIONES.md`. Las tres más importantes:

1. **La búsqueda de conocimiento es léxica, no vectorial.** Anthropic no
   ofrece embeddings, y meter un proveedor extra solo para eso agregaba
   dependencia, costo y otro secreto que rotar. Funciona bien hasta ~500
   fragmentos por cliente; el camino de upgrade a pgvector está documentado.
2. **La disponibilidad es real pero local.** Sale de los horarios del negocio
   menos las citas ya creadas en nuestra base. Si el dueño se anota algo en
   su Google Calendar y no está acá, el agente no lo ve. La interfaz
   `ProveedorCalendario` está lista para Google Calendar.
3. **El rate limit es en memoria.** En serverless cada instancia tiene el
   suyo. Frena abuso repetido, no un ataque distribuido.
