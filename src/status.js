/**
 * Connection copy. `connected` is true only after a verified read in this
 * sign-in, while online. A stored config or a click is not a connection.
 */
export function deriveStatus({
  mode = 'google',
  offline = false,
  configValid = false,
  missing = [],
  session = 'signed-out',
  readOk = false,
  hasSnapshot = false,
  lastError = null,
  shareWithLink = false
} = {}) {
  if (mode === 'demo') {
    return {
      state: 'demo',
      connected: false,
      title: 'Demo mode',
      detail: 'Sample pieces stay in this browser tab. Nothing is read from or written to Google. This is not your wardrobe.'
    };
  }

  if (offline) {
    const setup = !configValid
      ? ' Setup is also incomplete, and it cannot be verified until you are back online.'
      : '';
    return {
      state: 'offline',
      connected: false,
      title: 'Offline',
      detail: hasSnapshot
        ? `Showing the last read from this visit only. It is not stored for offline use and it is not syncing. Changes are off.${setup}`
        : `You are offline. The wardrobe was not loaded. Nothing is queued to sync.${setup}`
    };
  }

  if (!configValid) {
    const need = missing.length ? `Add ${missing.join(' and ')}. ` : 'Fix the highlighted setup fields. ';
    return {
      state: 'needs-config',
      connected: false,
      title: 'Setup needed',
      detail: `${need}The wardrobe is not connected.`
    };
  }

  if (session === 'expired') {
    return {
      state: 'expired',
      connected: false,
      title: 'Sign-in expired',
      detail: 'Your Google sign-in expired. Sign in again. Nothing is saved after the session ends.'
    };
  }

  if (session !== 'active') {
    return {
      state: 'signed-out',
      connected: false,
      title: 'Not signed in',
      detail: 'IDs on this device are not a connection. Sign in with Google and wait for the sheet to load.'
    };
  }

  if (lastError && !readOk) {
    return {
      state: lastError.kind || 'error',
      connected: false,
      title: titleForKind(lastError.kind),
      detail: lastError.message || 'The wardrobe could not be reached. No data was filled in.'
    };
  }

  if (!readOk) {
    return {
      state: 'not-verified',
      connected: false,
      title: 'Not verified',
      detail: 'Signed in, but the wardrobe has not loaded. Connected appears only after a successful read.'
    };
  }

  if (lastError) {
    return {
      state: 'write-failed',
      connected: true,
      title: 'Not saved',
      detail: lastError.message || 'The last change did not reach Google. The sheet was not updated by that attempt.'
    };
  }

  const sharing = shareWithLink
    ? ' New photos are shared with anyone who has the link because that option is on.'
    : '';
  return {
    state: 'connected',
    connected: true,
    title: 'Connected',
    detail: `The last read from your Google Sheet succeeded. Writes go to that sheet only while this sign-in is valid.${sharing}`
  };
}

function titleForKind(kind) {
  if (kind === 'permission') return 'Permission denied';
  if (kind === 'not-found') return 'Not found';
  if (kind === 'expired') return 'Sign-in expired';
  if (kind === 'offline') return 'Offline';
  return 'Not connected';
}

export function editsAllowed({ mode, status, offline }) {
  if (mode === 'demo') return true;
  return Boolean(status?.connected) && !offline;
}
