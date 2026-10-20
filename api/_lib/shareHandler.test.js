import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createShareHandler } from './shareHandler.js';
import { makeRes } from './testHttp.js';
import { SOP_DATA } from '../../src/data/sop-data.js';

const TOKEN = 'a'.repeat(64);
const SOP = SOP_DATA[0];
const FIELD = SOP.sections.flatMap((s) => s.fields)[0];
const SHARE = { id: 'share-1', farm_id: 'farm-1', sop_id: 1 };

/** A stand-in for the Supabase client: a query builder that answers from the tables it was given. */
function fakeAdmin({ shares = [SHARE], farmData = [], insertError = null, lookupError = null } = {}) {
  const inserted = [];
  const lookups = [];
  const admin = {
    inserted,
    lookups,
    from(table) {
      const query = { table, filters: [] };
      const builder = {
        select: () => builder,
        eq: (column, value) => { query.filters.push([column, value]); return builder; },
        is: (column, value) => { query.filters.push([column, value]); return builder; },
        in: (column, values) => { query.filters.push([column, values]); return builder; },
        maybeSingle: async () => {
          lookups.push(query);
          if (lookupError) return { data: null, error: lookupError };
          return { data: shares.find((s) => s.token === (query.filters.find(([c]) => c === 'token') ?? [])[1] || TOKEN === (query.filters.find(([c]) => c === 'token') ?? [])[1]) ?? null, error: null };
        },
        then: (resolve) => { lookups.push(query); resolve(lookupError ? { data: null, error: lookupError } : { data: farmData, error: null }); },
        insert: async (row) => {
          inserted.push({ table, row });
          return { error: insertError };
        },
      };
      return builder;
    },
  };
  return admin;
}

const allow = () => ({ check: vi.fn(async () => ({ allowed: true, retryAfterSec: 0 })) });
const limiters = (overrides = {}) => ({ read: allow(), sign: allow(), signPerLink: allow(), ...overrides });
const logger = () => ({ error: vi.fn() });
const get = (token = TOKEN, extra = {}) => ({ method: 'GET', query: token === null ? {} : { token }, headers: { 'x-real-ip': '203.0.113.7' }, ...extra });
const post = (body, extra = {}) => ({ method: 'POST', body, headers: { 'x-real-ip': '203.0.113.7' }, ...extra });
const NOW = () => new Date(2026, 9, 20, 9, 0, 0);

let deps;
let res;
beforeEach(() => {
  res = makeRes();
  deps = { getAdmin: () => fakeAdmin(), limiters: limiters(), logger: logger(), now: NOW };
});
const run = async (req) => {
  await createShareHandler(deps)(req, res);
  return res;
};

describe('sop-share: every response', () => {
  it('is never stored, never indexed and sends no referrer', async () => {
    await run(get());
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.headers['x-robots-tag']).toBe('noindex, nofollow');
    expect(res.headers['referrer-policy']).toBe('no-referrer');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  it('answers OPTIONS with nothing, and no CORS permission', async () => {
    await run({ method: 'OPTIONS', headers: {} });
    expect(res.statusCode).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it.each(['PUT', 'DELETE', 'PATCH'])('refuses %s', async (method) => {
    await run({ method, headers: {} });
    expect(res.statusCode).toBe(405);
    expect(res.headers.allow).toBe('GET, POST, OPTIONS');
  });
});

describe('sop-share: showing a SOP', () => {
  it('shows the SOP’s saved answers and the farm’s name, and nothing else', async () => {
    deps.getAdmin = () => fakeAdmin({ farmData: [{ key: 'farm_profile', value: { farm_name: 'Green Valley Farm', email: 'secret@example.com' } }, { key: 'sop_forms', value: { 1: { [FIELD.id]: 'Written answer' }, 2: { other: 'Other SOP' } } }] });
    await run(get());
    expect(res.statusCode).toBe(200);
    expect(res.json).toEqual({ sopId: 1, farmName: 'Green Valley Farm', values: { [FIELD.id]: 'Written answer' } });
    expect(res.body).not.toMatch(/secret@example|Other SOP/);
  });

  it('asks only for the SOP forms and profile of the share’s own farm', async () => {
    const admin = fakeAdmin();
    deps.getAdmin = () => admin;
    await run(get());
    const farmQuery = admin.lookups.find((q) => q.table === 'farm_data');
    expect(farmQuery.filters).toEqual([['farm_id', 'farm-1'], ['key', ['farm_profile', 'sop_forms']]]);
    const shareQuery = admin.lookups.find((q) => q.table === 'sop_shares');
    expect(shareQuery.filters).toContainEqual(['revoked_at', null]);
  });

  it('shows an empty SOP when nothing has been saved for it yet', async () => {
    await run(get());
    expect(res.json).toEqual({ sopId: 1, farmName: '', values: {} });
  });

  it('says the same thing for a token that does not exist as for one that was turned off', async () => {
    deps.getAdmin = () => fakeAdmin({ shares: [] });
    await run(get());
    const missing = res.json;
    expect(res.statusCode).toBe(404);
    expect(missing).toEqual({ error: 'This link is not valid any more.' });
  });

  it.each([[null], [''], ['short'], ['A'.repeat(64)], [['a'.repeat(64)]]])('does not look anything up for a token that cannot be one (%j)', async (token) => {
    const admin = fakeAdmin();
    deps.getAdmin = () => admin;
    await run(get(token));
    expect(res.statusCode).toBe(404);
    expect(admin.lookups).toEqual([]);
  });

  it('reads the token from the URL when the platform gives no query object', async () => {
    await run({ method: 'GET', url: `/api/sop-share?token=${TOKEN}`, headers: { 'x-real-ip': '1.1.1.1' } });
    expect(res.statusCode).toBe(200);
  });

  it('refuses a share for a SOP that no longer exists', async () => {
    deps.getAdmin = () => fakeAdmin({ shares: [{ ...SHARE, sop_id: 77 }] });
    await run(get());
    expect(res.statusCode).toBe(404);
  });
});

describe('sop-share: signing', () => {
  const body = (extra = {}) => ({ token: TOKEN, name: 'Maria Lopez', agree: true, lang: 'es', ...extra });

  it('makes a training record waiting for review', async () => {
    const admin = fakeAdmin();
    deps.getAdmin = () => admin;
    await run(post(body()));
    expect(res.statusCode).toBe(201);
    expect(res.json).toEqual({ ok: true });
    expect(admin.inserted).toHaveLength(1);
    expect(admin.inserted[0].table).toBe('records');
    expect(admin.inserted[0].row).toMatchObject({ farm_id: 'farm-1', kind: 'training', status: 'pending_review', record_date: '2026-10-20', source: 'web_upload', payload: { attendees: 'Maria Lopez', language: 'es', topic: SOP.title } });
  });

  it('takes the farm and the SOP from the link, never from what was sent', async () => {
    const admin = fakeAdmin();
    deps.getAdmin = () => admin;
    await run(post(body({ farm_id: 'another-farm', sop_id: 5, status: 'approved', kind: 'note', source: 'import' })));
    expect(admin.inserted[0].row).toMatchObject({ farm_id: 'farm-1', kind: 'training', status: 'pending_review', source: 'web_upload' });
    expect(admin.inserted[0].row.payload.topic).toBe(SOP.title);
  });

  it('answers the same whether or not this name had already signed today, so the link does not tell a stranger who has', async () => {
    deps.getAdmin = () => fakeAdmin({ insertError: { code: '23505' } });
    await run(post(body()));
    const repeat = { status: res.statusCode, body: res.json };
    res = makeRes();
    deps.getAdmin = () => fakeAdmin();
    await run(post(body()));
    expect(repeat).toEqual({ status: 201, body: { ok: true } });
    expect({ status: res.statusCode, body: res.json }).toEqual(repeat);
  });

  it('dates a sign-off by the farm’s day, not the server’s: an evening sign-off in California is still that day', async () => {
    const admin = fakeAdmin();
    deps.getAdmin = () => admin;
    deps.now = () => new Date('2026-10-21T03:30:00Z'); // 8:30 pm on 20 October in California
    await run(post(body()));
    expect(admin.inserted[0].row.record_date).toBe('2026-10-20');
  });

  it('makes a signature with commas one person, not several', async () => {
    const admin = fakeAdmin();
    deps.getAdmin = () => admin;
    await run(post(body({ name: 'Maria Lopez, Juan Perez' })));
    expect(admin.inserted[0].row.payload.attendees).toBe('Maria Lopez Juan Perez');
  });

  it.each([
    ['no name', { name: '' }],
    ['a name with markup', { name: '<img src=x onerror=alert(1)>' }],
    ['no confirmation', { agree: false }],
    ['a confirmation that is not exactly true', { agree: 'yes' }],
    ['a name that is not text', { name: { a: 1 } }],
  ])('refuses %s, and creates nothing', async (_label, extra) => {
    const admin = fakeAdmin();
    deps.getAdmin = () => admin;
    await run(post(body(extra)));
    expect(res.statusCode).toBe(400);
    expect(admin.inserted).toEqual([]);
  });

  it('says the link is not valid for a token that does not exist, and creates nothing', async () => {
    const admin = fakeAdmin({ shares: [] });
    deps.getAdmin = () => admin;
    await run(post(body()));
    expect(res.statusCode).toBe(404);
    expect(admin.inserted).toEqual([]);
  });

  it('reports a database failure without its details, and logs only its code', async () => {
    deps.getAdmin = () => fakeAdmin({ insertError: { code: '42P01', message: 'relation "records" has a secret in it' } });
    await run(post(body()));
    expect(res.statusCode).toBe(502);
    expect(res.body).not.toMatch(/secret|relation/);
    expect(deps.logger.error).toHaveBeenCalledWith('[sop-share] request failed', { code: '42P01' });
  });
});

describe('sop-share: limits', () => {
  it('limits readers by address, before looking up the token', async () => {
    const admin = fakeAdmin();
    deps.getAdmin = () => admin;
    deps.limiters = limiters({ read: { check: vi.fn(async () => ({ allowed: false, retryAfterSec: 30 })) } });
    await run(get());
    expect(res.statusCode).toBe(429);
    expect(res.headers['retry-after']).toBe('30');
    expect(admin.lookups).toEqual([]);
    expect(deps.limiters.read.check).toHaveBeenCalledWith('203.0.113.7');
  });

  it('limits signers by address, and a link by how many sign-offs it gets in a day', async () => {
    deps.limiters = limiters({ sign: { check: vi.fn(async () => ({ allowed: false, retryAfterSec: 60 })) } });
    await run(post({ token: TOKEN, name: 'Ana Diaz', agree: true }));
    expect(res.statusCode).toBe(429);

    res = makeRes();
    deps.limiters = limiters({ signPerLink: { check: vi.fn(async () => ({ allowed: false, retryAfterSec: 3600 })) } });
    const admin = fakeAdmin();
    deps.getAdmin = () => admin;
    await run(post({ token: TOKEN, name: 'Ana Diaz', agree: true }));
    expect(res.statusCode).toBe(429);
    expect(deps.limiters.signPerLink.check).toHaveBeenCalledWith('share-1');
    expect(admin.inserted).toEqual([]);
  });

  it('counts a request with a well-formed token against the address, so tokens cannot be guessed freely', async () => {
    deps.getAdmin = () => fakeAdmin({ shares: [] });
    await run(get('b'.repeat(64)));
    expect(res.statusCode).toBe(404);
    expect(deps.limiters.read.check).toHaveBeenCalledTimes(1);
  });

  it('turns away text that cannot be a token without touching the limits or the database', async () => {
    const admin = fakeAdmin();
    deps.getAdmin = () => admin;
    await run(get('nope'));
    expect(res.statusCode).toBe(404);
    expect(deps.limiters.read.check).not.toHaveBeenCalled();
    expect(admin.lookups).toEqual([]);
  });

  it('counts an address that cannot be read in one shared bucket, never as an unlimited caller', async () => {
    await run({ method: 'GET', query: { token: TOKEN }, headers: { 'x-real-ip': 'x'.repeat(500) } });
    expect(deps.limiters.read.check).toHaveBeenCalledWith('unknown');
  });

  it('uses the first forwarded address when there is no real-ip header', async () => {
    await run({ method: 'GET', query: { token: TOKEN }, headers: { 'x-forwarded-for': '198.51.100.4, 10.0.0.1' } });
    expect(deps.limiters.read.check).toHaveBeenCalledWith('198.51.100.4');
  });
});

describe('sop-share: when the server is not set up', () => {
  it('says the page is not available, and logs why', async () => {
    deps.getAdmin = () => null;
    await run(get());
    expect(res.statusCode).toBe(503);
    expect(deps.logger.error).toHaveBeenCalled();
    expect(res.body).not.toMatch(/SUPABASE/);
  });
});
