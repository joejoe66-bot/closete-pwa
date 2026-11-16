const FORMULA_START = /^[=+\-@\t\r]/;

/**
 * Sheets RAW input does not evaluate formulas. A leading apostrophe is still
 * applied so a later paste into a formula-aware cell cannot execute the text.
 */
export function sanitizeCell(value) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }
  if (typeof value === 'boolean') return value;
  if (value == null) return '';
  const text = String(value);
  if (text === '') return '';
  if (FORMULA_START.test(text)) return `'${text}`;
  return text;
}

export function sanitizeRow(values) {
  return values.map(sanitizeCell);
}
