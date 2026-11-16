/** Shared wardrobe schema. Matches legacy/Code.gs CONFIG. */
export const SHEET_NAME = 'Wardrobe';
export const DRIVE_FOLDER_NAME = 'CLOSETÉ Wardrobe Photos';
export const CURRENCY = 'S$';
export const TIMEZONE = 'Asia/Singapore';
export const MAX_IMAGE_BYTES = 7 * 1024 * 1024;

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
  'updatedAt'
];

/** Least privilege that can still open a spreadsheet the owner already has by ID. */
export const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.file'
];

export const BASE_PATH = '/closete-pwa/';
