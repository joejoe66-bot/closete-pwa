import { describe, expect, it } from 'vitest';
import { sanitizeCell, sanitizeRow } from '../src/lib/formula.js';

describe('formula safety', () => {
  it('prefixes formula-like text and leaves real numbers and booleans alone', () => {
    expect(sanitizeCell('=HYPERLINK("http://example.test")')).toBe('\'=HYPERLINK("http://example.test")');
    expect(sanitizeCell('+1')).toBe("'+1");
    expect(sanitizeCell('-cmd')).toBe("'-cmd");
    expect(sanitizeCell('@sum')).toBe("'@sum");
    expect(sanitizeCell('\t=1')).toBe("'\t=1");
    expect(sanitizeCell('linen')).toBe('linen');
    expect(sanitizeCell(12.5)).toBe(12.5);
    expect(sanitizeCell(false)).toBe(false);
    expect(sanitizeCell(true)).toBe(true);
    expect(sanitizeCell('')).toBe('');
    expect(sanitizeCell(null)).toBe('');
    expect(sanitizeRow(['=1+1', 4, false])).toEqual(["'=1+1", 4, false]);
  });
});
