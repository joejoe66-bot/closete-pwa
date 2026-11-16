import { CURRENCY, HEADERS } from './constants.js';
import { formatDateOnly, formatStoredTimestamp } from './dates.js';

export function isFavorite(value) {
  return value === true || String(value).toLowerCase() === 'true';
}

export function assertHeaders(headers) {
  if (!Array.isArray(headers) || headers.length < HEADERS.length) {
    const error = new Error(
      'Wardrobe headers do not match the confirmed schema. Nothing was written.'
    );
    error.code = 'HEADER_MISMATCH';
    throw error;
  }
  for (let index = 0; index < HEADERS.length; index += 1) {
    const actual = String(headers[index] ?? '').trim();
    if (actual !== HEADERS[index]) {
      const error = new Error(
        `Unexpected header in column ${index + 1}: expected "${HEADERS[index]}", found "${actual}". Nothing was written.`
      );
      error.code = 'HEADER_MISMATCH';
      throw error;
    }
  }
}

export function assertSpreadsheetShape(meta, { sheetName, sheetId }) {
  const sheets = meta?.sheets || [];
  const found = sheets.find(sheet => sheet?.properties?.title === sheetName);
  if (!found) {
    const error = new Error(
      `This spreadsheet has no "${sheetName}" tab. Nothing was read or written.`
    );
    error.code = 'SHEET_MISMATCH';
    throw error;
  }
  if (Number(found.properties.sheetId) !== Number(sheetId)) {
    const error = new Error(
      `The "${sheetName}" tab is not the confirmed sheet. Nothing was read or written.`
    );
    error.code = 'SHEET_MISMATCH';
    throw error;
  }
  return found.properties;
}

export function rowToItem(headers, row, { currency = CURRENCY, timeZone } = {}) {
  const item = {};
  headers.forEach((header, index) => {
    if (!header) return;
    item[header] = row[index];
  });

  item.id = String(item.id || '');
  item.name = item.name == null ? '' : String(item.name);
  item.category = item.category == null ? '' : String(item.category);
  item.brand = item.brand == null ? '' : String(item.brand);
  item.color = item.color == null ? '' : String(item.color);
  item.size = item.size == null ? '' : String(item.size);
  item.imageUrl = item.imageUrl == null ? '' : String(item.imageUrl);
  item.notes = item.notes == null ? '' : String(item.notes);
  item.price = Number(item.price || 0);
  item.wearCount = Number(item.wearCount || 0);
  item.favorite = isFavorite(item.favorite);
  item.purchaseDate = formatDateOnly(item.purchaseDate, timeZone);
  item.lastWorn = formatDateOnly(item.lastWorn, timeZone);
  item.createdAt = formatStoredTimestamp(item.createdAt, timeZone);
  item.updatedAt = formatStoredTimestamp(item.updatedAt, timeZone);
  item.currency = currency;
  return item;
}

export function recordToRow(record) {
  return HEADERS.map(header => (record[header] !== undefined ? record[header] : ''));
}
