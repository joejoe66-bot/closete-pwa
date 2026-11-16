import { describe, expect, it } from 'vitest';
import { HEADERS, SHEET_ID, SPREADSHEET_ID } from '../src/lib/constants.js';
import { createSheetsClient } from '../src/lib/sheets.js';
import { createDriveClient } from '../src/lib/drive.js';

const NOW = new Date('2026-11-16T02:00:00Z');
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

function jsonResponse(body, status = 200) {
  const text = JSON.stringify(body);
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => 'application/json' },
    text: async () => text,
    json: async () => JSON.parse(text),
  };
}

function harness(rows, { sheetId = SHEET_ID, drive } = {}) {
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url, options });
    if (url.includes('fields=properties.title')) {
      return jsonResponse({
        properties: { title: 'CLOSETÉ Wardrobe App' },
        sheets: [{ properties: { sheetId, title: 'Wardrobe' } }],
      });
    }
    if (url.includes('/values/') && (!options.method || options.method === 'GET')) {
      return jsonResponse({ values: rows });
    }
    if (url.includes('upload/drive')) {
      return jsonResponse({ id: 'file123', name: 'photo.png', mimeType: 'image/png' });
    }
    if (url.includes(':batchUpdate') || url.includes(':append') || options.method === 'PUT') {
      return jsonResponse({ updated: true });
    }
    return jsonResponse({ error: { message: 'unexpected ' + url } }, 404);
  };
  const client = createSheetsClient({
    fetchImpl,
    getToken: () => 'memory-token',
    spreadsheetId: SPREADSHEET_ID,
    sheetName: 'Wardrobe',
    sheetId: SHEET_ID,
    timeZone: 'Asia/Singapore',
    currency: 'S$',
    drive,
    now: () => NOW,
    newId: () => 'new-id',
  });
  return { client, calls };
}

const sampleRow = [
  'piece-1', 'Linen shirt', 'Tops', 'Uniqlo', 'Olive', 'M', 49,
  '2024-03-01', 'https://example.test/a.jpg', 'soft', true, '2026-10-02', 4,
  '2024-03-01T00:00:00+08:00', '2026-10-02T00:00:00+08:00',
];

describe('sheets adapter', () => {
  it('maps rows, skips blank ids, and shows newest first', async () => {
    const serial = (Date.UTC(2024, 2, 1) - Date.UTC(1899, 11, 30)) / 86400000;
    const older = [...sampleRow];
    older[0] = 'older';
    older[7] = serial;
    older[10] = 'TRUE';
    const blank = [...sampleRow];
    blank[0] = '';
    const { client } = harness([HEADERS, older, sampleRow, blank]);
    const items = await client.listItems();
    expect(items.map(item => item.id)).toEqual(['piece-1', 'older']);
    expect(items[0].currency).toBe('S$');
    expect(items[0].favorite).toBe(true);
    expect(items[0].price).toBe(49);
    expect(items[0].wearCount).toBe(4);
    expect(items[1].purchaseDate).toBe('2024-03-01');
    expect(items[1].favorite).toBe(true);
    expect(items[0].rowNumber).toBeUndefined();
  });

  it('appends a new row with RAW values and refuses formula text', async () => {
    const { client, calls } = harness([HEADERS, sampleRow]);
    const result = await client.saveItem({
      name: 'New coat',
      category: 'Outerwear',
      price: -8,
      notes: '=HYPERLINK("http://example.test")',
      favorite: false,
    });
    expect(result.id).toBe('new-id');
    const write = calls.find(call => call.url.includes(':append'));
    expect(write.options.method).toBe('POST');
    expect(write.url).toContain('valueInputOption=RAW');
    expect(write.url).not.toContain('USER_ENTERED');
    const body = JSON.parse(write.options.body);
    expect(body.values[0][0]).toBe('new-id');
    expect(body.values[0][6]).toBe(0);
    expect(body.values[0][9]).toBe('\'=HYPERLINK("http://example.test")');
    expect(body.values[0][11]).toBe('');
    expect(body.values[0][12]).toBe(0);
    expect(body.values).not.toEqual([HEADERS]);
    expect(calls.some(call => call.options.method === 'PUT')).toBe(false);
  });

  it('updates the matching row and keeps server wear fields', async () => {
    const { client, calls } = harness([HEADERS, sampleRow]);
    await client.saveItem({
      id: 'piece-1',
      name: 'Linen shirt',
      price: 50,
      wearCount: 99,
      lastWorn: '2099-01-01',
      favorite: false,
      imageUrl: 'https://example.test/a.jpg',
    });
    const write = calls.find(call => call.options.method === 'PUT');
    expect(write.url).toContain('Wardrobe!A2%3AO2');
    expect(write.url).toContain('valueInputOption=RAW');
    const body = JSON.parse(write.options.body);
    expect(body.values[0][12]).toBe(4);
    expect(body.values[0][11]).toBe('2026-10-02');
    expect(body.values[0][13]).toBe('2024-03-01T00:00:00+08:00');
    expect(body.values[0][6]).toBe(50);
    expect(calls.some(call => call.url.includes(':append'))).toBe(false);
  });

  it('marks worn on only the wear cells', async () => {
    const { client, calls } = harness([HEADERS, sampleRow]);
    const result = await client.markWorn('piece-1');
    expect(result.wearCount).toBe(5);
    expect(result.lastWorn).toBe('2026-11-16');
    const write = calls.find(call => call.url.includes(':batchUpdate'));
    const body = JSON.parse(write.options.body);
    expect(body.valueInputOption).toBe('RAW');
    expect(body.data.map(entry => entry.range)).toEqual([
      'Wardrobe!L2',
      'Wardrobe!M2',
      'Wardrobe!O2',
    ]);
    expect(body.data[1].values).toEqual([[5]]);
  });

  it('blocks writes when the header, tab, name, or auth is wrong', async () => {
    const badHeader = harness([['id', 'title']]);
    await expect(badHeader.client.saveItem({ name: 'Coat' })).rejects.toThrow(/Nothing was written/);
    expect(badHeader.calls.some(call => call.options.method && call.options.method !== 'GET')).toBe(false);

    const badSheet = harness([HEADERS], { sheetId: 1 });
    await expect(badSheet.client.listItems()).rejects.toThrow(/confirmed sheet/);
    expect(badSheet.calls).toHaveLength(1);

    const missingName = harness([HEADERS]);
    await expect(missingName.client.saveItem({ name: ' ' })).rejects.toThrow(/name/i);
    expect(missingName.calls).toHaveLength(0);

    const signedOut = createSheetsClient({
      fetchImpl: async () => { throw new Error('network should not run'); },
      getToken: () => '',
      spreadsheetId: SPREADSHEET_ID,
      sheetName: 'Wardrobe',
      sheetId: SHEET_ID,
      timeZone: 'Asia/Singapore',
      currency: 'S$',
      now: () => NOW,
      newId: () => 'x',
    });
    await expect(signedOut.listItems()).rejects.toThrow(/Sign in/);

    const empty = harness([HEADERS]);
    await expect(empty.client.markWorn('missing')).rejects.toThrow(/no pieces/i);
    await expect(harness([HEADERS, sampleRow]).client.markWorn('nope')).rejects.toThrow(/could not be found/i);
  });

  it('strips tokens from Google error bodies', async () => {
    const calls = [];
    const fetchImpl = async (url, options = {}) => {
      calls.push({ url, options });
      return jsonResponse({ error: { message: 'bad ya29.SUPERSECRETTOKEN' } }, 403);
    };
    const client = createSheetsClient({
      fetchImpl,
      getToken: () => 'ya29.SUPERSECRETTOKEN',
      spreadsheetId: SPREADSHEET_ID,
      sheetName: 'Wardrobe',
      sheetId: SHEET_ID,
      timeZone: 'Asia/Singapore',
      currency: 'S$',
      now: () => NOW,
      newId: () => 'x',
    });
    await expect(client.listItems()).rejects.toThrow(/\[token\]/);
    await expect(client.listItems()).rejects.not.toThrow(/SUPERSECRETTOKEN/);
  });

  it('uploads a private photo only after a folder is chosen and never shares it', async () => {
    const driveCalls = [];
    const fetchImpl = async (url, options = {}) => {
      driveCalls.push({ url, options });
      if (url.includes('fields=properties.title')) {
        return jsonResponse({
          sheets: [{ properties: { sheetId: SHEET_ID, title: 'Wardrobe' } }],
        });
      }
      if (url.includes('/values/') && (!options.method || options.method === 'GET')) {
        return jsonResponse({ values: [HEADERS] });
      }
      if (url.includes('upload/drive')) {
        return jsonResponse({ id: 'file123', name: 'photo.png', mimeType: 'image/png' });
      }
      if (url.includes(':append')) return jsonResponse({});
      return jsonResponse({}, 404);
    };
    const drive = createDriveClient({ fetchImpl, getToken: () => 'memory-token' });
    const client = createSheetsClient({
      fetchImpl,
      getToken: () => 'memory-token',
      spreadsheetId: SPREADSHEET_ID,
      sheetName: 'Wardrobe',
      sheetId: SHEET_ID,
      timeZone: 'Asia/Singapore',
      currency: 'S$',
      drive,
      now: () => NOW,
      newId: () => 'new-id',
    });

    await expect(client.saveItem({ name: 'Hat', imageDataUrl: PNG })).rejects.toThrow(/folder/i);
    expect(driveCalls.some(call => call.url.includes('upload/drive'))).toBe(false);
    expect(driveCalls.some(call => call.url.includes(':append'))).toBe(false);

    driveCalls.length = 0;
    await client.saveItem({ name: 'Hat', imageDataUrl: PNG, folderId: 'folder-1' });
    const upload = driveCalls.find(call => call.url.includes('upload/drive'));
    expect(upload.url).not.toContain('permissions');
    const text = new TextDecoder().decode(upload.options.body);
    expect(text).toContain('"parents":["folder-1"]');
    expect(text).not.toContain('anyone');
    expect(text).not.toContain('permissions');
    const append = driveCalls.find(call => call.url.includes(':append'));
    const saved = JSON.parse(append.options.body);
    expect(saved.values[0][8]).toBe('https://drive.google.com/file/d/file123/view');
  });
});
