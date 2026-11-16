/**
 * App-shell service worker. It never caches Google API calls or Authorization headers.
 */
export function renderServiceWorker({ version, assets, scope = '/closete-pwa/' }) {
  const precache = assets
    .filter(asset => asset.startsWith(scope))
    .filter(asset => !asset.includes('token') && !asset.includes('secret'));
  return `/* CLOSETÉ app shell ${version} */
const VERSION = ${JSON.stringify(version)};
const CACHE = 'closete-shell-' + VERSION;
const SCOPE = ${JSON.stringify(scope)};
const PRECACHE = ${JSON.stringify(precache, null, 2)};

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(PRECACHE)));
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter(key => key.startsWith('closete-shell-') && key !== CACHE)
      .map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

function sameOriginApp(url) {
  return url.origin === self.location.origin && url.pathname.startsWith(SCOPE);
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const fresh = await fetch(request);
    if (fresh && fresh.ok) cache.put(request, fresh.clone());
    return fresh;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) return cached;
    if (request.mode === 'navigate') {
      return cache.match(SCOPE + 'index.html') || cache.match(SCOPE);
    }
    throw error;
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const fresh = await fetch(request);
  if (fresh && fresh.ok) cache.put(request, fresh.clone());
  return fresh;
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  if (request.headers.has('authorization') || request.headers.has('Authorization')) return;
  const url = new URL(request.url);
  if (url.hostname.endsWith('googleapis.com')) return;
  if (url.hostname.endsWith('google.com')) return;
  if (url.hostname.endsWith('gstatic.com')) return;
  if (!sameOriginApp(url)) return;
  if (request.mode === 'navigate' || url.pathname.endsWith('/config.js')) {
    event.respondWith(networkFirst(request));
    return;
  }
  event.respondWith(cacheFirst(request));
});
`;
}
