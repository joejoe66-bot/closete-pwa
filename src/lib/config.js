import {
  CURRENCY,
  DRIVE_FOLDER_NAME,
  SCOPES,
  SHEET_ID,
  SHEET_NAME,
  SPREADSHEET_ID,
  TIMEZONE,
} from './constants.js';

const PLACEHOLDER = /^(your-client|changeme|example|todo|replace-me|paste)/i;

export function assessConfig(raw = {}) {
  const clientId = String(raw.CLIENT_ID || raw.clientId || '').trim();
  const spreadsheetId = String(raw.SPREADSHEET_ID || raw.spreadsheetId || SPREADSHEET_ID).trim();
  const sheetName = String(raw.SHEET_NAME || raw.sheetName || SHEET_NAME).trim();
  const sheetId = Number(raw.SHEET_ID || raw.sheetId || SHEET_ID);
  const errors = [];

  if (!clientId) {
    errors.push('OAuth client ID is not set. Google sign-in cannot start.');
  } else if (PLACEHOLDER.test(clientId)) {
    errors.push('OAuth client ID is still a placeholder.');
  } else if (!clientId.endsWith('.apps.googleusercontent.com')) {
    errors.push('OAuth client ID must be a Google web client ending in .apps.googleusercontent.com.');
  }

  if (!spreadsheetId) errors.push('Spreadsheet ID is missing.');
  if (!sheetName) errors.push('Sheet name is missing.');
  if (!Number.isFinite(sheetId)) errors.push('Sheet id is missing.');

  return {
    ok: errors.length === 0,
    errors,
    connected: false,
    clientId,
    spreadsheetId,
    sheetName,
    sheetId,
    currency: raw.CURRENCY || raw.currency || CURRENCY,
    timeZone: raw.TIMEZONE || raw.timeZone || TIMEZONE,
    driveFolderName: raw.DRIVE_FOLDER_NAME || raw.driveFolderName || DRIVE_FOLDER_NAME,
    scopes: SCOPES.slice(),
  };
}
