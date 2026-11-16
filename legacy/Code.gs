/**
 * CLOSETÉ — Digital Wardrobe
 * Backend: Google Apps Script
 * Database: Google Sheets
 *
 * 使用前：請先在 Google Sheets 中開啟
 * 擴充功能 → Apps Script
 */

const CONFIG = {
  SHEET_NAME: 'Wardrobe',
  DRIVE_FOLDER_NAME: 'CLOSETÉ Wardrobe Photos',
  CURRENCY: 'S$',
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
    'updatedAt'
  ]
};

/**
 * 開啟網頁 App
 */
function doGet() {
  return HtmlService
    .createHtmlOutputFromFile('Index')
    .setTitle('CLOSETÉ — My Digital Wardrobe')
    .addMetaTag(
      'viewport',
      'width=device-width, initial-scale=1, maximum-scale=1'
    );
}

/**
 * 取得資料表；不存在時自動建立
 */
function getWardrobeSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  if (!ss) {
    throw new Error(
      '找不到 Google Spreadsheet，請從 Google Sheets 的「擴充功能 → Apps Script」開啟本專案。'
    );
  }

  let sheet = ss.getSheetByName(CONFIG.SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEET_NAME);
  }

  if (sheet.getLastRow() === 0) {
    sheet.getRange(
      1, 1, 1, CONFIG.HEADERS.length
    ).setValues([CONFIG.HEADERS]);

    sheet.setFrozenRows(1);
    sheet.getRange(
      1, 1, 1, CONFIG.HEADERS.length
    )
      .setFontWeight('bold')
      .setBackground('#596347')
      .setFontColor('#ffffff');

    sheet.autoResizeColumns(
      1, CONFIG.HEADERS.length
    );
  } else {
    // 確保現有資料表的欄位完整。
    // 不會清除既有資料。
    const currentHeaders = sheet
      .getRange(1, 1, 1, sheet.getLastColumn())
      .getDisplayValues()[0];

    CONFIG.HEADERS.forEach(header => {
      if (!currentHeaders.includes(header)) {
        const newColumn = sheet.getLastColumn() + 1;
        sheet.getRange(1, newColumn).setValue(header);
        currentHeaders.push(header);
      }
    });
  }

  return sheet;
}

/**
 * 將表格一列轉換成前端使用的物件
 */
function rowToItem_(headers, row) {
  const item = {};

  headers.forEach((header, index) => {
    item[header] = row[index];
  });

  // 前端使用字串 ID
  item.id = String(item.id || '');

  // 價格和穿著次數轉成數字
  item.price = Number(item.price || 0);
  item.wearCount = Number(item.wearCount || 0);

  // 將 Google Sheets 的布林值轉成 true / false
  item.favorite =
    item.favorite === true ||
    String(item.favorite).toLowerCase() === 'true';

  // 日期欄位轉成 HTML date input 使用的格式
  item.purchaseDate = formatDate_(item.purchaseDate);
  item.lastWorn = formatDate_(item.lastWorn);

  item.currency = CONFIG.CURRENCY;

  return item;
}

/**
 * 格式化日期
 */
function formatDate_(value) {
  if (!value) return '';

  if (
    Object.prototype.toString.call(value) ===
    '[object Date]'
  ) {
    if (isNaN(value.getTime())) return '';

    return Utilities.formatDate(
      value,
      Session.getScriptTimeZone() || 'Asia/Singapore',
      'yyyy-MM-dd'
    );
  }

  return String(value).slice(0, 10);
}

/**
 * 讀取所有衣服
 * 供 Index.html 的 google.script.run.getItems() 使用
 */
function getItems() {
  const sheet = getWardrobeSheet_();
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) return [];

  const lastColumn = sheet.getLastColumn();

  const headers = sheet
    .getRange(1, 1, 1, lastColumn)
    .getDisplayValues()[0];

  const rows = sheet
    .getRange(2, 1, lastRow - 1, lastColumn)
    .getValues();

  return rows
    .filter(row => row[headers.indexOf('id')])
    .map(row => rowToItem_(headers, row))
    .reverse();
}

/**
 * 新增或更新衣服
 * 供 Index.html 的 saveItem(item) 使用
 */
function saveItem(item) {
  if (!item || typeof item !== 'object') {
    throw new Error('衣服資料格式不正確。');
  }

  const name = String(item.name || '').trim();

  if (!name) {
    throw new Error('請輸入衣服名稱。');
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const sheet = getWardrobeSheet_();
    const lastColumn = sheet.getLastColumn();

    const headers = sheet
      .getRange(1, 1, 1, lastColumn)
      .getDisplayValues()[0];

    const lastRow = sheet.getLastRow();
    const idIndex = headers.indexOf('id');

    let rowNumber = -1;

    if (item.id && lastRow >= 2) {
      const ids = sheet
        .getRange(2, idIndex + 1, lastRow - 1, 1)
        .getDisplayValues();

      const index = ids.findIndex(
        row => String(row[0]) === String(item.id)
      );

      if (index !== -1) {
        rowNumber = index + 2;
      }
    }

    const existing = rowNumber > 0
      ? rowToItem_(
          headers,
          sheet.getRange(
            rowNumber, 1, 1, lastColumn
          ).getValues()[0]
        )
      : {};

    const now = new Date();

    // 有選新照片時上傳到 Drive。
    // 沒有新照片時沿用原有圖片網址或手動輸入的網址。
    let imageUrl = String(item.imageUrl || '');

    if (item.imageDataUrl) {
      imageUrl = uploadWardrobeImage_(
        item.imageDataUrl,
        name
      );
    } else if (
      item.clearImage === true ||
      String(item.clearImage).toLowerCase() === 'true'
    ) {
      imageUrl = '';
    }

    const record = {
      id: existing.id || Utilities.getUuid(),
      name: name,
      category: String(item.category || 'Other'),
      brand: String(item.brand || ''),
      color: String(item.color || ''),
      size: String(item.size || ''),
      price: Math.max(0, Number(item.price || 0)),
      purchaseDate: String(item.purchaseDate || ''),
      imageUrl: imageUrl,
      notes: String(item.notes || ''),
      favorite: item.favorite === true ||
        String(item.favorite).toLowerCase() === 'true',
      lastWorn: existing.lastWorn || '',
      wearCount: Number(existing.wearCount || 0),
      createdAt: existing.createdAt || now,
      updatedAt: now
    };

    const values = headers.map(header => {
      if (
        header === 'purchaseDate' ||
        header === 'lastWorn'
      ) {
        return record[header] || '';
      }

      return record[header] !== undefined
        ? record[header]
        : '';
    });

    if (rowNumber > 0) {
      sheet.getRange(
        rowNumber, 1, 1, lastColumn
      ).setValues([values]);
    } else {
      sheet.appendRow(values);
    }

    return {
      success: true,
      id: record.id,
      message: '衣服資料已儲存。'
    };

  } finally {
    lock.releaseLock();
  }
}

/**
 * 將瀏覽器縮小後的圖片儲存到 Google Drive，並回傳圖片網址
 */
function uploadWardrobeImage_(dataUrl, itemName) {
  const match = String(dataUrl).match(
    /^data:image\/(jpeg|png|webp);base64,([\s\S]+)$/
  );

  if (!match) {
    throw new Error(
      '圖片格式不支援，請選擇 JPG、PNG 或 WebP。'
    );
  }

  const mimeType = 'image/' + match[1];
  const bytes = Utilities.base64Decode(match[2]);

  if (bytes.length > 7 * 1024 * 1024) {
    throw new Error(
      '圖片仍然太大，請選擇較小的照片。'
    );
  }

  const properties = PropertiesService.getScriptProperties();
  let folder;

  const folderId = properties.getProperty(
    'CLOSETÉ_DRIVE_FOLDER_ID'
  );

  if (folderId) {
    try {
      folder = DriveApp.getFolderById(folderId);
    } catch (error) {
      // 找不到舊資料夾時，下面會建立或搜尋資料夾。
    }
  }

  if (!folder) {
    const folders = DriveApp.getFoldersByName(
      CONFIG.DRIVE_FOLDER_NAME
    );

    folder = folders.hasNext()
      ? folders.next()
      : DriveApp.createFolder(CONFIG.DRIVE_FOLDER_NAME);

    properties.setProperty(
      'CLOSETÉ_DRIVE_FOLDER_ID',
      folder.getId()
    );
  }

  const extension = match[1] === 'jpeg'
    ? 'jpg'
    : match[1];

  const safeName = String(itemName || 'wardrobe-item')
    .replace(/[\\/:*?"<>|#%{}~&]/g, '_')
    .slice(0, 60);

  const blob = Utilities.newBlob(
    bytes,
    mimeType,
    safeName + '-' + Date.now() + '.' + extension
  );

  const file = folder.createFile(blob);

  // 圖片設為「知道連結的任何人可檢視」，
  // 讓衣物清單可直接顯示圖片。
  file.setSharing(
    DriveApp.Access.ANYONE_WITH_LINK,
    DriveApp.Permission.VIEW
  );

  return 'https://drive.google.com/uc?export=view&id=' +
    file.getId();
}

/**
 * 記錄穿過衣服的日期
 * 供 Index.html 的 markWorn(id) 使用
 */
function markWorn(id) {
  if (!id) {
    throw new Error('缺少衣服 ID。');
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const sheet = getWardrobeSheet_();
    const lastRow = sheet.getLastRow();

    if (lastRow < 2) {
      throw new Error('衣櫥中沒有衣服資料。');
    }

    const lastColumn = sheet.getLastColumn();

    const headers = sheet
      .getRange(1, 1, 1, lastColumn)
      .getDisplayValues()[0];

    const idColumn = headers.indexOf('id') + 1;
    const wornColumn = headers.indexOf('lastWorn') + 1;
    const countColumn = headers.indexOf('wearCount') + 1;
    const updatedColumn = headers.indexOf('updatedAt') + 1;

    const ids = sheet
      .getRange(2, idColumn, lastRow - 1, 1)
      .getDisplayValues();

    const index = ids.findIndex(
      row => String(row[0]) === String(id)
    );

    if (index === -1) {
      throw new Error('找不到這件衣服。');
    }

    const rowNumber = index + 2;
    const today = Utilities.formatDate(
      new Date(),
      Session.getScriptTimeZone() || 'Asia/Singapore',
      'yyyy-MM-dd'
    );

    const currentCount = Number(
      sheet.getRange(rowNumber, countColumn).getValue() || 0
    );

    sheet.getRange(rowNumber, wornColumn).setValue(today);
    sheet.getRange(rowNumber, countColumn)
      .setValue(currentCount + 1);
    sheet.getRange(rowNumber, updatedColumn)
      .setValue(new Date());

    return {
      success: true,
      lastWorn: today,
      wearCount: currentCount + 1
    };

  } finally {
    lock.releaseLock();
  }
}

/**
 * 初始化資料表
 * 可以在 Apps Script 編輯器中手動執行一次
 */
function setupWardrobe() {
  const sheet = getWardrobeSheet_();

  SpreadsheetApp.getActiveSpreadsheet().toast(
    'CLOSETÉ 衣櫥資料表已準備好！',
    'CLOSETÉ',
    5
  );

  return sheet.getName();
}
