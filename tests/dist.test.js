import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const built = existsSync('dist/index.html') && existsSync('dist/sw.js');

describe.skipIf(!built)('built app shell', () => {
  it('publishes the /closete-pwa/ base, manifest, icons, and versioned worker', () => {
    const index = readFileSync('dist/index.html', 'utf8');
    const manifest = JSON.parse(readFileSync('dist/manifest.webmanifest', 'utf8'));
    const config = readFileSync('dist/config.js', 'utf8');
    const worker = readFileSync('dist/sw.js', 'utf8');
    expect(index).toContain('/closete-pwa/assets/');
    expect(index).toContain('/closete-pwa/manifest.webmanifest');
    expect(index).toContain('/closete-pwa/config.js');
    expect(index).not.toMatch(/Outfits|Insights|google\.script\.run|%BASE_URL%/);
    expect(manifest.start_url).toBe('/closete-pwa/');
    expect(manifest.scope).toBe('/closete-pwa/');
    expect(config).toMatch(/CLIENT_ID:\s*''/);
    expect(worker).toContain("const SCOPE = \"/closete-pwa/\"");
    expect(worker).toContain('/closete-pwa/index.html');
    expect(worker).toContain('/closete-pwa/icons/icon-192.png');
    expect(worker).toContain('closete-shell-');
    expect(worker).not.toMatch(/ya29\.|GOCSPX-|client_secret/);
    for (const icon of [
      'dist/icons/icon-192.png',
      'dist/icons/icon-512.png',
      'dist/icons/icon-maskable-512.png',
      'dist/icons/apple-touch-icon.png',
    ]) {
      const bytes = readFileSync(icon);
      expect(bytes.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
      expect(statSync(icon).size).toBeGreaterThan(200);
    }
    expect(createHash('sha256').update(worker).digest('hex')).toHaveLength(64);
  });
});
