const SHEETS_EPOCH_MS = Date.UTC(1899, 11, 30);

export function sheetsSerialToUtcDate(serial) {
  const ms = SHEETS_EPOCH_MS + Number(serial) * 86400000;
  return new Date(ms);
}

export function isDateOnlySerial(value) {
  return typeof value === 'number'
    && Number.isFinite(value)
    && Math.abs(value - Math.round(value)) < 1e-6;
}

export function formatYmd(date, timeZone = 'Asia/Singapore') {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const get = type => parts.find(part => part.type === type).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export function offsetFor(date, timeZone = 'Asia/Singapore') {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(date);
  const map = Object.fromEntries(
    parts.filter(part => part.type !== 'literal').map(part => [part.type, part.value])
  );
  const hour = map.hour === '24' ? '00' : map.hour;
  const asUtc = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    Number(hour),
    Number(map.minute),
    Number(map.second)
  );
  const offsetMin = Math.round((asUtc - date.getTime()) / 60000);
  const sign = offsetMin >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMin);
  const hh = String(Math.floor(abs / 60)).padStart(2, '0');
  const mm = String(abs % 60).padStart(2, '0');
  return `${sign}${hh}:${mm}`;
}

export function formatTimestamp(date, timeZone = 'Asia/Singapore') {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(date);
  const map = Object.fromEntries(
    parts.filter(part => part.type !== 'literal').map(part => [part.type, part.value])
  );
  const hour = map.hour === '24' ? '00' : map.hour;
  return `${map.year}-${map.month}-${map.day}T${hour}:${map.minute}:${map.second}${offsetFor(date, timeZone)}`;
}

function pad(value) {
  return String(value).padStart(2, '0');
}

/**
 * Spreadsheet serials are wall-clock values in the sheet timezone.
 * Date-only serials become yyyy-MM-dd. Datetime serials keep the wall time
 * and are labeled with the Asia/Singapore offset used by the original script.
 */
export function timestampFromSerial(serial, timeZone = 'Asia/Singapore') {
  const dateOnly = isDateOnlySerial(serial);
  const utc = sheetsSerialToUtcDate(dateOnly ? Math.round(serial) : serial);
  const year = utc.getUTCFullYear();
  const month = pad(utc.getUTCMonth() + 1);
  const day = pad(utc.getUTCDate());
  const hour = dateOnly ? '00' : pad(utc.getUTCHours());
  const minute = dateOnly ? '00' : pad(utc.getUTCMinutes());
  const second = dateOnly ? '00' : pad(utc.getUTCSeconds());
  const probe = new Date(Date.UTC(year, Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second)));
  const offset = timeZone === 'Asia/Singapore' ? '+08:00' : offsetFor(probe, timeZone);
  return `${year}-${month}-${day}T${hour}:${minute}:${second}${offset}`;
}

/** Same contract as Code.gs formatDate_ for purchaseDate and lastWorn. */
export function formatDateOnly(value, timeZone = 'Asia/Singapore') {
  if (value == null || value === '') return '';

  if (typeof value === 'number' && Number.isFinite(value)) {
    const utc = sheetsSerialToUtcDate(isDateOnlySerial(value) ? Math.round(value) : value);
    if (isDateOnlySerial(value)) {
      return `${utc.getUTCFullYear()}-${pad(utc.getUTCMonth() + 1)}-${pad(utc.getUTCDate())}`;
    }
    return formatYmd(utc, timeZone);
  }

  if (Object.prototype.toString.call(value) === '[object Date]') {
    if (Number.isNaN(value.getTime())) return '';
    return formatYmd(value, timeZone);
  }

  return String(value).slice(0, 10);
}

export function formatStoredTimestamp(value, timeZone = 'Asia/Singapore') {
  if (value == null || value === '') return '';
  if (typeof value === 'number' && Number.isFinite(value)) {
    return timestampFromSerial(value, timeZone);
  }
  if (Object.prototype.toString.call(value) === '[object Date]') {
    if (Number.isNaN(value.getTime())) return '';
    return formatTimestamp(value, timeZone);
  }
  return String(value);
}

export function todayYmd(now = new Date(), timeZone = 'Asia/Singapore') {
  return formatYmd(now, timeZone);
}
