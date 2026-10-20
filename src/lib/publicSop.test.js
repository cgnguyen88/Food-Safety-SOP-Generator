import { describe, it, expect, vi } from 'vitest';
import { loadSharedSop, signSharedSop, tokenFromPath } from './publicSop.js';

const TOKEN = 'c'.repeat(64);
const reply = (status, body) => vi.fn().mockResolvedValue({ ok: status >= 200 && status < 300, status, json: async () => body });

describe('loadSharedSop', () => {
  it('asks the server for the SOP behind the link', async () => {
    const fetchImpl = reply(200, { sopId: 1, farmName: 'F', values: {} });
    expect(await loadSharedSop(TOKEN, { fetchImpl })).toEqual({ data: { sopId: 1, farmName: 'F', values: {} }, error: null });
    expect(fetchImpl).toHaveBeenCalledWith(`/api/sop-share?token=${TOKEN}`, expect.objectContaining({ headers: { Accept: 'application/json' } }));
  });

  it.each([[404, 'invalid'], [429, 'busy'], [400, 'bad_request'], [500, 'unknown'], [502, 'unknown']])('says what a %i answer means', async (status, code) => {
    expect(await loadSharedSop(TOKEN, { fetchImpl: reply(status, {}) })).toEqual({ data: null, error: { code } });
  });

  it('answers with a code, and does not throw, when the network is down', async () => {
    expect(await loadSharedSop(TOKEN, { fetchImpl: vi.fn().mockRejectedValue(new TypeError('offline')) })).toEqual({ data: null, error: { code: 'unknown' } });
  });

  it('puts only a safely encoded token in the address', async () => {
    const fetchImpl = reply(200, {});
    await loadSharedSop('a b&c', { fetchImpl });
    expect(fetchImpl.mock.calls[0][0]).toBe('/api/sop-share?token=a%20b%26c');
  });
});

describe('signSharedSop', () => {
  it('sends the token, the name, the confirmation and the language as JSON', async () => {
    const fetchImpl = reply(201, { ok: true });
    expect(await signSharedSop({ token: TOKEN, name: 'Ana Diaz', agree: true, lang: 'es' }, { fetchImpl })).toEqual({ data: { ok: true }, error: null });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('/api/sop-share');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ token: TOKEN, name: 'Ana Diaz', agree: true, lang: 'es' });
  });

  it('answers with a code when the server refuses', async () => {
    expect(await signSharedSop({ token: TOKEN, name: 'A', agree: true, lang: 'en' }, { fetchImpl: reply(429, {}) })).toEqual({ data: null, error: { code: 'busy' } });
  });
});

describe('tokenFromPath', () => {
  it('finds the token in a SOP link', () => {
    expect(tokenFromPath(`/s/${TOKEN}`)).toBe(TOKEN);
    expect(tokenFromPath(`/s/${TOKEN}/`)).toBe(TOKEN);
  });

  it.each(['/', '/s/', '/s/short', `/s/${'C'.repeat(64)}`, `/s/${TOKEN}/extra`, `/x/${TOKEN}`, `/s/${TOKEN}x`, ''])('is not a SOP link: %j', (path) => {
    expect(tokenFromPath(path)).toBeNull();
  });
});
