const CACHE_NAME = 'termo-pwa-v2';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './words.js',
  './multiplayer.js',
  './manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

self.addEventListener('fetch', (event) => {
  // Ignorar requisições externas como Firebase Realtime Database
  if (event.request.url.includes('firebaseio.com') || event.request.url.includes('googleapis.com')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      return cachedResponse || fetch(event.request);
    })
  );
});
