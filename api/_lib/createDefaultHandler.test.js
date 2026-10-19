import { describe, it, expect, vi } from 'vitest';
import { createDefaultHandler } from './createDefaultHandler.js';
import { makeReq, makeRes } from './testHttp.js';

const BASE = { SUPABASE_URL: 'https://abcdefghijklmnopqrst.supabase.co', SUPABASE_ANON_KEY: 'sb_publishable_x', ANTHROPIC_API_KEY: 'sk-ant-test' };
const logger = () => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn() });

describe('createDefaultHandler', () => {
  it.each([
    ['on Vercel production', { VERCEL_ENV: 'production' }],
    ['in any production build', { NODE_ENV: 'production' }],
  ])('refuses every AI request %s when shared rate limits are not configured, and says why in the log', async (_label, extra) => {
    const log = logger();
    const handler = createDefaultHandler({ ...BASE, ...extra }, log);
    const res = makeRes();
    await handler(makeReq({ body: { mode: 'assistant', messages: [{ role: 'user', content: 'hi' }] } }), res);
    expect(res.statusCode).toBe(503);
    expect(log.error).toHaveBeenCalledWith(expect.stringMatching(/SUPABASE_SERVICE_ROLE_KEY/));
  });

  it('runs normally in production once the service-role key is set (here: refusing a caller who is not signed in)', async () => {
    const handler = createDefaultHandler({ ...BASE, VERCEL_ENV: 'production', SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_x' }, logger());
    const res = makeRes();
    await handler(makeReq({ body: {}, headers: { authorization: undefined } }), res);
    expect(res.statusCode).toBe(401);
  });

  it('warns but still runs during development without the service-role key', async () => {
    const log = logger();
    const handler = createDefaultHandler(BASE, log);
    const res = makeRes();
    await handler(makeReq({ body: {}, headers: { authorization: undefined } }), res);
    expect(res.statusCode).toBe(401);
    expect(log.warn).toHaveBeenCalledWith(expect.stringMatching(/per server process/));
  });
});
