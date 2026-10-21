import { supabase } from './supabase.js';
import { fieldKey } from '../domain/records/fields.js';
import { validateWaterSourceInput } from '../domain/records/waterSources.js';

/**
 * Data access for a farm's list of water sources. Every function resolves to `{ data, error }` and never throws: `error`
 * is `{ code, message?, fields? }` with a code the screen can explain: invalid · forbidden · duplicate · in_use · too_many ·
 * not_set_up · unknown. Writes are validated here first; the database enforces the same rules, including that a source
 * used by records cannot be renamed or deleted.
 */

export const MAX_WATER_SOURCES_AT_ONCE = 50;

const fail = (code, extra = {}) => ({ data: null, error: { code, ...extra } });
const done = (data) => ({ data, error: null });

/** @param {{ code?: string, message?: string } | null | undefined} dbError */
export function describeWaterSourceError(dbError) {
  const message = dbError?.message;
  switch (dbError?.code) {
    case '42501':
    case 'PGRST116': // a single-row update matched nothing: row-level security hid it
      return { code: 'forbidden', message };
    case 'PGRST205': // the table is not in the API's schema: the database update that creates it has not been applied
    case '42P01':
      return { code: 'not_set_up', message };
    case '23505':
      return { code: 'duplicate', message };
    case '23514':
      return { code: /used by records/i.test(message ?? '') ? 'in_use' : /at most \d+ water sources/i.test(message ?? '') ? 'too_many' : 'invalid', message };
    default:
      return { code: 'unknown', message };
  }
}

function fromDb({ data, error }) {
  if (error) {
    const described = describeWaterSourceError(error);
    if (described.code === 'unknown') console.error('water sources:', error);
    return { data: null, error: described };
  }
  return done(data ?? null);
}

/** A farm's water sources: those in use first, then by name. @param {string} farmId */
export async function listWaterSources(farmId) {
  if (typeof farmId !== 'string' || farmId === '') return fail('invalid');
  const result = fromDb(await supabase.from('water_sources').select('*').eq('farm_id', farmId).order('is_active', { ascending: false }).order('name', { ascending: true }));
  return result.error ? result : done(result.data ?? []);
}

/** @param {{ farmId: string, name?: unknown, source_type?: unknown, fields_served?: unknown, notes?: unknown }} input */
export async function createWaterSource({ farmId, ...input }) {
  if (typeof farmId !== 'string' || farmId === '') return fail('invalid');
  const checked = validateWaterSourceInput(input);
  if (!checked.ok) return fail('invalid', { fields: checked.errors });
  return fromDb(await supabase.from('water_sources').insert({ farm_id: farmId, ...checked.value }).select().single());
}

/** Change a source's name, kind, fields or notes. (Its farm and author never change; archiving is `setWaterSourceActive`.) */
export async function updateWaterSource(id, input) {
  const checked = validateWaterSourceInput(input);
  if (!checked.ok) return fail('invalid', { fields: checked.errors });
  return fromDb(await supabase.from('water_sources').update(checked.value).eq('id', id).select().single());
}

/** Archive (false) or restore (true) a water source. Archived sources stay in the records that name them. */
export async function setWaterSourceActive(id, active) {
  if (typeof active !== 'boolean') return fail('invalid');
  return fromDb(await supabase.from('water_sources').update({ is_active: active }).eq('id', id).select().single());
}

/** Delete a water source no record names. Row-level security reports a forbidden delete as "nothing deleted". */
export async function deleteWaterSource(id) {
  const { data, error } = await supabase.from('water_sources').delete().eq('id', id).select('id');
  if (error) return fromDb({ data: null, error });
  if (Array.isArray(data) && data.length === 0) return fail('forbidden');
  return done(null);
}

/**
 * Add several water sources, one at a time, so one that already exists or is not a valid name does not stop the rest.
 * Stops at once if the person may not add them, or on an unexpected failure.
 *
 * @param {string} farmId
 * @param {Array<{ name: string, source_type?: string, fields_served?: string }>} entries
 * @returns {Promise<{ data: { added: number, skipped: number, remaining: number } | null, error: object | null }>} `remaining` is how many were left for another go
 */
export async function addWaterSources(farmId, entries) {
  if (typeof farmId !== 'string' || farmId === '') return fail('invalid');
  const seen = new Set();
  const unique = [];
  let skipped = 0;
  for (const entry of entries) {
    const key = fieldKey(entry.name);
    if (key !== '' && seen.has(key)) skipped += 1;
    else {
      seen.add(key);
      unique.push(entry);
    }
  }

  let added = 0;
  const batch = unique.slice(0, MAX_WATER_SOURCES_AT_ONCE);
  for (const entry of batch) {
    const checked = validateWaterSourceInput(entry);
    if (!checked.ok) {
      skipped += 1;
      continue;
    }
    const { error } = fromDb(await supabase.from('water_sources').insert({ farm_id: farmId, ...checked.value }));
    if (!error) added += 1;
    else if (error.code === 'duplicate' || error.code === 'invalid') skipped += 1;
    else return fail(error.code, { message: error.message, added });
  }
  return done({ added, skipped, remaining: unique.length - batch.length });
}
