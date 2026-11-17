/**
 * CLOSETÉ — Digital Wardrobe
 * Backend: Google Apps Script
 * Database: Google Sheets
 *
 * 第一次使用：
 *   1. 喺編輯器揀 setupApiToken → 執行 → 批准權限
 *   2. 喺「執行記錄」抄低個密碼（App 入面要輸入一次）
 *   3. 部署 → 新部署 → 網頁應用程式
 *      執行身分：我；存取權：任何人
 *   4. 抄低 /exec 網址，喺 PWA 第一次開嗰陣貼入去
 *
 * 所有讀寫都要經 api() 同密碼，所以就算網址俾人知道，冇密碼都睇唔到、改唔到。
 */

const CONFIG = {
  SHEET_NAME: 'Wardrobe',
  // 如果呢個 script 唔係喺 Google Sheets「擴充功能 → Apps Script」開嘅，就會用呢個 ID。
  SPREADSHEET_ID: '1NqubXEZAIJdBOnK9iru0qR4b2jPc8tRPToR2s9mYCng',
  DRIVE_FOLDER_NAME: 'CLOSETÉ Wardrobe Photos',
  CURRENCY: 'S$',
  TIME_ZONE: 'Asia/Singapore',
  TOKEN_PROPERTY: 'CLOSETE_API_TOKEN',
  FOLDER_PROPERTY: 'CLOSETÉ_DRIVE_FOLDER_ID',
  MAX_IMAGE_BYTES: 7 * 1024 * 1024,
  HEADERS: [
    'id',
    'name',
    'category',
    'brand',
    'color',
    'size',
    'price',
    'purchaseDate',
    'imageUrl',
    'notes',
    'favorite',
    'lastWorn',
    'wearCount',
    'createdAt',
    'updatedAt',
    'brandImageUrl'
  ]
};

/* ------------------------------------------------------------------ */
/* 入口                                                                */
/* ------------------------------------------------------------------ */

/** 開啟網頁版（喺瀏覽器直接用 Apps Script 網址） */
function doGet() {
  return HtmlService
    .createHtmlOutputFromFile('Index')
    .setTitle('CLOSETÉ — My Digital Wardrobe')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover');
}

/** PWA（GitHub Pages）用嘅 JSON API */
function doPost(e) {
  let request;
  try {
    request = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (error) {
    return json_({ ok: false, error: '請求格式不正確。' });
  }
  return json_(handle_(request));
}

/** 網頁版用 google.script.run.api(request) */
function api(request) {
  return handle_(request || {});
}

function handle_(request) {
  try {
    checkToken_(request.token);
    const payload = request.payload || {};
    let data;
    switch (request.action) {
      case 'ping':           data = { ok: true }; break;
      case 'getItems':       data = getItems_(); break;
      case 'saveItem':       data = saveItem_(payload.item); break;
      case 'deleteItem':     data = deleteItem_(payload.id); break;
      case 'markWorn':       data = markWorn_(payload.id); break;
      case 'toggleFavorite': data = toggleFavorite_(payload.id); break;
      default: throw new Error('未知的操作：' + request.action);
    }
    return { ok: true, data: data };
  } catch (error) {
    return {
      ok: false,
      error: String((error && error.message) || error),
      code: error && error.code ? error.code : ''
    };
  }
}

function json_(object) {
  return ContentService
    .createTextOutput(JSON.stringify(object))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ------------------------------------------------------------------ */
/* 密碼                                                                */
/* ------------------------------------------------------------------ */

/** 喺編輯器執行一次，喺執行記錄攞密碼。再執行會顯示同一個密碼。 */
function setupApiToken() {
  const props = PropertiesService.getScriptProperties();
  let token = props.getProperty(CONFIG.TOKEN_PROPERTY);
  if (!token) {
    token = Utilities.getUuid().replace(/-/g, '').slice(0, 20);
    props.setProperty(CONFIG.TOKEN_PROPERTY, token);
  }
  getWardrobeSheet_(); // 順便建立 / 更新表頭
  Logger.log('CLOSETÉ 密碼：' + token);
  return token;
}

/** 想換密碼（例如唔小心俾咗人）就執行呢個，舊密碼即時失效。 */
function resetApiToken() {
  PropertiesService.getScriptProperties().deleteProperty(CONFIG.TOKEN_PROPERTY);
  return setupApiToken();
}

function checkToken_(token) {
  const expected = PropertiesService.getScriptProperties().getProperty(CONFIG.TOKEN_PROPERTY);
  if (!expected) {
    throw codedError_('未設定密碼：請喺 Apps Script 編輯器執行 setupApiToken。', 'NO_TOKEN');
  }
  if (!token || String(token).trim() !== expected) {
    throw codedError_('密碼不正確。', 'AUTH');
  }
}

function codedError_(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

/* ------------------------------------------------------------------ */
/* 資料表                                                              */
/* ------------------------------------------------------------------ */

function getSpreadsheet_() {
  let ss = null;
  try { ss = SpreadsheetApp.getActiveSpreadsheet(); } catch (error) {}
  if (!ss && CONFIG.SPREADSHEET_ID) ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  if (!ss) throw new Error('找不到 Google Spreadsheet，請設定 CONFIG.SPREADSHEET_ID。');
  return ss;
}

/** 取得資料表；不存在時自動建立；缺少欄位會自動喺最後補上（唔會清資料） */
function getWardrobeSheet_() {
  const ss = getSpreadsheet_();
  let sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(CONFIG.SHEET_NAME);

  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, CONFIG.HEADERS.length).setValues([CONFIG.HEADERS]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, CONFIG.HEADERS.length)
      .setFontWeight('bold')
      .setBackground('#596347')
      .setFontColor('#ffffff');
    return sheet;
  }

  const current = sheet
    .getRange(1, 1, 1, Math.max(1, sheet.getLastColumn()))
    .getDisplayValues()[0]
    .map(h => String(h).trim());

  CONFIG.HEADERS.forEach(header => {
    if (current.indexOf(header) === -1) {
      const column = current.length + 1;
      sheet.getRange(1, column)
        .setValue(header)
        .setFontWeight('bold')
        .setBackground('#596347')
        .setFontColor('#ffffff');
      current.push(header);
    }
  });

  return sheet;
}

function readTable_() {
  const sheet = getWardrobeSheet_();
  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();
  const headers = sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0].map(h => String(h).trim());
  const rows = lastRow >= 2
    ? sheet.getRange(2, 1, lastRow - 1, lastColumn).getValues()
    : [];
  return { sheet: sheet, headers: headers, rows: rows, lastColumn: lastColumn };
}

function findRow_(table, id) {
  const idIndex = table.headers.indexOf('id');
  if (!id) return -1;
  for (let i = 0; i < table.rows.length; i++) {
    if (String(table.rows[i][idIndex]) === String(id)) return i + 2;
  }
  return -1;
}

function column_(table, header) {
  return table.headers.indexOf(header) + 1;
}

/** 將表格一列轉換成前端使用的物件 */
function rowToItem_(headers, row) {
  const item = {};
  headers.forEach((header, index) => {
    if (header) item[header] = row[index];
  });

  ['id', 'name', 'category', 'brand', 'color', 'size', 'notes', 'imageUrl', 'brandImageUrl']
    .forEach(key => { item[key] = item[key] == null ? '' : String(item[key]); });

  item.price = Number(item.price || 0);
  item.wearCount = Number(item.wearCount || 0);
  item.favorite = item.favorite === true || String(item.favorite).toLowerCase() === 'true';
  item.purchaseDate = formatDate_(item.purchaseDate);
  item.lastWorn = formatDate_(item.lastWorn);
  item.createdAt = item.createdAt instanceof Date ? item.createdAt.toISOString() : String(item.createdAt || '');
  item.updatedAt = item.updatedAt instanceof Date ? item.updatedAt.toISOString() : String(item.updatedAt || '');
  item.imageUrl = displayUrl_(item.imageUrl);
  item.brandImageUrl = displayUrl_(item.brandImageUrl);
  item.currency = CONFIG.CURRENCY;
  return item;
}

function formatDate_(value) {
  if (!value) return '';
  if (Object.prototype.toString.call(value) === '[object Date]') {
    if (isNaN(value.getTime())) return '';
    return Utilities.formatDate(value, timeZone_(), 'yyyy-MM-dd');
  }
  return String(value).slice(0, 10);
}

function timeZone_() {
  return Session.getScriptTimeZone() || CONFIG.TIME_ZONE;
}

/** 舊嘅 drive.google.com/uc?export=view 連結好多瀏覽器已經唔顯示，轉做 lh3 連結 */
function displayUrl_(url) {
  const id = driveFileId_(url);
  return id ? 'https://lh3.googleusercontent.com/d/' + id : String(url || '');
}

function driveFileId_(url) {
  const text = String(url || '');
  let match = text.match(/^https:\/\/drive\.google\.com\/(?:uc|open|thumbnail)\?(?:.*&)?id=([\w-]{20,})/);
  if (match) return match[1];
  match = text.match(/^https:\/\/drive\.google\.com\/file\/d\/([\w-]{20,})/);
  if (match) return match[1];
  match = text.match(/^https:\/\/lh3\.googleusercontent\.com\/d\/([\w-]{20,})/);
  if (match) return match[1];
  return '';
}

/* ------------------------------------------------------------------ */
/* 操作                                                                */
/* ------------------------------------------------------------------ */

/** 讀取所有衣服（最新加入嘅排最前） */
function getItems_() {
  const table = readTable_();
  const idIndex = table.headers.indexOf('id');
  return table.rows
    .filter(row => row[idIndex])
    .map(row => rowToItem_(table.headers, row))
    .reverse();
}

/** 新增或更新衣服 */
function saveItem_(item) {
  if (!item || typeof item !== 'object') throw new Error('衣服資料格式不正確。');
  const name = String(item.name || '').trim();
  if (!name) throw new Error('請輸入衣服名稱。');

  return withLock_(() => {
    const table = readTable_();
    const rowNumber = item.id ? findRow_(table, item.id) : -1;
    if (item.id && rowNumber === -1) throw new Error('找不到這件衣服，可能已經被刪除。');

    const existing = rowNumber > 0 ? rowToItem_(table.headers, table.rows[rowNumber - 2]) : {};
    const now = new Date();

    const imageUrl = resolveImage_(item.imageDataUrl, item.clearImage, item.imageUrl, existing.imageUrl, name);
    const brandImageUrl = resolveImage_(item.brandImageDataUrl, item.clearBrandImage, item.brandImageUrl, existing.brandImageUrl, name + '-label');

    const record = {
      id: existing.id || Utilities.getUuid(),
      name: name,
      category: String(item.category || 'Other'),
      brand: String(item.brand || ''),
      color: String(item.color || ''),
      size: String(item.size || ''),
      price: Math.max(0, Number(item.price || 0) || 0),
      purchaseDate: String(item.purchaseDate || ''),
      imageUrl: imageUrl,
      notes: String(item.notes || ''),
      favorite: rowNumber > 0 ? existing.favorite : item.favorite === true,
      lastWorn: existing.lastWorn || '',
      wearCount: Number(existing.wearCount || 0),
      createdAt: rowNumber > 0 ? table.rows[rowNumber - 2][table.headers.indexOf('createdAt')] || now : now,
      updatedAt: now,
      brandImageUrl: brandImageUrl
    };

    const values = table.headers.map(header => {
      const value = record[header] !== undefined ? record[header] : '';
      // 防止輸入「=」開頭嘅文字變成公式
      return typeof value === 'string' && /^[=+\-@]/.test(value) ? "'" + value : value;
    });

    if (rowNumber > 0) {
      table.sheet.getRange(rowNumber, 1, 1, table.lastColumn).setValues([values]);
      // 換咗相或者刪咗相，就將舊相放入垃圾桶
      if (existing.imageUrl !== imageUrl) trashOwnPhoto_(existing.imageUrl);
      if (existing.brandImageUrl !== brandImageUrl) trashOwnPhoto_(existing.brandImageUrl);
    } else {
      table.sheet.appendRow(values);
    }

    const saved = Object.assign({}, record, {
      createdAt: record.createdAt instanceof Date ? record.createdAt.toISOString() : String(record.createdAt),
      updatedAt: now.toISOString(),
      currency: CONFIG.CURRENCY
    });
    return { item: saved, message: '衣服資料已儲存。' };
  });
}

function resolveImage_(dataUrl, clear, typedUrl, existingUrl, label) {
  if (dataUrl) return uploadWardrobeImage_(dataUrl, label);
  if (clear === true || String(clear).toLowerCase() === 'true') return '';
  const typed = String(typedUrl || '').trim();
  if (typed) return displayUrl_(typed);
  return existingUrl || '';
}

/** 刪除衣服（連埋佢喺 Drive 嘅相） */
function deleteItem_(id) {
  if (!id) throw new Error('缺少衣服 ID。');
  return withLock_(() => {
    const table = readTable_();
    const rowNumber = findRow_(table, id);
    if (rowNumber === -1) throw new Error('找不到這件衣服。');
    const existing = rowToItem_(table.headers, table.rows[rowNumber - 2]);
    table.sheet.deleteRow(rowNumber);
    trashOwnPhoto_(existing.imageUrl);
    trashOwnPhoto_(existing.brandImageUrl);
    return { id: String(id) };
  });
}

/** 記錄今日著過 */
function markWorn_(id) {
  if (!id) throw new Error('缺少衣服 ID。');
  return withLock_(() => {
    const table = readTable_();
    const rowNumber = findRow_(table, id);
    if (rowNumber === -1) throw new Error('找不到這件衣服。');

    const today = Utilities.formatDate(new Date(), timeZone_(), 'yyyy-MM-dd');
    const countColumn = column_(table, 'wearCount');
    const currentCount = Number(table.rows[rowNumber - 2][countColumn - 1] || 0);

    table.sheet.getRange(rowNumber, column_(table, 'lastWorn')).setValue(today);
    table.sheet.getRange(rowNumber, countColumn).setValue(currentCount + 1);
    table.sheet.getRange(rowNumber, column_(table, 'updatedAt')).setValue(new Date());

    return { id: String(id), lastWorn: today, wearCount: currentCount + 1 };
  });
}

/** 收藏 / 取消收藏（只改一格，唔使成件衫重新儲存） */
function toggleFavorite_(id) {
  if (!id) throw new Error('缺少衣服 ID。');
  return withLock_(() => {
    const table = readTable_();
    const rowNumber = findRow_(table, id);
    if (rowNumber === -1) throw new Error('找不到這件衣服。');
    const favColumn = column_(table, 'favorite');
    const current = table.rows[rowNumber - 2][favColumn - 1];
    const next = !(current === true || String(current).toLowerCase() === 'true');
    table.sheet.getRange(rowNumber, favColumn).setValue(next);
    table.sheet.getRange(rowNumber, column_(table, 'updatedAt')).setValue(new Date());
    return { id: String(id), favorite: next };
  });
}

function withLock_(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

/* ------------------------------------------------------------------ */
/* 相片（Google Drive）                                                */
/* ------------------------------------------------------------------ */

function getPhotoFolder_() {
  const props = PropertiesService.getScriptProperties();
  const folderId = props.getProperty(CONFIG.FOLDER_PROPERTY);
  if (folderId) {
    try { return DriveApp.getFolderById(folderId); } catch (error) {}
  }
  const folders = DriveApp.getFoldersByName(CONFIG.DRIVE_FOLDER_NAME);
  const folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(CONFIG.DRIVE_FOLDER_NAME);
  props.setProperty(CONFIG.FOLDER_PROPERTY, folder.getId());
  return folder;
}

/** 儲存瀏覽器壓縮好嘅相，回傳可以顯示嘅網址 */
function uploadWardrobeImage_(dataUrl, itemName) {
  const match = String(dataUrl).match(/^data:image\/(jpeg|png|webp);base64,([\s\S]+)$/);
  if (!match) throw new Error('圖片格式不支援，請選擇 JPG、PNG 或 WebP。');

  const bytes = Utilities.base64Decode(match[2]);
  if (bytes.length > CONFIG.MAX_IMAGE_BYTES) throw new Error('圖片太大，請選擇較小的照片。');

  const extension = match[1] === 'jpeg' ? 'jpg' : match[1];
  const safeName = String(itemName || 'wardrobe-item').replace(/[\\/:*?"<>|#%{}~&]/g, '_').slice(0, 60);
  const blob = Utilities.newBlob(bytes, 'image/' + match[1], safeName + '-' + Date.now() + '.' + extension);
  const file = getPhotoFolder_().createFile(blob);
  // App 要直接顯示相片，所以設為「知道連結的人可檢視」。
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return 'https://lh3.googleusercontent.com/d/' + file.getId();
}

/** 只會刪 CLOSETÉ 相片資料夾入面嘅相，其他 Drive 檔案唔會掂 */
function trashOwnPhoto_(url) {
  const id = driveFileId_(url);
  if (!id) return;
  try {
    const folderId = getPhotoFolder_().getId();
    const file = DriveApp.getFileById(id);
    const parents = file.getParents();
    while (parents.hasNext()) {
      if (parents.next().getId() === folderId) {
        file.setTrashed(true);
        return;
      }
    }
  } catch (error) {
    // 相片已經唔存在或者冇權限，略過
  }
}
