/**
 * Download a private Drive file with the bearer token.
 * The token is never placed in the URL, and the response is not stored
 * in Cache Storage (cache: 'no-store').
 */
export async function fetchPrivateDriveImage(fileId, token, fetchImpl = fetch) {
  if (!fileId || !token) return null;
  const url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`;
  if (url.includes(token)) {
    throw new Error('Refusing to place the access token in a URL.');
  }
  const response = await fetchImpl(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
    credentials: 'omit',
    referrerPolicy: 'no-referrer'
  });
  if (!response.ok) return null;
  return response.blob();
}
