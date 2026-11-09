/* Service worker de TRÍO: guarda el juego para jugar sin conexión.
   La caché lleva la versión en el nombre; al publicar otra versión, esta se
   instala, se activa sola y borra las anteriores. La página se pide primero a
   la red (con límite de tiempo), así nunca se queda atascada en una versión vieja. */
const VERSION = '3.1.0';
const CACHE = 'trio-' + VERSION;
const ASSETS = ["./", "./index.html", "./manifest.webmanifest", "./icons/apple-touch-icon.png", "./icons/favicon-32.png", "./icons/icon-any-192.png", "./icons/icon-any-512.png", "./icons/icon-maskable-192.png", "./icons/icon-maskable-512.png"];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('trio-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('message', e => { if (e.data === 'version' && e.ports[0]) e.ports[0].postMessage(VERSION); });
function fromCache(req) { return caches.open(CACHE).then(c => c.match(req, { ignoreSearch: true })); }
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    e.respondWith(new Promise(resolve => {
      let done = false;
      const fallback = () => fromCache('./index.html').then(r => { if (!done && r) { done = true; resolve(r); } });
      const timer = setTimeout(fallback, 4000);
      fetch(req, { cache: 'no-store' }).then(r => {
        clearTimeout(timer);
        if (r && r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put('./index.html', copy)); }
        if (!done) { done = true; resolve(r); }
      }).catch(() => { clearTimeout(timer); fromCache('./index.html').then(r => { if (!done) { done = true; resolve(r || Response.error()); } }); });
    }));
    return;
  }
  e.respondWith(fromCache(req).then(r => r || fetch(req).then(n => { if (n && n.ok && url.pathname.endsWith('.png')) { const cp = n.clone(); caches.open(CACHE).then(c => c.put(req, cp)); } return n; })));
});
