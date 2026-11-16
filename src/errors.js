export class WardrobeError extends Error {
  constructor(message, kind = 'validation') {
    super(message);
    this.name = 'WardrobeError';
    this.kind = kind;
  }
}

export function classifyHttpStatus(status, bodyText = '') {
  let message = '';
  try {
    const json = JSON.parse(bodyText);
    message = json.error?.message || json.message || '';
  } catch {
    message = String(bodyText || '').replace(/\s+/g, ' ').slice(0, 280);
  }

  if (status === 401) {
    return { kind: 'expired', message: message || 'Sign-in expired or was rejected.' };
  }
  if (status === 403) {
    return { kind: 'permission', message: message || 'Permission denied.' };
  }
  if (status === 404) {
    return { kind: 'not-found', message: message || 'The spreadsheet, tab, or file was not found.' };
  }
  if (status === 408 || status === 429 || status >= 500) {
    return { kind: 'network', message: message || `Google request failed (${status}).` };
  }
  return { kind: 'network', message: message || `Google request failed (${status}).` };
}

const KNOWN = {
  '衣服資料格式不正確。': 'The piece could not be read.',
  '請輸入衣服名稱。': 'Enter an item name.',
  '缺少衣服 ID。': 'Missing item id.',
  '衣櫥中沒有衣服資料。': 'There is no wardrobe data.',
  '找不到這件衣服。': 'That piece was not found.',
  '圖片格式不支援，請選擇 JPG、PNG 或 WebP。': 'Use a JPG, PNG, or WebP photo.',
  '圖片仍然太大，請選擇較小的照片。': 'That photo is still too large.'
};

export function userMessage(error, { action = 'save' } = {}) {
  const kind = error?.kind;
  if (kind === 'offline') {
    return action === 'load'
      ? 'You are offline. The wardrobe was not loaded, and nothing is queued to sync.'
      : 'You are offline. Nothing was written to Google.';
  }
  if (kind === 'expired') {
    return action === 'load'
      ? 'Your Google sign-in expired. Sign in again. The wardrobe was not loaded.'
      : 'Your Google sign-in expired. Sign in again. This change was not saved.';
  }
  if (kind === 'permission') {
    return error.message
      ? `Permission denied. ${error.message} Nothing was confirmed.`
      : 'Permission denied for this account. Nothing was confirmed.';
  }
  if (kind === 'not-found') {
    return 'That spreadsheet, tab, or folder was not found. Check the IDs in Setup. No wardrobe was invented.';
  }
  if (kind === 'missing-folder') {
    return 'No Drive folder is configured. Create a private folder or paste an existing folder ID. The photo was not uploaded and the piece was not saved.';
  }
  if (KNOWN[error?.message]) return KNOWN[error.message];
  if (kind === 'network') {
    return error?.message
      ? `Could not reach Google. ${error.message} Nothing was confirmed.`
      : 'Could not reach Google. Nothing was confirmed.';
  }
  if (error?.message) return error.message;
  return 'Something went wrong. Nothing was confirmed.';
}
