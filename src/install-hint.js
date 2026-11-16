export function installHint(userAgent = '', standalone = false) {
  if (standalone) {
    return {
      platform: 'installed',
      title: 'Installed',
      steps: ['CLOSETÉ is already open as an app.']
    };
  }
  const ua = String(userAgent || '');
  if (/iphone|ipad|ipod/i.test(ua)) {
    return {
      platform: 'ios',
      title: 'Add to iPhone or iPad',
      steps: [
        'Open this page in Safari.',
        'Tap Share.',
        'Tap Add to Home Screen, then Add.',
        'Open CLOSETÉ from the home screen. Sign in again there; the install does not copy your Google session.'
      ]
    };
  }
  if (/android/i.test(ua)) {
    return {
      platform: 'android',
      title: 'Install on Android',
      steps: [
        'Open this page in Chrome.',
        'Tap the menu, then Install app or Add to Home screen.',
        'If the browser offers an install banner, confirm it.',
        'Sign in again after installing. Wardrobe data is not stored in the icon.'
      ]
    };
  }
  return {
    platform: 'desktop',
    title: 'Install on this computer',
    steps: [
      'Open this page in Chrome, Edge, or another Chromium browser.',
      'Use the install icon in the address bar, or the browser menu entry Install CLOSETÉ.',
      'The installed window is the same app. It still needs your own Google sign-in.'
    ]
  };
}
