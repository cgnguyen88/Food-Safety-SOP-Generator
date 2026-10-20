import { describe, it, expect, vi, beforeEach } from 'vitest';

const calls = [];
let answer;
const builder = {
  select: (...a) => { calls.push(['select', ...a]); return builder; },
  insert: (...a) => { calls.push(['insert', ...a]); return builder; },
  update: (...a) => { calls.push(['update', ...a]); return builder; },
  eq: (...a) => { calls.push(['eq', ...a]); return builder; },
  is: (...a) => { calls.push(['is', ...a]); return builder; },
  maybeSingle: async () => answer,
  single: async () => answer,
  then: (resolve) => resolve(answer),
};
vi.mock('./supabase.js', () => ({ supabase: { from: (table) => { calls.push(['from', table]); return builder; } } }));
const { getShare, createShare, turnOffShare, shareUrl } = await import('./sopShares.js');

beforeEach(() => {
  calls.length = 0;
  answer = { data: null, error: null };
});

describe('shareUrl', () => {
  it('is the page a worker opens', () => {
    expect(shareUrl('https://farm.example.com', 'abc')).toBe('https://farm.example.com/s/abc');
  });
});

describe('getShare', () => {
  it('asks for the farm’s working link for the SOP, and returns it', async () => {
    answer = { data: { id: '1', sop_id: 3, token: 't' }, error: null };
    expect(await getShare('farm-1', 3)).toEqual({ data: { id: '1', sop_id: 3, token: 't' }, error: null });
    expect(calls).toEqual(expect.arrayContaining([['from', 'sop_shares'], ['eq', 'farm_id', 'farm-1'], ['eq', 'sop_id', 3], ['is', 'revoked_at', null]]));
  });

  it('returns no link when there is none', async () => {
    expect(await getShare('farm-1', 3)).toEqual({ data: null, error: null });
  });

  it('returns a code, not the database’s message, when it cannot ask', async () => {
    answer = { data: null, error: { code: '42501', message: 'details we should not show' } };
    expect(await getShare('farm-1', 3)).toEqual({ data: null, error: { code: '42501' } });
  });
});

describe('createShare', () => {
  it('sends only the farm and the SOP: the database makes the token', async () => {
    answer = { data: { id: '1', sop_id: 3, token: 'made-by-database' }, error: null };
    const result = await createShare('farm-1', 3);
    expect(result.data.token).toBe('made-by-database');
    expect(calls).toContainEqual(['insert', { farm_id: 'farm-1', sop_id: 3 }]);
  });

  it('returns a code when it fails (for example a link already works for this SOP)', async () => {
    answer = { data: null, error: { code: '23505' } };
    expect(await createShare('farm-1', 3)).toEqual({ data: null, error: { code: '23505' } });
  });
});

describe('turnOffShare', () => {
  it('turns the link off', async () => {
    expect(await turnOffShare('share-1')).toEqual({ data: null, error: null });
    expect(calls).toContainEqual(['eq', 'id', 'share-1']);
    expect(calls.find((c) => c[0] === 'update')[1]).toHaveProperty('revoked_at');
  });

  it('returns a code when it fails', async () => {
    answer = { data: null, error: { code: '42501' } };
    expect(await turnOffShare('share-1')).toEqual({ data: null, error: { code: '42501' } });
  });
});
