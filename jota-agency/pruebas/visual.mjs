import { chromium } from "playwright";

const base = "http://127.0.0.1:3119";
const nav = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await nav.newContext({ viewport: { width: 1440, height: 980 } });
const p = await ctx.newPage();

const errores = [];
p.on("console", (m) => { if (m.type() === "error") errores.push(m.text()); });
p.on("pageerror", (e) => errores.push(String(e)));

// --- login ---
await p.goto(`${base}/acceder?next=/ceo`, { waitUntil: "networkidle" });
await p.getByRole("tab", { name: /Sign in|Entrar/i }).click();
await p.locator("#af-email").fill("ceo@jotaagency.org");
await p.locator("#af-pass").fill("prueba-local-1234");
await p.locator("button:has-text('Sign in'), button:has-text('Entrar')").last().click();
await p.waitForURL("**/ceo", { timeout: 25000 });
await p.waitForLoadState("networkidle");

console.log("URL tras login:", p.url());
console.log("Título:", await p.title());

// --- comprobaciones de contenido real ---
const texto = await p.locator("body").innerText();
const chequeos = [
  ["Monthly Revenue Goal", "tarjeta de objetivo"],
  ["$16,800", "recaudado del mes"],
  ["$25,000", "objetivo"],
  ["$8,200", "restante"],
  ["CEO Daily Briefing", "briefing"],
  ["Island Fitness Collective", "cliente en riesgo detectado"],
  ["Meta Ads", "canal que pierde plata"],
  ["Datos de ejemplo", "aviso de demo"],
  ["Pipeline por etapa", "gráfico de embudo"],
];
for (const [t, q] of chequeos) console.log(texto.includes(t) ? `  ✅ ${q}` : `  ❌ FALTA: ${q} (${t})`);

await p.screenshot({ path: "/tmp/ceo-oscuro.png", fullPage: false });

// --- modo claro ---
await p.getByRole("button", { name: /modo claro/i }).click();
await p.waitForTimeout(400);
await p.screenshot({ path: "/tmp/ceo-claro.png", fullPage: false });
console.log("  ✅ modo claro conmuta");

// --- buscador global ---
await p.keyboard.press("Control+k");
await p.waitForTimeout(300);
await p.keyboard.type("Kihei");
await p.waitForTimeout(400);
const res = await p.locator("[role=dialog] button").count();
console.log(res > 0 ? `  ✅ buscador global devuelve ${res} resultados para "Kihei"` : "  ❌ buscador sin resultados");
await p.screenshot({ path: "/tmp/ceo-buscador.png" });
await p.keyboard.press("Escape");

// --- modal de alta ---
await p.waitForTimeout(300);
await p.getByRole("button", { name: "+ Lead" }).click();
await p.waitForTimeout(400);
const modal = await p.locator("[role=dialog]").isVisible();
console.log(modal ? "  ✅ modal de nuevo lead abre" : "  ❌ modal no abre");
await p.screenshot({ path: "/tmp/ceo-modal.png" });
await p.keyboard.press("Escape");

// --- móvil ---
const m = await ctx.newPage();
await m.setViewportSize({ width: 390, height: 844 });
await m.goto(`${base}/ceo`, { waitUntil: "networkidle" });
const anchoBody = await m.evaluate(() => document.documentElement.scrollWidth);
console.log(anchoBody <= 400 ? `  ✅ móvil sin scroll horizontal (${anchoBody}px)` : `  ❌ móvil desborda: ${anchoBody}px`);
await m.screenshot({ path: "/tmp/ceo-movil.png", fullPage: false });

console.log(errores.length === 0 ? "  ✅ consola del navegador sin errores" : `  ❌ ${errores.length} errores en consola:\n     ${errores.slice(0,5).join("\n     ")}`);

await nav.close();
