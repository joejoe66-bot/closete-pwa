import { HEADERS } from './constants.js';
import { headerCompletion } from './schema.js';
import { imageUrlForFileId, parseImageDataUrl, safeFileName } from './images.js';

export function createMemoryPort({
  headers = [...HEADERS],
  rows = [],
  nowMs = () => Date.now(),
  shareWithLink = false,
  folderId = 'memory-folder',
  keepDataUrl = false
} = {}) {
  let headerRow = headers.map(header => String(header));
  let dataRows = rows.map(row => row.slice());
  let chain = Promise.resolve();
  const uploads = [];
  const permissionCalls = [];
  let createdSheet = false;
  let addedHeaders = [];

  function ensureShape() {
    const completed = headerCompletion(headerRow);
    if (!headerRow.length) {
      headerRow = [...HEADERS];
      createdSheet = true;
    } else if (completed.added.length) {
      headerRow = completed.headers;
      addedHeaders = completed.added;
    }
    dataRows = dataRows.map(row => {
      const copy = row.slice();
      while (copy.length < headerRow.length) copy.push('');
      return copy;
    });
  }

  function withLock(fn) {
    const run = chain.then(() => fn());
    chain = run.then(() => undefined, () => undefined);
    return run;
  }

  return {
    uploads,
    permissionCalls,
    withLock,
    snapshot() {
      ensureShape();
      return {
        headers: headerRow.slice(),
        rows: dataRows.map(row => row.slice())
      };
    },
    async readTable() {
      ensureShape();
      const meta = { createdSheet, addedHeaders: addedHeaders.slice() };
      createdSheet = false;
      addedHeaders = [];
      return {
        headers: headerRow.slice(),
        rows: dataRows.map(row => row.slice()),
        ...meta
      };
    },
    async writeDataRow(index, values) {
      dataRows[index] = values.slice();
    },
    async appendDataRow(values) {
      dataRows.push(values.slice());
    },
    async uploadImage(dataUrl, itemName) {
      if (!folderId) {
        const error = new Error('No Drive folder is configured.');
        error.kind = 'missing-folder';
        throw error;
      }
      const parsed = parseImageDataUrl(dataUrl);
      const fileId = `memory-${uploads.length + 1}`;
      const name = safeFileName(itemName, parsed.extension, nowMs());
      const url = keepDataUrl ? dataUrl : imageUrlForFileId(fileId);
      uploads.push({ name, mimeType: parsed.mimeType, bytes: parsed.bytes, folderId, shareWithLink });
      if (shareWithLink) permissionCalls.push({ fileId, type: 'anyone', role: 'reader' });
      return { url, fileId, shared: shareWithLink };
    }
  };
}
