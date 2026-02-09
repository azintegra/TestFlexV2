// Flex Codes PWA Service Worker
const CACHE = 'flexcodes-v1';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './apple-touch-icon.png',
  './favicon.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-512-maskable.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => (k === CACHE ? null : caches.delete(k))));
    await self.clients.claim();
  })());
});

// Network-first for codes.csv so data updates immediately
async function networkFirst(request) {
  try {
    const fresh = await fetch(request, { cache: 'no-store' });
    const cache = await caches.open(CACHE);
    cache.put(request, fresh.clone());
    return fresh;
  } catch (e) {
    const cached = await caches.match(request);
    return cached || new Response('', { status: 504 });
  }
}

// Cache-first for app shell
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const fresh = await fetch(request);
  const cache = await caches.open(CACHE);
  cache.put(request, fresh.clone());
  return fresh;
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // same-origin only
  if (url.origin !== location.origin) return;

  if (url.pathname.endsWith('/codes.csv') || url.pathname.endsWith('codes.csv')) {
    event.respondWith(networkFirst(event.request));
    return;
  }

  // App shell
  if (ASSETS.some((a) => url.pathname.endsWith(a.replace('./','')))) {
    event.respondWith(cacheFirst(event.request));
    return;
  }
});
