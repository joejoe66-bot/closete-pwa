import { formatDateOnly, formatTimestamp, todayYmd } from './dates.js';
import { isFavorite } from './schema.js';

export function requireName(item) {
  const name = String(item?.name || '').trim();
  if (!name) {
    const error = new Error('Enter an item name.');
    error.code = 'NAME_REQUIRED';
    throw error;
  }
  return name;
}

/**
 * Image rules follow Code.gs saveItem:
 * a new data URL wins, clearImage blanks the URL, otherwise the form URL is stored.
 */
export function resolveImageAction(item) {
  if (item?.imageDataUrl) {
    return { action: 'upload', dataUrl: String(item.imageDataUrl) };
  }
  if (item?.clearImage === true || String(item?.clearImage).toLowerCase() === 'true') {
    return { action: 'clear', imageUrl: '' };
  }
  return { action: 'keep', imageUrl: String(item?.imageUrl || '') };
}

export function buildRecord({ item, existing, now, imageUrl, newId, timeZone }) {
  const name = requireName(item);
  const isUpdate = Boolean(existing?.id);
  const price = Number(item?.price || 0);
  return {
    id: isUpdate ? String(existing.id) : String(newId),
    name,
    category: String(item?.category || 'Other'),
    brand: String(item?.brand || ''),
    color: String(item?.color || ''),
    size: String(item?.size || ''),
    price: Math.max(0, Number.isFinite(price) ? price : 0),
    purchaseDate: formatDateOnly(item?.purchaseDate || '', timeZone),
    imageUrl: String(imageUrl ?? ''),
    notes: String(item?.notes || ''),
    favorite: isFavorite(item?.favorite),
    lastWorn: isUpdate ? (existing.lastWorn || '') : '',
    wearCount: isUpdate ? Number(existing.wearCount || 0) : 0,
    createdAt: isUpdate
      ? (existing.createdAt || formatTimestamp(now, timeZone))
      : formatTimestamp(now, timeZone),
    updatedAt: formatTimestamp(now, timeZone),
  };
}

export function nextWear(existing, now = new Date(), timeZone = 'Asia/Singapore') {
  if (!existing?.id) {
    const error = new Error('That piece could not be found.');
    error.code = 'NOT_FOUND';
    throw error;
  }
  return {
    lastWorn: todayYmd(now, timeZone),
    wearCount: Number(existing.wearCount || 0) + 1,
    updatedAt: formatTimestamp(now, timeZone),
  };
}

export function filterItems(items, { query = '', category = 'All pieces', view = 'all' } = {}) {
  const needle = String(query).toLowerCase();
  return items.filter(item =>
    (category === 'All pieces' || item.category === category)
    && (view !== 'favorites' || item.favorite)
    && [item.name, item.brand, item.color, item.category, item.notes]
      .join(' ')
      .toLowerCase()
      .includes(needle)
  );
}

export function collectionStats(items) {
  return {
    count: items.length,
    categories: new Set(items.map(item => item.category).filter(Boolean)).size,
    value: items.reduce((sum, item) => sum + Number(item.price || 0), 0),
    favorites: items.filter(item => item.favorite).length,
  };
}

export function photoScale(width, height, maxEdge = 1400) {
  const longest = Math.max(Number(width) || 0, Number(height) || 0);
  if (!longest) return 1;
  return Math.min(1, maxEdge / longest);
}
