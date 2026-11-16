/** Access tokens live in memory for this tab only. */
export function createSession({ now = () => Date.now() } = {}) {
  let token = '';
  let expiresAt = 0;

  return {
    set(accessToken, expiresInSeconds) {
      token = String(accessToken || '');
      const seconds = Number(expiresInSeconds);
      const lifetime = Number.isFinite(seconds) && seconds > 0 ? seconds : 3600;
      expiresAt = now() + lifetime * 1000 - 60_000;
    },
    clear() {
      token = '';
      expiresAt = 0;
    },
    snapshot() {
      if (!token) return { state: 'signed-out', token: '' };
      if (now() >= expiresAt) return { state: 'expired', token: '' };
      return { state: 'active', token };
    }
  };
}
