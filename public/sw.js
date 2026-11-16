/* CLOSETÉ app shell. Do not cache Google API or authenticated responses.
   BLOCKED_HOSTS must stay in sync with src/cache-policy.js. */
const VERSION = 'closete-shell-v1';
const BASE = '/closete-pwa/';
const BLOCKED_HOSTS = [
  'sheets.googleapis.com',
  'www.googleapis.com',
  'oauth2.googleapis.com',
  'accounts.google.com',
  'drive.google.com',
  'script.google.com',
  'www.google.com',
  'googleapis.com',
  'googleusercontent.com',
  'content.googleapis.com'
];
const SHELL = [
  BASE,
  `${BASE}index.html`,
  `${BASE}manifest.webmanifest`,
  `${BASE}icons/icon-192.png`,
  `${BASE}icons/icon-512.png`,
  `${BASE}icons/icon-maskable-512.png`,
  `${BASE}icons/apple-touch-icon.png`,
  `${BASE}icons/icon.svg`
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(VERSION).then(cache => cache.addAll(SHELL)));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== VERSION).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

function blocked(hostname) {
  const host = String(hostname || '').toLowerCase();
  return BLOCKED_HOSTS.some(name => host === name || host.endsWith(`.${name}`));
}

function cacheable(request) {
  if (request.method !== 'GET') return false;
  if (request.headers.has('authorization')) return false;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return false;
  if (blocked(url.hostname)) return false;
  if (!url.pathname.startsWith(BASE)) return false;
  return true;
}

async function networkFirst(request) {
  const cache = await caches.open(VERSION);
  try {
    const response = await fetch(request);
    if (response && response.ok) await cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await caches.match(request) || await caches.match(BASE) || await caches.match(`${BASE}index.html`);
    if (cached) return cached;
    return new Response('Offline. CLOSETÉ does not keep a copy of wardrobe data.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=UTF-8' }
    });
  }
}

self.addEventListener('fetch', event => {
  if (!cacheable(event.request)) return;

  const url = new URL(event.request.url);
  const shellNavigation = event.request.mode === 'navigate'
    || url.pathname === `${BASE}sw.js`
    || url.pathname.endsWith('/manifest.webmanifest');

  if (shellNavigation) {
    event.respondWith(networkFirst(event.request));
    return;
  }

  event.respondWith((async () => {
    const cached = await caches.match(event.request);
    const fetched = fetch(event.request)
      .then(response => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(VERSION).then(cache => cache.put(event.request, copy)).catch(() => {});
        }
        return response;
      })
      .catch(() => cached);
    return cached || fetched;
  })());
});
