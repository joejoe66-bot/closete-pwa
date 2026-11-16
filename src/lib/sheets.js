import { HEADERS } from './constants.js';
import { publicError } from './errors.js';
import { sanitizeRow } from './formula.js';
import { assertHeaders, assertSpreadsheetShape, recordToRow, rowToItem } from './schema.js';
import { buildRecord, nextWear, requireName, resolveImageAction } from './wardrobe.js';

export function columnLetter(index) {
  let number = index + 1;
  let letters = '';
  while (number > 0) {
    const remainder = (number - 1) % 26;
    letters = String.fromCharCode(65 + remainder) + letters;
    number = Math.floor((number - 1) / 26);
  }
  return letters;
}

function rangeUrl(spreadsheetId, range, query = '') {
  const encoded = encodeURIComponent(range);
  return `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encoded}${query}`;
}

export function createSheetsClient({
  fetchImpl,
  getToken,
  spreadsheetId,
  sheetName,
  sheetId,
  timeZone,
  currency,
  drive,
  now = () => new Date(),
  newId = () => (globalThis.crypto?.randomUUID
    ? globalThis.crypto.randomUUID()
    : `closete-${Date.now()}-${Math.random().toString(16).slice(2)}`),
}) {
  async function request(url, options = {}) {
    const token = getToken();
    if (!token) {
      const error = new Error('Sign in with Google before opening your wardrobe.');
      error.code = 'AUTH';
      throw error;
    }
    const headers = {
      Authorization: `Bearer ${token}`,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
    };
    const response = await fetchImpl(url, { ...options, headers });
    const text = await response.text();
    if (!response.ok) {
      const error = new Error(
        `Google Sheets request failed (${response.status}). ${publicError(text) || 'Check that this Google account can edit the wardrobe spreadsheet.'}`
      );
      error.code = response.status === 401 || response.status === 403 ? 'AUTH' : 'SHEETS';
      error.status = response.status;
      throw error;
    }
    return text ? JSON.parse(text) : {};
  }

  async function assertMeta() {
    const meta = await request(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=properties.title,sheets(properties(sheetId,title))`
    );
    assertSpreadsheetShape(meta, { sheetName, sheetId });
    return meta;
  }

  async function readTable() {
    await assertMeta();
    const data = await request(
      rangeUrl(
        spreadsheetId,
        `${sheetName}!A1:O`,
        '?valueRenderOption=UNFORMATTED_VALUE'
      )
    );
    const values = data.values || [];
    if (!values.length) {
      const error = new Error('The Wardrobe tab has no header row. Nothing was written.');
      error.code = 'HEADER_MISMATCH';
      throw error;
    }
    assertHeaders(values[0]);
    const byId = new Map();
    const items = [];
    for (let index = 1; index < values.length; index += 1) {
      const row = values[index] || [];
      const item = rowToItem(HEADERS, row, { currency, timeZone });
      if (!item.id) continue;
      item.rowNumber = index + 1;
      byId.set(item.id, item);
      items.push(item);
    }
    return { items: items.reverse(), byId };
  }

  function publicItem(item) {
    const copy = { ...item };
    delete copy.rowNumber;
    return copy;
  }

  return {
    assertMeta,
    async listItems() {
      const table = await readTable();
      return table.items.map(publicItem);
    },

    async saveItem(item) {
      requireName(item);
      const table = await readTable();
      const existing = item?.id ? table.byId.get(String(item.id)) : null;
      const imageAction = resolveImageAction(item);
      let imageUrl = imageAction.imageUrl || '';
      if (imageAction.action === 'upload') {
        if (!drive) {
          const error = new Error('Photo upload is unavailable. Nothing was written.');
          error.code = 'DRIVE';
          throw error;
        }
        const uploaded = await drive.uploadImage({
          dataUrl: imageAction.dataUrl,
          itemName: item.name,
          folderId: item.folderId,
          nowMs: now().getTime(),
        });
        imageUrl = uploaded.imageUrl;
      }
      const record = buildRecord({
        item,
        existing: existing || null,
        now: now(),
        imageUrl,
        newId: newId(),
        timeZone,
      });
      const safe = sanitizeRow(recordToRow(record));
      if (existing) {
        await request(
          rangeUrl(
            spreadsheetId,
            `${sheetName}!A${existing.rowNumber}:O${existing.rowNumber}`,
            '?valueInputOption=RAW'
          ),
          { method: 'PUT', body: JSON.stringify({ values: [safe] }) }
        );
      } else {
        await request(
          rangeUrl(
            spreadsheetId,
            `${sheetName}!A1:O1`,
            ':append?valueInputOption=RAW&insertDataOption=INSERT_ROWS'
          ),
          { method: 'POST', body: JSON.stringify({ values: [safe] }) }
        );
      }
      return { success: true, id: record.id, message: 'Piece saved to your wardrobe.' };
    },

    async markWorn(id) {
      if (!id) {
        const error = new Error('Missing clothing id.');
        error.code = 'ID_REQUIRED';
        throw error;
      }
      const table = await readTable();
      if (table.byId.size === 0) {
        const error = new Error('The wardrobe has no pieces yet.');
        error.code = 'EMPTY';
        throw error;
      }
      const existing = table.byId.get(String(id));
      if (!existing) {
        const error = new Error('That piece could not be found.');
        error.code = 'NOT_FOUND';
        throw error;
      }
      const next = nextWear(existing, now(), timeZone);
      const updates = [
        ['lastWorn', next.lastWorn],
        ['wearCount', next.wearCount],
        ['updatedAt', next.updatedAt],
      ];
      await request(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`,
        {
          method: 'POST',
          body: JSON.stringify({
            valueInputOption: 'RAW',
            data: updates.map(([header, value]) => ({
              range: `${sheetName}!${columnLetter(HEADERS.indexOf(header))}${existing.rowNumber}`,
              values: [[sanitizeRow([value])[0]]],
            })),
          }),
        }
      );
      return { success: true, ...next };
    },
  };
}
