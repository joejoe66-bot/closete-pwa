import { WardrobeError } from './errors.js';

export const CONFIG_STORAGE_KEY = 'closete.publicConfig.v1';

const CLIENT_ID = /^[0-9]+-[a-z0-9-]+\.apps\.googleusercontent\.com$/i;
const GOOGLE_ID = /^[a-zA-Z0-9-_]{10,}$/;
const SECRET_KEYS = ['accessToken', 'access_token', 'refresh_token', 'client_secret', 'clientSecret', 'id_token', 'token'];

export function emptyConfig() {
  return {
    clientId: '',
    spreadsheetId: '',
    folderId: '',
    shareWithLink: false
  };
}

export function extractSpreadsheetId(input) {
  const value = String(input || '').trim();
  const match = value.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : value;
}

export function extractFolderId(input) {
  const value = String(input || '').trim();
  const folder = value.match(/\/folders\/([a-zA-Z0-9-_]+)/);
  if (folder) return folder[1];
  if (/drive\.google\.com/i.test(value)) {
    const id = value.match(/[?&]id=([a-zA-Z0-9-_]+)/);
    if (id) return id[1];
  }
  return value;
}

export function sanitizeConfigValues(input = {}) {
  return {
    clientId: String(input.clientId || '').trim(),
    spreadsheetId: extractSpreadsheetId(input.spreadsheetId),
    folderId: extractFolderId(input.folderId),
    shareWithLink: input.shareWithLink === true || String(input.shareWithLink).toLowerCase() === 'true'
  };
}

export function validateConfig(input) {
  const value = sanitizeConfigValues(input);
  const errors = {};
  const missing = [];

  if (!value.clientId) {
    errors.clientId = 'OAuth client ID is required to sign in.';
    missing.push('OAuth client ID');
  } else if (/secret|private_key|service_account/i.test(value.clientId)) {
    errors.clientId = 'Paste the public OAuth client ID only. A client secret is not used and must not be stored.';
  } else if (!CLIENT_ID.test(value.clientId)) {
    errors.clientId = 'Client ID should look like 123-abc.apps.googleusercontent.com.';
  }

  if (!value.spreadsheetId) {
    errors.spreadsheetId = 'Spreadsheet ID is required to open your wardrobe.';
    missing.push('spreadsheet ID');
  } else if (!GOOGLE_ID.test(value.spreadsheetId)) {
    errors.spreadsheetId = 'That does not look like a Google spreadsheet ID.';
  }

  if (value.folderId && !GOOGLE_ID.test(value.folderId)) {
    errors.folderId = 'That does not look like a Drive folder ID.';
  }

  return {
    ok: Object.keys(errors).length === 0,
    errors,
    missing,
    value
  };
}

function assertNoSecrets(saved) {
  for (const key of SECRET_KEYS) {
    if (Object.prototype.hasOwnProperty.call(saved, key)) {
      throw new WardrobeError('Refusing to store a token or client secret on this device.', 'validation');
    }
  }
}

export function writeConfig(storage, input) {
  const clean = sanitizeConfigValues(input);
  assertNoSecrets(clean);
  storage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(clean));
  const saved = JSON.parse(storage.getItem(CONFIG_STORAGE_KEY));
  assertNoSecrets(saved);
  return saved;
}

export function readConfig(storage) {
  const raw = storage.getItem(CONFIG_STORAGE_KEY);
  if (!raw) return emptyConfig();
  try {
    const parsed = JSON.parse(raw);
    const clean = sanitizeConfigValues(parsed);
    if (JSON.stringify(parsed) !== JSON.stringify(clean)) {
      storage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(clean));
    }
    return clean;
  } catch {
    return emptyConfig();
  }
}

export function configStoreMessage(validation) {
  if (!validation.ok) {
    const missing = validation.missing.length
      ? `Still missing ${validation.missing.join(' and ')}. `
      : 'Fix the highlighted fields. ';
    return `${missing}What could be kept is on this device only. Not connected to Google.`;
  }
  const folder = validation.value.folderId
    ? 'Folder ID stored.'
    : 'No photo folder yet.';
  return `IDs stored on this device only. ${folder} Not connected until Sign in reads the sheet successfully.`;
}
