export function saveToast({ mode, imageShared } = {}) {
  if (mode === 'demo') {
    return 'Saved in the demo on this device only. Nothing was written to Google.';
  }
  if (imageShared === true) {
    return 'Piece saved to your Google Sheet. The new photo is visible to anyone with the link.';
  }
  if (imageShared === false) {
    return 'Piece saved to your Google Sheet. The photo stays private.';
  }
  return 'Piece saved to your Google Sheet.';
}

export function wearToast(mode) {
  return mode === 'demo'
    ? 'Wear logged in the demo only. Nothing was written to Google.'
    : 'Wear logged.';
}

export function favoriteToast(mode) {
  return mode === 'demo'
    ? 'Favorite updated in the demo only. Nothing was written to Google.'
    : 'Favorite updated on your Google Sheet.';
}
