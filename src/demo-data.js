import { HEADERS } from './constants.js';

/** Obvious sample rows. Not a substitute for the owner's sheet. */
export function demoRows() {
  const items = [
    ['demo-linen', 'Sample linen shirt', 'Tops', 'Sample brand', 'Olive', 'M', 49, '2024-04-02', '', 'Demo piece only', false, '2026-01-03', 2, '2024-04-02T00:00:00.000Z', '2026-01-03T00:00:00.000Z'],
    ['demo-trousers', 'Sample wool trousers', 'Bottoms', 'Sample brand', 'Stone', '32', 89.5, '2023-11-18', '', 'Demo piece only', true, '', 0, '2023-11-18T00:00:00.000Z', '2023-11-18T00:00:00.000Z'],
    ['demo-coat', 'Sample cotton coat', 'Outerwear', 'Sample brand', 'Sand', 'L', 120, '2025-02-11', '', 'Demo piece only', false, '2026-02-01', 4, '2025-02-11T00:00:00.000Z', '2026-02-01T00:00:00.000Z']
  ];
  return { headers: [...HEADERS], rows: items };
}
