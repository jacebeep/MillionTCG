const CACHE_NAME = 'milliontcg-v2';
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
  '/manifest.json',
  '/images/logo.png'
];

// Install: cache static assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS);
    }).catch(err => {
      console.warn('SW: Some assets failed to cache', err);
    })
  );
  self.skipWaiting();
});

// Activate: clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Fetch: network-first for navigation, cache-first for assets
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests and non-same-origin requests
  if (request.method !== 'GET' || !url.origin.includes(self.location.origin.split('//')[1])) {
    return;
  }

  // Network-first for HTML pages (fresh content)
  if (request.destination === 'document' || request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          return response;
        })
        .catch(() => caches.match(request).then(cached => cached || caches.match('/index.html')))
    );
    return;
  }

  // Cache-first for static assets (images, css, js)
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(response => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
        }
        return response;
      });
    })
  );
});
