// Noonchaser service worker: lets the game open with no connection.
// Game files are served from the cache straight away and refreshed in the
// background, so a pushed update shows up on the launch after next.
// Bump VERSION only when this file's caching logic changes.
const VERSION = 'v1';
const CORE = 'noonchaser-core-' + VERSION;
const FONTS = 'noonchaser-fonts-' + VERSION;
const CORE_FILES = [
  './',
  'index.html',
  'manifest.webmanifest'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CORE)
      .then(cache => cache.addAll(CORE_FILES.map(u => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys
        .filter(k => k.startsWith('noonchaser-') && k !== CORE && k !== FONTS)
        .map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Serve from cache, refresh the cache from the network in the background.
function staleWhileRevalidate(event, cacheName, request, fallbackKey) {
  const cachePromise = caches.open(cacheName);
  const network = cachePromise.then(cache =>
    fetch(request).then(response => {
      if (response && (response.ok || response.type === 'opaque')) {
        cache.put(fallbackKey || request, response.clone());
      }
      return response;
    })
  );
  event.waitUntil(network.catch(() => {}));
  return cachePromise
    .then(cache => cache.match(fallbackKey || request, { ignoreSearch: true }))
    .then(cached => cached || network);
}

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Opening the game (any URL in this folder) always gets index.html.
  if (req.mode === 'navigate' && url.origin === self.location.origin) {
    event.respondWith(staleWhileRevalidate(event, CORE, req, 'index.html'));
    return;
  }
  if (url.origin === self.location.origin) {
    event.respondWith(staleWhileRevalidate(event, CORE, req));
    return;
  }
  // Google Fonts: stylesheet and font files, cached on first online launch.
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(staleWhileRevalidate(event, FONTS, req));
  }
});
