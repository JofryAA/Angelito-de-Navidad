/* Service worker del Angelito: funciona como app, abre sin internet y recibe notificaciones. */
const VERSION = 'angelito-2026.11.13-114418';
const SHELL = ['./', './index.html', './firebase-config.js', './css/app.css', './js/app.js', './js/juegos.js', './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png', './icons/favicon-64.png'];

const LIBS = ['app', 'auth', 'firestore'].map(n => `https://www.gstatic.com/firebasejs/10.12.2/firebase-${n}.js`);

self.addEventListener('install', e => {
  // 'reload' evita guardar una copia vieja del navegador; las librerías de Firebase se guardan también para abrir sin internet.
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: 'reload' })))
    .then(() => Promise.allSettled(LIBS.map(u => c.add(u))))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Firebase (datos en vivo) y el archivo de versión nunca se guardan en caché.
  if (/firestore\.googleapis|firebaseio|identitytoolkit|securetoken|firebaseinstallations|fcmregistrations|firebaseappcheck|recaptcha|google\.com$/.test(url.host)) return;
  if (url.pathname.endsWith('version.json')) return;
  // Página principal: primero internet (para tener siempre la última versión), si no hay, la copia guardada.
  if (req.mode === 'navigate' || (url.origin === location.origin && /\/(index\.html)?$/.test(url.pathname))) {
    e.respondWith(fetch(req).then(r => { if (r.ok) { const c = r.clone(); caches.open(VERSION).then(x => x.put('./index.html', c)); } return r; })
      .catch(() => caches.match('./index.html')));
    return;
  }
  // Código y estilos de la app: siempre lo más reciente; sin internet, la copia guardada.
  if (url.origin === location.origin && (/firebase-config\.js$/.test(url.pathname) || /\/(js|css)\/[^/]+\.(js|css)$/.test(url.pathname))) {
    e.respondWith(fetch(req).then(r => { if (r.ok) { const c = r.clone(); caches.open(VERSION).then(x => x.put(req, c)); } return r; }).catch(() => caches.match(req, { ignoreSearch: true }))); // app.js?v=… también vale sin internet
    return;
  }
  // Librerías, fuentes e íconos: la copia guardada y se actualiza por detrás.
  if (url.origin === location.origin || /gstatic\.com|fonts\.googleapis\.com/.test(url.host)) {
    e.respondWith(caches.open(VERSION).then(async c => {
      const hit = await c.match(req);
      const net = fetch(req).then(r => { if (r.ok || r.type === 'opaque') c.put(req, r.clone()); return r; }).catch(() => hit);
      return hit || net;
    }));
  }
});

// Notificaciones push enviadas desde la consola de Firebase (Messaging).
try {
  const cfg = JSON.parse(new URL(self.location).searchParams.get('cfg') || 'null');
  if (cfg && cfg.apiKey && cfg.messagingSenderId) {
    importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js', 'https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');
    firebase.initializeApp(cfg);
    const messaging = firebase.messaging();
    messaging.onBackgroundMessage(async p => {
      if (p.notification) return; // Firebase ya la muestra
      const d = p.data || {};
      // si la app está abierta y a la vista, ella misma avisa: no repetir
      const open = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      if (open.some(c => c.visibilityState === 'visible')) return;
      return self.registration.showNotification(d.title || 'Angelito 🎁', { body: d.body || '', icon: 'icons/icon-192.png', badge: 'icons/favicon-64.png', tag: 'angelito', renotify: true, data: { url: d.url || './' } });
    });
  }
} catch (e) { /* sin push */ }

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const target = (e.notification.data && e.notification.data.url) || './';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => {
    for (const c of cs) { if ('focus' in c) { c.navigate && c.navigate(target).catch(() => {}); return c.focus(); } }
    return self.clients.openWindow(target);
  }));
});
