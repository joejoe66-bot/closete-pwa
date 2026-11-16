import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, posix, relative } from 'node:path';
import { renderServiceWorker } from '../src/sw-template.js';

const dist = 'dist';
const scope = '/closete-pwa/';

function walk(directory) {
  const files = [];
  for (const entry of readdirSync(directory)) {
    const full = join(directory, entry);
    if (statSync(full).isDirectory()) files.push(...walk(full));
    else files.push(full);
  }
  return files;
}

const files = walk(dist)
  .map(file => file.split('\\').join('/'))
  .filter(file => !file.endsWith('/sw.js'));

const hash = createHash('sha256');
for (const file of files.sort()) {
  hash.update(file);
  hash.update(readFileSync(file));
}
const version = hash.digest('hex').slice(0, 12);
const assets = [
  scope,
  ...files.map(file => scope + relative(dist, file).split('\\').join(posix.sep)),
];
writeFileSync(join(dist, 'sw.js'), renderServiceWorker({ version, assets, scope }));
console.log(`wrote dist/sw.js ${version} (${assets.length} assets)`);
