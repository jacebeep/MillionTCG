const CACHE_NAME = 'milliontcg-v100';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/shop.html',
  '/product.html',
  '/sell.html',
  '/checkout.html',
  '/contact-us.html',
  '/track-order.html',
  '/returns-policy.html',
  '/shipping-policy.html',
  '/styles.css',
  '/main.js',
  '/auth.js',
  '/manifest.json',
  '/images/logo.png',
  '/images/icon-192.png',
  '/images/icon-512.png'
];

// Install: skip waiting immediately
self.addEventListener('install', event => {
  self.skipWaiting();
});

// Activate: clean up all old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(key => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Fetch: Network-first for all resources to ensure live GitHub Pages and local updates show instantly
self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;

  event.respondWith(
    fetch(request)
      .then(response => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});
