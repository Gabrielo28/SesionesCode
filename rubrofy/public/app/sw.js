// Service worker de Rubrofy: permite instalar el panel como app, muestra
// una página sin conexión y recibe las notificaciones push. No guarda en
// caché datos del negocio (la API siempre va a la red).
const VERSION = 'rubrofy-v1';
const OFFLINE = '/app/offline.html';

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((c) => c.addAll([OFFLINE, '/app/icon-192.png'])).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys()
    .then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Solo las navegaciones: si no hay red, la página sin conexión.
self.addEventListener('fetch', (event) => {
  if (event.request.mode !== 'navigate') return;
  event.respondWith(fetch(event.request).catch(() => caches.match(OFFLINE)));
});

self.addEventListener('push', (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch (err) { d = { cuerpo: event.data && event.data.text() }; }
  event.waitUntil(self.registration.showNotification(d.titulo || 'Rubrofy', {
    body: d.cuerpo || '',
    icon: '/app/icon-192.png',
    badge: '/app/favicon-32.png',
    tag: d.tag || undefined,
    data: { url: d.url || '/app' },
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || '/app', self.location.origin).href;
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((ventanas) => {
    for (const v of ventanas) {
      if (v.url.startsWith(self.location.origin + '/app')) {
        v.focus();
        return v.navigate ? v.navigate(url) : null;
      }
    }
    return self.clients.openWindow(url);
  }));
});
