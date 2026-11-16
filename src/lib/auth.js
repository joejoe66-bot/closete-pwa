/** Access tokens stay in memory. Nothing here writes storage, caches, or logs. */

export function rememberToken(response, now = Date.now()) {
  if (!response?.access_token || response.error) {
    const error = new Error(
      response?.error_description || response?.error || 'Google sign-in failed.'
    );
    error.code = 'AUTH';
    throw error;
  }
  const seconds = Number(response.expires_in || 3600);
  return {
    accessToken: response.access_token,
    expiresAt: now + (Number.isFinite(seconds) ? seconds : 3600) * 1000,
  };
}

export function currentToken(state, now = Date.now()) {
  if (!state?.accessToken) return '';
  if (now >= state.expiresAt - 5000) return '';
  return state.accessToken;
}
