import { DRIVE_FOLDER_NAME, HEADERS, SHEET_NAME } from './constants.js';
import { WardrobeError, classifyHttpStatus } from './errors.js';
import { headerCompletion } from './schema.js';
import { imageUrlForFileId, parseImageDataUrl, safeFileName } from './images.js';

const SHEETS_ROOT = 'https://sheets.googleapis.com';
const DRIVE_ROOT = 'https://www.googleapis.com';

export function columnLetter(n) {
  let value = n;
  let letters = '';
  while (value > 0) {
    const remainder = (value - 1) % 26;
    letters = String.fromCharCode(65 + remainder) + letters;
    value = Math.floor((value - 1) / 26);
  }
  return letters;
}

function failure(kind, message) {
  return new WardrobeError(message, kind);
}

function startTimeout(timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  if (typeof timer.unref === 'function') timer.unref();
  return {
    signal: controller.signal,
    done() { clearTimeout(timer); }
  };
}

async function request(fetchImpl, url, { token, method = 'GET', body, timeoutMs = 30000 } = {}) {
  const timer = startTimeout(timeoutMs);
  let response;
  try {
    response = await fetchImpl(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body ? { 'Content-Type': 'application/json' } : {})
      },
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      signal: timer.signal
    });
  } catch (error) {
    const timedOut = error?.name === 'TimeoutError' || error?.name === 'AbortError';
    throw failure(
      'offline',
      timedOut
        ? 'The Google request timed out. Nothing was confirmed.'
        : 'You are offline or Google could not be reached. Nothing was confirmed.'
    );
  } finally {
    timer.done();
  }

  const text = await response.text();
  if (!response.ok) {
    const classified = classifyHttpStatus(response.status, text);
    throw failure(classified.kind, classified.message);
  }
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw failure('network', 'Google returned a response that could not be read. Nothing was confirmed.');
  }
}

function requireToken(getSession) {
  const session = getSession();
  if (session?.state === 'expired') {
    throw failure('expired', 'Your Google sign-in expired.');
  }
  if (!session?.token || session.state !== 'active') {
    throw failure('signed-out', 'Sign in again before using Google.');
  }
  return session.token;
}

function sheetUrl(spreadsheetId, suffix) {
  return `${SHEETS_ROOT}/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}${suffix}`;
}

async function writeHeaderRow(fetchImpl, token, spreadsheetId, headers) {
  const end = columnLetter(headers.length);
  await request(
    fetchImpl,
    `${sheetUrl(spreadsheetId, `/values/${encodeURIComponent(`${SHEET_NAME}!A1:${end}1`)}?valueInputOption=RAW`)}`,
    { token, method: 'PUT', body: { values: [headers] } }
  );
}

export function createGooglePort({ fetchImpl = fetch, getSession, getConfig }) {
  let chain = Promise.resolve();

  function withLock(fn) {
    const run = chain.then(() => fn());
    chain = run.then(() => undefined, () => undefined);
    return run;
  }

  async function readTable() {
    const token = requireToken(getSession);
    const { spreadsheetId } = getConfig();
    if (!spreadsheetId) throw failure('not-found', 'Spreadsheet ID is missing.');

    const meta = await request(
      fetchImpl,
      sheetUrl(spreadsheetId, '?fields=sheets.properties(title)'),
      { token }
    );
    const sheets = meta.sheets || [];
    const exists = sheets.some(sheet => sheet.properties?.title === SHEET_NAME);
    if (!exists) {
      await request(fetchImpl, sheetUrl(spreadsheetId, ':batchUpdate'), {
        token,
        method: 'POST',
        body: {
          requests: [{
            addSheet: {
              properties: {
                title: SHEET_NAME,
                gridProperties: { frozenRowCount: 1 }
              }
            }
          }]
        }
      });
      await writeHeaderRow(fetchImpl, token, spreadsheetId, HEADERS);
      return { headers: [...HEADERS], rows: [], createdSheet: true, addedHeaders: [] };
    }

    const data = await request(
      fetchImpl,
      sheetUrl(
        spreadsheetId,
        `/values/${encodeURIComponent(SHEET_NAME)}?valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=SERIAL_NUMBER`
      ),
      { token }
    );
    const values = data.values || [];
    if (!values.length) {
      await writeHeaderRow(fetchImpl, token, spreadsheetId, HEADERS);
      return { headers: [...HEADERS], rows: [], createdSheet: false, addedHeaders: [...HEADERS] };
    }

    const completed = headerCompletion(values[0]);
    if (completed.added.length) {
      await writeHeaderRow(fetchImpl, token, spreadsheetId, completed.headers);
    }
    const rows = values.slice(1).map(row => {
      const copy = row.slice();
      while (copy.length < completed.headers.length) copy.push('');
      return copy;
    });
    return {
      headers: completed.headers,
      rows,
      createdSheet: false,
      addedHeaders: completed.added
    };
  }

  async function writeDataRow(index, values) {
    const token = requireToken(getSession);
    const { spreadsheetId } = getConfig();
    const rowNumber = index + 2;
    const end = columnLetter(values.length);
    const cells = values.map(cellForSheet);
    await request(
      fetchImpl,
      sheetUrl(
        spreadsheetId,
        `/values/${encodeURIComponent(`${SHEET_NAME}!A${rowNumber}:${end}${rowNumber}`)}?valueInputOption=RAW`
      ),
      { token, method: 'PUT', body: { values: [cells] } }
    );
  }

  async function appendDataRow(values) {
    const token = requireToken(getSession);
    const { spreadsheetId } = getConfig();
    const cells = values.map(cellForSheet);
    await request(
      fetchImpl,
      sheetUrl(
        spreadsheetId,
        `/values/${encodeURIComponent(`${SHEET_NAME}!A1`)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`
      ),
      { token, method: 'POST', body: { values: [cells] } }
    );
  }

  async function uploadImage(dataUrl, itemName) {
    const token = requireToken(getSession);
    const config = getConfig();
    if (!config.folderId) {
      throw failure('missing-folder', 'No Drive folder is configured.');
    }
    const parsed = parseImageDataUrl(dataUrl);
    const filename = safeFileName(itemName, parsed.extension, Date.now());
    const metadata = {
      name: filename,
      parents: [config.folderId],
      mimeType: parsed.mimeType
    };
    const boundary = `closete_${crypto.randomUUID()}`;
    const body = [
      `--${boundary}`,
      'Content-Type: application/json; charset=UTF-8',
      '',
      JSON.stringify(metadata),
      `--${boundary}`,
      `Content-Type: ${parsed.mimeType}`,
      'Content-Transfer-Encoding: base64',
      '',
      parsed.base64,
      `--${boundary}--`,
      ''
    ].join('\r\n');

    const timer = startTimeout(30000);
    let response;
    try {
      response = await fetchImpl(
        `${DRIVE_ROOT}/upload/drive/v3/files?uploadType=multipart&fields=id`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': `multipart/related; boundary=${boundary}`
          },
          body,
          cache: 'no-store',
          credentials: 'omit',
          referrerPolicy: 'no-referrer',
          signal: timer.signal
        }
      );
    } catch {
      throw failure('offline', 'You are offline or Google could not be reached. The photo was not uploaded.');
    } finally {
      timer.done();
    }
    const text = await response.text();
    if (!response.ok) {
      const classified = classifyHttpStatus(response.status, text);
      throw failure(classified.kind, classified.message);
    }
    const created = JSON.parse(text);
    if (!created.id) throw failure('network', 'Drive did not return a file id. The piece was not saved.');

    let shared = false;
    if (config.shareWithLink) {
      await request(fetchImpl, `${DRIVE_ROOT}/drive/v3/files/${encodeURIComponent(created.id)}/permissions`, {
        token,
        method: 'POST',
        body: { role: 'reader', type: 'anyone' }
      });
      shared = true;
    }

    return {
      url: imageUrlForFileId(created.id),
      fileId: created.id,
      shared
    };
  }

  return { withLock, readTable, writeDataRow, appendDataRow, uploadImage };
}

export async function createWardrobeFolder({ fetchImpl = fetch, getSession }) {
  const token = requireToken(getSession);
  const created = await request(fetchImpl, `${DRIVE_ROOT}/drive/v3/files?fields=id,name`, {
    token,
    method: 'POST',
    body: {
      name: DRIVE_FOLDER_NAME,
      mimeType: 'application/vnd.google-apps.folder'
    }
  });
  if (!created.id) throw failure('network', 'Drive did not return a folder id. No folder was stored.');
  return { id: created.id, name: created.name || DRIVE_FOLDER_NAME, shared: false };
}

function cellForSheet(value) {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'boolean' || typeof value === 'number') return value;
  if (value === null || value === undefined) return '';
  return String(value);
}
