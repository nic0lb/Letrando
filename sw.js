/* Service Worker — offline após o primeiro acesso.
   Ao alterar qualquer arquivo do app, aumente CACHE_VERSION para forçar atualização. */
const CACHE_VERSION = 'termo-v1';
const APP_SHELL = [
  './', 'index.html', 'styles.css', 'app.js', 'words.js', 'multiplayer.js',
  'manifest.json', 'icons/icon-192.png', 'icons/icon-512.png'
];

// Instalação: pré-carrega o "casco" do app
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_VERSION).then(c => c.addAll(APP_SHELL)));
  self.skipWaiting();
});

// Ativação: apaga caches antigos
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k)))));
  self.clients.claim();
});

// Fetch: stale-while-revalidate (responde do cache e atualiza em segundo plano)
self.addEventListener('fetch', e => {
  const { request } = e;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  const cacheable = url.origin === location.origin || url.hostname === 'www.gstatic.com';
  if (!cacheable) return; // Firebase Realtime DB (websocket) passa direto

  e.respondWith(caches.open(CACHE_VERSION).then(async cache => {
    // ignoreSearch: '?sala=A3K9' usa o mesmo index.html em cache
    const cached = await cache.match(request, { ignoreSearch: true });
    const network = fetch(request).then(res => {
      if (res.ok) cache.put(request, res.clone());
      return res;
    }).catch(() => null);
    return cached || (await network) || (request.mode === 'navigate' ? cache.match('index.html') : Response.error());
  }));
});
