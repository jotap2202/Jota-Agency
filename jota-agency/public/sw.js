/**
 * Service worker de JOTA Command Center.
 *
 * DECISIÓN IMPORTANTE: no cachea nada de la aplicación. Ni páginas, ni datos.
 *
 * Este panel muestra leads, conversaciones y contactos de los clientes de
 * distintos negocios. Un service worker que guardara respuestas dejaría esos
 * datos en el disco del dispositivo y se los mostraría a quien abriera la app
 * después — incluso tras cerrar sesión, y aunque el lead ya no exista. En un
 * celular compartido o robado eso es una filtración, no un problema de UX.
 *
 * Así que va a la red siempre. Lo único que se guarda es una página de
 * cortesía para cuando no hay conexión, y los íconos.
 *
 * Alcanza para que el navegador ofrezca instalar la app: eso necesita
 * manifiesto, HTTPS y un service worker con un handler de fetch. No necesita
 * caché de datos.
 */

const VERSION = "jota-v1";
const OFFLINE = "/offline.html";
const PRECARGA = [OFFLINE, "/icono-192.png", "/icono-512.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(VERSION).then((c) => c.addAll(PRECARGA)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((claves) => Promise.all(claves.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;

  // Solo se toca la navegación entre páginas. Las llamadas a la API, los
  // POST y todo lo demás pasan de largo, sin que el service worker los vea.
  if (req.method !== "GET" || req.mode !== "navigate") return;

  e.respondWith(
    fetch(req).catch(async () => {
      // Sin conexión: la página de cortesía. Nunca una versión vieja del panel
      // con datos que ya no son ciertos.
      const c = await caches.open(VERSION);
      return (await c.match(OFFLINE)) ?? new Response("Sin conexión", { status: 503 });
    }),
  );
});
