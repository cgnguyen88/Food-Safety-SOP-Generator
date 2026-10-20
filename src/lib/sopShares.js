import { supabase } from './supabase.js';

/**
 * The links that let workers read one SOP and sign it. Owners and managers make them and turn them off (the database
 * allows no one else, and makes the secret token itself). Every function resolves to `{ data, error }`; it never throws.
 */

const COLUMNS = 'id, sop_id, token, created_at';
const fail = (error) => ({ data: null, error: { code: error?.code ?? 'unknown' } });

/** The address workers open for a share. @param {string} origin @param {string} token */
export const shareUrl = (origin, token) => `${origin}/s/${token}`;

/** The working link for a SOP, or null when it has none. @param {string} farmId @param {number} sopId */
export async function getShare(farmId, sopId) {
  const { data, error } = await supabase.from('sop_shares').select(COLUMNS).eq('farm_id', farmId).eq('sop_id', sopId).is('revoked_at', null).maybeSingle();
  return error ? fail(error) : { data: data ?? null, error: null };
}

/** Make the working link for a SOP. @param {string} farmId @param {number} sopId */
export async function createShare(farmId, sopId) {
  const { data, error } = await supabase.from('sop_shares').insert({ farm_id: farmId, sop_id: sopId }).select(COLUMNS).single();
  return error ? fail(error) : { data, error: null };
}

/** Turn a link off for good (a new one can be made). @param {string} id */
export async function turnOffShare(id) {
  const { error } = await supabase.from('sop_shares').update({ revoked_at: new Date().toISOString() }).eq('id', id);
  return error ? fail(error) : { data: null, error: null };
}
