import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';

const root = join(process.cwd(), 'dist');
const port = Number(process.env.PORT || 4173);
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
};

const server = createServer((request, response) => {
  const url = new URL(request.url, `http://127.0.0.1:${port}`);
  if (url.pathname === '/closete-pwa') {
    response.writeHead(302, { Location: '/closete-pwa/' });
    response.end();
    return;
  }
  if (!url.pathname.startsWith('/closete-pwa/')) {
    response.writeHead(404);
    response.end('Not found');
    return;
  }
  let relativePath = decodeURIComponent(url.pathname.slice('/closete-pwa/'.length));
  if (!relativePath || relativePath.endsWith('/')) relativePath += 'index.html';
  const file = normalize(join(root, relativePath));
  if (!file.startsWith(root) || !existsSync(file) || !statSync(file).isFile()) {
    response.writeHead(404);
    response.end('Not found');
    return;
  }
  response.writeHead(200, {
    'Content-Type': types[extname(file)] || 'application/octet-stream',
    'Cache-Control': 'no-cache',
    'Service-Worker-Allowed': '/closete-pwa/',
  });
  createReadStream(file).pipe(response);
});

server.listen(port, '127.0.0.1', () => {
  console.log(`CLOSETÉ preview at http://127.0.0.1:${port}/closete-pwa/`);
});
