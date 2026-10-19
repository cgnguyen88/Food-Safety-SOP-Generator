import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  FarmDataError, fetchFarmData, saveFarmData, importLocalData, forgetOldAccounts, createSaveQueue, findLocalData,
  pruneBackups, stashUnsaved, takeUnsaved, BACKUP_PREFIX, LEGACY_OWNER_KEY,
} from './farmData.js';

/** A stand-in for the Supabase client: records calls and answers from `rows` / `results`. */
function fakeClient({ rows = [], selectError = null, rpcResult = { data: 2, error: null }, insertResults = {} } = {}) {
  const calls = { select: [], rpc: [], insert: [] };
  return {
    calls,
    from(table) {
      return {
        select(columns) {
          return {
            eq: async (column, value) => {
              calls.select.push({ table, columns, column, value });
              return selectError ? { data: null, error: selectError } : { data: rows, error: null };
            },
          };
        },
        insert: async (row) => {
          calls.insert.push({ table, row });
          return insertResults[row.key] ?? { error: null };
        },
      };
    },
    rpc: async (fn, args) => {
      calls.rpc.push({ fn, args });
      return rpcResult;
    },
  };
}

function memoryStorage(initial = {}, { full = false } = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => {
      if (full) throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
      map.set(k, String(v));
    },
    removeItem: (k) => map.delete(k),
    key: (i) => [...map.keys()][i] ?? null,
    get length() { return map.size; },
    dump: () => Object.fromEntries(map),
  };
}

afterEach(() => vi.useRealTimers());

describe('fetchFarmData', () => {
  it("reads the farm's values and their versions by kind, ignoring kinds the app does not know", async () => {
    const client = fakeClient({ rows: [{ key: 'farm_profile', value: { farm_name: 'GV' }, version: 3 }, { key: 'incidents', value: [{ id: 1 }], version: 1 }, { key: 'other', value: 1, version: 1 }] });
    expect(await fetchFarmData(client, 'farm-1')).toEqual({
      data: { farm_profile: { farm_name: 'GV' }, incidents: [{ id: 1 }] },
      versions: { farm_profile: 3, incidents: 1 },
    });
    expect(client.calls.select).toEqual([{ table: 'farm_data', columns: 'key, value, version', column: 'farm_id', value: 'farm-1' }]);
  });

  it('throws a clear error when the database cannot be read', async () => {
    const client = fakeClient({ selectError: { code: '500', message: 'boom' } });
    await expect(fetchFarmData(client, 'farm-1')).rejects.toThrow(FarmDataError);
  });
});

describe('saveFarmData', () => {
  it('saves one value over the version it read, and returns the new version', async () => {
    const client = fakeClient();
    expect(await saveFarmData(client, 'farm-1', 'incidents', [{ id: 1 }], 1)).toBe(2);
    expect(client.calls.rpc).toEqual([{ fn: 'put_farm_data', args: { p_farm_id: 'farm-1', p_key: 'incidents', p_value: [{ id: 1 }], p_expected_version: 1 } }]);
    await saveFarmData(client, 'farm-1', 'incidents', [], undefined);
    expect(client.calls.rpc[1].args.p_expected_version).toBeNull();
  });

  it('reports a save made first on another device as a conflict', async () => {
    const client = fakeClient({ rpcResult: { data: null, error: { code: 'FD409', message: 'changed' } } });
    await expect(saveFarmData(client, 'farm-1', 'incidents', [], 1)).rejects.toMatchObject({ code: 'conflict' });
  });

  it('refuses an answer without a version', async () => {
    const client = fakeClient({ rpcResult: { data: null, error: null } });
    await expect(saveFarmData(client, 'farm-1', 'incidents', [], 1)).rejects.toBeInstanceOf(FarmDataError);
  });

  it.each([
    ['42501', /only owners and managers/i],
    ['23514', /too large/i],
    ['XX000', /could not be saved/i],
  ])('explains database error %s', async (code, message) => {
    const client = fakeClient({ rpcResult: { data: null, error: { code, message: 'raw' } } });
    const error = await saveFarmData(client, 'farm-1', 'incidents', []).catch((e) => e);
    expect(error).toBeInstanceOf(FarmDataError);
    expect(error.message).toMatch(message);
    expect(error.code).toBe(code);
  });

  it('refuses a kind of data the app does not know, without asking the database', async () => {
    const client = fakeClient();
    await expect(saveFarmData(client, 'farm-1', 'secrets', {})).rejects.toThrow(FarmDataError);
    expect(client.calls.rpc).toEqual([]);
  });
});

describe('forgetOldAccounts', () => {
  it('removes the old browser-only accounts, which held passwords in plain text', () => {
    const storage = memoryStorage({ user_accounts: '[{"password":"x"}]', current_user: '{}', app_lang: 'es' });
    forgetOldAccounts(storage);
    expect(storage.dump()).toEqual({ app_lang: 'es' });
  });

  it('keeps only the email of whoever was signed in, to say whose data this browser holds', () => {
    const storage = memoryStorage({ current_user: JSON.stringify({ email: 'ana@example.com', password: 'secret' }) });
    forgetOldAccounts(storage);
    expect(storage.dump()).toEqual({ [LEGACY_OWNER_KEY]: 'ana@example.com' });
  });

  it('copes with an unreadable old entry', () => {
    const storage = memoryStorage({ current_user: '{broken' });
    forgetOldAccounts(storage);
    expect(storage.dump()).toEqual({});
  });
});

describe('findLocalData', () => {
  it("lists this browser's data by kind and says whose it was", () => {
    const storage = memoryStorage({ incidents: '[{"id":"i1"}]', sop_activity_records: '[]', farm_profile: '{broken', [LEGACY_OWNER_KEY]: 'ana@example.com' });
    expect(findLocalData(storage)).toEqual({ values: { incidents: [{ id: 'i1' }] }, owner: 'ana@example.com' });
    expect(findLocalData(memoryStorage())).toEqual({ values: {}, owner: null });
  });
});

describe('importLocalData (after the person agrees to copy this browser\'s data)', () => {
  const local = {
    farm_profile: JSON.stringify({ farm_name: 'Local Farm' }),
    incidents: JSON.stringify([{ id: 'i1' }]),
    cost_settings: JSON.stringify({ wage: 18 }),
    sop_activity_records: JSON.stringify([]),
  };
  const empty = { data: {}, versions: {} };

  it('copies what the account does not have yet, keeps what it already has, then moves the browser copy to a backup', async () => {
    const storage = memoryStorage({ ...local, app_lang: 'en', [LEGACY_OWNER_KEY]: 'ana@example.com' });
    const current = { data: { farm_profile: { farm_name: 'Server Farm' } }, versions: { farm_profile: 4 } };
    // What the database holds once the import is done (read back afterwards).
    const client = fakeClient({ rows: [
      { key: 'farm_profile', value: { farm_name: 'Server Farm' }, version: 4 },
      { key: 'incidents', value: [{ id: 'i1' }], version: 1 },
      { key: 'cost_settings', value: { wage: 18 }, version: 1 },
    ] });

    const result = await importLocalData({ client, farmId: 'farm-1', storage, current, now: () => new Date('2026-10-18T12:00:00Z') });

    expect(client.calls.insert.map((c) => c.row)).toEqual([
      { farm_id: 'farm-1', key: 'incidents', value: [{ id: 'i1' }] },
      { farm_id: 'farm-1', key: 'cost_settings', value: { wage: 18 } },
    ]);
    expect(result).toEqual({
      data: { farm_profile: { farm_name: 'Server Farm' }, incidents: [{ id: 'i1' }], cost_settings: { wage: 18 } },
      versions: { farm_profile: 4, incidents: 1, cost_settings: 1 },
      imported: ['incidents', 'cost_settings'],
      kept: ['farm_profile'],
      failed: [],
    });

    const after = storage.dump();
    expect(after.app_lang).toBe('en');
    for (const key of ['farm_profile', 'incidents', 'cost_settings', LEGACY_OWNER_KEY]) expect(after[key]).toBeUndefined();
    expect(after.sop_activity_records).toBe('[]'); // nothing in it, so nothing to move
    const backup = JSON.parse(after[`${BACKUP_PREFIX}2026-10-18T12:00:00.000Z`]);
    expect(backup.values.farm_profile).toEqual({ farm_name: 'Local Farm' });
    expect(backup.values.incidents).toEqual([{ id: 'i1' }]);
  });

  it('does nothing when the browser has no data (an empty list counts as none)', async () => {
    const storage = memoryStorage({ sop_activity_records: '[]', app_lang: 'en' });
    const client = fakeClient();
    const current = { data: { incidents: [] }, versions: { incidents: 1 } };
    const result = await importLocalData({ client, farmId: 'farm-1', storage, current });
    expect(result).toEqual({ ...current, imported: [], kept: [], failed: [] });
    expect(client.calls.insert).toEqual([]);
    expect(storage.dump()).toEqual({ sop_activity_records: '[]', app_lang: 'en' });
  });

  it('ignores browser values that are unreadable or the wrong shape', async () => {
    const storage = memoryStorage({ farm_profile: '{broken', incidents: '{"not":"a list"}', cost_settings: '"text"' });
    const client = fakeClient();
    const result = await importLocalData({ client, farmId: 'farm-1', storage, current: empty });
    expect(result.imported).toEqual([]);
    expect(client.calls.insert).toEqual([]);
  });

  it('reads the data back when another tab copied it a moment earlier, instead of showing an empty farm', async () => {
    const storage = memoryStorage({ incidents: local.incidents });
    const client = fakeClient({
      insertResults: { incidents: { error: { code: '23505', message: 'duplicate key' } } },
      rows: [{ key: 'incidents', value: [{ id: 'i1' }], version: 1 }],
    });
    const result = await importLocalData({ client, farmId: 'farm-1', storage, current: empty });
    expect(result.kept).toEqual(['incidents']);
    expect(result.data).toEqual({ incidents: [{ id: 'i1' }] });
    expect(client.calls.select).toHaveLength(1);
    expect(storage.dump().incidents).toBeUndefined();
  });

  it('keeps the browser copy, and says what failed, when a value cannot be copied', async () => {
    const storage = memoryStorage({ incidents: local.incidents, cost_settings: local.cost_settings });
    const client = fakeClient({ insertResults: { incidents: { error: { code: '23514', message: 'too big' } } } });
    const result = await importLocalData({ client, farmId: 'farm-1', storage, current: empty });
    expect(result.failed).toEqual(['incidents']);
    expect(result.imported).toEqual(['cost_settings']);
    expect(storage.dump().incidents).toBe(local.incidents);
    expect(storage.dump().cost_settings).toBeUndefined();
  });

  it('still copies the data when the browser is too full for a backup, keeping what the account already had in place', async () => {
    const storage = memoryStorage({ incidents: local.incidents, farm_profile: local.farm_profile }, { full: true });
    const current = { data: { farm_profile: { farm_name: 'Server Farm' } }, versions: { farm_profile: 1 } };
    const client = fakeClient({ rows: [{ key: 'farm_profile', value: { farm_name: 'Server Farm' }, version: 1 }, { key: 'incidents', value: [{ id: 'i1' }], version: 1 }] });
    const result = await importLocalData({ client, farmId: 'farm-1', storage, current });
    expect(result.imported).toEqual(['incidents']);
    expect(result.kept).toEqual(['farm_profile']);
    expect(storage.dump()).toEqual({ farm_profile: local.farm_profile });
  });
});

describe('pruneBackups', () => {
  it('deletes backups older than 30 days and unreadable ones, and keeps recent ones and everything else', () => {
    const storage = memoryStorage({
      [`${BACKUP_PREFIX}2026-08-01T00:00:00.000Z`]: '{}',
      [`${BACKUP_PREFIX}2026-10-10T00:00:00.000Z`]: '{}',
      [`${BACKUP_PREFIX}not-a-date`]: '{}',
      app_lang: 'en',
    });
    pruneBackups(storage, new Date('2026-10-18T00:00:00Z'));
    expect(Object.keys(storage.dump()).sort()).toEqual(['app_lang', `${BACKUP_PREFIX}2026-10-10T00:00:00.000Z`]);
  });
});

describe('stashUnsaved and takeUnsaved', () => {
  it('keeps unsaved changes for one farm and hands them back once', () => {
    const storage = memoryStorage();
    expect(stashUnsaved(storage, 'farm-1', { incidents: [{ id: 'a' }], cost_settings: { wage: 1 } })).toBe(true);
    expect(takeUnsaved(storage, 'farm-2')).toEqual({});
    expect(takeUnsaved(storage, 'farm-1')).toEqual({ incidents: [{ id: 'a' }], cost_settings: { wage: 1 } });
    expect(takeUnsaved(storage, 'farm-1')).toEqual({});
  });

  it('drops unknown kinds and wrong shapes, and survives a full or broken store', () => {
    const storage = memoryStorage({ 'farmsafe_unsaved:farm-1': JSON.stringify({ incidents: {}, secrets: 1, farm_profile: { a: 1 } }) });
    expect(takeUnsaved(storage, 'farm-1')).toEqual({ farm_profile: { a: 1 } });
    expect(stashUnsaved(memoryStorage({}, { full: true }), 'farm-1', { incidents: [] })).toBe(false);
    expect(takeUnsaved(memoryStorage({ 'farmsafe_unsaved:farm-1': '{broken' }), 'farm-1')).toEqual({});
  });
});

describe('createSaveQueue', () => {
  it('waits for typing to settle, then saves only the latest value of each kind', async () => {
    vi.useFakeTimers();
    const save = vi.fn(async () => {});
    const queue = createSaveQueue({ save, delayMs: 800 });
    queue.queue('incidents', [1]);
    queue.queue('incidents', [1, 2]);
    queue.queue('cost_settings', { wage: 1 });
    await vi.advanceTimersByTimeAsync(799);
    expect(save).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(save.mock.calls).toEqual([['incidents', [1, 2]], ['cost_settings', { wage: 1 }]]);
  });

  it('reports saving, saved and failed, and keeps the failed value to try again', async () => {
    vi.useFakeTimers();
    const statuses = [];
    const save = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(undefined);
    const queue = createSaveQueue({ save, delayMs: 10, onStatus: (s) => statuses.push(s) });
    queue.queue('incidents', [1]);
    expect(statuses.at(-1)).toEqual({ state: 'saving', error: null });
    await vi.advanceTimersByTimeAsync(10);
    expect(statuses.at(-1)).toEqual({ state: 'error', error: 'offline' });
    expect(queue.hasPending()).toBe(true);
    await queue.retry();
    expect(save.mock.calls).toEqual([['incidents', [1]], ['incidents', [1]]]);
    expect(statuses.at(-1)).toEqual({ state: 'saved', error: null });
    expect(queue.hasPending()).toBe(false);
  });

  it('never runs two saves of the same kind at once, and saves a change made during a save afterwards', async () => {
    vi.useFakeTimers();
    let release;
    const save = vi.fn(() => new Promise((resolve) => { release = resolve; }));
    const queue = createSaveQueue({ save, delayMs: 10 });
    queue.queue('incidents', [1]);
    await vi.advanceTimersByTimeAsync(10);
    queue.queue('incidents', [1, 2]);
    await vi.advanceTimersByTimeAsync(10);
    expect(save).toHaveBeenCalledTimes(1);
    release();
    await vi.advanceTimersByTimeAsync(0);
    expect(save.mock.calls.at(-1)).toEqual(['incidents', [1, 2]]);
    release();
    await vi.advanceTimersByTimeAsync(0);
    expect(queue.hasPending()).toBe(false);
  });

  it('flush() saves everything waiting right away and resolves when it is done', async () => {
    vi.useFakeTimers();
    const save = vi.fn(async () => {});
    const queue = createSaveQueue({ save, delayMs: 10_000 });
    queue.queue('farm_profile', { farm_name: 'GV' });
    await queue.flush();
    expect(save).toHaveBeenCalledWith('farm_profile', { farm_name: 'GV' });
    expect(queue.hasPending()).toBe(false);
  });

  it('lists the kinds not saved yet', async () => {
    vi.useFakeTimers();
    const save = vi.fn().mockRejectedValue(new Error('offline'));
    const queue = createSaveQueue({ save, delayMs: 10 });
    queue.queue('incidents', [1]);
    queue.queue('farm_profile', {});
    expect(queue.pendingKeys().sort()).toEqual(['farm_profile', 'incidents']);
    await vi.advanceTimersByTimeAsync(10);
    expect(queue.pendingKeys().sort()).toEqual(['farm_profile', 'incidents']);
  });

  it('cancel() drops everything waiting (after signing out)', async () => {
    vi.useFakeTimers();
    const save = vi.fn(async () => {});
    const queue = createSaveQueue({ save, delayMs: 10 });
    queue.queue('incidents', [1]);
    queue.cancel();
    await vi.advanceTimersByTimeAsync(50);
    expect(save).not.toHaveBeenCalled();
    expect(queue.hasPending()).toBe(false);
  });
});
