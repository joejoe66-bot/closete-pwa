import { MAX_IMAGE_BYTES } from './constants.js';
import { publicError } from './errors.js';

const DATA_URL = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=\s]+)$/;

export function base64ByteLength(b64) {
  const clean = String(b64).replace(/\s/g, '').replace(/=+$/, '');
  return Math.floor((clean.length * 3) / 4);
}

export function decodeBase64(b64) {
  const clean = String(b64).replace(/\s/g, '');
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(clean, 'base64'));
  }
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

export function parseImageDataUrl(dataUrl) {
  const match = String(dataUrl || '').match(DATA_URL);
  if (!match) {
    const error = new Error('This image type is not supported. Choose JPG, PNG, or WebP.');
    error.code = 'IMAGE_TYPE';
    throw error;
  }
  const bytes = base64ByteLength(match[2]);
  if (bytes > MAX_IMAGE_BYTES) {
    const error = new Error('That photo is still too large. Choose a smaller one.');
    error.code = 'IMAGE_SIZE';
    throw error;
  }
  return {
    mimeType: `image/${match[1]}`,
    extension: match[1] === 'jpeg' ? 'jpg' : match[1],
    base64: match[2].replace(/\s/g, ''),
    bytes,
  };
}

export function safeFileName(itemName, extension, nowMs) {
  const safe = String(itemName || 'wardrobe-item')
    .replace(/[\\/:*?"<>|#%{}~&]/g, '_')
    .slice(0, 60);
  return `${safe}-${nowMs}.${extension}`;
}

export function driveFileIdFromUrl(url) {
  const value = String(url || '');
  const file = value.match(/drive\.google\.com\/file\/d\/([^/?#]+)/);
  if (file) return file[1];
  if (/drive\.google\.com\/uc\?/.test(value) || /[?&]export=view/.test(value)) {
    const id = value.match(/[?&]id=([^&]+)/);
    return id ? '' : '';
  }
  const prefixed = value.match(/^drive-file:(.+)$/);
  return prefixed ? prefixed[1] : '';
}

/** Legacy anyone-with-link URLs stay direct image sources. New uploads do not. */
export function isLegacyPublicDriveImage(url) {
  return /drive\.google\.com\/uc\?/.test(String(url || '')) || /[?&]export=view/.test(String(url || ''));
}

export function privateDriveViewUrl(fileId) {
  return `https://drive.google.com/file/d/${fileId}/view`;
}

export function buildMultipartBody({ metadata, mimeType, bytes, boundary }) {
  const encoder = new TextEncoder();
  const head = encoder.encode(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`
    + `--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`
  );
  const tail = encoder.encode(`\r\n--${boundary}--`);
  const body = new Uint8Array(head.length + bytes.length + tail.length);
  body.set(head, 0);
  body.set(bytes, head.length);
  body.set(tail, head.length + bytes.length);
  return body;
}

async function driveFetch(fetchImpl, token, url, options = {}) {
  if (!token) {
    const error = new Error('Sign in with Google before using Drive.');
    error.code = 'AUTH';
    throw error;
  }
  const response = await fetchImpl(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });
  if (!response.ok) {
    const text = await response.text();
    const error = new Error(`Google Drive request failed (${response.status}). ${publicError(text)}`);
    error.code = 'DRIVE';
    error.status = response.status;
    throw error;
  }
  if (response.status === 204) return null;
  const type = response.headers.get('content-type') || '';
  if (type.includes('application/json')) return response.json();
  return response;
}

export function createDriveClient({ fetchImpl, getToken }) {
  return {
    async createPrivateFolder(name) {
      const token = getToken();
      const created = await driveFetch(
        fetchImpl,
        token,
        'https://www.googleapis.com/drive/v3/files?fields=id,name,mimeType',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name,
            mimeType: 'application/vnd.google-apps.folder',
          }),
        }
      );
      return created;
    },

    async uploadImage({ dataUrl, itemName, folderId, nowMs = Date.now() }) {
      if (!folderId) {
        const error = new Error(
          'Choose or create a private Drive folder before saving a photo. Nothing was written.'
        );
        error.code = 'FOLDER_REQUIRED';
        throw error;
      }
      const image = parseImageDataUrl(dataUrl);
      const metadata = {
        name: safeFileName(itemName, image.extension, nowMs),
        mimeType: image.mimeType,
        parents: [folderId],
      };
      const boundary = `closete_${nowMs}`;
      const body = buildMultipartBody({
        metadata,
        mimeType: image.mimeType,
        bytes: decodeBase64(image.base64),
        boundary,
      });
      const created = await driveFetch(
        fetchImpl,
        getToken(),
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType',
        {
          method: 'POST',
          headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
          body,
        }
      );
      return {
        id: created.id,
        name: created.name,
        imageUrl: privateDriveViewUrl(created.id),
      };
    },

    async fetchPrivateImage(fileId) {
      const token = getToken();
      const response = await driveFetch(
        fetchImpl,
        token,
        `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`,
        { method: 'GET' }
      );
      return response.blob();
    },
  };
}
