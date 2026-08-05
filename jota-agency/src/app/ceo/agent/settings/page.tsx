import { prisma } from "@/lib/prisma";
import { SITIO_URL } from "@/lib/sitio";
import { horariosDe } from "@/lib/agente/tenant";
import { hayClaveMaestra } from "@/lib/agente/cripto";
import { MODELO } from "@/lib/agente/agente";
import { Cabecera, SinNegocios, resolverTenant, type Params } from "../comun";
import {
  accionGuardarConfig, accionHorarios, accionGuardarMiembro, accionBorrarMiembro,
  accionGuardarIntegracion, accionBorrarIntegracion, accionRotarClaves,
} from "../acciones";

export const dynamic = "force-dynamic";
export const metadata = { title: "Agent Settings — JOTA CEO", robots: { index: false, follow: false } };

const DIAS: [string, string][] = [
  ["mon", "Lunes"], ["tue", "Martes"], ["wed", "Miércoles"], ["thu", "Jueves"],
  ["fri", "Viernes"], ["sat", "Sábado"], ["sun", "Domingo"],
];

const INTEGRACIONES: { tipo: string; nombre: string; ayuda: string; pideUrl?: boolean; pideSecreto: boolean }[] = [
  { tipo: "email_resend", nombre: "Email saliente (Resend)", ayuda: "API key de resend.com. Sin esto, los emails quedan como simulados.", pideSecreto: true },
  { tipo: "slack", nombre: "Slack", ayuda: "Incoming Webhook URL. Se guarda cifrada porque la URL es la credencial.", pideSecreto: true },
  { tipo: "crm_webhook", nombre: "CRM externo", ayuda: "URL que recibe los leads + secreto para firmar (HMAC-SHA256). Acá se engancha n8n.", pideUrl: true, pideSecreto: true },
  { tipo: "google_calendar", nombre: "Google Calendar", ayuda: "Todavía no implementado: la disponibilidad sale de los horarios y las citas de esta base.", pideSecreto: true },
];

export default async function Pagina({ searchParams }: { searchParams: Promise<Params> }) {
  const sp = await searchParams;
  const { t, todos } = await resolverTenant(sp);
  if (!t) return <div className="ceo-anim"><SinNegocios /></div>;

  const [equipo, integraciones] = await Promise.all([
    prisma.tenantMember.findMany({ where: { tenantId: t.id }, orderBy: { createdAt: "asc" } }),
    prisma.tenantIntegration.findMany({ where: { tenantId: t.id } }),
  ]);
  const horarios = horariosDe(t);
  const conectada = (tipo: string) => integraciones.find((i) => i.tipo === tipo);

  const embed = `<script src="${SITIO_URL}/api/agente/widget?clave=${t.clavePublica}" async></script>`;
  const webhookEmail = `${SITIO_URL}/api/agente/email?tenant=${t.slug}`;

  return (
    <div className="ceo-anim">
      <Cabecera
        titulo="Configuración del agente"
        descripcion="Lo que el agente puede decir, cómo lo dice y cuándo pide permiso."
        tenant={t}
        todos={todos}
        activo="/ceo/agent/settings"
      />

      {/* ---- Instalación ---- */}
      <div className="ceo-card" style={{ marginBottom: 16 }}>
        <div className="ceo-label" style={{ marginBottom: 8 }}>Instalar en el sitio del cliente</div>
        <p className="ceo-sub" style={{ margin: "0 0 10px", fontSize: 12.5 }}>
          Una sola línea antes de <code>&lt;/body&gt;</code>. La clave pública no es un secreto:
          solo permite crear mensajes en este negocio, nunca leer nada.
        </p>
        <pre style={caja}>{embed}</pre>

        <div className="ceo-label" style={{ margin: "14px 0 6px" }}>Webhook de email entrante</div>
        <pre style={caja}>{webhookEmail}</pre>
        <p className="ceo-sub" style={{ margin: "6px 0 0", fontSize: 12 }}>
          Va firmado con HMAC-SHA256 en la cabecera <code>X-Jota-Signature</code>, usando el secreto
          del negocio. El secreto no se muestra acá: se ve una sola vez al rotarlo, y vive en la
          configuración del proveedor de email.
        </p>
        <form action={accionRotarClaves} style={{ marginTop: 10 }}>
          <input type="hidden" name="tenantId" value={t.id} />
          <button className="ceo-btn" type="submit">Rotar clave pública y secreto</button>
        </form>
      </div>

      {/* ---- Configuración principal ---- */}
      <form action={accionGuardarConfig}>
        <input type="hidden" name="tenantId" value={t.id} />

        <div className="ceo-card" style={{ marginBottom: 16 }}>
          <div className="ceo-label" style={{ marginBottom: 12 }}>Identidad</div>
          <Grid>
            <Campo label="Nombre del agente" name="nombreAgente" def={t.nombreAgente} />
            <Select label="Tono" name="tono" def={t.tono} opciones={["profesional", "cercano", "formal", "directo"]} />
            <Select label="Largo de respuesta" name="largoRespuesta" def={t.largoRespuesta} opciones={["corta", "media", "larga"]} />
            <Select label="Idioma por defecto" name="idioma" def={t.idioma} opciones={["en", "es"]} />
            <Campo label="Zona horaria" name="zonaHoraria" def={t.zonaHoraria} />
            <Campo label="Sitio web" name="sitioWeb" def={t.sitioWeb ?? ""} />
          </Grid>
          <Check label="Puede usar emojis" name="usaEmojis" def={t.usaEmojis} />
          <Area label="Cómo se presenta" name="presentacion" def={t.presentacion ?? ""} rows={2} />
          <Area label="Firma de los emails" name="firmaEmail" def={t.firmaEmail ?? ""} rows={3} />
          <Area label="Descripción del negocio" name="descripcion" def={t.descripcion ?? ""} rows={3} />
        </div>

        <div className="ceo-card" style={{ marginBottom: 16 }}>
          <div className="ceo-label" style={{ marginBottom: 6 }}>Información comercial aprobada</div>
          <p className="ceo-sub" style={{ margin: "0 0 12px", fontSize: 12.5 }}>
            Esto es lo único que el agente puede afirmar. <strong>Si dejás Precios vacío, el agente
            no habla de precios</strong> — dice que depende del caso y ofrece pasar con el equipo.
          </p>
          <Area label="Servicios (uno por línea)" name="servicios" def={t.servicios} rows={6} />
          <Campo label="Área de servicio" name="areaServicio" def={t.areaServicio ?? ""} />
          <Area label="Precios que puede mencionar" name="reglasPrecio" def={t.reglasPrecio} rows={5} />
          <Area label="Políticas" name="politicas" def={t.politicas} rows={4} />
          <Area label="Temas prohibidos (uno por línea)" name="prohibido" def={t.prohibido} rows={3} />
        </div>

        <div className="ceo-card" style={{ marginBottom: 16 }}>
          <div className="ceo-label" style={{ marginBottom: 12 }}>Comportamiento</div>
          <Grid>
            <Select
              label="Modo de operación" name="modo" def={t.modo}
              opciones={["draft", "supervisado", "autonomo"]}
            />
            <Campo label="Confianza mínima (0 a 1)" name="confianzaMinima" def={String(t.confianzaMinima)} />
            <Campo label="Score para avisar al equipo" name="umbralAviso" def={String(t.umbralAviso)} />
            <Campo label="SLA de respuesta (minutos)" name="slaRespuestaMin" def={String(t.slaRespuestaMin)} />
            <Campo label="Seguimientos (horas, separadas por coma)" name="secuenciaHoras" def={t.secuenciaHoras.join(", ")} />
          </Grid>
          <p className="ceo-sub" style={{ margin: "4px 0 12px", fontSize: 12.5 }}>
            <strong>draft</strong>: la IA redacta y una persona aprueba todo. <strong>supervisado</strong>:
            responde lo simple y pide permiso para lo sensible. <strong>autonomo</strong>: responde y
            ejecuta lo autorizado. En cualquiera de los tres, lo que está en “Acciones que requieren
            aprobación” siempre pasa por una persona.
          </p>
          <Area label="Canales habilitados (uno por línea)" name="canales" def={t.canales} rows={3} />
          <Area label="Acciones que requieren aprobación" name="requiereAprobacion" def={t.requiereAprobacion} rows={4} />
          <Area label="Reglas extra de derivación a humano" name="reglasHandoff" def={t.reglasHandoff} rows={3} />
        </div>

        <button className="ceo-btn ceo-btn-gold" type="submit" style={{ marginBottom: 22 }}>
          Guardar configuración
        </button>
      </form>

      {/* ---- Horarios ---- */}
      <div className="ceo-card" style={{ marginBottom: 16 }}>
        <div className="ceo-label" style={{ marginBottom: 6 }}>Horarios de atención ({t.zonaHoraria})</div>
        <p className="ceo-sub" style={{ margin: "0 0 12px", fontSize: 12.5 }}>
          De acá sale la disponibilidad real para agendar, y también qué consultas cuentan como
          “fuera de horario” en las métricas.
        </p>
        <form action={accionHorarios}>
          <input type="hidden" name="tenantId" value={t.id} />
          {DIAS.map(([clave, nombre]) => {
            const tramo = horarios[clave]?.[0];
            return (
              <div key={clave} style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 6 }}>
                <label style={{ width: 130, fontSize: 13, display: "flex", gap: 7, alignItems: "center" }}>
                  <input type="checkbox" name={`${clave}_activo`} defaultChecked={Boolean(tramo)} />
                  {nombre}
                </label>
                <input type="time" name={`${clave}_desde`} defaultValue={tramo?.[0] ?? "09:00"} className="ceo-input" aria-label={`${nombre} desde`} style={{ width: 120 }} />
                <span style={{ color: "var(--c-dim)" }}>a</span>
                <input type="time" name={`${clave}_hasta`} defaultValue={tramo?.[1] ?? "17:00"} className="ceo-input" aria-label={`${nombre} hasta`} style={{ width: 120 }} />
              </div>
            );
          })}
          <button className="ceo-btn" type="submit" style={{ marginTop: 8 }}>Guardar horarios</button>
        </form>
      </div>

      {/* ---- Equipo ---- */}
      <div className="ceo-card" style={{ marginBottom: 16 }}>
        <div className="ceo-label" style={{ marginBottom: 6 }}>Equipo y avisos</div>
        <p className="ceo-sub" style={{ margin: "0 0 12px", fontSize: 12.5 }}>
          A esta gente le llegan los hot leads, las reuniones y los handoff. Sin nadie acá, una
          consulta urgente de las 3am no le llega a ninguna persona.
        </p>
        {equipo.length > 0 && (
          <table className="ceo-tabla" style={{ marginBottom: 12 }}>
            <thead><tr><th>Nombre</th><th>Email</th><th>Rol</th><th>Avisos</th><th></th></tr></thead>
            <tbody>
              {equipo.map((m) => (
                <tr key={m.id}>
                  <td>{m.nombre}</td>
                  <td>{m.email}</td>
                  <td>{m.rol}</td>
                  <td>{m.recibeAvisos ? "sí" : "no"}</td>
                  <td>
                    <form action={accionBorrarMiembro}>
                      <input type="hidden" name="tenantId" value={t.id} />
                      <input type="hidden" name="miembroId" value={m.id} />
                      <button className="ceo-btn" type="submit" style={{ fontSize: 12, padding: "4px 8px" }}>Quitar</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <form action={accionGuardarMiembro} style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <input type="hidden" name="tenantId" value={t.id} />
          <input name="nombre" className="ceo-input" placeholder="Nombre" aria-label="Nombre" style={{ flex: "1 1 140px" }} />
          <input name="email" type="email" required className="ceo-input" placeholder="email@negocio.com" aria-label="Email" style={{ flex: "1 1 200px" }} />
          <select name="rol" className="ceo-input" aria-label="Rol">
            <option value="owner">owner</option>
            <option value="sales">sales</option>
            <option value="support">support</option>
          </select>
          <button className="ceo-btn" type="submit">Agregar</button>
        </form>
      </div>

      {/* ---- Integraciones ---- */}
      <div className="ceo-card" style={{ marginBottom: 16 }}>
        <div className="ceo-label" style={{ marginBottom: 6 }}>Integraciones</div>
        <p className="ceo-sub" style={{ margin: "0 0 12px", fontSize: 12.5 }}>
          Las credenciales se guardan cifradas con AES-256-GCM y nunca se vuelven a mostrar.
          Dejar el campo vacío al guardar conserva la credencial anterior.
          {!hayClaveMaestra() && (
            <strong style={{ color: "var(--c-red)" }}> Falta APP_ENCRYPTION_KEY: no se pueden guardar credenciales.</strong>
          )}
        </p>
        {INTEGRACIONES.map((i) => {
          const c = conectada(i.tipo);
          return (
            <div key={i.tipo} style={{ borderTop: "1px solid var(--c-line-soft)", padding: "12px 0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", marginBottom: 6 }}>
                <strong style={{ fontSize: 13.5 }}>{i.nombre}</strong>
                <span className={`ceo-chip ${c?.estado === "activo" ? "ceo-chip-green" : "ceo-chip-gris"}`}>
                  {c?.estado ?? "sin configurar"}
                </span>
              </div>
              <p className="ceo-sub" style={{ margin: "0 0 8px", fontSize: 12 }}>{i.ayuda}</p>
              <form action={accionGuardarIntegracion} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <input type="hidden" name="tenantId" value={t.id} />
                <input type="hidden" name="tipo" value={i.tipo} />
                {i.pideUrl && (
                  <input
                    name="url" className="ceo-input" placeholder="https://…"
                    defaultValue={((c?.config as Record<string, string> | null)?.url) ?? ""}
                    aria-label={`URL de ${i.nombre}`} style={{ flex: "1 1 240px" }}
                  />
                )}
                {i.pideSecreto && (
                  <input
                    name="secreto" type="password" className="ceo-input" autoComplete="off"
                    placeholder={c?.cifrado ? "•••••• (guardada)" : "Pegá la credencial"}
                    aria-label={`Credencial de ${i.nombre}`} style={{ flex: "1 1 240px" }}
                  />
                )}
                <button className="ceo-btn" type="submit">Guardar</button>
                {c && (
                  <button className="ceo-btn" type="submit" formAction={accionBorrarIntegracion}>Quitar</button>
                )}
              </form>
            </div>
          );
        })}
      </div>

      <p className="ceo-sub" style={{ fontSize: 12 }}>
        Modelo en uso: <code>{MODELO}</code> (variable <code>AGENTE_MODELO</code>).
      </p>
    </div>
  );
}

const caja: React.CSSProperties = {
  background: "var(--c-surface-2)", border: "1px solid var(--c-line)", borderRadius: 8,
  padding: "10px 12px", fontSize: 12.5, overflowX: "auto", margin: 0,
  fontFamily: "var(--font-mono, ui-monospace, monospace)",
};

function Grid({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", marginBottom: 12 }}>
      {children}
    </div>
  );
}

function Campo({ label, name, def }: { label: string; name: string; def: string }) {
  return (
    <label style={{ display: "block", fontSize: 12.5 }}>
      <span style={{ color: "var(--c-dim)", display: "block", marginBottom: 4 }}>{label}</span>
      <input name={name} defaultValue={def} className="ceo-input" style={{ width: "100%" }} />
    </label>
  );
}

function Area({ label, name, def, rows }: { label: string; name: string; def: string; rows: number }) {
  return (
    <label style={{ display: "block", fontSize: 12.5, marginBottom: 12 }}>
      <span style={{ color: "var(--c-dim)", display: "block", marginBottom: 4 }}>{label}</span>
      <textarea name={name} defaultValue={def} rows={rows} className="ceo-input" style={{ width: "100%", fontSize: 13 }} />
    </label>
  );
}

function Select({ label, name, def, opciones }: { label: string; name: string; def: string; opciones: string[] }) {
  return (
    <label style={{ display: "block", fontSize: 12.5 }}>
      <span style={{ color: "var(--c-dim)", display: "block", marginBottom: 4 }}>{label}</span>
      <select name={name} defaultValue={def} className="ceo-input" style={{ width: "100%" }}>
        {opciones.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}

function Check({ label, name, def }: { label: string; name: string; def: boolean }) {
  return (
    <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, marginBottom: 12 }}>
      <input type="checkbox" name={name} defaultChecked={def} />
      {label}
    </label>
  );
}
