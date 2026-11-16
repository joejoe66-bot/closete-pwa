import { TIMEZONE } from './constants.js';
import { WardrobeError } from './errors.js';
import { todayString } from './dates.js';
import {
  findRowIndex,
  mapRows,
  normalizePrice,
  rowToItem,
  valuesForHeaders
} from './schema.js';

function requireItem(item) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) {
    throw new WardrobeError('衣服資料格式不正確。', 'validation');
  }
}

export async function loadWardrobe(port) {
  const table = await port.readTable();
  return {
    items: mapRows(table.headers, table.rows),
    createdSheet: Boolean(table.createdSheet),
    addedHeaders: table.addedHeaders || []
  };
}

export async function saveItem(port, item, {
  now = new Date(),
  newId = () => crypto.randomUUID()
} = {}) {
  requireItem(item);
  const name = String(item.name || '').trim();
  if (!name) throw new WardrobeError('請輸入衣服名稱。', 'validation');

  return port.withLock(async () => {
    const table = await port.readTable();
    const rowIndex = findRowIndex(table.rows, table.headers, item.id);
    const existing = rowIndex >= 0 ? rowToItem(table.headers, table.rows[rowIndex]) : {};

    let imageUrl = String(item.imageUrl || '');
    let imageShared = null;
    if (item.imageDataUrl) {
      const uploaded = await port.uploadImage(item.imageDataUrl, name);
      imageUrl = uploaded.url;
      imageShared = uploaded.shared === true;
    } else if (item.clearImage === true || String(item.clearImage).toLowerCase() === 'true') {
      imageUrl = '';
    }

    const record = {
      id: existing.id || newId(),
      name,
      category: String(item.category || 'Other'),
      brand: String(item.brand || ''),
      color: String(item.color || ''),
      size: String(item.size || ''),
      price: normalizePrice(item.price),
      purchaseDate: String(item.purchaseDate || ''),
      imageUrl,
      notes: String(item.notes || ''),
      favorite: item.favorite === true || String(item.favorite).toLowerCase() === 'true',
      lastWorn: existing.lastWorn || '',
      wearCount: Number(existing.wearCount || 0),
      createdAt: existing.createdAt || now,
      updatedAt: now
    };

    const values = valuesForHeaders(table.headers, record);
    if (rowIndex >= 0) await port.writeDataRow(rowIndex, values);
    else await port.appendDataRow(values);

    let message = '衣服資料已儲存。';
    if (imageShared === false) {
      message = '衣服資料已儲存。照片保持私人。';
    } else if (imageShared === true) {
      message = '衣服資料已儲存。照片已設為知道連結者可檢視。';
    }

    return {
      success: true,
      id: record.id,
      message,
      imageShared
    };
  });
}

export async function markWorn(port, id, { now = new Date(), timeZone = TIMEZONE } = {}) {
  if (!id) throw new WardrobeError('缺少衣服 ID。', 'validation');

  return port.withLock(async () => {
    const table = await port.readTable();
    if (!table.rows.length) throw new WardrobeError('衣櫥中沒有衣服資料。', 'validation');

    const index = findRowIndex(table.rows, table.headers, id);
    if (index === -1) throw new WardrobeError('找不到這件衣服。', 'validation');

    const wornIndex = table.headers.indexOf('lastWorn');
    const countIndex = table.headers.indexOf('wearCount');
    const updatedIndex = table.headers.indexOf('updatedAt');
    const today = todayString(now, timeZone);
    const currentCount = Number(table.rows[index][countIndex] || 0);
    const next = table.rows[index].slice();
    next[wornIndex] = today;
    next[countIndex] = currentCount + 1;
    next[updatedIndex] = now;
    await port.writeDataRow(index, next);

    return {
      success: true,
      lastWorn: today,
      wearCount: currentCount + 1
    };
  });
}
