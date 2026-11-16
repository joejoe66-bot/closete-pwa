export const CATEGORIES = [
  'All pieces',
  'Tops',
  'Bottoms',
  'Outerwear',
  'Shoes',
  'Accessories',
  'Dresses',
  'Sportswear',
  'Other'
];

export function collectionTitle(view) {
  if (view === 'favorites') return 'Your wishlist';
  if (view === 'insights') return 'Wardrobe insights';
  return 'Your collection';
}

export function viewNotice(view) {
  if (view === 'Outfits') {
    return 'Outfits is not a separate planner in this version. This is the same wardrobe list.';
  }
  if (view === 'insights') {
    return 'Insights is not a separate report in this version. This is the same wardrobe list.';
  }
  return '';
}

export function filterItems(items, { query = '', activeFilter = 'All pieces', view = 'all' } = {}) {
  const needle = String(query || '').toLowerCase();
  return items.filter(item =>
    (activeFilter === 'All pieces' || item.category === activeFilter) &&
    (view !== 'favorites' || item.favorite) &&
    [item.name, item.brand, item.color, item.category, item.notes]
      .join(' ')
      .toLowerCase()
      .includes(needle)
  );
}

export function summarize(items) {
  return {
    count: items.length,
    categories: new Set(items.map(item => item.category)).size,
    value: items.reduce((sum, item) => sum + Number(item.price || 0), 0),
    favorites: items.filter(item => item.favorite).length
  };
}

export function emptyMessage({ loadState, itemCount }) {
  if (loadState === 'loading') return 'Loading your wardrobe…';
  if ((loadState === 'ready' || loadState === 'demo') && itemCount === 0) {
    return 'Your wardrobe is waiting for its first piece. Add a clothing item to get started.';
  }
  if (loadState === 'error') {
    return 'The wardrobe could not be loaded. Nothing on screen was filled in from Google.';
  }
  if (loadState === 'offline') {
    return 'You are offline. Nothing was loaded, and this app does not keep a copy to sync later.';
  }
  return 'Your Google wardrobe is not connected. Open Setup, or try the local demo.';
}
