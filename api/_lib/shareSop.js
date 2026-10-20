import { SOP_DATA } from '../../src/data/sop-data.js';
import { evaluateRecord, recordFingerprint } from '../../src/domain/records/schemas.js';

/**
 * What a SOP share link may show and what signing it creates. Everything here is about the one SOP the link is for:
 * the page gets that SOP's saved answers and the farm's name, nothing else about the farm.
 */

const SHARE_TOKEN = /^[0-9a-f]{64}$/;
const NAME_MIN = 2;
const NAME_MAX = 80;
const VALUE_MAX = 4000;
const LIST_MAX = 50;
const ITEM_MAX = 200;
const FARM_NAME_MAX = 120;
// Control and format characters (zero-width, bidirectional marks and isolates, tags), line and paragraph separators, and the blank
// "filler" characters some scripts have: all invisible, so none of them may make a name look different from what it is.
const HIDDEN = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}\u115f\u1160\u3164\uffa0\u2800]/gu;

/** The token from a link, or null when it cannot be a token (so nothing is looked up for it). @param {unknown} value */
export const parseShareToken = (value) => (typeof value === 'string' && SHARE_TOKEN.test(value) ? value : null);

/** The SOP with this number, or null. @param {unknown} id */
export const findSop = (id) => (Number.isInteger(id) ? SOP_DATA.find((sop) => sop.id === id) ?? null : null);

const oneLine = (value, max) => (typeof value === 'string' ? value.replace(HIDDEN, ' ').replace(/\s+/g, ' ').trim().slice(0, max) : '');
const MIN_LETTERS = 2;

/**
 * A signer's name as it will be kept: one line, tidy spacing, two to eighty characters with at least two letters, and nothing
 * that looks like markup. Commas and semicolons become spaces, because the training list reads them as the break between two
 * people: one signature must be one person.
 * @param {unknown} value
 * @returns {string | null}
 */
export function cleanSignerName(value) {
  const name = oneLine(typeof value === 'string' ? value.replace(/[,;]/g, ' ') : value, NAME_MAX + 1);
  if (name.length < NAME_MIN || name.length > NAME_MAX || /[<>]/.test(name)) return null;
  if ((name.match(/\p{L}/gu) ?? []).length < MIN_LETTERS) return null;
  return name;
}

/**
 * The saved answers for one SOP, cut down to what a reader of the page needs: only fields the SOP has, text no longer
 * than a page can use, and no other farm data.
 *
 * @param {{ sop: object, form: unknown, farmProfile: unknown }} input
 * @returns {{ sopId: number, farmName: string, values: Record<string, string | string[]> }}
 */
export function sharedSopView({ sop, form, farmProfile }) {
  const saved = form && typeof form === 'object' && !Array.isArray(form) ? form : {};
  const values = {};
  for (const section of sop.sections) {
    for (const field of section.fields) {
      const value = saved[field.id];
      if (typeof value === 'string') {
        const text = value.replace(HIDDEN, (c) => (c === '\n' || c === '\r' || c === '\t' ? c : '')).trim().slice(0, VALUE_MAX);
        if (text !== '') values[field.id] = text;
      } else if (Array.isArray(value)) {
        const items = value.filter((item) => typeof item === 'string').map((item) => oneLine(item, ITEM_MAX)).filter(Boolean).slice(0, LIST_MAX);
        if (items.length > 0) values[field.id] = items;
      }
    }
  }
  const profile = farmProfile && typeof farmProfile === 'object' ? farmProfile : {};
  return { sopId: sop.id, farmName: oneLine(profile.farm_name, FARM_NAME_MAX), values };
}

const nameKey = (name) => name.normalize('NFC').toLowerCase();

/**
 * The training record that signing a SOP creates: waiting for an owner or manager to approve, from the link, with no
 * signed-in author. Signing the same SOP twice on one day under one name makes one record.
 *
 * @param {{ share: { id: string, farm_id: string }, sop: object, name: string, today: string, lang: unknown }} input
 * @returns {{ ok: true, row: object } | { ok: false }}
 */
export function signOffRow({ share, sop, name, today, lang }) {
  const payload = {
    topic: sop.title,
    sop: sop.ref,
    trainer: 'Read and signed from the SOP link',
    attendees: name,
    language: lang === 'es' ? 'es' : 'en',
  };
  const evaluation = evaluateRecord('training', { record_date: today, payload });
  if (!evaluation.ok || !evaluation.complete) return { ok: false };
  const { record_date, payload: clean } = evaluation.value;
  return {
    ok: true,
    row: {
      farm_id: share.farm_id,
      kind: 'training',
      status: 'pending_review',
      record_date,
      payload: clean,
      missing_fields: evaluation.missing,
      fingerprint: recordFingerprint('training', record_date, clean),
      source: 'web_upload',
      source_ref: `sop-share:${share.id}:${record_date}:${nameKey(name)}`.slice(0, 200),
    },
  };
}
