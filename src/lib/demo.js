import { CURRENCY } from './constants.js';
import { buildRecord, nextWear } from './wardrobe.js';

export function createDemoItems(now = new Date('2026-11-01T02:00:00Z')) {
  const stamp = '2026-11-01T10:00:00+08:00';
  return [
    {
      id: 'demo-linen-shirt',
      name: 'Sample linen shirt',
      category: 'Tops',
      brand: 'Demo label',
      color: 'Olive',
      size: 'M',
      price: 49,
      purchaseDate: '2024-03-01',
      imageUrl: '',
      notes: 'Demo piece only. This is not from your spreadsheet.',
      favorite: true,
      lastWorn: '2026-10-02',
      wearCount: 3,
      createdAt: stamp,
      updatedAt: stamp,
      currency: CURRENCY,
      demo: true,
    },
    {
      id: 'demo-trousers',
      name: 'Sample wide trousers',
      category: 'Bottoms',
      brand: 'Demo label',
      color: 'Sand',
      size: '32',
      price: 89.5,
      purchaseDate: '2025-01-12',
      imageUrl: '',
      notes: 'Sample data for layout. Nothing here is saved to Google.',
      favorite: false,
      lastWorn: '',
      wearCount: 0,
      createdAt: stamp,
      updatedAt: stamp,
      currency: CURRENCY,
      demo: true,
    },
    {
      id: 'demo-sneakers',
      name: 'Sample court sneakers',
      category: 'Shoes',
      brand: 'Demo label',
      color: 'White',
      size: '38',
      price: 120,
      purchaseDate: '2023-08-20',
      imageUrl: '',
      notes: 'Demo piece only.',
      favorite: false,
      lastWorn: '2026-09-01',
      wearCount: 8,
      createdAt: stamp,
      updatedAt: stamp,
      currency: CURRENCY,
      demo: true,
    },
  ];
}

export function createDemoStore({ now = () => new Date(), newId = () => `demo-${Math.random().toString(16).slice(2)}` } = {}) {
  let items = createDemoItems(now());
  return {
    listItems() {
      return items.map(item => ({ ...item }));
    },
    saveItem(item) {
      const existing = item?.id ? items.find(entry => entry.id === item.id) : null;
      const imageUrl = item?.imageDataUrl
        ? item.imageDataUrl
        : (item?.clearImage === true || String(item?.clearImage).toLowerCase() === 'true')
          ? ''
          : String(item?.imageUrl || '');
      const record = buildRecord({
        item,
        existing: existing || null,
        now: now(),
        imageUrl,
        newId: newId(),
        timeZone: 'Asia/Singapore',
      });
      record.currency = CURRENCY;
      record.demo = true;
      if (existing) {
        items = items.map(entry => (entry.id === existing.id ? record : entry));
      } else {
        items = [record, ...items];
      }
      return { success: true, id: record.id, message: 'Demo only — nothing was written to Google Sheets.' };
    },
    markWorn(id) {
      const existing = items.find(entry => entry.id === id);
      const next = nextWear(existing, now(), 'Asia/Singapore');
      items = items.map(entry => (entry.id === id ? { ...entry, ...next } : entry));
      return { success: true, ...next, demo: true };
    },
  };
}
