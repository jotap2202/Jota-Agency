# Dar de alta un cliente nuevo

Sin tocar código. Todo desde el panel, en unos 20 minutos si el cliente ya te
pasó la información.

---

## Antes de sentarte a cargarlo

Pedile al cliente estas siete cosas. Sin ellas el agente no puede responder
nada útil, y va a derivar todo al equipo:

1. **Qué servicios ofrece**, uno por línea, como los nombra él.
2. **Dónde trabaja**: ciudades, barrios, radio.
3. **Horarios de atención**, día por día.
4. **Qué precios puede decir el agente.** Esto es lo más delicado — ver abajo.
5. **Preguntas frecuentes** con sus respuestas reales. Diez alcanzan.
6. **Políticas**: garantías, formas de pago, cancelaciones, y sobre todo **qué
   NO hace**.
7. **A quién avisarle** cuando entra un lead bueno: nombre y email.

Lo que no te dé, no lo inventes. El agente solo puede afirmar lo que está
cargado; todo lo demás lo deriva a una persona, que es el comportamiento
correcto.

---

## Paso 1 — Crear el negocio

`/ceo/agent/businesses` → formulario **Dar de alta un negocio**.

Campo por campo:

| Campo | Qué poner |
| --- | --- |
| Nombre del negocio | Como lo escribe él, con la marca exacta |
| Sitio web | Donde va a ir el widget |
| Zona horaria | La del negocio, no la tuya |
| Nombre del agente | Un nombre de persona funciona mejor que "Asistente" |
| Tono | *cercano* para oficios, *profesional* para servicios B2B |
| Qué hace el negocio | Dos o tres líneas |
| Servicios | Uno por línea |
| Área de servicio | Las ciudades separadas por coma |
| **Precios que PUEDE mencionar** | Ver abajo |
| Políticas | Incluí siempre qué NO hace |
| Preguntas frecuentes | Formato `Q:` / `A:` |
| Emails del equipo | Uno por línea |

Al guardar, el sistema crea el negocio, parte el conocimiento en fragmentos y
lo indexa. **Queda en estado `onboarding` y en modo supervisado**: todavía no
le contesta a nadie.

### Sobre los precios

Este campo decide si el agente miente o no.

- **Si lo dejás vacío**, el agente tiene prohibido decir cualquier precio. Va a
  decir que depende del caso y ofrecer pasar con el equipo. Es seguro.
- **Si cargás una lista**, puede decir exactamente eso y nada más.

Poné siempre una línea final del tipo: *"Never quote a price for a job that has
not been inspected."* Es lo que evita que el agente extrapole un número.

---

## Paso 2 — Horarios

`/ceo/agent/settings` → **Horarios de atención**.

Destildá los días que no atiende. De acá sale la disponibilidad real para
agendar y el conteo de "consultas fuera de horario", que es justamente el
número que le vas a mostrar al cliente el primer mes.

---

## Paso 3 — Conocimiento

`/ceo/agent/knowledge`.

El alta ya cargó servicios, precios, políticas y FAQ. Sumá lo que tenga:
texto de su web, lista de servicios detallada, casos, garantías.

Cada fuente se corta en fragmentos y se indexa al guardar. Si el cliente
después cambia algo, editás la fuente y **Guardar y reindexar**.

Regla práctica: si una pregunta que le hacen seguido no está acá, el agente la
va a derivar. Cargala.

---

## Paso 4 — Equipo y avisos

`/ceo/agent/settings` → **Equipo y avisos**.

Agregá a quien tenga que recibir los hot leads. **Sin nadie acá, una consulta
urgente de las 3am no le llega a ninguna persona** — el sistema no te deja
activar el negocio en ese estado.

---

## Paso 5 — Comportamiento

`/ceo/agent/settings` → **Comportamiento**.

- **Modo**: arrancá siempre en **supervisado**. Pasá a **autonomo** recién
  cuando el cliente haya leído unas cuantas respuestas reales y esté conforme.
- **Confianza mínima**: 0,6 está bien. Subilo si el cliente es exigente con lo
  que se dice en su nombre.
- **Score para avisar**: 70 por defecto. Bajalo si recibe poco volumen.
- **Acciones que requieren aprobación**: dejá `ofrecer_descuento` y
  `enviar_presupuesto` salvo que el cliente diga lo contrario, por escrito.

---

## Paso 6 — Integraciones (opcional)

`/ceo/agent/settings` → **Integraciones**.

- **Resend**: si el cliente quiere que los emails salgan desde su dominio.
  Sin esto usan el remitente de Jota Agency.
- **Slack**: pegá el Incoming Webhook. La URL *es* la credencial, se guarda
  cifrada.
- **CRM**: URL + secreto. Cada lead calificado se manda firmado con
  HMAC-SHA256. Acá es donde se engancha n8n si el cliente tiene un CRM raro.

Las credenciales se cifran con AES-256-GCM y **no se vuelven a mostrar nunca**.
Dejar el campo vacío al guardar conserva la anterior.

---

## Paso 7 — Probarlo antes de activarlo

Todavía está en `onboarding`, así que no responde. Probalo así:

1. Ponelo en `activo` desde **Businesses → Activar**.
2. Copiá la línea de instalación de Settings.
3. Pegala en cualquier HTML local y escribile al agente como si fueras un
   cliente.

Preguntale al menos esto:

- Algo que **sí** esté en la FAQ → tiene que contestarlo bien.
- Algo que **no** esté → tiene que decir que no quiere dar información
  inexacta y ofrecer pasar con el equipo. **Si lo inventa, falta cargar
  conocimiento o sobran precios.**
- Un **precio** → tiene que decir exactamente lo aprobado, o derivar.
- Un **descuento** → tiene que negarse y derivar.
- Algo que el negocio **no hace** → tiene que decir que no.

Mirá las respuestas en `/ceo/agent/inbox`. Si algo no te gusta, ajustá el
conocimiento o el tono y volvé a probar. No sigas hasta que las cinco estén
bien.

---

## Paso 8 — Instalarlo en el sitio del cliente

`/ceo/agent/settings` → **Instalar en el sitio del cliente**. Una línea antes
de `</body>`:

```html
<script src="https://jotaagency.org/api/agente/widget?clave=pk_xxxxx" async></script>
```

La clave pública **no es un secreto**: solo permite crear mensajes entrantes en
ese negocio, nunca leer nada. Todo lo que lee está detrás de sesión.

En WordPress va en el tema o con un plugin de "insertar código en el footer".
En Squarespace: Settings → Advanced → Code Injection → Footer. En Wix: Settings
→ Custom Code → Body end.

Si el cliente tiene formularios propios, pueden apuntar a
`/api/agente/form` con la misma clave.

---

## Paso 9 — La primera semana

- Miralo todos los días en `/ceo/agent/inbox`. Las primeras conversaciones
  reales muestran lo que falta en el conocimiento.
- `/ceo/agent/health` tiene que estar en verde.
- Cuando el cliente esté conforme, pasá el modo a **autonomo**.

Al mes, lo que le mostrás es: consultas recibidas, cuántas fuera de horario,
tiempo de primera respuesta, leads capturados y reuniones. Eso es lo que
justifica la factura.

---

## Errores que se pagan caro

**Activarlo sin probarlo.** El primer cliente que reciba una respuesta
inventada te hace perder la cuenta.

**Cargar precios "de referencia".** Si un número está en el campo de precios,
el agente lo va a decir como si fuera firme. Si no es firme, no lo cargues.

**No cargar qué NO hace el negocio.** Sin eso, ante "¿hacen X?" el agente no
tiene con qué negar y puede terminar diciendo que sí.

**Dejarlo sin nadie en el equipo.** El sistema lo bloquea al activar, pero si
después borrás al último, los avisos no le llegan a nadie.
