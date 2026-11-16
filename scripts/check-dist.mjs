import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const dist = path.resolve('dist');
const index = readFileSync(path.join(dist, 'index.html'), 'utf8');
const manifest = JSON.parse(readFileSync(path.join(dist, 'manifest.webmanifest'), 'utf8'));
const worker = readFileSync(path.join(dist, 'sw.js'), 'utf8');

assert.match(index, /\/closete-pwa\//);
assert.match(index, /manifest\.webmanifest/);
assert.equal(index.includes('google.script.run'), false);
assert.equal(index.includes('<iframe'), false);
assert.equal(manifest.start_url, '/closete-pwa/');
assert.equal(manifest.scope, '/closete-pwa/');
assert.match(worker, /\/closete-pwa\//);
assert.match(worker, /sheets\.googleapis\.com/);

for (const icon of manifest.icons) {
  const relative = icon.src.replace(/^\/closete-pwa\//, '');
  const file = path.join(dist, relative);
  assert.equal(statSync(file).isFile(), true, file);
}

const banned = [
  /AIza[0-9A-Za-z_-]{10}/,
  new RegExp(['BEGIN', 'PRIVATE KEY'].join(' ')),
  /client_secret['"]?\s*[:=]\s*['"][^'"]+/,
  /ya29\.[0-9A-Za-z_-]{10}/
];
function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full);
      continue;
    }
    if (!/\.(html|js|css|webmanifest|svg|txt|json)$/.test(entry)) continue;
    const text = readFileSync(full, 'utf8');
    for (const pattern of banned) assert.equal(pattern.test(text), false, `${pattern} in ${full}`);
  }
}
walk(dist);
const assets = readdirSync(path.join(dist, 'assets'));
assert.ok(assets.some(name => name.endsWith('.js')));
assert.ok(assets.some(name => name.endsWith('.css')));
console.log('dist checks passed');
