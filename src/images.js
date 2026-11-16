import { MAX_IMAGE_BYTES } from './constants.js';
import { WardrobeError } from './errors.js';

const DATA_URL = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=\s]+)$/;

export function parseImageDataUrl(dataUrl) {
  const match = String(dataUrl || '').match(DATA_URL);
  if (!match) {
    throw new WardrobeError('圖片格式不支援，請選擇 JPG、PNG 或 WebP。', 'validation');
  }
  const base64 = match[2].replace(/\s/g, '');
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  const bytes = Math.floor((base64.length * 3) / 4) - padding;
  if (bytes > MAX_IMAGE_BYTES) {
    throw new WardrobeError('圖片仍然太大，請選擇較小的照片。', 'validation');
  }
  const subtype = match[1];
  return {
    mimeType: `image/${subtype}`,
    extension: subtype === 'jpeg' ? 'jpg' : subtype,
    base64,
    bytes
  };
}

export function safeFileName(itemName, extension, nowMs) {
  const safe = String(itemName || 'wardrobe-item')
    .replace(/[\\/:*?"<>|#%{}~&]/g, '_')
    .slice(0, 60);
  return `${safe}-${nowMs}.${extension}`;
}

export function imageUrlForFileId(fileId) {
  return `https://drive.google.com/uc?export=view&id=${fileId}`;
}

export function driveFileIdFromUrl(url) {
  const value = String(url || '');
  const patterns = [
    /[?&]id=([a-zA-Z0-9_-]+)/,
    /\/file\/d\/([a-zA-Z0-9_-]+)/,
    /\/folders\/([a-zA-Z0-9_-]+)/,
    /googleapis\.com\/drive\/v3\/files\/([a-zA-Z0-9_-]+)/
  ];
  for (const pattern of patterns) {
    const match = value.match(pattern);
    if (match) return match[1];
  }
  return '';
}

export function safeImageSrc(url) {
  const value = String(url || '').trim();
  if (!value) return '';
  if (/^data:image\/(jpeg|png|webp|gif);base64,[a-z0-9+/=\s]+$/i.test(value)) return value;
  try {
    const parsed = new URL(value);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') return value;
  } catch {
    return '';
  }
  return '';
}
