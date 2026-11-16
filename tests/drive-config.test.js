import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { assessConfig } from '../src/lib/config.js';
import { SCOPES } from '../src/lib/constants.js';
import { createDemoStore } from '../src/lib/demo.js';
import {
  createDriveClient,
  isLegacyPublicDriveImage,
  parseImageDataUrl,
  safeFileName,
} from '../src/lib/drive.js';
import { assertWritable, publicError } from '../src/lib/errors.js';
import { currentToken, rememberToken } from '../src/lib/auth.js';
import { renderServiceWorker } from '../src/sw-template.js';

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

describe('missing config and auth errors', () => {
  it('does not treat a blank client id as a connection', () => {
    const config = assessConfig({
      CLIENT_ID: '',
      SPREADSHEET_ID: '1NqubXEZAIJdBOnK9iru0qR4b2jPc8tRPToR2s9mYCng',
      SHEET_NAME: 'Wardrobe',
      SHEET_ID: 1746053320,
    });
    expect(config.ok).toBe(false);
    expect(config.connected).toBe(false);
    expect(config.errors.join(' ')).toMatch(/OAuth client ID/);
    expect(config.scopes).toEqual([
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive.file',
    ]);
    expect(SCOPES).toEqual(config.scopes);
    expect(SCOPES.some(scope => scope.endsWith('/drive'))).toBe(false);
  });

  it('rejects placeholders and still does not claim a live connection', () => {
    expect(assessConfig({ CLIENT_ID: 'example.apps.googleusercontent.com' }).ok).toBe(false);
    const ready = assessConfig({ CLIENT_ID: '123-abc.apps.googleusercontent.com' });
    expect(ready.ok).toBe(true);
    expect(ready.connected).toBe(false);
  });

  it('keeps tokens in memory and redacts them from errors', () => {
    const state = rememberToken({ access_token: 'ya29.SECRETVALUE', expires_in: 10 }, 1_000);
    expect(currentToken(state, 1_000)).toBe('ya29.SECRETVALUE');
    expect(currentToken(state, 1_000 + 6000)).toBe('');
    expect(() => rememberToken({ error: 'access_denied' })).toThrow(/failed|access_denied/i);
    expect(publicError(new Error('Bearer ya29.SECRETVALUE'))).not.toContain('SECRETVALUE');
    expect(() => assertWritable(false)).toThrow(/Nothing was written/);
  });
});

describe('drive permissions and demo mode', () => {
  it('rejects unsupported or oversized images and unsafe names', () => {
    expect(parseImageDataUrl(PNG).mimeType).toBe('image/png');
    expect(() => parseImageDataUrl('data:image/gif;base64,AAAA')).toThrow(/not supported/i);
    const huge = `data:image/jpeg;base64,${'A'.repeat(10 * 1024 * 1024)}`;
    expect(() => parseImageDataUrl(huge)).toThrow(/too large/i);
    expect(safeFileName('a/b:c*shirt', 'jpg', 5)).toBe('a_b_c_shirt-5.jpg');
    expect(isLegacyPublicDriveImage('https://drive.google.com/uc?export=view&id=abc')).toBe(true);
    expect(isLegacyPublicDriveImage('https://drive.google.com/file/d/abc/view')).toBe(false);
  });

  it('creates a folder without a permissions request', async () => {
    const calls = [];
    const fetchImpl = async (url, options = {}) => {
      calls.push({ url, options });
      return {
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        text: async () => '{"id":"folder-9","name":"CLOSETÉ Wardrobe Photos"}',
        json: async () => ({ id: 'folder-9', name: 'CLOSETÉ Wardrobe Photos' }),
      };
    };
    const drive = createDriveClient({ fetchImpl, getToken: () => 'memory-token' });
    const created = await drive.createPrivateFolder('CLOSETÉ Wardrobe Photos');
    expect(created.id).toBe('folder-9');
    expect(calls[0].url).not.toContain('permissions');
    expect(JSON.parse(calls[0].options.body).mimeType).toBe('application/vnd.google-apps.folder');
    await expect(drive.uploadImage({ dataUrl: PNG, itemName: 'Hat', folderId: '' })).rejects.toThrow(/Nothing was written/);
  });

  it('keeps demo edits in memory', () => {
    const store = createDemoStore({
      now: () => new Date('2026-11-16T02:00:00Z'),
      newId: () => 'demo-new',
    });
    const saved = store.saveItem({ name: 'Sample scarf', category: 'Accessories', price: 15 });
    expect(saved.message).toMatch(/nothing was written/i);
    expect(store.listItems()[0].id).toBe('demo-new');
    expect(store.listItems()[0].demo).toBe(true);
    const worn = store.markWorn('demo-new');
    expect(worn.wearCount).toBe(1);
    expect(worn.lastWorn).toBe('2026-11-16');
  });
});

describe('service worker and app shell source', () => {
  it('versions the shell cache and refuses Google and authorized responses', () => {
    const source = renderServiceWorker({
      version: 'test-version',
      scope: '/closete-pwa/',
      assets: [
        '/closete-pwa/',
        '/closete-pwa/index.html',
        '/closete-pwa/config.js',
        '/closete-pwa/manifest.webmanifest',
        '/closete-pwa/icons/icon-192.png',
        '/other/secret.txt',
      ],
    });
    expect(source).toContain('test-version');
    expect(source).toContain('closete-shell-');
    expect(source).toContain('/closete-pwa/index.html');
    expect(source).toContain('/closete-pwa/manifest.webmanifest');
    expect(source).not.toContain('/other/secret.txt');
    expect(source).toContain('googleapis.com');
    expect(source).toContain('authorization');
    expect(source).toContain('SKIP_WAITING');
    expect(source).toContain("url.pathname.endsWith('/config.js')");
    expect(source).not.toContain('ya29.');
    expect(source).not.toContain('GOCSPX-');
  });

  it('ships an empty client id, the confirmed sheet, and no unfinished sections', () => {
    const index = readFileSync('index.html', 'utf8');
    const config = readFileSync('public/config.js', 'utf8');
    const manifest = JSON.parse(readFileSync('public/manifest.webmanifest', 'utf8'));
    const vite = readFileSync('vite.config.js', 'utf8');
    expect(config).toContain("CLIENT_ID: ''");
    expect(config).toContain('1NqubXEZAIJdBOnK9iru0qR4b2jPc8tRPToR2s9mYCng');
    expect(config).not.toMatch(/GOCSPX-|ya29\.|client_secret|refresh_token/i);
    expect(index).not.toMatch(/Outfits|Insights|google\.script\.run/);
    expect(index).toContain('data-view="favorites"');
    expect(index).toContain('capture="environment"');
    expect(index).toContain('%BASE_URL%manifest.webmanifest');
    expect(index).toContain('View demo wardrobe');
    expect(vite).toContain("base: '/closete-pwa/'");
    expect(manifest.start_url).toBe('/closete-pwa/');
    expect(manifest.scope).toBe('/closete-pwa/');
    expect(manifest.display).toBe('standalone');
    expect(manifest.theme_color).toBe('#596347');
    expect(manifest.background_color).toBe('#f7f1eb');
    expect(manifest.icons.map(icon => icon.sizes)).toEqual(['192x192', '512x512', '512x512']);
    const legacy = readFileSync('legacy/closete-source/Index.html');
    expect(createHash('sha256').update(legacy).digest('hex')).toBe(
      '20a6e05bc54b3574c35aaad05c4ca831470fcd4b19571cf9eb1e69bf1db548eb'
    );
  });

  it('does not store secrets or the old Apps Script bridge in the app', () => {
    const files = [];
    const walk = directory => {
      for (const entry of readdirSync(directory)) {
        const full = join(directory, entry);
        if (statSync(full).isDirectory()) walk(full);
        else if (/\.(js|html|webmanifest|css|mjs)$/.test(entry)) files.push(full);
      }
    };
    ['src', 'public', 'scripts'].forEach(walk);
    files.push('index.html');
    const banned = /GOCSPX-|ya29\.|client_secret|refresh_token|google\.script\.run|衣櫃收納|Clothes-/;
    for (const file of files) {
      expect(readFileSync(file, 'utf8'), file).not.toMatch(banned);
    }
  });
});
