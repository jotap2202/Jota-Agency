import { tenantPorClave } from "@/lib/agente/tenant";
import { SITIO_URL } from "@/lib/sitio";

/**
 * El widget de chat, servido como JavaScript.
 *
 * El cliente pega UNA línea en su sitio:
 *   <script src="https://jotaagency.org/api/agente/widget?clave=pk_xxx" async></script>
 *
 * Va todo dentro de un Shadow DOM. Sin eso, el CSS del sitio del cliente
 * —que puede tener cualquier cosa, incluido un `* { box-sizing: content-box }`
 * de 2014— rompe el widget, y el widget rompe el sitio. Con Shadow DOM ninguno
 * de los dos se entera del otro.
 */

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const clave = new URL(req.url).searchParams.get("clave")?.trim() ?? "";
  const t = await tenantPorClave(clave);

  const cabeceras = {
    "Content-Type": "application/javascript; charset=utf-8",
    "Cache-Control": "public, max-age=300",
    "Access-Control-Allow-Origin": "*",
  };

  if (!t || t.estado !== "activo") {
    return new Response(
      `/* Agente no disponible para esta clave */\nconsole.warn("[jota] widget: clave inválida o agente inactivo");`,
      { headers: cabeceras },
    );
  }

  const cfg = {
    clave,
    api: `${SITIO_URL}/api/agente/chat`,
    agente: t.nombreAgente,
    negocio: t.nombreNegocio,
    saludo:
      t.presentacion?.trim() ||
      `Hi — I'm ${t.nombreAgente} from ${t.nombreNegocio}. How can I help?`,
    color: colorDe(t.ajustes),
  };

  return new Response(GUION.replace("__CFG__", JSON.stringify(cfg)), { headers: cabeceras });
}

function colorDe(ajustes: unknown): string {
  const a = (ajustes as Record<string, unknown> | null) ?? {};
  const c = typeof a.colorMarca === "string" ? a.colorMarca.trim() : "";
  // Solo se acepta un hex: el color entra a un `style`, y cualquier otra cosa
  // sería inyección de CSS en el sitio del cliente.
  return /^#[0-9a-fA-F]{3,8}$/.test(c) ? c : "#1c1917";
}

const GUION = String.raw`(function () {
  "use strict";
  var CFG = __CFG__;
  if (window.__jotaAgente) return;
  window.__jotaAgente = true;

  var LS = "jota_sesion_" + CFG.clave.slice(-8);
  var sesion = null;
  try { sesion = localStorage.getItem(LS); } catch (e) {}

  var host = document.createElement("div");
  host.setAttribute("data-jota-agente", "");
  document.body.appendChild(host);
  var raiz = host.attachShadow({ mode: "open" });

  var estilo = document.createElement("style");
  estilo.textContent = [
    ":host,*{box-sizing:border-box}",
    ".b{position:fixed;right:20px;bottom:20px;z-index:2147483000;width:56px;height:56px;border-radius:50%;border:none;cursor:pointer;",
    "background:" + CFG.color + ";color:#fff;font:600 22px/1 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;",
    "box-shadow:0 6px 24px rgba(0,0,0,.22);display:flex;align-items:center;justify-content:center}",
    ".b:focus-visible{outline:3px solid #60a5fa;outline-offset:2px}",
    ".p{position:fixed;right:20px;bottom:88px;z-index:2147483000;width:360px;max-width:calc(100vw - 32px);height:520px;max-height:calc(100vh - 120px);",
    "background:#fff;border:1px solid #e7e5e4;border-radius:16px;box-shadow:0 18px 50px rgba(0,0,0,.2);display:none;flex-direction:column;overflow:hidden;",
    "font:400 14px/1.55 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1c1917}",
    ".p.on{display:flex}",
    ".h{padding:14px 16px;border-bottom:1px solid #f0efee;display:flex;align-items:center;gap:10px}",
    ".h b{font-size:14px}.h span{font-size:12px;color:#78716c;display:block}",
    ".x{margin-left:auto;background:none;border:none;font-size:20px;cursor:pointer;color:#78716c;line-height:1;padding:4px}",
    ".m{flex:1;overflow-y:auto;padding:14px 16px;display:flex;flex-direction:column;gap:10px}",
    ".u,.a{max-width:85%;padding:9px 12px;border-radius:14px;white-space:pre-wrap;word-wrap:break-word}",
    ".u{align-self:flex-end;background:" + CFG.color + ";color:#fff;border-bottom-right-radius:4px}",
    ".a{align-self:flex-start;background:#f5f5f4;border-bottom-left-radius:4px}",
    ".t{align-self:flex-start;color:#a8a29e;font-size:13px;padding:4px 2px}",
    ".f{border-top:1px solid #f0efee;padding:10px;display:flex;gap:8px}",
    ".f textarea{flex:1;resize:none;border:1px solid #e7e5e4;border-radius:10px;padding:9px 11px;font:inherit;max-height:90px;color:#1c1917;background:#fff}",
    ".f textarea:focus{outline:none;border-color:" + CFG.color + "}",
    ".f button{border:none;background:" + CFG.color + ";color:#fff;border-radius:10px;padding:0 15px;cursor:pointer;font:600 13px/1 inherit}",
    ".f button:disabled{opacity:.45;cursor:default}",
    ".pie{padding:0 16px 9px;font-size:11px;color:#a8a29e}",
    "@media (max-width:420px){.p{right:12px;left:12px;width:auto;bottom:80px}}"
  ].join("");
  raiz.appendChild(estilo);

  var boton = document.createElement("button");
  boton.className = "b";
  boton.type = "button";
  boton.setAttribute("aria-label", "Chat with " + CFG.agente);
  boton.textContent = "✉";

  var panel = document.createElement("div");
  panel.className = "p";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", "Chat with " + CFG.agente);
  panel.innerHTML =
    '<div class="h"><div><b></b><span></span></div><button class="x" type="button" aria-label="Close">×</button></div>' +
    '<div class="m" aria-live="polite"></div>' +
    '<div class="pie">You’re chatting with an AI assistant.</div>' +
    '<div class="f"><textarea rows="1" aria-label="Your message" placeholder="Write your message…"></textarea><button type="button">Send</button></div>';

  raiz.appendChild(boton);
  raiz.appendChild(panel);

  panel.querySelector(".h b").textContent = CFG.agente;
  panel.querySelector(".h span").textContent = CFG.negocio;

  var lista = panel.querySelector(".m");
  var caja = panel.querySelector("textarea");
  var enviar = panel.querySelector(".f button");
  var abierto = false;
  var enviando = false;

  function burbuja(texto, clase) {
    var d = document.createElement("div");
    d.className = clase;
    d.textContent = texto;
    lista.appendChild(d);
    lista.scrollTop = lista.scrollHeight;
    return d;
  }

  function abrir() {
    abierto = !abierto;
    panel.classList.toggle("on", abierto);
    if (abierto) {
      if (!lista.children.length) burbuja(CFG.saludo, "a");
      caja.focus();
    }
  }

  boton.addEventListener("click", abrir);
  panel.querySelector(".x").addEventListener("click", abrir);
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && abierto) abrir();
  });

  function mandar() {
    var texto = caja.value.trim();
    if (!texto || enviando) return;
    enviando = true;
    enviar.disabled = true;
    caja.value = "";
    burbuja(texto, "u");
    var esperando = burbuja(CFG.agente + " is typing…", "t");

    fetch(CFG.api, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clave: CFG.clave, sesion: sesion, mensaje: texto, url: location.href, referrer: document.referrer })
    })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        esperando.remove();
        if (d && d.sesion) {
          sesion = d.sesion;
          try { localStorage.setItem(LS, sesion); } catch (e) {}
        }
        if (d && d.respuesta) burbuja(d.respuesta, "a");
        else if (d && d.esperaAprobacion) burbuja("Got it — someone from the team is reviewing this and will reply shortly.", "a");
        else burbuja(d && d.error ? d.error : "Thanks — the team will get back to you shortly.", "a");
      })
      .catch(function () {
        esperando.remove();
        burbuja("I couldn’t send that. Please try again in a moment.", "a");
      })
      .then(function () {
        enviando = false;
        enviar.disabled = false;
        caja.focus();
      });
  }

  enviar.addEventListener("click", mandar);
  caja.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); mandar(); }
  });
})();
`;
