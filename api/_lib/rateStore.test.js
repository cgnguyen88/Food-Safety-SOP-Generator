import { describe, it, expect, vi } from 'vitest';
import { createRateStore } from './rateStore.js';

const ENV = { SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'service-key' };

function fakeClient(result) {
  const calls = [];
  const clients = [];
  const createClientImpl = vi.fn((url, key, options) => {
    const client = { url, key, options, rpc: async (fn, args) => { calls.push({ fn, args }); return result; } };
    clients.push(client);
    return client;
  });
  return { createClientImpl, calls, clients };
}

describe('createRateStore', () => {
  it('asks the database with the service role, passing the verified subject and the limit', async () => {
    const fake = fakeClient({ data: [{ allowed: false, retry_after_sec: 17 }], error: null });
    const store = createRateStore(ENV, { createClientImpl: fake.createClientImpl });
    expect(await store.takeRateToken('claude-proxy-min', 'user-1', 6, 60)).toEqual({ allowed: false, retry_after_sec: 17 });
    expect(fake.calls).toEqual([{ fn: 'take_rate_token', args: { p_bucket: 'claude-proxy-min', p_subject: 'user-1', p_max: 6, p_window_seconds: 60 } }]);
    expect(fake.clients[0]).toMatchObject({ url: 'https://x.supabase.co', key: 'service-key' });
    expect(fake.clients[0].options.auth).toEqual({ persistSession: false, autoRefreshToken: false, detectSessionInUrl: false });
  });

  it('makes one database client and reuses it', async () => {
    const fake = fakeClient({ data: [{ allowed: true, retry_after_sec: 0 }], error: null });
    const store = createRateStore(ENV, { createClientImpl: fake.createClientImpl });
    await store.takeRateToken('b', 's', 1, 1);
    await store.takeRateToken('b', 's', 1, 1);
    expect(fake.createClientImpl).toHaveBeenCalledTimes(1);
  });

  it('accepts the browser-named Supabase URL as a fallback', async () => {
    const fake = fakeClient({ data: [{ allowed: true, retry_after_sec: 0 }], error: null });
    await createRateStore({ VITE_SUPABASE_URL: 'https://v.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'k' }, { createClientImpl: fake.createClientImpl }).takeRateToken('b', 's', 1, 1);
    expect(fake.clients[0].url).toBe('https://v.supabase.co');
  });

  it('throws on a database error, and when the answer is not a verdict', async () => {
    const bad = fakeClient({ data: null, error: { code: '57014', message: 'timeout' } });
    await expect(createRateStore(ENV, { createClientImpl: bad.createClientImpl }).takeRateToken('b', 's', 1, 1)).rejects.toThrow('timeout');
    const empty = fakeClient({ data: [], error: null });
    await expect(createRateStore(ENV, { createClientImpl: empty.createClientImpl }).takeRateToken('b', 's', 1, 1)).rejects.toThrow(/verdict/i);
  });

  it('refuses without the service-role key or the URL', async () => {
    const fake = fakeClient({ data: [], error: null });
    await expect(createRateStore({ SUPABASE_URL: 'u' }, { createClientImpl: fake.createClientImpl }).takeRateToken('b', 's', 1, 1)).rejects.toThrow(/SERVICE_ROLE/);
    await expect(createRateStore({ SUPABASE_SERVICE_ROLE_KEY: 'k' }, { createClientImpl: fake.createClientImpl }).takeRateToken('b', 's', 1, 1)).rejects.toThrow(/SUPABASE_URL/);
  });

  it('says whether shared limits are possible', () => {
    expect(createRateStore(ENV).shared).toBe(true);
    expect(createRateStore({ SUPABASE_URL: 'u' }).shared).toBe(false);
    expect(createRateStore({ SUPABASE_SERVICE_ROLE_KEY: 'k' }).shared).toBe(false);
  });
});
