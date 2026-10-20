/**
 * The farm's shared data (farm profile, SOP forms, and the older incidents, cost settings and SOP activity records), kept in the
 * `farm_data` table so the whole team sees the same thing on every device. Until now each browser
 * kept its own copy in localStorage; the first sign-in copies that copy into the account once.
 *
 * Every function takes the Supabase client, so tests can pass a stand-in.
 */

/** The kinds of data, and the shape each must have (the database checks the same). */
export const FARM_DATA_SHAPES = Object.freeze({
  farm_profile: 'object',
  incidents: 'array',
  cost_settings: 'object',
  sop_activity_records: 'array',
  sop_forms: 'object',
});

/** Where the browser's own copy is kept after it has been copied into an account. */
export const BACKUP_PREFIX = 'farmsafe_backup_before_account:';
/** Changes that could not be saved before the session ended, kept to save at the next sign-in. */
export const UNSAVED_PREFIX = 'farmsafe_unsaved:';
/** The email of whoever used the old browser-only app here, shown when offering to copy its data. */
export const LEGACY_OWNER_KEY = 'farmsafe_legacy_owner';

// The old browser-only sign-in kept every password here in plain text.
const OLD_ACCOUNT_KEYS = ['user_accounts', 'current_user'];
const ALREADY_THERE = '23505';
const CHANGED_ELSEWHERE = 'FD409';
const BACKUP_DAYS = 30;
const DAY_MS = 86_400_000;

const FRIENDLY_ERRORS = {
  42501: 'Only owners and managers can change the farm’s data.',
  23514: 'This is too large to save. Remove some photos and try again.',
};

/** A farm data request that failed, with a message that can be shown as is. */
export class FarmDataError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'FarmDataError';
    this.code = code;
  }
}

const isKnownKey = (key) => typeof key === 'string' && Object.hasOwn(FARM_DATA_SHAPES, key);

function hasShape(key, value) {
  if (FARM_DATA_SHAPES[key] === 'array') return Array.isArray(value);
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * The farm's data and the version of each kind (a save must name the version it replaces).
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {string} farmId
 * @returns {Promise<{ data: Partial<Record<keyof typeof FARM_DATA_SHAPES, unknown>>, versions: Record<string, number> }>}
 */
export async function fetchFarmData(client, farmId) {
  const { data, error } = await client.from('farm_data').select('key, value, version').eq('farm_id', farmId);
  if (error) throw new FarmDataError('The farm’s data could not be loaded. Check your connection and reload the page.', error.code);
  const rows = (data ?? []).filter((row) => isKnownKey(row.key));
  return {
    data: Object.fromEntries(rows.map((row) => [row.key, row.value])),
    versions: Object.fromEntries(rows.map((row) => [row.key, row.version])),
  };
}

/**
 * Save one kind of data over the version this device read (null: there was none).
 * @returns {Promise<number>} the new version
 * @throws {FarmDataError} with code 'conflict' when another device saved first
 */
export async function saveFarmData(client, farmId, key, value, expectedVersion) {
  if (!isKnownKey(key)) throw new FarmDataError('This kind of data cannot be saved.', 'unknown_key');
  const { data, error } = await client.rpc('put_farm_data', {
    p_farm_id: farmId, p_key: key, p_value: value, p_expected_version: expectedVersion ?? null,
  });
  if (error?.code === CHANGED_ELSEWHERE) throw new FarmDataError('This was changed on another device.', 'conflict');
  if (error) throw new FarmDataError(FRIENDLY_ERRORS[error.code] ?? 'Your changes could not be saved. They will be tried again.', error.code);
  if (!Number.isInteger(data)) throw new FarmDataError('Your changes could not be saved. They will be tried again.', 'no_version');
  return data;
}

/**
 * Remove the old browser-only accounts (their passwords were stored in plain text). The email of the
 * person who was signed in is kept, so the offer to copy this browser's data can say whose it was.
 */
export function forgetOldAccounts(storage) {
  try {
    const email = JSON.parse(storage.getItem('current_user') ?? 'null')?.email;
    if (typeof email === 'string' && email.includes('@')) storage.setItem(LEGACY_OWNER_KEY, email.slice(0, 254));
  } catch {
    // an unreadable old entry has no email worth keeping
  }
  for (const key of OLD_ACCOUNT_KEYS) storage.removeItem(key);
}

/** Delete this browser's backups once they are older than 30 days. */
export function pruneBackups(storage, now = new Date()) {
  const keys = Array.from({ length: storage.length }, (_, i) => storage.key(i)).filter((k) => k?.startsWith(BACKUP_PREFIX));
  for (const key of keys) {
    const savedAt = Date.parse(key.slice(BACKUP_PREFIX.length));
    if (Number.isNaN(savedAt) || now.getTime() - savedAt > BACKUP_DAYS * DAY_MS) storage.removeItem(key);
  }
}

/** Keep changes that could not be saved, to save them at the next sign-in. Never throws. */
export function stashUnsaved(storage, farmId, values) {
  try {
    storage.setItem(`${UNSAVED_PREFIX}${farmId}`, JSON.stringify(values));
    return true;
  } catch {
    return false;
  }
}

/** The changes stashed for this farm (removed from the browser as they are handed back). */
export function takeUnsaved(storage, farmId) {
  const key = `${UNSAVED_PREFIX}${farmId}`;
  let values = {};
  try {
    const parsed = JSON.parse(storage.getItem(key) ?? '{}');
    values = Object.fromEntries(Object.entries(parsed ?? {}).filter(([k, v]) => isKnownKey(k) && hasShape(k, v)));
  } catch {
    values = {};
  }
  storage.removeItem(key);
  return values;
}

/**
 * What this browser kept before accounts existed, by kind (empty lists and unreadable values left out).
 * @returns {{ values: Record<string, unknown>, owner: string | null }}
 */
export function findLocalData(storage) {
  const values = {};
  for (const key of Object.keys(FARM_DATA_SHAPES)) {
    const raw = storage.getItem(key);
    if (raw === null) continue;
    let value;
    try {
      value = JSON.parse(raw);
    } catch {
      continue;
    }
    if (!hasShape(key, value)) continue;
    if (Array.isArray(value) ? value.length === 0 : Object.keys(value).length === 0) continue;
    values[key] = value;
  }
  return { values, owner: storage.getItem(LEGACY_OWNER_KEY) };
}

/**
 * Copy this browser's data into the farm, once the person has agreed to. A kind the farm already has
 * is kept as it is (the account is the source of truth). The browser's copy is first saved under a
 * backup key; only then are the originals removed, so nothing is lost and nothing is imported twice.
 * If the backup cannot be written (the browser is full), the copied kinds are still removed (the
 * account has them) but kinds the account already had stay in place as their own backup. A kind that
 * fails to copy stays in the browser to try again later.
 *
 * @param {{ client: object, farmId: string, storage: Storage, current: { data: object, versions: object }, now?: () => Date }} options
 *   `current` is what fetchFarmData returned for this farm.
 * @returns {Promise<{ data: object, versions: object, imported: string[], kept: string[], failed: string[] }>}
 */
export async function importLocalData({ client, farmId, storage, current, now = () => new Date() }) {
  const { values: local } = findLocalData(storage);
  const keys = Object.keys(local);
  if (keys.length === 0) return { ...current, imported: [], kept: [], failed: [] };

  let backedUp = true;
  try {
    storage.setItem(`${BACKUP_PREFIX}${now().toISOString()}`, JSON.stringify({ farmId, values: local }));
  } catch {
    backedUp = false;
  }

  const imported = [];
  const kept = [];
  const failed = [];
  let raced = false;
  for (const key of keys) {
    if (Object.hasOwn(current.data, key)) {
      kept.push(key);
      continue;
    }
    const { error } = await client.from('farm_data').insert({ farm_id: farmId, key, value: local[key] });
    if (!error) imported.push(key);
    else if (error.code === ALREADY_THERE) {
      kept.push(key);
      raced = true;
    } else failed.push(key);
  }

  for (const key of backedUp ? [...imported, ...kept] : imported) storage.removeItem(key);
  if (failed.length === 0) storage.removeItem(LEGACY_OWNER_KEY);
  const latest = imported.length || raced ? await fetchFarmData(client, farmId) : current;
  return { ...latest, imported, kept, failed };
}

/**
 * Saves changes a moment after they stop (typing, several quick edits), one kind at a time, latest
 * value only. A failed save keeps its value so it can be tried again.
 *
 * @param {{ save: (key: string, value: unknown) => Promise<void>, delayMs?: number,
 *   onStatus?: (status: { state: 'saving' | 'saved' | 'error', error: string | null }) => void }} options
 */
export function createSaveQueue({ save, delayMs = 800, onStatus = () => {} }) {
  const timers = new Map();
  const waiting = new Map(); // key -> latest value not yet saved
  const running = new Map(); // key -> promise of the save in progress
  const failures = new Map(); // key -> message of its last failed save
  let cancelled = false;

  const report = () => {
    if (timers.size || running.size) onStatus({ state: 'saving', error: null });
    else if (failures.size) onStatus({ state: 'error', error: [...failures.values()].at(-1) });
    else onStatus({ state: 'saved', error: null });
  };

  const run = (key) => {
    timers.delete(key);
    if (cancelled || !waiting.has(key)) return Promise.resolve();
    if (running.has(key)) return running.get(key); // it runs again when the current save ends
    const value = waiting.get(key);
    waiting.delete(key);
    const attempt = (async () => {
      try {
        await save(key, value);
        failures.delete(key);
      } catch (error) {
        failures.set(key, error?.message ?? 'Your changes could not be saved.');
        if (!waiting.has(key)) waiting.set(key, value); // keep it to try again
      } finally {
        running.delete(key);
      }
      if (waiting.has(key) && !failures.has(key)) await run(key);
      report();
    })();
    running.set(key, attempt);
    report();
    return attempt;
  };

  return {
    queue(key, value) {
      cancelled = false;
      waiting.set(key, value);
      failures.delete(key);
      clearTimeout(timers.get(key));
      timers.set(key, setTimeout(() => run(key), delayMs));
      report();
    },
    /** Save everything waiting now. */
    async flush() {
      for (const timer of timers.values()) clearTimeout(timer);
      timers.clear();
      await Promise.all([...waiting.keys()].map((key) => run(key)));
      await Promise.all(running.values());
    },
    /** Try the failed saves again. */
    retry() {
      for (const key of failures.keys()) failures.delete(key);
      return this.flush();
    },
    /** Drop everything waiting, for example after signing out. */
    cancel() {
      cancelled = true;
      for (const timer of timers.values()) clearTimeout(timer);
      timers.clear();
      waiting.clear();
      failures.clear();
    },
    hasPending: () => waiting.size > 0 || running.size > 0,
    /** The kinds not saved yet (waiting, saving or failed). */
    pendingKeys: () => [...new Set([...waiting.keys(), ...running.keys()])],
  };
}
