/** Confirmed Wardrobe tab. Browser OAuth is a separate, still-missing setup step. */
export const HEADERS = [
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
];

export const SHEET_NAME = 'Wardrobe';
export const SPREADSHEET_ID = '1NqubXEZAIJdBOnK9iru0qR4b2jPc8tRPToR2s9mYCng';
export const SHEET_ID = 1746053320;
export const CURRENCY = 'S$';
export const TIMEZONE = 'Asia/Singapore';
export const DRIVE_FOLDER_NAME = 'CLOSETÉ Wardrobe Photos';
export const BASE_PATH = '/closete-pwa/';
export const PHOTO_MAX_EDGE = 1400;
export const PHOTO_JPEG_QUALITY = 0.82;
export const MAX_IMAGE_BYTES = 7 * 1024 * 1024;

/** Narrowest scopes that can edit the sheet and only files this app creates. */
export const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.file',
];

export const CATEGORIES = [
  'All pieces',
  'Tops',
  'Bottoms',
  'Outerwear',
  'Shoes',
  'Accessories',
  'Dresses',
  'Sportswear',
  'Other',
];

export const DRIVE_FOLDER_STORAGE_KEY = 'closete.driveFolderId';
