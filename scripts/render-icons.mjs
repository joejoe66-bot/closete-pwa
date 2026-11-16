import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'public', 'icons');

const OLIVE = [89, 99, 71, 255];
const CREAM = [255, 250, 245, 255];
const INK = [37, 39, 32, 255];
const ROSE = [201, 130, 106, 255];

function crc32(buffer) {
  let crc = ~0;
  for (const byte of buffer) {
    crc ^= byte;
    for (let i = 0; i < 8; i += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return ~crc >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const name = Buffer.from(type);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([length, name, data, checksum]);
}

function encodePng(width, height, rgba) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0;
    for (let x = 0; x < stride; x += 1) raw[y * (stride + 1) + 1 + x] = rgba[y * stride + x];
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

function createCanvas(size) {
  const data = new Uint8ClampedArray(size * size * 4);
  function blend(x, y, color, alpha) {
    if (x < 0 || y < 0 || x >= size || y >= size || alpha <= 0) return;
    const i = (y * size + x) * 4;
    const src = Math.max(0, Math.min(1, alpha));
    const dst = data[i + 3] / 255;
    const out = src + dst * (1 - src);
    if (!out) return;
    for (let channel = 0; channel < 3; channel += 1) {
      data[i + channel] = (color[channel] * src + data[i + channel] * dst * (1 - src)) / out;
    }
    data[i + 3] = out * 255;
  }
  function fill(color) {
    for (let i = 0; i < data.length; i += 4) {
      data[i] = color[0];
      data[i + 1] = color[1];
      data[i + 2] = color[2];
      data[i + 3] = color[3];
    }
  }
  function circle(cx, cy, radius, color) {
    const minX = Math.max(0, Math.floor(cx - radius - 1));
    const maxX = Math.min(size - 1, Math.ceil(cx + radius + 1));
    const minY = Math.max(0, Math.floor(cy - radius - 1));
    const maxY = Math.min(size - 1, Math.ceil(cy + radius + 1));
    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        const distance = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
        blend(x, y, color, radius - distance + 0.6);
      }
    }
  }
  function discStroke(cx, cy, radius, width, color, start, end) {
    const minX = Math.max(0, Math.floor(cx - radius - width));
    const maxX = Math.min(size - 1, Math.ceil(cx + radius + width));
    const minY = Math.max(0, Math.floor(cy - radius - width));
    const maxY = Math.min(size - 1, Math.ceil(cy + radius + width));
    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        const angle = Math.atan2(y + 0.5 - cy, x + 0.5 - cx);
        const norm = angle < 0 ? angle + Math.PI * 2 : angle;
        if (norm < start || norm > end) continue;
        const distance = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
        blend(x, y, color, (width / 2) - Math.abs(distance - radius) + 0.6);
      }
    }
  }
  function line(x1, y1, x2, y2, width, color) {
    const length = Math.hypot(x2 - x1, y2 - y1) || 1;
    const steps = Math.ceil(length * 2);
    for (let step = 0; step <= steps; step += 1) {
      const t = step / steps;
      circle(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, width / 2, color);
    }
  }
  return { data, fill, circle, discStroke, line };
}

function draw(size, { maskable = false } = {}) {
  const canvas = createCanvas(size);
  canvas.fill(OLIVE);
  const cx = size / 2;
  const cy = size / 2;
  if (!maskable) canvas.circle(cx, cy, size * 0.34, CREAM);
  const scale = maskable ? 0.46 : 0.58;
  const hookY = cy - size * scale * 0.34;
  const hookR = size * 0.055;
  canvas.discStroke(cx, hookY, hookR, size * 0.025, maskable ? CREAM : INK, Math.PI * 1.05, Math.PI * 1.95);
  const neckTop = hookY + hookR;
  const barY = cy + size * scale * 0.28;
  canvas.line(cx, neckTop, cx, neckTop + size * 0.06, size * 0.02, maskable ? CREAM : INK);
  canvas.line(cx, neckTop + size * 0.05, cx - size * scale * 0.42, barY, size * 0.028, maskable ? CREAM : INK);
  canvas.line(cx, neckTop + size * 0.05, cx + size * scale * 0.42, barY, size * 0.028, maskable ? CREAM : INK);
  canvas.line(cx - size * scale * 0.48, barY, cx + size * scale * 0.48, barY, size * 0.03, maskable ? CREAM : INK);
  canvas.circle(cx + size * 0.16, cy - size * 0.16, size * 0.035, ROSE);
  return canvas.data;
}

fs.mkdirSync(outDir, { recursive: true });
const files = [
  ['icon-192.png', 192, false],
  ['icon-512.png', 512, false],
  ['icon-maskable-512.png', 512, true],
  ['apple-touch-icon.png', 180, false]
];
for (const [name, size, maskable] of files) {
  fs.writeFileSync(path.join(outDir, name), encodePng(size, size, draw(size, { maskable })));
}

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-label="CLOSETÉ">
  <rect width="512" height="512" rx="96" fill="#596347"/>
  <circle cx="256" cy="256" r="174" fill="#fffaf5"/>
  <path d="M256 150 a28 28 0 1 1 0 56" fill="none" stroke="#252720" stroke-width="14" stroke-linecap="round"/>
  <path d="M256 206 L256 230 L150 340 H362 L256 230" fill="none" stroke="#252720" stroke-width="16" stroke-linejoin="round" stroke-linecap="round"/>
  <circle cx="338" cy="176" r="18" fill="#c9826a"/>
</svg>
`;
fs.writeFileSync(path.join(outDir, 'icon.svg'), svg);
console.log(`Wrote icons to ${outDir}`);
