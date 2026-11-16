import { describe, expect, it } from 'vitest';
import { formatMoney } from '../src/lib/money.js';
import {
  buildRecord,
  collectionStats,
  filterItems,
  nextWear,
  photoScale,
  requireName,
  resolveImageAction,
} from '../src/lib/wardrobe.js';

const now = new Date('2026-11-16T02:00:00Z');

describe('write semantics', () => {
  it('requires a name and clamps a negative price on insert', () => {
    expect(() => requireName({ name: '  ' })).toThrow(/name/i);
    const record = buildRecord({
      item: { name: '  Linen shirt ', category: '', price: -12, favorite: 'true', notes: '=1+1' },
      existing: null,
      now,
      imageUrl: '',
      newId: 'new-id',
      timeZone: 'Asia/Singapore',
    });
    expect(record.id).toBe('new-id');
    expect(record.name).toBe('Linen shirt');
    expect(record.category).toBe('Other');
    expect(record.price).toBe(0);
    expect(record.favorite).toBe(true);
    expect(record.wearCount).toBe(0);
    expect(record.lastWorn).toBe('');
    expect(record.createdAt).toBe('2026-11-16T10:00:00+08:00');
    expect(record.updatedAt).toBe(record.createdAt);
    expect(record.notes).toBe('=1+1');
  });

  it('preserves wear count, last worn, and created time when editing', () => {
    const record = buildRecord({
      item: {
        id: 'piece-1',
        name: 'Linen shirt',
        price: 49,
        favorite: false,
        wearCount: 99,
        lastWorn: '2099-01-01',
        createdAt: '1999-01-01T00:00:00+08:00',
      },
      existing: {
        id: 'piece-1',
        wearCount: 4,
        lastWorn: '2026-10-02',
        createdAt: '2024-03-01T00:00:00+08:00',
      },
      now,
      imageUrl: 'https://example.test/keep.jpg',
      newId: 'ignored',
      timeZone: 'Asia/Singapore',
    });
    expect(record.id).toBe('piece-1');
    expect(record.wearCount).toBe(4);
    expect(record.lastWorn).toBe('2026-10-02');
    expect(record.createdAt).toBe('2024-03-01T00:00:00+08:00');
    expect(record.updatedAt).toBe('2026-11-16T10:00:00+08:00');
    expect(record.imageUrl).toBe('https://example.test/keep.jpg');
    expect(record.price).toBe(49);
  });

  it('matches the original image rules', () => {
    expect(resolveImageAction({ imageDataUrl: 'data:image/jpeg;base64,aa' }).action).toBe('upload');
    expect(resolveImageAction({ clearImage: true, imageUrl: 'https://x' }).imageUrl).toBe('');
    expect(resolveImageAction({ clearImage: 'true' }).imageUrl).toBe('');
    expect(resolveImageAction({ imageUrl: 'https://example.test/a.jpg' }).imageUrl).toBe('https://example.test/a.jpg');
    expect(resolveImageAction({}).imageUrl).toBe('');
  });

  it('increments wear count and stamps today in Singapore', () => {
    const next = nextWear({ id: 'piece-1', wearCount: 2 }, now);
    expect(next).toEqual({
      lastWorn: '2026-11-16',
      wearCount: 3,
      updatedAt: '2026-11-16T10:00:00+08:00',
    });
    expect(() => nextWear(null, now)).toThrow(/could not be found/i);
  });

  it('filters search, category, and wishlist without an outfits view', () => {
    const items = [
      { name: 'Linen', brand: 'Demo', color: 'Olive', category: 'Tops', notes: 'soft', favorite: true, price: 10 },
      { name: 'Sneakers', brand: 'Demo', color: 'White', category: 'Shoes', notes: '', favorite: false, price: 5 },
    ];
    expect(filterItems(items, { query: 'olive' }).map(item => item.name)).toEqual(['Linen']);
    expect(filterItems(items, { category: 'Shoes' }).map(item => item.name)).toEqual(['Sneakers']);
    expect(filterItems(items, { view: 'favorites' }).map(item => item.name)).toEqual(['Linen']);
    expect(filterItems(items, { view: 'Outfits' })).toHaveLength(2);
    expect(collectionStats(items)).toEqual({ count: 2, categories: 2, value: 15, favorites: 1 });
    expect(formatMoney(258.5)).toBe('S$ 258.50');
    expect(photoScale(2800, 1000)).toBe(0.5);
    expect(photoScale(800, 600)).toBe(1);
  });
});
