import { formatMoney } from './money.js';
import { safeImageSrc } from './images.js';

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[char]);
}

export function renderItems(items) {
  return items.map((item, index) => {
    const src = safeImageSrc(item.imageUrl);
    const photo = src
      ? `<img alt="${escapeHtml(item.name)}" data-photo="${escapeHtml(item.id)}" src="${escapeHtml(src)}">`
      : '<div class="photo-fallback" aria-hidden="true">♧</div>';
    const worn = Number(item.wearCount) > 0
      ? `Worn ${Number(item.wearCount)}×${item.lastWorn ? ` · ${escapeHtml(item.lastWorn)}` : ''}`
      : 'Not worn yet';
    return `<article class="card" data-delay="${Math.min(index, 10)}">
      <div class="photo">
        ${photo}
        <button type="button" class="heart" data-fav="${escapeHtml(item.id)}" aria-label="Toggle favorite">${item.favorite ? '♥' : '♡'}</button>
      </div>
      <div class="details">
        <h3>${escapeHtml(item.name)}</h3>
        <p>${escapeHtml(item.brand || 'No brand')}${item.color ? ` · ${escapeHtml(item.color)}` : ''}</p>
        <span class="tag">${escapeHtml(item.category)}</span>
        <div class="price">${escapeHtml(formatMoney(item.price, item.currency || 'S$'))}</div>
        <div class="worn">${worn}</div>
        <div class="card-actions">
          <button type="button" class="filter" data-edit="${escapeHtml(item.id)}">Edit</button>
          <button type="button" class="filter" data-worn="${escapeHtml(item.id)}">Wore it</button>
        </div>
      </div>
    </article>`;
  }).join('');
}
