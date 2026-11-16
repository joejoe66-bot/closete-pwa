import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  configStoreMessage,
  CONFIG_STORAGE_KEY,
  extractFolderId,
  extractSpreadsheetId,
  readConfig,
  validateConfig,
  writeConfig
} from '../src/config.js';
import { favoriteToast, saveToast, wearToast } from '../src/copy.js';
import { userMessage } from '../src/errors.js';
import { installHint } from '../src/install-hint.js';
import { fetchPrivateDriveImage } from '../src/private-image.js';
import { renderItems } from '../src/render.js';
import { createSession } from '../src/session.js';
import { deriveStatus, editsAllowed } from '../src/status.js';
import { GOOGLE_SCOPES } from '../src/constants.js';
import { emptyMessage, filterItems, viewNotice } from '../src/views.js';
import { memoryStorage } from './helpers.js';

const clientId = '1234567890-abc123.apps.googleusercontent.com';
const spreadsheetId = '1AbcdEFGH1234567890xyz';

test('config accepts public ids, rejects secrets, and never stores tokens', () => {
  const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit#gid=0`;
  const validation = validateConfig({
    clientId,
    spreadsheetId: url,
    folderId: 'https://drive.google.com/drive/folders/folder1234567890',
    shareWithLink: false,
    access_token: 'should-not-stick',
    client_secret: 'super-secret'
  });
  assert.equal(validation.ok, true);
  assert.equal(validation.value.spreadsheetId, spreadsheetId);
  assert.equal(validation.value.folderId, 'folder1234567890');
  assert.equal(validation.value.shareWithLink, false);
  assert.equal(validation.value.access_token, undefined);
  assert.match(configStoreMessage(validation), /Not connected/);

  const storage = memoryStorage();
  const saved = writeConfig(storage, { ...validation.value, access_token: 'abc', client_secret: 'nope' });
  const raw = storage.getItem(CONFIG_STORAGE_KEY);
  assert.equal(raw.includes('access_token'), false);
  assert.equal(raw.includes('should-not-stick'), false);
  assert.equal(raw.includes('super-secret'), false);
  assert.equal(saved.shareWithLink, false);

  const dirty = memoryStorage({
    [CONFIG_STORAGE_KEY]: JSON.stringify({ clientId, spreadsheetId, access_token: 'leak' })
  });
  const cleaned = readConfig(dirty);
  assert.equal(cleaned.clientId, clientId);
  assert.equal(dirty.getItem(CONFIG_STORAGE_KEY).includes('leak'), false);

  const missing = validateConfig({ clientId: '', spreadsheetId: '' });
  assert.equal(missing.ok, false);
  assert.match(configStoreMessage(missing), /Not connected/);
  assert.match(validateConfig({ clientId: 'secret-file', spreadsheetId }).errors.clientId, /client secret/i);
  assert.equal(extractSpreadsheetId(url), spreadsheetId);
  assert.equal(extractFolderId('https://drive.google.com/drive/folders/folder1234567890'), 'folder1234567890');
});

test('connection status is not claimed before a verified read', () => {
  assert.equal(deriveStatus({ configValid: false, missing: ['spreadsheet ID'] }).connected, false);
  assert.equal(deriveStatus({ configValid: false, missing: ['OAuth client ID'], offline: true }).state, 'offline');
  assert.match(deriveStatus({ configValid: false, missing: ['spreadsheet ID'] }).detail, /not connected/i);
  assert.equal(deriveStatus({ configValid: true, session: 'signed-out' }).state, 'signed-out');
  assert.equal(deriveStatus({ configValid: true, session: 'active' }).state, 'not-verified');
  assert.equal(deriveStatus({ configValid: true, session: 'expired' }).connected, false);
  assert.equal(deriveStatus({
    configValid: true,
    session: 'active',
    readOk: false,
    lastError: { kind: 'permission', message: 'Permission denied.' }
  }).connected, false);
  assert.equal(deriveStatus({
    configValid: true,
    session: 'active',
    offline: true,
    readOk: true,
    hasSnapshot: true
  }).connected, false);
  assert.match(deriveStatus({
    configValid: true,
    session: 'active',
    offline: true,
    hasSnapshot: true
  }).detail, /not syncing/i);

  const connected = deriveStatus({ configValid: true, session: 'active', readOk: true });
  assert.equal(connected.connected, true);
  assert.equal(connected.state, 'connected');
  const shared = deriveStatus({ configValid: true, session: 'active', readOk: true, shareWithLink: true });
  assert.match(shared.detail, /anyone who has the link/);

  const failedWrite = deriveStatus({
    configValid: true,
    session: 'active',
    readOk: true,
    lastError: { kind: 'network', message: 'The last change did not reach Google.' }
  });
  assert.equal(failedWrite.state, 'write-failed');
  assert.equal(failedWrite.title, 'Not saved');

  assert.equal(deriveStatus({ mode: 'demo' }).connected, false);
  assert.match(deriveStatus({ mode: 'demo' }).detail, /not your wardrobe/i);
  assert.equal(editsAllowed({ mode: 'demo', offline: true, status: deriveStatus({ mode: 'demo' }) }), true);
  assert.equal(editsAllowed({
    mode: 'google',
    offline: true,
    status: deriveStatus({ configValid: true, session: 'active', offline: true })
  }), false);
  assert.equal(editsAllowed({ mode: 'google', offline: false, status: connected }), true);
});

test('session tokens expire in memory and are not serialized', () => {
  let now = 1_000_000;
  const session = createSession({ now: () => now });
  assert.equal(session.snapshot().state, 'signed-out');
  session.set('ya29.memory-only', 3600);
  assert.equal(session.snapshot().state, 'active');
  assert.equal(JSON.stringify(session).includes('ya29.memory-only'), false);
  now += 3600 * 1000;
  assert.equal(session.snapshot().state, 'expired');
  assert.equal(session.snapshot().token, '');
  session.clear();
  assert.equal(session.snapshot().state, 'signed-out');
});

test('private drive fetches keep the bearer token out of the url and the http cache', async () => {
  let seen;
  const blob = await fetchPrivateDriveImage('file-1', 'ya29.token', async (url, init) => {
    seen = { url, init };
    return new Response('image-bytes', { status: 200 });
  });
  assert.equal(seen.url.includes('ya29.token'), false);
  assert.equal(seen.init.cache, 'no-store');
  assert.equal(seen.init.credentials, 'omit');
  assert.equal(seen.init.headers.Authorization, 'Bearer ya29.token');
  assert.equal(typeof blob.text, 'function');
  assert.equal(await fetchPrivateDriveImage('', 'token', async () => {
    throw new Error('should not fetch');
  }), null);
});

test('copy and empty states do not claim a finished sync or a connected wardrobe', () => {
  assert.match(saveToast({ mode: 'demo' }), /demo on this device only/);
  assert.equal(saveToast({ mode: 'demo' }).includes('Google Sheet'), false);
  assert.match(saveToast({ mode: 'google', imageShared: false }), /stays private/);
  assert.match(saveToast({ mode: 'google', imageShared: true }), /anyone with the link/);
  assert.match(wearToast('demo'), /demo only/);
  assert.match(favoriteToast('google'), /Google Sheet/);
  for (const text of [saveToast({ mode: 'google' }), wearToast('google'), favoriteToast('google')]) {
    assert.equal(/synced/i.test(text), false);
  }
  assert.match(emptyMessage({ loadState: 'unconfigured', itemCount: 0 }), /not connected/i);
  assert.match(emptyMessage({ loadState: 'error', itemCount: 0 }), /could not be loaded/i);
  assert.match(emptyMessage({ loadState: 'offline', itemCount: 0 }), /does not keep a copy/i);
  assert.match(emptyMessage({ loadState: 'ready', itemCount: 0 }), /first piece/i);
  assert.match(userMessage({ kind: 'offline' }, { action: 'save' }), /Nothing was written/);
});

test('Outfits and Insights stay on the same list and say they are not separate features', () => {
  const items = [
    { name: 'Coat', brand: '', color: '', category: 'Outerwear', notes: '', favorite: false },
    { name: 'Hat', brand: '', color: '', category: 'Accessories', notes: '', favorite: true }
  ];
  assert.equal(filterItems(items, { view: 'Outfits' }).length, 2);
  assert.equal(filterItems(items, { view: 'insights' }).length, 2);
  assert.equal(filterItems(items, { view: 'favorites' }).length, 1);
  assert.match(viewNotice('Outfits'), /not a separate planner/);
  assert.match(viewNotice('insights'), /not a separate report/);
  assert.equal(viewNotice('all'), '');
});

test('rendered cards escape item text', () => {
  const html = renderItems([{
    id: 'id-1',
    name: '<img src=x onerror=alert(1)>',
    brand: 'A & B',
    color: '',
    category: 'Tops',
    notes: '',
    price: 10,
    currency: 'S$',
    favorite: false,
    wearCount: 0,
    imageUrl: 'javascript:alert(1)'
  }]);
  assert.equal(html.includes('<img src=x'), false);
  assert.equal(html.includes('javascript:'), false);
  assert.match(html, /&lt;img/);
  assert.match(html, /A &amp; B/);
  assert.match(html, /S\$ 10\.00/);
});

test('install hints differ by platform and scopes stay least privilege', () => {
  assert.equal(installHint('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)', false).platform, 'ios');
  assert.match(installHint('Mozilla/5.0 (Linux; Android 14)', false).steps.join(' '), /Install app/);
  assert.equal(installHint('Mozilla/5.0', true).platform, 'installed');
  assert.deepEqual(GOOGLE_SCOPES, [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive.file'
  ]);
  assert.equal(GOOGLE_SCOPES.includes('https://www.googleapis.com/auth/drive'), false);
  const source = readFileSync(new URL('../src/google-port.js', import.meta.url), 'utf8');
  assert.equal(source.includes('files.list'), false);
  assert.equal(source.includes('type: \'anyone\''), true);
});
