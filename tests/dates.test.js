import { describe, expect, it } from 'vitest';
import {
  formatDateOnly,
  formatStoredTimestamp,
  formatTimestamp,
  offsetFor,
  todayYmd,
} from '../src/lib/dates.js';

const serialFor = (year, month, day) => (
  Date.UTC(year, month - 1, day) - Date.UTC(1899, 11, 30)
) / 86400000;

describe('dates', () => {
  it('formats Singapore calendar dates from sheet serials', () => {
    expect(formatDateOnly(serialFor(2024, 3, 1))).toBe('2024-03-01');
    expect(formatDateOnly(serialFor(2026, 11, 16))).toBe('2026-11-16');
  });

  it('uses the Asia/Singapore day when logging wear around midnight UTC', () => {
    expect(todayYmd(new Date('2026-11-15T18:30:00Z'))).toBe('2026-11-16');
    expect(todayYmd(new Date('2026-11-16T16:30:00Z'))).toBe('2026-11-17');
    expect(todayYmd(new Date('2026-11-16T15:30:00Z'))).toBe('2026-11-16');
  });

  it('keeps the Code.gs string fallback of the first 10 characters', () => {
    expect(formatDateOnly('2024-03-01T10:00:00+08:00')).toBe('2024-03-01');
    expect(formatDateOnly('not-a-date-value')).toBe('not-a-date');
    expect(formatDateOnly('')).toBe('');
    expect(formatDateOnly(null)).toBe('');
  });

  it('labels timestamps with the Singapore offset', () => {
    const instant = new Date('2026-11-16T02:00:00Z');
    expect(offsetFor(instant)).toBe('+08:00');
    expect(formatTimestamp(instant)).toBe('2026-11-16T10:00:00+08:00');
    expect(formatStoredTimestamp(serialFor(2024, 3, 1))).toBe('2024-03-01T00:00:00+08:00');
    expect(formatStoredTimestamp('2024-03-01T10:00:00+08:00')).toBe('2024-03-01T10:00:00+08:00');
  });
});
