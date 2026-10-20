/**
 * The page a worker opens from a QR code asks the server for the SOP behind the link and sends back a sign-off. No one
 * is signed in, so these use plain requests to the app's own server. Both resolve to `{ data, error }` and never throw;
 * `error.code` is invalid (link not valid), busy (too many requests), bad_request or unknown.
 */

const ENDPOINT = '/api/sop-share';
const CODES = { 404: 'invalid', 429: 'busy', 400: 'bad_request' };

async function answer(responsePromise) {
  try {
    const response = await responsePromise;
    if (!response.ok) return { data: null, error: { code: CODES[response.status] ?? 'unknown' } };
    return { data: await response.json(), error: null };
  } catch {
    return { data: null, error: { code: 'unknown' } };
  }
}

/** @param {string} token @param {{ fetchImpl?: typeof fetch }} [deps] */
export function loadSharedSop(token, { fetchImpl = globalThis.fetch } = {}) {
  return answer(fetchImpl(`${ENDPOINT}?token=${encodeURIComponent(token)}`, { headers: { Accept: 'application/json' } }));
}

/** @param {{ token: string, name: string, agree: boolean, lang: 'en' | 'es' }} input @param {{ fetchImpl?: typeof fetch }} [deps] */
export function signSharedSop({ token, name, agree, lang }, { fetchImpl = globalThis.fetch } = {}) {
  return answer(fetchImpl(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ token, name, agree, lang }),
  }));
}

/** The token in an address like /s/<token>, or null when the address is not a SOP link. @param {string} pathname */
export function tokenFromPath(pathname) {
  const match = /^\/s\/([0-9a-f]{64})\/?$/.exec(pathname);
  return match ? match[1] : null;
}
