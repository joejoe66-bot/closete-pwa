import { CURRENCY, HEADERS } from './constants.js';
import { formatDate } from './dates.js';

export function isFavorite(value) {
  return value === true || String(value).toLowerCase() === 'true';
}

export function rowToItem(headers, row, { currency = CURRENCY, timeZone } = {}) {
  const item = {};
  headers.forEach((header, index) => {
    item[header] = row[index];
  });

  item.id = String(item.id || '');
  item.price = Number(item.price || 0);
  item.wearCount = Number(item.wearCount || 0);
  item.favorite = isFavorite(item.favorite);
  item.purchaseDate = formatDate(item.purchaseDate, timeZone);
  item.lastWorn = formatDate(item.lastWorn, timeZone);
  item.currency = currency;
  return item;
}

export function mapRows(headers, rows) {
  const idIndex = headers.indexOf('id');
  if (idIndex < 0) return [];
  return rows
    .filter(row => row[idIndex])
    .map(row => rowToItem(headers, row))
    .reverse();
}

export function findRowIndex(rows, headers, id) {
  if (!id) return -1;
  const idIndex = headers.indexOf('id');
  if (idIndex < 0) return -1;
  return rows.findIndex(row => String(row[idIndex] ?? '') === String(id));
}

export function valuesForHeaders(headers, record) {
  return headers.map(header => {
    if (header === 'purchaseDate' || header === 'lastWorn') {
      return record[header] || '';
    }
    return record[header] !== undefined ? record[header] : '';
  });
}

export function normalizePrice(value) {
  const number = Number(value || 0);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, number);
}

export function headerCompletion(currentHeaders) {
  const headers = currentHeaders.map(header => String(header ?? ''));
  const added = [];
  for (const header of HEADERS) {
    if (!headers.includes(header)) {
      headers.push(header);
      added.push(header);
    }
  }
  return { headers, added };
}

export { HEADERS };
