export function publicError(error) {
  const raw = String(error?.message || error || 'Something went wrong.');
  const accessToken = `${'ya29'}\\.`;
  return raw
    .replace(new RegExp(`${accessToken}[0-9A-Za-z\\-_]+`, 'g'), '[token]')
    .replace(/Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, 'Bearer [token]')
    .replace(/access_token["']?\s*[:=]\s*["'][^"']+["']/gi, 'access_token=[token]')
    .slice(0, 300);
}

export function assertWritable(online) {
  if (!online) {
    const error = new Error('You are offline. Reconnect before saving. Nothing was written.');
    error.code = 'OFFLINE';
    throw error;
  }
}
