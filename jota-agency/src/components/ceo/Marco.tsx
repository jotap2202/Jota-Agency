"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { SECCIONES, type ItemBusqueda } from "./navegacion";
import { CommandMenu } from "./CommandMenu";
import { ModalesRapidos } from "./ModalesRapidos";
import { PanelNotificaciones, type NotificacionUI } from "./PanelNotificaciones";
import { usePreferencia } from "./usePreferencia";

const TEMAS = ["oscuro", "claro"] as const;
const LADOS = ["ancho", "min"] as const;

export function Marco({
  children,
  email,
  notificaciones,
  indice,
  hayDemo,
}: {
  children: React.ReactNode;
  email: string;
  notificaciones: NotificacionUI[];
  indice: ItemBusqueda[];
  hayDemo: boolean;
}) {
  const ruta = usePathname();
  const [tema, setTema] = usePreferencia("tema", "ceo-tema", TEMAS, "oscuro");
  const [lado, setLado] = usePreferencia("side", "ceo-side", LADOS, "ancho");
  const [abiertoMovil, setAbiertoMovil] = useState(false);
  const [menu, setMenu] = useState(false);
  const [modal, setModal] = useState<"lead" | "ingreso" | null>(null);

  const minimizado = lado === "min";

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setMenu((v) => !v);
      }
      if (e.key === "Escape") { setMenu(false); setModal(null); setAbiertoMovil(false); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const sinLeer = notificaciones.filter((n) => !n.leida).length;

  return (
    <div className="ceo-shell">
      {abiertoMovil && (
        <div className="ceo-tapa ceo-solo-movil" onClick={() => setAbiertoMovil(false)} aria-hidden />
      )}

      <aside className="ceo-side" data-min={minimizado ? "1" : "0"} data-abierto={abiertoMovil ? "1" : "0"}>
        <div className="ceo-side-top">
          <span className="ceo-logo" aria-hidden>J</span>
          {!minimizado && (
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: "-0.01em" }}>JOTA</div>
              <div style={{ fontSize: 10, color: "var(--c-dim)", letterSpacing: "0.06em" }}>COMMAND CENTER</div>
            </div>
          )}
        </div>

        <nav className="ceo-nav" aria-label="Secciones">
          {SECCIONES.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              // Cerrar el cajón al navegar se hace acá, en el evento, y no en
              // un efecto sobre la ruta: es el mismo resultado sin un render
              // extra en cada navegación.
              onClick={() => setAbiertoMovil(false)}
              aria-current={ruta === s.href ? "page" : undefined}
              title={minimizado ? s.nombre : undefined}
            >
              <span className="ico" aria-hidden>{s.ico}</span>
              {!minimizado && <span>{s.nombre}</span>}
            </Link>
          ))}
        </nav>

        <div style={{ padding: 10, borderTop: "1px solid var(--c-line-soft)" }}>
          <button
            className="ceo-btn"
            style={{ width: "100%", justifyContent: "center" }}
            onClick={() => setLado(minimizado ? "ancho" : "min")}
            aria-label={minimizado ? "Expandir barra lateral" : "Minimizar barra lateral"}
          >
            {minimizado ? "»" : "« Minimizar"}
          </button>
        </div>
      </aside>

      <div className="ceo-main">
        <header className="ceo-top">
          <button
            className="ceo-btn ceo-btn-icon ceo-solo-movil"
            onClick={() => setAbiertoMovil((v) => !v)}
            aria-label="Abrir menú"
          >
            ☰
          </button>

          <button
            className="ceo-btn ceo-buscar"
            onClick={() => setMenu(true)}
            style={{ flex: 1, maxWidth: 340, justifyContent: "space-between", color: "var(--c-dim)", fontWeight: 400 }}
          >
            <span>Buscar leads, clientes, campañas…</span>
            <kbd style={{ fontSize: 10, fontFamily: "var(--font-mono), monospace", opacity: 0.75 }}>⌘K</kbd>
          </button>

          <div className="ceo-espaciador" style={{ flex: 1 }} />

          <button className="ceo-btn" onClick={() => setModal("lead")} aria-label="Agregar lead">
            +<span className="ceo-accion-texto"> Lead</span>
          </button>
          <button className="ceo-btn ceo-btn-gold" onClick={() => setModal("ingreso")} aria-label="Registrar ingreso">
            +<span className="ceo-accion-texto"> Ingreso</span>
          </button>

          <PanelNotificaciones notificaciones={notificaciones} sinLeer={sinLeer} />

          <button
            className="ceo-btn ceo-btn-icon"
            onClick={() => setTema(tema === "oscuro" ? "claro" : "oscuro")}
            aria-label={tema === "oscuro" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
            title={tema === "oscuro" ? "Modo claro" : "Modo oscuro"}
          >
            {tema === "oscuro" ? "☀" : "☾"}
          </button>

          <span
            className="ceo-logo"
            title={email}
            style={{ fontSize: 12, height: 30, width: 30 }}
            aria-label={`Sesión de ${email}`}
          >
            {email.slice(0, 1).toUpperCase()}
          </span>
        </header>

        <main className="ceo-body">
          {hayDemo && (
            <div className="ceo-demo" role="status">
              <strong>Datos de ejemplo.</strong>
              <span style={{ color: "var(--c-text-2)" }}>
                Estás viendo empresas ficticias para probar el tablero.
              </span>
              <Link href="/ceo/settings" style={{ marginLeft: "auto", textDecoration: "underline" }}>
                Administrar →
              </Link>
            </div>
          )}
          {children}
        </main>
      </div>

      {menu && <CommandMenu indice={indice} cerrar={() => setMenu(false)} />}
      {modal && <ModalesRapidos tipo={modal} cerrar={() => setModal(null)} />}
    </div>
  );
}
