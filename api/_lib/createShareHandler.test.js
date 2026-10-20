import { describe, it, expect, vi } from 'vitest';
import { createDefaultShareHandler } from './createShareHandler.js';
import { makeRes } from './testHttp.js';

const BASE = { SUPABASE_URL: 'https://abcdefghijklmnopqrst.supabase.co' };
const logger = () => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn() });
const req = { method: 'GET', query: { token: 'a'.repeat(64) }, headers: { 'x-real-ip': '203.0.113.9' } };

describe('createDefaultShareHandler', () => {
  it.each([
    ['on Vercel production', { VERCEL_ENV: 'production' }],
    ['in any production build', { NODE_ENV: 'production' }],
  ])('refuses every request %s when shared rate limits are not configured, and says why in the log', async (_label, extra) => {
    const log = logger();
    const handler = createDefaultShareHandler({ ...BASE, ...extra }, log);
    const res = makeRes();
    await handler(req, res);
    expect(res.statusCode).toBe(503);
    expect(res.body).not.toMatch(/SUPABASE/);
    expect(log.error).toHaveBeenCalledWith(expect.stringMatching(/SUPABASE_SERVICE_ROLE_KEY/));
  });

  it('warns but still runs during development without the service-role key (here: the server is not set up for lookups)', async () => {
    const log = logger();
    const handler = createDefaultShareHandler(BASE, log);
    const res = makeRes();
    await handler(req, res);
    expect(log.warn).toHaveBeenCalledWith(expect.stringMatching(/per server process/));
    expect(res.statusCode).toBe(503);
  });

  it('runs in production once the service-role key is set (here: a token that cannot be one is not found, with no lookup)', async () => {
    const handler = createDefaultShareHandler({ ...BASE, VERCEL_ENV: 'production', SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_x' }, logger());
    const res = makeRes();
    await handler({ ...req, query: { token: 'nope' } }, res);
    expect(res.statusCode).toBe(404);
  });
});
