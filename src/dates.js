import { TIMEZONE } from './constants.js';

const SHEETS_EPOCH_MS = Date.UTC(1899, 11, 30);

export function sheetsSerialToUtcDate(serial) {
  return new Date(SHEETS_EPOCH_MS + serial * 86400000);
}

export function formatYmd(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);
  const part = type => parts.find(item => item.type === type)?.value || '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

/**
 * Match Apps Script formatDate_: Date -> yyyy-MM-dd in the script timezone,
 * otherwise the first 10 characters. Sheet serials are treated as the
 * calendar date stored in the cell (UTC wall clock), which matches date-only
 * values written by the original app.
 */
export function formatDate(value, timeZone = TIMEZONE) {
  if (value === null || value === undefined || value === '') return '';

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return '';
    return formatYmd(value, timeZone);
  }

  if (typeof value === 'number' && Number.isFinite(value) && value > 20000 && value < 80000) {
    return formatYmd(sheetsSerialToUtcDate(value), 'UTC');
  }

  const text = String(value).trim();
  const iso = text.match(/^(\d{4}-\d{2}-\d{2})/);
  if (iso) return iso[1];
  return text.slice(0, 10);
}

export function todayString(now = new Date(), timeZone = TIMEZONE) {
  return formatYmd(now, timeZone);
}
