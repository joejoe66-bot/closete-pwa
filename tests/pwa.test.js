import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BASE_PATH } from '../src/constants.js';
import { BLOCKED_HOSTS, shouldCacheRequest } from '../src/cache-policy.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => readFileSync(path.join(root, relative), 'utf8');

function pngSize(buffer) {
  assert.equal(buffer.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

test('manifest, icons, and service worker are scoped to /closete-pwa/', () => {
  const manifest = JSON.parse(read('public/manifest.webmanifest'));
  assert.equal(manifest.start_url, BASE_PATH);
  assert.equal(manifest.scope, BASE_PATH);
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.theme_color, '#596347');
  assert.equal(manifest.background_color, '#f7f1eb');
  assert.ok(manifest.icons.length >= 3);

  const expected = {
    'public/icons/icon-192.png': 192,
    'public/icons/icon-512.png': 512,
    'public/icons/icon-maskable-512.png': 512,
    'public/icons/apple-touch-icon.png': 180
  };
  for (const [file, size] of Object.entries(expected)) {
    const buffer = readFileSync(path.join(root, file));
    assert.deepEqual(pngSize(buffer), { width: size, height: size });
  }
  assert.match(read('public/icons/icon.svg'), /#596347/);

  const worker = read('public/sw.js');
  assert.match(worker, /const BASE = '\/closete-pwa\/'/);
  assert.match(worker, /closete-shell-v1/);
  assert.match(worker, /SKIP_WAITING/);
  assert.match(worker, /authorization/);
  for (const host of BLOCKED_HOSTS) assert.match(worker, new RegExp(host.replaceAll('.', '\\.')));
  assert.equal(worker.includes('sheets.googleapis.com'), true);
  assert.equal(/cache\.put\([^)]*googleapis/.test(worker), false);
});

test('the app shell does not wrap the live Apps Script page or cache Google calls', () => {
  const html = read('index.html');
  const worker = read('public/sw.js');
  const vite = read('vite.config.js');
  assert.match(html, /%BASE_URL%manifest\.webmanifest/);
  assert.match(html, /Store on this device/);
  assert.match(html, /Not connected/);
  assert.equal(html.includes('google.script.run'), false);
  assert.equal(html.includes('<iframe'), false);
  assert.equal(html.includes('script.google.com/macros'), false);
  assert.match(vite, /base: '\/closete-pwa\/'/);
  assert.match(worker, /Offline\. CLOSETÉ does not keep a copy/);

  assert.equal(shouldCacheRequest({
    method: 'GET',
    hostname: 'sheets.googleapis.com',
    pathname: '/v4/spreadsheets/abc',
    origin: 'https://sheets.googleapis.com',
    pageOrigin: 'https://joejoe66-bot.github.io',
    hasAuthorization: true
  }), false);
  assert.equal(shouldCacheRequest({
    method: 'POST',
    hostname: 'joejoe66-bot.github.io',
    pathname: '/closete-pwa/',
    origin: 'https://joejoe66-bot.github.io',
    pageOrigin: 'https://joejoe66-bot.github.io'
  }), false);
  assert.equal(shouldCacheRequest({
    method: 'GET',
    hostname: 'joejoe66-bot.github.io',
    pathname: '/closete-pwa/icons/icon-192.png',
    origin: 'https://joejoe66-bot.github.io',
    pageOrigin: 'https://joejoe66-bot.github.io'
  }), true);
  assert.equal(shouldCacheRequest({
    method: 'GET',
    hostname: 'joejoe66-bot.github.io',
    pathname: '/other-app/icon.png',
    origin: 'https://joejoe66-bot.github.io',
    pageOrigin: 'https://joejoe66-bot.github.io'
  }), false);
});

test('source and legacy backup do not contain invented secrets', () => {
  const files = [];
  function walk(dir) {
    for (const entry of readdirSync(dir)) {
      if (entry === 'node_modules' || entry === 'dist' || entry === '.git' || entry === 'tests') continue;
      const full = path.join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.(js|mjs|html|md|css|webmanifest|yml|json|gs|txt|svg)$/.test(entry)) files.push(full);
    }
  }
  walk(root);
  const combined = files.map(file => readFileSync(file, 'utf8')).join('\n');
  assert.equal(/AIza[0-9A-Za-z_-]{10}/.test(combined), false);
  assert.equal(/BEGIN PRIVATE KEY/.test(combined), false);
  assert.equal(/client_secret['"]?\s*[:=]\s*['"][^'"]+/.test(combined), false);
  assert.match(read('src/config.js'), /client_secret/);

  const code = read('legacy/Code.gs');
  assert.match(code, /function getItems\(/);
  assert.match(code, /function saveItem\(/);
  assert.match(code, /function markWorn\(/);
  assert.match(code, /ANYONE_WITH_LINK/);
  assert.match(code, /SHEET_NAME: 'Wardrobe'/);
  assert.match(code, /CURRENCY: 'S\$'/);
  assert.match(code, /CLOSETÉ Wardrobe Photos/);
  assert.match(read('legacy/SOURCE-NOTES.md'), /no spreadsheet ID/i);
  assert.equal(code.includes('iframe'), false);
});
