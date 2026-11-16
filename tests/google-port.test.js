import test from 'node:test';
import assert from 'node:assert/strict';
import { HEADERS } from '../src/constants.js';
import { columnLetter, createGooglePort, createWardrobeFolder } from '../src/google-port.js';
import { userMessage } from '../src/errors.js';
import { loadWardrobe, saveItem } from '../src/wardrobe.js';
import { jsonResponse } from './helpers.js';

const TOKEN = 'ya29.super-secret-token';
const jpeg = 'data:image/jpeg;base64,aaaa';

function session(state = 'active', token = TOKEN) {
  return () => ({ state, token: state === 'active' ? token : '' });
}

function createApi(options = {}) {
  const db = {
    sheets: options.sheets || ['Wardrobe'],
    headers: options.headers ? options.headers.slice() : [...HEADERS],
    rows: (options.rows || []).map(row => row.slice()),
    permissions: [],
    files: [],
    failPermissions: options.failPermissions || false,
    status: options.status || 200
  };
  const calls = [];

  async function fetchImpl(url, init = {}) {
    calls.push({ url: String(url), init });
    const auth = init.headers?.Authorization || '';
    assert.equal(init.cache, 'no-store');
    assert.equal(init.credentials, 'omit');
    assert.equal(String(url).includes(TOKEN), false);
    if (options.failNetwork) throw new TypeError('Failed to fetch');
    if (auth.includes('ya29.expired') || db.status === 401) {
      return jsonResponse({ error: { message: 'Invalid Credentials' } }, 401);
    }
    if (db.status === 403) return jsonResponse({ error: { message: 'The caller does not have permission' } }, 403);
    if (db.status === 404) return jsonResponse({ error: { message: 'Requested entity was not found.' } }, 404);

    if (url.includes(':batchUpdate')) {
      db.sheets.push('Wardrobe');
      return jsonResponse({});
    }
    if (url.includes('/upload/drive/')) {
      assert.match(init.body, /folder-123/);
      assert.equal(init.body.includes('"type":"anyone"'), false);
      return jsonResponse({ id: 'file-uploaded' });
    }
    if (url.includes('/permissions')) {
      db.permissions.push(JSON.parse(init.body));
      if (db.failPermissions) return jsonResponse({ error: { message: 'forbidden' } }, 403);
      return jsonResponse({ id: 'perm-1' });
    }
    if (url.includes('/drive/v3/files') && init.method === 'POST') {
      const body = JSON.parse(init.body);
      db.files.push(body);
      return jsonResponse({ id: 'folder-created', name: body.name });
    }
    if (url.includes('/values/') && init.method === 'PUT') {
      const row = Number((String(url).match(/!A(\d+)(?::|%3A)/i) || [])[1] || 0);
      const values = JSON.parse(init.body).values[0];
      if (row === 1) db.headers = values;
      else db.rows[row - 2] = values;
      return jsonResponse({});
    }
    if (url.includes(':append')) {
      db.rows.push(JSON.parse(init.body).values[0]);
      return jsonResponse({});
    }
    if (url.includes('/values/')) {
      return jsonResponse({ values: db.rows.length || db.headers.length ? [db.headers, ...db.rows] : [] });
    }
    if (url.includes('fields=sheets.properties')) {
      return jsonResponse({ sheets: db.sheets.map(title => ({ properties: { title } })) });
    }
    throw new Error(`Unexpected request ${init.method || 'GET'} ${url}`);
  }

  return { db, calls, fetchImpl };
}

function portFor(api, config) {
  return createGooglePort({
    fetchImpl: api.fetchImpl,
    getSession: session(),
    getConfig: () => ({
      spreadsheetId: 'sheet-1234567890',
      folderId: 'folder-1234567890',
      shareWithLink: false,
      ...config
    })
  });
}

test('column letters cover the wardrobe header width', () => {
  assert.equal(columnLetter(1), 'A');
  assert.equal(columnLetter(HEADERS.length), 'O');
  assert.equal(columnLetter(27), 'AA');
});

test('a verified read reverses rows and a save appends with RAW values', async () => {
  const api = createApi({
    rows: [[
      'old', 'Coat', 'Outerwear', '', '', '', 10, '2024-01-02', '', '', false, '', 1, 'c', 'u'
    ]]
  });
  const port = portFor(api);
  const loaded = await loadWardrobe(port);
  assert.equal(loaded.items[0].name, 'Coat');
  assert.equal(loaded.items[0].currency, 'S$');
  assert.equal(loaded.createdSheet, false);

  const saved = await saveItem(port, {
    name: 'Hat',
    category: 'Accessories',
    price: 12,
    wearCount: 99
  }, { newId: () => 'hat-1', now: new Date('2026-11-16T00:00:00.000Z') });
  assert.equal(saved.success, true);
  assert.equal(api.db.rows.length, 2);
  assert.equal(api.db.rows[1][0], 'hat-1');
  assert.equal(api.db.rows[1][HEADERS.indexOf('wearCount')], 0);
  assert.ok(api.calls.some(call => call.url.includes(':append') && call.url.includes('valueInputOption=RAW')));
  assert.equal(api.calls.some(call => call.url.includes('/permissions')), false);
  assert.equal(api.calls.some(call => call.url.includes('files.list') || call.url.includes('q=')), false);
});

test('creating the missing Wardrobe tab is explicit and keeps later reads empty', async () => {
  const api = createApi({ sheets: [] });
  const loaded = await loadWardrobe(portFor(api));
  assert.equal(loaded.createdSheet, true);
  assert.equal(loaded.items.length, 0);
  assert.deepEqual(api.db.headers, HEADERS);
  assert.ok(api.calls.some(call => call.url.includes(':batchUpdate')));
});

test('private upload does not call permissions, and link sharing is opt-in', async () => {
  const api = createApi();
  const port = portFor(api, { folderId: 'folder-123', shareWithLink: false });
  const saved = await saveItem(port, { name: 'Coat', imageDataUrl: jpeg }, { newId: () => 'pic-1' });
  assert.equal(saved.imageShared, false);
  assert.match(api.db.rows[0][HEADERS.indexOf('imageUrl')], /export=view&id=file-uploaded/);
  assert.equal(api.db.permissions.length, 0);

  const sharedApi = createApi();
  const shared = portFor(sharedApi, { folderId: 'folder-123', shareWithLink: true });
  const sharedSave = await saveItem(shared, { name: 'Coat', imageDataUrl: jpeg }, { newId: () => 'pic-2' });
  assert.equal(sharedSave.imageShared, true);
  assert.deepEqual(sharedApi.db.permissions[0], { role: 'reader', type: 'anyone' });
});

test('a failed share or missing folder does not append a wardrobe row', async () => {
  const denied = createApi({ failPermissions: true });
  const port = portFor(denied, { folderId: 'folder-123', shareWithLink: true });
  await assert.rejects(() => saveItem(port, { name: 'Coat', imageDataUrl: jpeg }));
  assert.equal(denied.db.rows.length, 0);

  const missing = createApi();
  const noFolder = portFor(missing, { folderId: '' });
  await assert.rejects(
    () => saveItem(noFolder, { name: 'Coat', imageDataUrl: jpeg }),
    error => error.kind === 'missing-folder'
  );
  assert.equal(missing.calls.some(call => call.url.includes('/upload/')), false);
  assert.equal(missing.db.rows.length, 0);
});

test('http and network failures stay unconfirmed', async () => {
  const expired = createApi();
  const expiredPort = createGooglePort({
    fetchImpl: expired.fetchImpl,
    getSession: session('active', 'ya29.expired'),
    getConfig: () => ({ spreadsheetId: 'sheet-1234567890', folderId: '', shareWithLink: false })
  });
  await assert.rejects(() => loadWardrobe(expiredPort), error => {
    assert.equal(error.kind, 'expired');
    assert.match(userMessage(error, { action: 'load' }), /not loaded/i);
    return true;
  });

  const forbidden = createApi({ status: 403 });
  await assert.rejects(() => loadWardrobe(portFor(forbidden)), error => {
    assert.equal(error.kind, 'permission');
    assert.match(userMessage(error, { action: 'save' }), /Nothing was confirmed/);
    return true;
  });

  const missing = createApi({ status: 404 });
  await assert.rejects(() => loadWardrobe(portFor(missing)), error => error.kind === 'not-found');

  const offline = createApi({ failNetwork: true });
  await assert.rejects(() => loadWardrobe(portFor(offline)), error => {
    assert.equal(error.kind, 'offline');
    assert.match(userMessage(error, { action: 'load' }), /nothing is queued to sync/i);
    assert.match(userMessage(error, { action: 'save' }), /Nothing was written/);
    return true;
  });

  const signedOut = createGooglePort({
    fetchImpl: () => { throw new Error('should not be called'); },
    getSession: session('signed-out'),
    getConfig: () => ({ spreadsheetId: 'sheet-1234567890', folderId: '', shareWithLink: false })
  });
  await assert.rejects(() => loadWardrobe(signedOut), error => error.kind === 'signed-out');
});

test('creating a photo folder does not share it or search Drive by name', async () => {
  const api = createApi();
  const folder = await createWardrobeFolder({
    fetchImpl: api.fetchImpl,
    getSession: session()
  });
  assert.equal(folder.id, 'folder-created');
  assert.equal(folder.shared, false);
  assert.equal(api.db.files[0].mimeType, 'application/vnd.google-apps.folder');
  assert.equal(api.db.files[0].name, 'CLOSETÉ Wardrobe Photos');
  assert.equal(api.db.permissions.length, 0);
  assert.equal(api.calls.some(call => call.url.includes('q=')), false);
});
