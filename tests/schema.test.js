import test from 'node:test';
import assert from 'node:assert/strict';
import { CURRENCY, HEADERS, TIMEZONE } from '../src/constants.js';
import { formatDate, sheetsSerialToUtcDate, todayString } from '../src/dates.js';
import { formatMoney } from '../src/money.js';
import {
  driveFileIdFromUrl,
  imageUrlForFileId,
  parseImageDataUrl,
  safeFileName,
  safeImageSrc
} from '../src/images.js';
import { MAX_IMAGE_BYTES } from '../src/constants.js';
import { headerCompletion, mapRows, rowToItem, valuesForHeaders } from '../src/schema.js';

test('row mapping matches the Apps Script field rules and S$ currency', () => {
  const serial = (Date.UTC(2026, 10, 16) - Date.UTC(1899, 11, 30)) / 86400000;
  const item = rowToItem(HEADERS, [
    42,
    'Linen shirt',
    'Tops',
    'Uniqlo',
    'Olive',
    'M',
    '19.5',
    serial,
    'https://example.com/a.jpg',
    'Soft',
    'TRUE',
    '2026-01-03',
    '3',
    '2024-04-02T00:00:00.000Z',
    '2026-01-03T00:00:00.000Z'
  ]);

  assert.equal(item.id, '42');
  assert.equal(item.price, 19.5);
  assert.equal(item.wearCount, 3);
  assert.equal(item.favorite, true);
  assert.equal(item.purchaseDate, '2026-11-16');
  assert.equal(item.lastWorn, '2026-01-03');
  assert.equal(item.currency, CURRENCY);
  assert.equal(item.currency, 'S$');
  assert.equal(formatMoney(item.price, item.currency), 'S$ 19.50');
  assert.equal(formatDate(sheetsSerialToUtcDate(serial), 'UTC'), '2026-11-16');
});

test('dates use the Asia/Singapore fallback near midnight UTC', () => {
  const instant = new Date('2026-11-16T20:00:00.000Z');
  assert.equal(TIMEZONE, 'Asia/Singapore');
  assert.equal(todayString(instant, TIMEZONE), '2026-11-17');
  assert.equal(todayString(instant, 'UTC'), '2026-11-16');
  assert.equal(formatDate('', TIMEZONE), '');
  assert.equal(formatDate('2024-05-01T10:00:00.000Z', TIMEZONE), '2024-05-01');
});

test('blank ids are dropped and surviving rows are reversed', () => {
  const rows = [
    ['a', 'First', 'Tops', '', '', '', 1, '', '', '', false, '', 0, '', ''],
    ['', 'Skip', 'Tops', '', '', '', 1, '', '', '', false, '', 0, '', ''],
    ['b', 'Second', 'Shoes', '', '', '', 2, '', '', '', false, '', 0, '', '']
  ];
  const items = mapRows(HEADERS, rows);
  assert.deepEqual(items.map(item => item.id), ['b', 'a']);
});

test('header completion adds missing columns without dropping existing ones', () => {
  const { headers, added } = headerCompletion(['id', 'name', 'extra']);
  assert.deepEqual(added, HEADERS.filter(header => header !== 'id' && header !== 'name'));
  assert.equal(headers[0], 'id');
  assert.equal(headers[2], 'extra');
  assert.ok(headers.includes('wearCount'));
  const values = valuesForHeaders(headers, { id: 'a', name: 'Coat' });
  assert.equal(values[0], 'a');
  assert.equal(values[2], '');
});

test('image data urls accept jpeg png and webp and reject other types or oversized files', () => {
  const parsed = parseImageDataUrl('data:image/jpeg;base64,aaaa');
  assert.equal(parsed.mimeType, 'image/jpeg');
  assert.equal(parsed.extension, 'jpg');
  assert.equal(parseImageDataUrl('data:image/png;base64,aaaa').extension, 'png');
  assert.equal(parseImageDataUrl('data:image/webp;base64,aaaa').extension, 'webp');
  assert.throws(() => parseImageDataUrl('data:image/gif;base64,aaaa'), /JPG、PNG 或 WebP/);
  const tooLong = 'A'.repeat(Math.ceil((MAX_IMAGE_BYTES + 3) / 3) * 4);
  assert.throws(() => parseImageDataUrl(`data:image/jpeg;base64,${tooLong}`), /太大/);
});

test('drive urls and filenames stay compatible with the original sheet column', () => {
  assert.equal(imageUrlForFileId('abc_123'), 'https://drive.google.com/uc?export=view&id=abc_123');
  assert.equal(driveFileIdFromUrl('https://drive.google.com/uc?export=view&id=abc_123'), 'abc_123');
  assert.equal(driveFileIdFromUrl('https://drive.google.com/file/d/abc_123/view'), 'abc_123');
  assert.equal(safeFileName('a/b:c*name', 'jpg', 5), 'a_b_c_name-5.jpg');
  assert.equal(safeImageSrc('javascript:alert(1)'), '');
  assert.equal(safeImageSrc('https://example.com/a.jpg'), 'https://example.com/a.jpg');
});
