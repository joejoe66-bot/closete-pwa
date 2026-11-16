import { currentToken, rememberToken } from './lib/auth.js';
import { assessConfig } from './lib/config.js';
import {
  CATEGORIES,
  DRIVE_FOLDER_STORAGE_KEY,
  PHOTO_JPEG_QUALITY,
  PHOTO_MAX_EDGE,
  SCOPES,
} from './lib/constants.js';
import { createDemoStore } from './lib/demo.js';
import {
  createDriveClient,
  driveFileIdFromUrl,
  isLegacyPublicDriveImage,
} from './lib/drive.js';
import { assertWritable, publicError } from './lib/errors.js';
import { formatMoney } from './lib/money.js';
import { createSheetsClient } from './lib/sheets.js';
import { collectionStats, filterItems, photoScale } from './lib/wardrobe.js';

const $ = selector => document.querySelector(selector);

const config = assessConfig(window.CLOSETE_CONFIG || {});
const demoStore = createDemoStore();

let allItems = [];
let activeFilter = 'All pieces';
let view = 'all';
let selectedImageDataUrl = '';
let clearExistingImage = false;
let mode = 'setup';
let tokenState = null;
let deferredPrompt = null;
let folderId = readFolderId();
let objectUrls = [];

const drive = createDriveClient({
  fetchImpl: (...args) => fetch(...args),
  getToken: () => currentToken(tokenState),
});

function sheets() {
  return createSheetsClient({
    fetchImpl: (...args) => fetch(...args),
    getToken: () => currentToken(tokenState),
    spreadsheetId: config.spreadsheetId,
    sheetName: config.sheetName,
    sheetId: config.sheetId,
    timeZone: config.timeZone,
    currency: config.currency,
    drive,
  });
}

function readFolderId() {
  try {
    return localStorage.getItem(DRIVE_FOLDER_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

function writeFolderId(id) {
  folderId = String(id || '').trim();
  try {
    if (folderId) localStorage.setItem(DRIVE_FOLDER_STORAGE_KEY, folderId);
    else localStorage.removeItem(DRIVE_FOLDER_STORAGE_KEY);
  } catch {
    /* storage may be blocked; the in-memory id still works for this visit */
  }
  renderFolderBar();
}

function toast(message) {
  const node = $('#toast');
  node.textContent = message;
  node.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => node.classList.remove('show'), 3200);
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]);
}

function online() {
  return navigator.onLine !== false;
}

function offlineSuffix() {
  return online()
    ? ''
    : ' You are offline. This app shell can open, but Google sign-in and spreadsheet saves stay disabled and are not queued.';
}

function setStatus(message, kind = '') {
  const node = $('#status');
  node.className = `status${message ? ' show' : ''}${kind ? ` ${kind}` : ''}`;
  node.innerHTML = message || '';
}

function showLive(show) {
  $('#liveApp').hidden = !show;
  $('#gate').hidden = show;
}

function renderFolderBar() {
  const bar = $('#folderBar');
  if (mode !== 'live') {
    bar.className = 'folder-bar';
    bar.innerHTML = '';
    return;
  }
  bar.className = 'folder-bar show';
  const label = folderId
    ? `Private photo folder <span class="mono">${escapeHtml(folderId)}</span>. New photos stay in your Drive and are not shared publicly.`
    : 'No private photo folder yet. Create one, or paste a folder ID that this app created, before adding photos. The folder is not made public.';
  bar.innerHTML = `
    <div>${label}</div>
    <button class="pill" type="button" id="createFolder">Create “${escapeHtml(config.driveFolderName)}”</button>
    <input class="search folder-id" id="folderInput" placeholder="Existing folder ID" value="${escapeHtml(folderId)}" aria-label="Drive folder ID">
    <button class="pill" type="button" id="saveFolder">Use folder ID</button>
  `;
  $('#createFolder').onclick = createFolder;
  $('#saveFolder').onclick = () => {
    const value = $('#folderInput').value.trim();
    if (!value) {
      toast('Enter a Drive folder ID, or create a new private folder.');
      return;
    }
    writeFolderId(value);
    toast('Folder ID saved on this device. It will be used for the next photo.');
  };
}

async function createFolder() {
  if (mode !== 'live') return;
  try {
    assertWritable(online());
    const created = await drive.createPrivateFolder(config.driveFolderName);
    writeFolderId(created.id);
    toast('Private folder created. Photos uploaded there are not shared publicly.');
  } catch (error) {
    setStatus(publicError(error), 'error');
    toast(publicError(error));
  }
}

function applyMode(next) {
  mode = next;
  const account = $('#account');
  if (mode === 'demo') {
    account.textContent = 'Leave demo';
    showLive(true);
    setStatus('<strong>Demo mode.</strong> These are sample pieces on this device. Nothing is read from or written to your spreadsheet.', '');
  } else if (mode === 'live') {
    account.textContent = 'Sign out';
    showLive(true);
    if (!online()) {
      setStatus('You are offline. The app shell is open, but the wardrobe cannot be loaded or saved until you reconnect. Nothing is queued.', 'offline');
    } else {
      setStatus('', '');
    }
  } else if (mode === 'signedOut') {
    account.textContent = 'Sign in';
    showLive(false);
    $('#gateTitle').textContent = 'Sign in to your wardrobe';
    $('#gateLead').textContent = 'A web client ID is present. This page has not signed in, and it has not read your spreadsheet. Browser OAuth is ready to start only when you choose Sign in.';
    setStatus(online() ? '' : offlineSuffix().trim(), online() ? '' : 'offline');
  } else {
    account.textContent = 'Setup';
    showLive(false);
    $('#gateTitle').textContent = 'Google sign-in is not configured';
    $('#gateLead').textContent = `This copy has no OAuth client ID. Sign-in cannot start. The wardrobe spreadsheet is not being read or written, and there is no live Google connection.${offlineSuffix()}`;
    setStatus(`${config.errors[0] || 'OAuth client ID is not set.'}${offlineSuffix()}`, online() ? 'error' : 'offline');
  }
  renderFolderBar();
}

function render() {
  const shown = filterItems(allItems, {
    query: $('#search').value,
    category: activeFilter,
    view,
  });
  const stats = collectionStats(allItems);
  $('#count').textContent = stats.count;
  $('#categories').textContent = stats.categories;
  $('#value').textContent = formatMoney(stats.value, config.currency || 'S$');
  $('#favCount').textContent = stats.favorites;
  $('#collectionTitle').textContent = view === 'favorites' ? 'Your wishlist' : 'Your collection';
  $('#filters').innerHTML = CATEGORIES.map(category =>
    `<button class="filter ${activeFilter === category ? 'active' : ''}" type="button" data-cat="${escapeHtml(category)}">${escapeHtml(category)}</button>`
  ).join('');

  revokePhotos();
  if (!shown.length) {
    $('#items').innerHTML = '<div class="empty">Your wardrobe is waiting for its first piece. ✨<br><br>Add a clothing item to get started.</div>';
    return;
  }

  $('#items').innerHTML = shown.map((item, index) => {
    const photo = photoMarkup(item);
    return `
      <article class="card" style="animation-delay:${Math.min(index, 10) * 35}ms">
        <div class="photo">
          ${photo}
          <button class="heart" type="button" data-fav="${escapeHtml(item.id)}" aria-label="Favorite">${item.favorite ? '♥' : '♡'}</button>
        </div>
        <div class="details">
          <h3>${escapeHtml(item.name)}</h3>
          <p>${escapeHtml(item.brand || 'No brand')}${item.color ? ` · ${escapeHtml(item.color)}` : ''}</p>
          <span class="tag">${escapeHtml(item.category)}</span>
          <div class="price">${formatMoney(item.price, item.currency || config.currency || 'S$')}</div>
          <div style="display:flex;gap:6px;margin-top:12px">
            <button class="filter" type="button" data-edit="${escapeHtml(item.id)}">Edit</button>
            <button class="filter" type="button" data-worn="${escapeHtml(item.id)}">Wore it</button>
          </div>
        </div>
      </article>`;
  }).join('');
  hydratePrivatePhotos();
}

function photoMarkup(item) {
  const url = item.imageUrl || '';
  if (!url) {
    return '<div style="height:100%;display:grid;place-items:center;font-size:48px;color:#a69b8a">♧</div>';
  }
  if (url.startsWith('data:image/') || isLegacyPublicDriveImage(url) || /^https?:\/\//.test(url) && !driveFileIdFromUrl(url)) {
    return `<img loading="lazy" alt="" src="${escapeHtml(url)}" onerror="this.style.display='none'">`;
  }
  const fileId = driveFileIdFromUrl(url);
  if (fileId) {
    return `<img alt="" data-drive-id="${escapeHtml(fileId)}" hidden><div class="private-photo" style="height:100%;display:grid;place-items:center;font-size:13px;color:#8f887d;padding:12px;text-align:center">Private Drive photo</div>`;
  }
  return `<img loading="lazy" alt="" src="${escapeHtml(url)}" onerror="this.style.display='none'">`;
}

function revokePhotos() {
  objectUrls.forEach(url => URL.revokeObjectURL(url));
  objectUrls = [];
}

async function hydratePrivatePhotos() {
  if (mode !== 'live' || !currentToken(tokenState)) return;
  const images = [...document.querySelectorAll('[data-drive-id]')];
  await Promise.all(images.map(async image => {
    try {
      const blob = await drive.fetchPrivateImage(image.dataset.driveId);
      const url = URL.createObjectURL(blob);
      objectUrls.push(url);
      image.src = url;
      image.hidden = false;
      image.parentElement?.querySelector('.private-photo')?.remove();
    } catch {
      /* keep the private placeholder; do not fall back to a public link */
    }
  }));
}

function showPhoto(source) {
  const preview = $('#photoPreview');
  if (!source) {
    preview.innerHTML = '<span>No photo selected</span>';
    return;
  }
  if (driveFileIdFromUrl(source) && !source.startsWith('data:')) {
    preview.innerHTML = '<span>Private Drive photo</span>';
    return;
  }
  preview.innerHTML = `<img src="${escapeHtml(source)}" alt="Selected clothing photo">`;
}

function openModal(item) {
  if (mode !== 'demo' && mode !== 'live') {
    toast('Sign in, or open the labeled demo, before adding a piece.');
    return;
  }
  $('#itemForm').reset();
  selectedImageDataUrl = '';
  clearExistingImage = false;
  $('#modalTitle').textContent = item ? 'Edit piece' : 'Add a piece';
  const form = $('#itemForm');
  if (item) {
    Object.keys(item).forEach(key => {
      if (form.elements[key] && key !== 'imageUrl') form.elements[key].value = item[key] ?? '';
    });
    if (item.imageUrl && !driveFileIdFromUrl(item.imageUrl)) {
      form.elements.imageUrl.value = item.imageUrl;
    }
  }
  showPhoto(item && item.imageUrl ? item.imageUrl : '');
  $('#modalBack').classList.add('show');
}

function closeModal() {
  $('#modalBack').classList.remove('show');
}

function preparePhoto(file) {
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    toast('Please choose an image file.');
    return;
  }
  const objectUrl = URL.createObjectURL(file);
  const image = new Image();
  image.onload = () => {
    const scale = photoScale(image.width, image.height, PHOTO_MAX_EDGE);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(objectUrl);
    selectedImageDataUrl = canvas.toDataURL('image/jpeg', PHOTO_JPEG_QUALITY);
    clearExistingImage = false;
    $('#itemForm').elements.imageUrl.value = '';
    showPhoto(selectedImageDataUrl);
    toast('Photo ready to save');
  };
  image.onerror = () => {
    URL.revokeObjectURL(objectUrl);
    toast('Could not read that image.');
  };
  image.src = objectUrl;
}

async function loadLive() {
  applyMode('live');
  if (!online()) {
    allItems = [];
    render();
    $('#items').innerHTML = '<div class="empty">You are offline. Reconnect to load your wardrobe. Sample data is not substituted.</div>';
    return;
  }
  $('#items').innerHTML = '<div class="empty">Loading your wardrobe…</div>';
  try {
    allItems = await sheets().listItems();
    render();
  } catch (error) {
    allItems = [];
    render();
    const message = publicError(error);
    setStatus(message, 'error');
    $('#items').innerHTML = `<div class="empty">${escapeHtml(message)}</div>`;
    if (error.code === 'AUTH') tokenState = null;
  }
}

function enterDemo() {
  allItems = demoStore.listItems();
  applyMode('demo');
  render();
}

async function persistItem(item) {
  if (mode === 'demo') {
    const result = demoStore.saveItem(item);
    allItems = demoStore.listItems();
    return result;
  }
  assertWritable(online());
  if (!currentToken(tokenState)) {
    const error = new Error('Sign in with Google before saving. Nothing was written.');
    error.code = 'AUTH';
    throw error;
  }
  item.folderId = folderId;
  return sheets().saveItem(item);
}

async function persistWorn(id) {
  if (mode === 'demo') {
    const result = demoStore.markWorn(id);
    allItems = demoStore.listItems();
    return result;
  }
  assertWritable(online());
  return sheets().markWorn(id);
}

function loadGis() {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Could not load Google sign-in. Check the network and try again.'));
    document.head.appendChild(script);
  });
}

function requestToken() {
  return new Promise((resolve, reject) => {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: config.clientId,
      scope: SCOPES.join(' '),
      callback: response => {
        try {
          resolve(rememberToken(response));
        } catch (error) {
          reject(error);
        }
      },
      error_callback: error => {
        reject(new Error(error?.message || 'Google sign-in was cancelled or blocked.'));
      },
    });
    client.requestAccessToken({ prompt: 'consent' });
  });
}

async function signIn() {
  if (!config.ok) {
    applyMode('setup');
    toast('Add an OAuth web client ID before signing in. No request was sent.');
    return;
  }
  if (!online()) {
    setStatus('You are offline, so Google sign-in cannot start.', 'offline');
    toast('You are offline. Sign-in needs a connection.');
    return;
  }
  try {
    await loadGis();
    tokenState = await requestToken();
    await loadLive();
  } catch (error) {
    tokenState = null;
    applyMode('signedOut');
    setStatus(publicError(error), 'error');
    toast(publicError(error));
  }
}

function signOut() {
  const token = currentToken(tokenState);
  tokenState = null;
  allItems = [];
  if (token && window.google?.accounts?.oauth2?.revoke) {
    window.google.accounts.oauth2.revoke(token, () => {});
  }
  applyMode(config.ok ? 'signedOut' : 'setup');
  toast('Signed out. The access token was dropped from memory.');
}

function openHelp() {
  $('#helpBack').classList.add('show');
  $('#promptInstall').disabled = !deferredPrompt;
}

function closeHelp() {
  $('#helpBack').classList.remove('show');
}

async function promptInstall() {
  if (!deferredPrompt) {
    toast('Use the browser menu: Install app, or Add to Home Screen. Safari on iPhone uses Share → Add to Home Screen.');
    return;
  }
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  $('#promptInstall').disabled = true;
}

$('#takePhoto').onclick = () => $('#cameraFile').click();
$('#importPhoto').onclick = () => $('#importFile').click();
$('#cameraFile').onchange = event => {
  preparePhoto(event.target.files[0]);
  event.target.value = '';
};
$('#importFile').onchange = event => {
  preparePhoto(event.target.files[0]);
  event.target.value = '';
};
$('#removePhoto').onclick = () => {
  selectedImageDataUrl = '';
  clearExistingImage = true;
  $('#itemForm').elements.imageUrl.value = '';
  showPhoto('');
};
$('#itemForm').elements.imageUrl.addEventListener('input', () => {
  if ($('#itemForm').elements.imageUrl.value.trim()) clearExistingImage = false;
});
$('#addTop').onclick = () => openModal();
$('#addHero').onclick = () => openModal();
$('#cancel').onclick = closeModal;
$('#refresh').onclick = () => {
  if (mode === 'demo') {
    allItems = demoStore.listItems();
    render();
    return;
  }
  if (mode === 'live') loadLive();
  else toast('Connect Google, or open the labeled demo, before refreshing.');
};
$('#search').oninput = () => {
  if (mode === 'demo' || mode === 'live') render();
};
$('#demoButton').onclick = enterDemo;
$('#install').onclick = openHelp;
$('#installGate').onclick = openHelp;
$('#closeHelp').onclick = closeHelp;
$('#promptInstall').onclick = promptInstall;
$('#account').onclick = () => {
  if (mode === 'demo') {
    allItems = [];
    applyMode(config.ok ? 'signedOut' : 'setup');
    return;
  }
  if (mode === 'live') signOut();
  else signIn();
};
$('#modalBack').onclick = event => {
  if (event.target === $('#modalBack')) closeModal();
};
$('#helpBack').onclick = event => {
  if (event.target === $('#helpBack')) closeHelp();
};

document.addEventListener('click', async event => {
  const button = event.target.closest('button');
  if (!button || button.closest('#gate') || button.closest('#helpBack') || button.closest('#folderBar')) return;
  if (button.dataset.cat) {
    activeFilter = button.dataset.cat;
    render();
  }
  if (button.dataset.view) {
    view = button.dataset.view;
    activeFilter = 'All pieces';
    document.querySelectorAll('[data-view]').forEach(nav => {
      nav.classList.toggle('active', nav === button);
    });
    if (mode === 'demo' || mode === 'live') render();
  }
  if (button.dataset.edit) {
    const item = allItems.find(entry => entry.id === button.dataset.edit);
    if (item) openModal(item);
  }
  if (button.dataset.fav) {
    const item = allItems.find(entry => entry.id === button.dataset.fav);
    if (!item) return;
    try {
      await persistItem({ ...item, favorite: !item.favorite });
      if (mode === 'live') await loadLive();
      else render();
      toast(mode === 'demo' ? 'Demo favorite updated. Nothing was written to Sheets.' : 'Favorite updated.');
    } catch (error) {
      toast(publicError(error));
      setStatus(publicError(error), 'error');
    }
  }
  if (button.dataset.worn) {
    try {
      await persistWorn(button.dataset.worn);
      if (mode === 'live') await loadLive();
      else render();
      toast(mode === 'demo' ? 'Demo wear logged. Nothing was written to Sheets.' : 'Wear logged! ✨');
    } catch (error) {
      toast(publicError(error));
      setStatus(publicError(error), 'error');
    }
  }
});

$('#itemForm').onsubmit = async event => {
  event.preventDefault();
  const formData = new FormData(event.target);
  const item = Object.fromEntries(formData.entries());
  item.price = Number(item.price || 0);
  const existing = allItems.find(entry => entry.id === item.id);
  item.favorite = existing ? existing.favorite : false;
  item.imageDataUrl = selectedImageDataUrl;
  item.clearImage = clearExistingImage;
  if (existing && driveFileIdFromUrl(existing.imageUrl) && !item.imageUrl && !selectedImageDataUrl && !clearExistingImage) {
    item.imageUrl = existing.imageUrl;
  }
  $('#savePiece').disabled = true;
  try {
    await persistItem(item);
    closeModal();
    if (mode === 'live') await loadLive();
    else render();
    toast(mode === 'demo'
      ? 'Demo only — nothing was written to Google Sheets.'
      : 'Piece saved to your wardrobe ✨');
  } catch (error) {
    const message = publicError(error);
    toast(message);
    setStatus(message, 'error');
  } finally {
    $('#savePiece').disabled = false;
  }
};

window.addEventListener('offline', () => {
  if (mode === 'live') {
    setStatus('You are offline. Saves, favorites, and wear logs are disabled until you reconnect. Nothing will be queued.', 'offline');
  }
});
window.addEventListener('online', () => {
  if (mode === 'live') {
    setStatus('Back online. Refresh to load the latest wardrobe.', '');
  }
});
window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  deferredPrompt = event;
  $('#promptInstall').disabled = false;
});

function registerWorker() {
  if (!('serviceWorker' in navigator)) return;
  const base = import.meta.env.BASE_URL || '/closete-pwa/';
  let acceptUpdate = false;
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register(`${base}sw.js`, { scope: base });
      const watch = worker => {
        if (!worker) return;
        worker.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) {
            setStatus('An update is ready. Reload to use the new app shell. <button class="pill" type="button" id="applyUpdate">Reload</button>', '');
            $('#applyUpdate')?.addEventListener('click', () => {
              acceptUpdate = true;
              (registration.waiting || worker).postMessage({ type: 'SKIP_WAITING' });
            });
          }
        });
      };
      watch(registration.installing);
      registration.addEventListener('updatefound', () => watch(registration.installing));
    } catch {
      /* the app still works online without a service worker */
    }
  });
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (acceptUpdate) window.location.reload();
  });
}

applyMode(config.ok ? 'signedOut' : 'setup');
registerWorker();
