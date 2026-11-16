import { BASE_PATH } from './constants.js';

/** Hosts that must never be written to the Cache Storage app shell. */
export const BLOCKED_HOSTS = [
  'sheets.googleapis.com',
  'www.googleapis.com',
  'oauth2.googleapis.com',
  'accounts.google.com',
  'drive.google.com',
  'script.google.com',
  'www.google.com',
  'googleapis.com',
  'googleusercontent.com',
  'content.googleapis.com'
];

export function isBlockedHost(hostname) {
  const host = String(hostname || '').toLowerCase();
  return BLOCKED_HOSTS.some(blocked => host === blocked || host.endsWith(`.${blocked}`));
}

/**
 * Only same-origin GET app-shell requests are eligible for the service worker.
 * Authenticated and Google API calls always stay on the network.
 */
export function shouldCacheRequest({
  method = 'GET',
  hostname,
  pathname,
  origin,
  pageOrigin,
  hasAuthorization = false
} = {}) {
  if (String(method).toUpperCase() !== 'GET') return false;
  if (hasAuthorization) return false;
  if (isBlockedHost(hostname)) return false;
  if (origin !== pageOrigin) return false;
  if (!String(pathname || '').startsWith(BASE_PATH)) return false;
  return true;
}
