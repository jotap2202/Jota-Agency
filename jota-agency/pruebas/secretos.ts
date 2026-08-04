/**
 * Chequeo estático: ningún secreto puede llegar al navegador.
 *
 *   npm run test:secretos
 *
 * No necesita base ni claves: lee el código fuente y falla si encuentra una
 * forma de filtrar una credencial. Corre en CI, así que la regla no depende de
 * que alguien se acuerde en una revisión.
 *
 * En Next, todo lo que empieza con NEXT_PUBLIC_ se INCRUSTA en el JavaScript
 * que se descarga el visitante. Un `NEXT_PUBLIC_ANTHROPIC_API_KEY` no es un
 * error de estilo: es la clave publicada en internet.
 *
 * Y hay una segunda forma, más silenciosa: leer `process.env.LO_QUE_SEA` desde
 * un componente marcado "use client". Ahí Next reemplaza la expresión en el
 * bundle del cliente, y la variable queda expuesta igual aunque no lleve el
 * prefijo.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

let fallos = 0;
let total = 0;
const ok = (c: boolean, m: string, detalle?: string) => {
  total++;
  console.log(c ? `  ✅ ${m}` : `  ❌ ${m}`);
  if (detalle) console.log(`       ${detalle}`);
  if (!c) fallos++;
};
const grupo = (t: string) => console.log(`\n${t}`);

/** Variables que jamás pueden salir del servidor. */
const SECRETOS = [
  "ANTHROPIC_API_KEY",
  "RESEND_API_KEY",
  "APP_ENCRYPTION_KEY",
  "CRON_SECRET",
  "AUTH_SECRET",
  "AUTH_GOOGLE_SECRET",
  "DATABASE_URL",
  "PANEL_SECRET",
  "PANEL_PASSWORD",
];

type Archivo = { ruta: string; texto: string; cliente: boolean };

function recorrer(dir: string, salida: Archivo[] = []): Archivo[] {
  for (const nombre of readdirSync(dir)) {
    if (nombre === "node_modules" || nombre === ".next" || nombre.startsWith(".")) continue;
    const ruta = path.join(dir, nombre);
    if (statSync(ruta).isDirectory()) {
      recorrer(ruta, salida);
    } else if (/\.(ts|tsx|js|jsx|mjs)$/.test(nombre)) {
      const texto = readFileSync(ruta, "utf8");
      salida.push({
        ruta: path.relative(process.cwd(), ruta),
        texto,
        // "use client" tiene que estar en las primeras líneas para contar.
        cliente: /^\s*(["'])use client\1/m.test(texto.slice(0, 400)),
      });
    }
  }
  return salida;
}

const archivos = recorrer(path.resolve(process.cwd(), "src"));
console.log(`\nRevisando ${archivos.length} archivos de src/`);

// ===========================================================================
grupo("1. Ningún secreto con prefijo NEXT_PUBLIC_");

for (const s of SECRETOS) {
  const malos = archivos.filter((a) => a.texto.includes(`NEXT_PUBLIC_${s}`));
  ok(malos.length === 0, `${s} nunca aparece como NEXT_PUBLIC_${s}`, malos.map((m) => m.ruta).join(", ") || undefined);
}

const cualquierPublic = archivos
  .flatMap((a) => (a.texto.match(/NEXT_PUBLIC_[A-Z_0-9]+/g) ?? []).map((v) => ({ v, ruta: a.ruta })));
ok(
  cualquierPublic.length === 0,
  "no se usa ninguna variable NEXT_PUBLIC_ en todo el proyecto",
  cualquierPublic.map((x) => `${x.v} en ${x.ruta}`).join(", ") || "(ninguna: nada del servidor se filtra por ahí)",
);

// ===========================================================================
grupo("2. Ningún componente de cliente lee process.env");

const clientes = archivos.filter((a) => a.cliente);
console.log(`  (${clientes.length} archivos con "use client")`);

// NODE_ENV es la única excepción, y no es una concesión: Next lo incrusta en
// TODOS los bundles del cliente siempre, sea que uno lo lea o no. No hay nada
// que filtrar. Cualquier otra variable sí queda expuesta al leerla acá.
const PUBLICAS_POR_DEFINICION = ["NODE_ENV"];

const filtraciones: string[] = [];
for (const a of clientes) {
  const usos = a.texto.match(/process\.env\.[A-Z_0-9]+/g) ?? [];
  for (const u of usos) {
    if (PUBLICAS_POR_DEFINICION.some((v) => u.endsWith(`.${v}`))) continue;
    filtraciones.push(`${u} en ${a.ruta}`);
  }
}
ok(filtraciones.length === 0, "ningún componente de cliente lee una variable que no sea pública", filtraciones.join(", ") || undefined);

// ===========================================================================
grupo("3. Los secretos solo se leen desde módulos de servidor");

for (const s of SECRETOS) {
  const lectores = archivos.filter((a) => a.texto.includes(`process.env.${s}`));
  const enCliente = lectores.filter((a) => a.cliente);
  ok(
    enCliente.length === 0,
    `${s} se lee solo del lado del servidor`,
    lectores.length > 0 ? `leído en: ${lectores.map((l) => l.ruta).join(", ")}` : "no se usa en src/",
  );
}

// ===========================================================================
grupo("4. Ninguna credencial escrita a mano en el código");

const PATRONES: [RegExp, string][] = [
  [/sk-ant-[A-Za-z0-9_-]{20,}/, "clave de Anthropic"],
  [/\bre_[A-Za-z0-9]{20,}/, "clave de Resend"],
  [/GOCSPX-[A-Za-z0-9_-]{10,}/, "secreto de Google OAuth"],
  [/AIza[A-Za-z0-9_-]{30,}/, "clave de Google API"],
  [/postgres(ql)?:\/\/[^\s"'`]+:[^\s"'`@]+@(?!host|localhost|usuario)/, "connection string con contraseña"],
];
for (const [re, nombre] of PATRONES) {
  const encontrados = archivos.filter((a) => re.test(a.texto));
  ok(encontrados.length === 0, `no hay ninguna ${nombre} hardcodeada`, encontrados.map((e) => e.ruta).join(", ") || undefined);
}

// ===========================================================================
grupo("5. El widget público no lleva secretos");

const widget = archivos.find((a) => a.ruta.includes("agente/widget"));
ok(widget !== undefined, "se encontró el código del widget");
if (widget) {
  const secretosEnWidget = SECRETOS.filter((s) => widget.texto.includes(s));
  ok(
    secretosEnWidget.length === 0,
    "el widget no menciona ninguna variable secreta",
    secretosEnWidget.join(", ") || undefined,
  );
  ok(
    widget.texto.includes("tenantPorClave("),
    "el widget resuelve el negocio por la clave PÚBLICA, que solo permite crear mensajes",
  );
  ok(
    !widget.texto.includes("secretoWebhook"),
    "y nunca por el secreto de webhook, que sí es una credencial",
  );
  // El objeto de configuración se serializa entero al navegador: cada campo
  // que se agregue ahí queda a la vista de cualquiera que abra el inspector.
  const cfg = widget.texto.match(/const cfg = \{([\s\S]*?)\n  \};/)?.[1] ?? "";
  const CAMPOS_PERMITIDOS = ["clave", "api", "agente", "negocio", "saludo", "color"];
  const campos = [...cfg.matchAll(/^\s{4}(\w+)\s*[,:]/gm)].map((m) => m[1]);
  const inesperados = campos.filter((c) => !CAMPOS_PERMITIDOS.includes(c));
  ok(
    campos.length > 0 && inesperados.length === 0,
    "la config que viaja al navegador solo tiene campos públicos",
    `campos: ${campos.join(", ")}${inesperados.length ? ` · INESPERADOS: ${inesperados.join(", ")}` : ""}`,
  );
}

// ===========================================================================
grupo("6. El panel nunca devuelve una credencial guardada");

const settings = archivos.find((a) => a.ruta.includes("ceo/agent/settings"));
ok(settings !== undefined, "se encontró la página de integraciones");
if (settings) {
  ok(
    !/value=\{[^}]*\.cifrado/.test(settings.texto),
    "el campo de credencial nunca se rellena con el valor guardado",
  );
  ok(
    settings.texto.includes('type="password"'),
    "la credencial se pide en un campo de tipo password",
  );
}

const acciones = archivos.find((a) => a.ruta.includes("ceo/agent/acciones"));
if (acciones) {
  ok(
    !acciones.texto.includes("descifrar("),
    "las server actions del panel nunca descifran una credencial para mostrarla",
  );
}

// ===========================================================================
console.log(`\n${fallos === 0 ? "✅" : "❌"} ${total - fallos}/${total} comprobaciones de secretos pasaron\n`);
process.exit(fallos === 0 ? 0 : 1);
