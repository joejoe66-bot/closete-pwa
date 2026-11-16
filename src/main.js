import '@fontsource/dm-sans/400.css';
import '@fontsource/dm-sans/500.css';
import '@fontsource/dm-sans/600.css';
import '@fontsource/dm-sans/700.css';
import '@fontsource/playfair-display/500.css';
import '@fontsource/playfair-display/600.css';
import '@fontsource/playfair-display/700.css';
import './styles.css';

import { GOOGLE_SCOPES } from './constants.js';
import { favoriteToast, saveToast, wearToast } from './copy.js';
import { configStoreMessage, readConfig, validateConfig, writeConfig } from './config.js';
import { demoRows } from './demo-data.js';
import { userMessage } from './errors.js';
import { createGooglePort, createWardrobeFolder } from './google-port.js';
import { formatMoney } from './money.js';
import { driveFileIdFromUrl } from './images.js';
import { installHint } from './install-hint.js';
import { createMemoryPort } from './memory-port.js';
import { fetchPrivateDriveImage } from './private-image.js';
import { renderItems } from './render.js';
import { createSession } from './session.js';
import { deriveStatus, editsAllowed } from './status.js';
import { loadWardrobe, markWorn, saveItem } from './wardrobe.js';
import { CATEGORIES, collectionTitle, emptyMessage, filterItems, summarize, viewNotice } from './views.js';

const $ = selector => document.querySelector(selector);
const memoryStore = new Map();
const storage = {
  getItem(key) {
    try { return localStorage.getItem(key); } catch { return memoryStore.get(key) ?? null; }
  },
  setItem(key, value) {
    try { localStorage.setItem(key, value); } catch { memoryStore.set(key, value); }
  }
};

const session = createSession();
const blobUrls = new Map();
let mode = 'google';
let port = null;
let items = [];
let loadState = 'unconfigured';
let readOk = false;
let lastError = null;
let offline = !navigator.onLine;
let activeFilter = 'All pieces';
let view = 'all';
let selectedImageDataUrl = '';
let clearExistingImage = false;
let saving = false;
let deferredInstall = null;
let acceptUpdate = false;

const googlePort = createGooglePort({
  getSession: () => session.snapshot(),
  getConfig: () => readConfig(storage)
});

function toast(message) {
  const node = $('#toast');
  node.textContent = message;
  node.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => node.classList.remove('show'), 3200);
}

function currentStatus() {
  const config = readConfig(storage);
  const validation = validateConfig(config);
  return deriveStatus({
    mode,
    offline,
    configValid: validation.ok,
    missing: validation.missing,
    session: session.snapshot().state,
    readOk,
    hasSnapshot: mode === 'google' && loadState === 'ready' && items.length > 0,
    lastError,
    shareWithLink: config.shareWithLink
  });
}

function canEdit() {
  return editsAllowed({ mode, status: currentStatus(), offline });
}

function paintStatus() {
  const status = currentStatus();
  const bar = $('#appStatus');
  bar.dataset.state = status.state;
  $('#statusTitle').textContent = status.title;
  $('#statusDetail').textContent = status.detail;
}

function activePort() {
  return mode === 'demo' ? port : googlePort;
}

function render() {
  const query = $('#search').value;
  const shown = (loadState === 'ready' || loadState === 'demo')
    ? filterItems(items, { query, activeFilter, view })
    : [];
  $('#collectionTitle').textContent = collectionTitle(view);
  const notice = viewNotice(view);
  const note = $('#viewNote');
  note.textContent = notice;
  note.hidden = !notice;

  const filters = $('#filters');
  filters.replaceChildren();
  for (const category of CATEGORIES) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `filter${activeFilter === category ? ' active' : ''}`;
    button.dataset.cat = category;
    button.textContent = category;
    filters.append(button);
  }

  const statsReady = loadState === 'ready' || loadState === 'demo';
  if (!statsReady) {
    $('#count').textContent = '—';
    $('#categories').textContent = '—';
    $('#value').textContent = '—';
    $('#favCount').textContent = '—';
  } else {
    const stats = summarize(items);
    $('#count').textContent = String(stats.count);
    $('#categories').textContent = String(stats.categories);
    $('#value').textContent = formatMoney(stats.value);
    $('#favCount').textContent = String(stats.favorites);
  }

  const grid = $('#items');
  if (!shown.length) {
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.textContent = emptyMessage({
      loadState: statsReady && shown.length === 0 && items.length > 0 ? 'ready' : loadState,
      itemCount: statsReady ? shown.length : items.length
    });
    if (statsReady && items.length > 0 && !shown.length) {
      empty.textContent = 'No pieces match this view.';
    }
    grid.replaceChildren(empty);
  } else {
    grid.innerHTML = renderItems(shown);
    for (const card of grid.querySelectorAll('.card')) {
      card.style.animationDelay = `${Number(card.dataset.delay || 0) * 35}ms`;
    }
    hydratePhotos(grid);
  }
  paintStatus();
}

async function hydratePhotos(root) {
  const token = session.snapshot().token;
  if (!token) return;
  const images = [...root.querySelectorAll('img[data-photo]')];
  await Promise.all(images.map(async img => {
    const fileId = driveFileIdFromUrl(img.getAttribute('src'));
    if (!fileId) return;
    try {
      if (!blobUrls.has(fileId)) {
        const blob = await fetchPrivateDriveImage(fileId, token);
        if (!blob) return;
        blobUrls.set(fileId, URL.createObjectURL(blob));
      }
      if (blobUrls.has(fileId)) img.src = blobUrls.get(fileId);
    } catch {
      /* Leave the original URL. Public legacy photos can still load. */
    }
  }));
}

function clearBlobs() {
  for (const url of blobUrls.values()) URL.revokeObjectURL(url);
  blobUrls.clear();
}

function showPhoto(source) {
  const preview = $('#photoPreview');
  preview.replaceChildren();
  if (!source) {
    const span = document.createElement('span');
    span.textContent = 'No photo selected';
    preview.append(span);
    return;
  }
  const image = document.createElement('img');
  image.alt = 'Selected clothing photo';
  image.src = source;
  preview.append(image);
}

function openModal(item) {
  if (!canEdit()) {
    toast(offline
      ? 'You are offline. Nothing was written to Google.'
      : 'Connect your sheet or start the local demo before adding a piece. Nothing was written.');
    $('#setupBack').classList.add('show');
    return;
  }
  const form = $('#itemForm');
  form.reset();
  selectedImageDataUrl = '';
  clearExistingImage = false;
  $('#modalTitle').textContent = item ? 'Edit piece' : 'Add a piece';
  if (item) {
    for (const key of Object.keys(item)) {
      if (form.elements[key]) form.elements[key].value = item[key] ?? '';
    }
  }
  showPhoto(item?.imageUrl || '');
  $('#modalBack').classList.add('show');
}

function closeModal() {
  $('#modalBack').classList.remove('show');
}

function fillSetupForm() {
  const config = readConfig(storage);
  const form = $('#setupForm');
  form.elements.clientId.value = config.clientId;
  form.elements.spreadsheetId.value = config.spreadsheetId;
  form.elements.folderId.value = config.folderId;
  form.elements.shareWithLink.checked = config.shareWithLink;
  for (const node of form.querySelectorAll('[data-error]')) node.textContent = '';
  $('#originHelp').textContent = `In Google Cloud, create a Web application OAuth client (no client secret) and add this JavaScript origin: ${window.location.origin}`;
}

function showSetupErrors(errors) {
  for (const node of $('#setupForm').querySelectorAll('[data-error]')) {
    node.textContent = errors[node.dataset.error] || '';
  }
}

async function reloadWardrobe() {
  if (mode === 'demo') {
    const result = await loadWardrobe(port);
    items = result.items;
    loadState = 'demo';
    readOk = false;
    lastError = null;
    render();
    return;
  }
  if (offline) {
    loadState = items.length ? 'ready' : 'offline';
    lastError = { kind: 'offline', message: userMessage({ kind: 'offline' }, { action: 'load' }) };
    readOk = false;
    render();
    toast(lastError.message);
    return;
  }
  const sessionState = session.snapshot().state;
  if (sessionState !== 'active') {
    items = [];
    loadState = 'unconfigured';
    readOk = false;
    render();
    return;
  }
  loadState = 'loading';
  render();
  try {
    const result = await loadWardrobe(googlePort);
    items = result.items;
    loadState = 'ready';
    readOk = true;
    lastError = null;
    render();
    if (result.createdSheet) toast('Created the Wardrobe tab and header row in your spreadsheet.');
    else if (result.addedHeaders?.length) toast('Added missing columns on the Wardrobe tab. Existing cells were kept.');
  } catch (error) {
    items = [];
    readOk = false;
    loadState = 'error';
    lastError = { kind: error.kind || 'network', message: userMessage(error, { action: 'load' }) };
    render();
    toast(lastError.message);
  }
}

function startDemo() {
  const seed = demoRows();
  port = createMemoryPort({ headers: seed.headers, rows: seed.rows, keepDataUrl: true, shareWithLink: false });
  mode = 'demo';
  readOk = false;
  lastError = null;
  loadState = 'demo';
  session.clear();
  clearBlobs();
  $('#setupBack').classList.remove('show');
  reloadWardrobe();
  toast('Demo mode is on. These are sample pieces, not your Google wardrobe.');
}

function leaveDemo() {
  if (mode !== 'demo') return;
  mode = 'google';
  port = null;
  items = [];
  loadState = 'unconfigured';
  readOk = false;
  render();
}

async function onStoreConfig(event) {
  event.preventDefault();
  const form = event.target;
  const draft = {
    clientId: form.elements.clientId.value,
    spreadsheetId: form.elements.spreadsheetId.value,
    folderId: form.elements.folderId.value,
    shareWithLink: form.elements.shareWithLink.checked
  };
  const validation = validateConfig(draft);
  writeConfig(storage, draft);
  showSetupErrors(validation.errors);
  readOk = false;
  lastError = null;
  if (mode === 'google') {
    items = [];
    loadState = 'unconfigured';
  }
  render();
  toast(configStoreMessage(validation));
}

function loadGis() {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-gis="1"]');
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Could not load Google sign-in.')), { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.dataset.gis = '1';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Could not load Google sign-in. Check the connection. Not connected.'));
    document.head.appendChild(script);
  });
}

async function signIn() {
  leaveDemo();
  const validation = validateConfig(readConfig(storage));
  if (!validation.ok) {
    showSetupErrors(validation.errors);
    $('#setupBack').classList.add('show');
    toast(configStoreMessage(validation));
    return;
  }
  if (offline) {
    toast('You are offline. Sign-in did not start, and the wardrobe was not loaded.');
    render();
    return;
  }
  try {
    await loadGis();
  } catch (error) {
    toast(error.message || 'Could not load Google sign-in. Not connected.');
    return;
  }
  const client = window.google.accounts.oauth2.initTokenClient({
    client_id: validation.value.clientId,
    scope: GOOGLE_SCOPES.join(' '),
    callback: response => {
      if (!response || response.error) {
        session.clear();
        readOk = false;
        lastError = { kind: 'permission', message: 'Google did not return a sign-in. Not connected.' };
        items = [];
        loadState = 'error';
        render();
        toast(lastError.message);
        return;
      }
      session.set(response.access_token, response.expires_in);
      reloadWardrobe();
    },
    error_callback: error => {
      const blocked = error?.type === 'popup_failed_to_open';
      toast(blocked
        ? 'The Google sign-in window was blocked. Allow pop-ups for this site. Not connected.'
        : 'Google sign-in did not finish. Not connected.');
    }
  });
  client.requestAccessToken({ prompt: 'select_account' });
}

async function createFolder() {
  if (session.snapshot().state !== 'active') {
    toast('Sign in first. No folder was created.');
    return;
  }
  if (offline) {
    toast('You are offline. No folder was created.');
    return;
  }
  try {
    const folder = await createWardrobeFolder({ getSession: () => session.snapshot() });
    const config = readConfig(storage);
    config.folderId = folder.id;
    writeConfig(storage, config);
    fillSetupForm();
    toast('Private folder created in your Drive. Its ID is stored on this device and it was not shared. This may be a different folder from the original Apps Script one.');
  } catch (error) {
    toast(userMessage(error, { action: 'save' }));
  }
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
    const scale = Math.min(1, 1400 / Math.max(image.width, image.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(image.width * scale);
    canvas.height = Math.round(image.height * scale);
    canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(objectUrl);
    selectedImageDataUrl = canvas.toDataURL('image/jpeg', 0.82);
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

async function persistItem(item, { message } = {}) {
  if (!canEdit()) {
    toast(offline
      ? 'You are offline. Nothing was written to Google.'
      : 'Not connected. Nothing was written.');
    return false;
  }
  try {
    const result = await saveItem(activePort(), item);
    if (!result?.success) throw Object.assign(new Error('Save was not confirmed.'), { kind: 'network' });
    lastError = null;
    toast(message || saveToast({ mode, imageShared: result.imageShared }));
    return true;
  } catch (error) {
    if (error.kind !== 'validation') {
      lastError = { kind: error.kind || 'write', message: userMessage(error, { action: 'save' }) };
    }
    toast(error.kind === 'validation' ? userMessage(error, { action: 'save' }) : lastError.message);
    render();
    return false;
  }
}

function openInstall() {
  const standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  const hint = installHint(navigator.userAgent, standalone);
  $('#installTitle').textContent = hint.title;
  $('#installLead').textContent = 'Installing saves the app shell on this device. It does not copy your wardrobe, token, or Google password.';
  const list = $('#installSteps');
  list.replaceChildren();
  for (const step of hint.steps) {
    const item = document.createElement('li');
    item.textContent = step;
    list.append(item);
  }
  $('#installNow').hidden = !deferredInstall;
  $('#installBack').classList.add('show');
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, {
        scope: import.meta.env.BASE_URL
      });
      if (!navigator.serviceWorker.controller && (registration.waiting || registration.installing)) {
        (registration.waiting || registration.installing).postMessage({ type: 'SKIP_WAITING' });
      }
      registration.addEventListener('updatefound', () => {
        const worker = registration.installing;
        worker?.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) {
            $('#updateBanner').hidden = false;
          }
        });
      });
    } catch {
      /* The online app still runs if the worker cannot register. */
    }
  });
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!acceptUpdate) return;
    window.location.reload();
  });
}

$('#setupForm').addEventListener('submit', onStoreConfig);
$('#signInBtn').addEventListener('click', signIn);
$('#createFolderBtn').addEventListener('click', createFolder);
$('#demoBtn').addEventListener('click', startDemo);
$('#closeSetup').addEventListener('click', () => $('#setupBack').classList.remove('show'));
$('#setupBtn').addEventListener('click', () => {
  fillSetupForm();
  $('#setupBack').classList.add('show');
});
$('#setupBack').addEventListener('click', event => {
  if (event.target === $('#setupBack')) $('#setupBack').classList.remove('show');
});

$('#addTop').addEventListener('click', () => openModal());
$('#addHero').addEventListener('click', () => openModal());
$('#cancel').addEventListener('click', closeModal);
$('#refresh').addEventListener('click', () => {
  if (mode === 'demo') reloadWardrobe();
  else if (session.snapshot().state === 'active') reloadWardrobe();
  else toast('Sign in before refreshing. Nothing was loaded.');
});
$('#search').addEventListener('input', render);
$('#modalBack').addEventListener('click', event => {
  if (event.target === $('#modalBack')) closeModal();
});
$('#takePhoto').addEventListener('click', () => $('#cameraFile').click());
$('#importPhoto').addEventListener('click', () => $('#importFile').click());
$('#cameraFile').addEventListener('change', event => {
  preparePhoto(event.target.files[0]);
  event.target.value = '';
});
$('#importFile').addEventListener('change', event => {
  preparePhoto(event.target.files[0]);
  event.target.value = '';
});
$('#removePhoto').addEventListener('click', () => {
  selectedImageDataUrl = '';
  clearExistingImage = true;
  $('#itemForm').elements.imageUrl.value = '';
  showPhoto('');
});
$('#itemForm').elements.imageUrl.addEventListener('input', () => {
  if ($('#itemForm').elements.imageUrl.value.trim()) clearExistingImage = false;
});

$('#itemForm').addEventListener('submit', async event => {
  event.preventDefault();
  if (saving) return;
  const formData = new FormData(event.target);
  const item = Object.fromEntries(formData.entries());
  item.price = Number(item.price || 0);
  const existing = items.find(entry => entry.id === item.id);
  item.favorite = existing ? existing.favorite : false;
  item.imageDataUrl = selectedImageDataUrl;
  item.clearImage = clearExistingImage;
  saving = true;
  const saved = await persistItem(item);
  saving = false;
  if (!saved) return;
  closeModal();
  await reloadWardrobe();
});

document.addEventListener('click', async event => {
  const button = event.target.closest('button');
  if (!button) return;
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
    render();
  }
  if (button.dataset.edit) {
    const item = items.find(entry => entry.id === button.dataset.edit);
    if (item) openModal(item);
  }
  if (button.dataset.fav) {
    const item = items.find(entry => entry.id === button.dataset.fav);
    if (!item) return;
    const saved = await persistItem(
      { ...item, favorite: !item.favorite },
      { message: favoriteToast(mode) }
    );
    if (saved) await reloadWardrobe();
  }
  if (button.dataset.worn) {
    if (!canEdit()) {
      toast(offline ? 'You are offline. Nothing was written to Google.' : 'Not connected. The wear log was not written.');
      return;
    }
    try {
      const result = await markWorn(activePort(), button.dataset.worn);
      if (!result?.success) throw Object.assign(new Error('Wear was not confirmed.'), { kind: 'network' });
      lastError = null;
      toast(wearToast(mode));
      await reloadWardrobe();
    } catch (error) {
      if (error.kind !== 'validation') {
        lastError = { kind: error.kind || 'write', message: userMessage(error, { action: 'save' }) };
      }
      toast(error.kind === 'validation' ? userMessage(error) : (lastError?.message || userMessage(error)));
      render();
    }
  }
});

$('#installBtn').addEventListener('click', openInstall);
$('#closeInstall').addEventListener('click', () => $('#installBack').classList.remove('show'));
$('#installBack').addEventListener('click', event => {
  if (event.target === $('#installBack')) $('#installBack').classList.remove('show');
});
$('#installNow').addEventListener('click', async () => {
  if (!deferredInstall) return;
  deferredInstall.prompt();
  await deferredInstall.userChoice;
  deferredInstall = null;
  $('#installNow').hidden = true;
});
window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  deferredInstall = event;
});

$('#applyUpdate').addEventListener('click', async () => {
  acceptUpdate = true;
  const registration = await navigator.serviceWorker.getRegistration(import.meta.env.BASE_URL);
  registration?.waiting?.postMessage({ type: 'SKIP_WAITING' });
});

window.addEventListener('online', () => {
  offline = false;
  render();
});
window.addEventListener('offline', () => {
  offline = true;
  if (mode !== 'demo') readOk = false;
  render();
});

registerServiceWorker();
fillSetupForm();
const initial = validateConfig(readConfig(storage));
if (!initial.ok) $('#setupBack').classList.add('show');
render();
