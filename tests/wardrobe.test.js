import test from 'node:test';
import assert from 'node:assert/strict';
import { HEADERS } from '../src/constants.js';
import { createMemoryPort } from '../src/memory-port.js';
import { loadWardrobe, markWorn, saveItem } from '../src/wardrobe.js';

const jpeg = 'data:image/jpeg;base64,aaaa';

function portWith(rows = []) {
  return createMemoryPort({ headers: [...HEADERS], rows });
}

test('saveItem creates, updates, and preserves wear fields the way Code.gs does', async () => {
  const port = portWith();
  const createdAt = new Date('2024-04-02T00:00:00.000Z');
  const created = await saveItem(port, {
    name: '  Linen shirt ',
    price: -4,
    favorite: 'true',
    wearCount: 99,
    lastWorn: '2099-01-01'
  }, { now: createdAt, newId: () => 'id-1' });

  assert.equal(created.success, true);
  assert.equal(created.id, 'id-1');
  assert.equal(created.imageShared, null);
  let loaded = await loadWardrobe(port);
  assert.equal(loaded.items.length, 1);
  assert.equal(loaded.items[0].name, 'Linen shirt');
  assert.equal(loaded.items[0].category, 'Other');
  assert.equal(loaded.items[0].price, 0);
  assert.equal(loaded.items[0].favorite, true);
  assert.equal(loaded.items[0].wearCount, 0);
  assert.equal(loaded.items[0].lastWorn, '');
  assert.equal(loaded.items[0].currency, 'S$');
  assert.equal(port.snapshot().rows.length, 1);

  const worn = await markWorn(port, 'id-1', { now: new Date('2026-11-16T20:00:00.000Z') });
  assert.equal(worn.success, true);
  assert.equal(worn.lastWorn, '2026-11-17');
  assert.equal(worn.wearCount, 1);

  const updatedAt = new Date('2026-11-18T01:00:00.000Z');
  const updated = await saveItem(port, {
    id: 'id-1',
    name: 'Olive shirt',
    category: 'Tops',
    price: '12.5',
    favorite: false,
    wearCount: 50,
    lastWorn: ''
  }, { now: updatedAt, newId: () => 'should-not-be-used' });

  assert.equal(updated.success, true);
  loaded = await loadWardrobe(port);
  assert.equal(loaded.items.length, 1);
  assert.equal(loaded.items[0].name, 'Olive shirt');
  assert.equal(loaded.items[0].wearCount, 1);
  assert.equal(loaded.items[0].lastWorn, '2026-11-17');
  assert.equal(loaded.items[0].price, 12.5);
  assert.equal(loaded.items[0].favorite, false);
  const createdIndex = HEADERS.indexOf('createdAt');
  assert.equal(port.snapshot().rows[0][createdIndex], createdAt);
  assert.equal(port.snapshot().rows[0][HEADERS.indexOf('updatedAt')], updatedAt);
});

test('new rows are returned newest first and blank ids are ignored', async () => {
  const port = portWith([['old', 'Old coat', 'Outerwear', '', '', '', 10, '', '', '', false, '', 0, '', '']]);
  await saveItem(port, { name: 'New hat', category: 'Accessories', price: 8 }, { newId: () => 'new' });
  const loaded = await loadWardrobe(port);
  assert.deepEqual(loaded.items.map(item => item.id), ['new', 'old']);
});

test('photos upload, clear, or stay, and a failed upload does not write the row', async () => {
  const port = portWith([['id-1', 'Coat', 'Outerwear', '', '', '', 10, '', 'https://example.com/old.jpg', '', false, '', 2, 'c', 'u']]);
  const replaced = await saveItem(port, { id: 'id-1', name: 'Coat', imageDataUrl: jpeg, clearImage: true });
  assert.equal(replaced.imageShared, false);
  assert.equal(port.uploads.length, 1);
  assert.equal(port.permissionCalls.length, 0);
  assert.match(port.snapshot().rows[0][HEADERS.indexOf('imageUrl')], /^https:\/\/drive\.google\.com\/uc\?export=view&id=/);

  await saveItem(port, { id: 'id-1', name: 'Coat', clearImage: 'true' });
  assert.equal(port.snapshot().rows[0][HEADERS.indexOf('imageUrl')], '');

  await saveItem(port, { id: 'id-1', name: 'Coat', imageUrl: 'https://example.com/manual.jpg' });
  assert.equal(port.snapshot().rows[0][HEADERS.indexOf('imageUrl')], 'https://example.com/manual.jpg');

  const failing = portWith();
  failing.uploadImage = async () => {
    throw Object.assign(new Error('upload failed'), { kind: 'permission' });
  };
  await assert.rejects(() => saveItem(failing, { name: 'Nope', imageDataUrl: jpeg }));
  assert.equal(failing.snapshot().rows.length, 0);

  await assert.rejects(() => saveItem(portWith(), { name: 'Nope', imageDataUrl: 'data:image/gif;base64,aaaa' }), /WebP/);
  await assert.rejects(() => saveItem(portWith(), { name: '   ' }), /衣服名稱/);
  await assert.rejects(() => saveItem(portWith(), null), /格式不正確/);
});

test('a rejected sheet write does not report success or add a second row', async () => {
  const port = portWith();
  port.appendDataRow = async () => {
    throw Object.assign(new Error('write failed'), { kind: 'network' });
  };
  await assert.rejects(() => saveItem(port, { name: 'Coat' }));
  assert.equal(port.snapshot().rows.length, 0);
});

test('markWorn serializes in one tab and does not touch other columns', async () => {
  const port = portWith([['id-1', 'Coat', 'Outerwear', 'Brand', 'Sand', 'M', 10, '2024-01-02', '', 'note', false, '', 0, 'created', 'updated']]);
  const [first, second] = await Promise.all([
    markWorn(port, 'id-1', { now: new Date('2026-11-16T01:00:00.000Z') }),
    markWorn(port, 'id-1', { now: new Date('2026-11-16T01:00:00.000Z') })
  ]);
  assert.deepEqual([first.wearCount, second.wearCount].sort(), [1, 2]);
  const row = port.snapshot().rows[0];
  assert.equal(row[HEADERS.indexOf('wearCount')], 2);
  assert.equal(row[HEADERS.indexOf('name')], 'Coat');
  assert.equal(row[HEADERS.indexOf('notes')], 'note');
  await assert.rejects(() => markWorn(port, ''), /缺少衣服 ID/);
  await assert.rejects(() => markWorn(port, 'missing'), /找不到這件衣服/);
  await assert.rejects(() => markWorn(portWith(), 'id-1'), /沒有衣服資料/);
});

test('link sharing is explicit and missing folders do not fall back to another folder', async () => {
  const shared = createMemoryPort({ shareWithLink: true, folderId: 'folder-a' });
  const saved = await saveItem(shared, { name: 'Coat', imageDataUrl: jpeg });
  assert.equal(saved.imageShared, true);
  assert.equal(shared.permissionCalls.length, 1);
  assert.equal(shared.uploads[0].folderId, 'folder-a');

  const missing = createMemoryPort({ folderId: '' });
  await assert.rejects(() => saveItem(missing, { name: 'Coat', imageDataUrl: jpeg }));
  assert.equal(missing.snapshot().rows.length, 0);
  assert.equal(missing.uploads.length, 0);
});
