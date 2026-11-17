// Builds both versions of the app from src/app.html. No npm packages needed.
//   apps-script/Index.html  → paste into the Apps Script project (file name "Index")
//   site/                   → GitHub Pages PWA
// Run: node scripts/build.mjs
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'src/app.html'), 'utf8');

if (!source.includes('<!--HEAD_EXTRA-->') || !source.includes('<!--BODY_EXTRA-->')) {
  throw new Error('src/app.html is missing a build marker');
}

// Apps Script version
const gas = source.replace('<!--HEAD_EXTRA-->\n', '').replace('<!--BODY_EXTRA-->\n', '');
mkdirSync(join(root, 'apps-script'), { recursive: true });
writeFileSync(join(root, 'apps-script/Index.html'), gas);

// PWA version (all paths relative, so it works under /closete-pwa/ or any other path)
const head = `<meta name="robots" content="noindex, nofollow">
<meta name="theme-color" content="#596347">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="apple-mobile-web-app-title" content="CLOSETÉ">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" type="image/png" sizes="192x192" href="icons/icon-192.png">
<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">
`;
const body = `<script>
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('sw.js').catch(function () {});
  });
}
</script>
`;
const pwa = source.replace('<!--HEAD_EXTRA-->\n', head).replace('<!--BODY_EXTRA-->\n', body);
mkdirSync(join(root, 'site'), { recursive: true });
writeFileSync(join(root, 'site/index.html'), pwa);

const manifest = {
  name: 'CLOSETÉ — My Digital Wardrobe',
  short_name: 'CLOSETÉ',
  description: 'Your wardrobe, in your pocket.',
  id: './',
  start_url: './',
  scope: './',
  display: 'standalone',
  background_color: '#f7f1eb',
  theme_color: '#596347',
  icons: [
    { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
};
writeFileSync(join(root, 'site/manifest.webmanifest'), JSON.stringify(manifest, null, 2) + '\n');

const version = createHash('sha256').update(pwa).update(JSON.stringify(manifest)).digest('hex').slice(0, 10);
const sw = `/* CLOSETÉ service worker — app shell only. Wardrobe data and photos are never cached here. */
const CACHE = 'closete-shell-${version}';
const SHELL = [
  './',
  'index.html',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.startsWith('closete-shell-') && k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // Apps Script, Drive photos, fonts: straight to network

  if (request.mode === 'navigate') {
    // Network first so updates show up; fall back to the cached app when offline.
    event.respondWith(
      fetch(request)
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE).then(cache => cache.put('index.html', copy));
          return response;
        })
        .catch(() => caches.match('index.html'))
    );
    return;
  }

  event.respondWith(caches.match(request).then(hit => hit || fetch(request)));
});
`;
writeFileSync(join(root, 'site/sw.js'), sw);

console.log('Built apps-script/Index.html and site/ (version ' + version + ')');
