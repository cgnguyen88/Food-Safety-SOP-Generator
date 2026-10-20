import { isValidIsoDate } from './schemas.js';

/**
 * Lot codes. A farm writes its lot code format once, with the parts it wants in curly brackets
 * ({FARM}-{CROP}-{YYYYMMDD}-{FIELD}); each harvest gets a code made from the harvest itself, so codes are
 * the same shape every time and nobody has to invent one on the truck. A code that has already been used gets a
 * number added so two lots never share one.
 */

export const DEFAULT_LOT_FORMAT = '{FARM}-{CROP}-{YYYYMMDD}-{FIELD}';
export const LOT_FORMAT_MAX = 40;

/** How long each part may be, so a code still fits on a label. */
const PART_LIMITS = Object.freeze({ FARM: 8, CROP: 12, FIELD: 10 });
/** Parts that stand for the date. A format needs one of these, or {SEQ}, to tell one day's lots from another's. */
const DATE_TOKENS = Object.freeze(['YYYYMMDD', 'YYMMDD', 'YYYY', 'JULIAN']);
const DAY_TOKENS = Object.freeze(['YYYYMMDD', 'YYMMDD', 'JULIAN']);
export const LOT_TOKENS = Object.freeze(['FARM', 'CROP', 'FIELD', ...DATE_TOKENS, 'SEQ']);

const TOKEN = /\{([^{}]*)\}/g;
const LITERAL_OK = /^[A-Za-z0-9_.-]*$/;
const MAX_SEQUENCE = 10_000;

/**
 * @param {unknown} format
 * @returns {{ ok: boolean, errors: Array<'empty' | 'too_long' | 'unknown_token' | 'bad_characters' | 'no_date'>, tokens: string[] }}
 */
export function validateLotFormat(format) {
  const text = typeof format === 'string' ? format.trim() : '';
  if (text === '') return { ok: false, errors: ['empty'], tokens: [] };

  const errors = [];
  if ([...text].length > LOT_FORMAT_MAX) errors.push('too_long');

  const names = [...text.matchAll(TOKEN)].map((match) => match[1]);
  const tokens = names.filter((name) => LOT_TOKENS.includes(name));
  if (tokens.length < names.length) errors.push('unknown_token');
  if (!LITERAL_OK.test(text.replace(TOKEN, ''))) errors.push('bad_characters');
  if (!tokens.some((name) => DAY_TOKENS.includes(name) || name === 'SEQ')) errors.push('no_date');
  return { ok: errors.length === 0, errors, tokens };
}

/** Letters and numbers only, capitals, accents taken off ("Jalapeño" is "JALAPENO"), cut to `limit`. */
const clean = (value, limit) =>
  (typeof value === 'string' ? value : '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, limit);

/** The farm's own code, or the first letters of its words ("Green Valley Farm" is "GVF"), or its one word. */
function farmPart(farmCode, farmName) {
  const code = clean(farmCode, PART_LIMITS.FARM);
  if (code !== '') return code;
  const words = (typeof farmName === 'string' ? farmName : '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().split(/[^A-Z0-9]+/).filter(Boolean);
  if (words.length > 1) return words.map((word) => word[0]).join('').slice(0, PART_LIMITS.FARM);
  return clean(words[0], PART_LIMITS.FARM);
}

const pad = (n, width = 2) => String(n).padStart(width, '0');

/** The date parts, from a YYYY-MM-DD date. */
function dateParts(date) {
  const [year, month, day] = date.split('-');
  const dayOfYear = Math.round((Date.UTC(Number(year), Number(month) - 1, Number(day)) - Date.UTC(Number(year), 0, 1)) / 86_400_000) + 1;
  return { YYYYMMDD: `${year}${month}${day}`, YYMMDD: `${year.slice(2)}${month}${day}`, YYYY: year, JULIAN: `${year.slice(2)}${pad(dayOfYear, 3)}` };
}

const keyOf = (code) => code.trim().toUpperCase();

/**
 * Make a lot code.
 *
 * @param {{ format: string, farmCode?: string, farmName?: string, crop?: string, field?: string, date?: string, existingCodes?: unknown[] }} input
 * @returns {{ ok: true, code: string } | { ok: false, reason: 'invalid_format' } | { ok: false, reason: 'missing', missing: string[] }}
 */
export function generateLotCode({ format, farmCode, farmName, crop, field, date, existingCodes = [] }) {
  const checked = validateLotFormat(format);
  if (!checked.ok) return { ok: false, reason: 'invalid_format' };

  const parts = { FARM: farmPart(farmCode, farmName), CROP: clean(crop, PART_LIMITS.CROP), FIELD: clean(field, PART_LIMITS.FIELD) };
  const dates = typeof date === 'string' && isValidIsoDate(date) ? dateParts(date) : null;
  const missing = checked.tokens.filter((name) => (name in parts ? parts[name] === '' : DATE_TOKENS.includes(name) && dates === null));
  if (missing.length > 0) return { ok: false, reason: 'missing', missing: [...new Set(missing)] };

  const template = format.trim();
  const fill = (sequence) => template.replace(TOKEN, (_, name) => (name in parts ? parts[name] : name === 'SEQ' ? pad(sequence) : dates[name]));

  const used = new Set(existingCodes.filter((code) => typeof code === 'string' && code.trim() !== '').map(keyOf));
  if (checked.tokens.includes('SEQ')) {
    for (let sequence = 1; sequence <= MAX_SEQUENCE; sequence += 1) {
      const code = fill(sequence);
      if (!used.has(keyOf(code))) return { ok: true, code };
    }
  }
  const base = fill(1);
  let code = base;
  for (let attempt = 2; used.has(keyOf(code)) && attempt <= MAX_SEQUENCE; attempt += 1) code = `${base}-${attempt}`;
  return { ok: true, code };
}

/**
 * The code for a harvest, from what the harvest says (its crop and field) and its date.
 * @param {{ crop?: unknown, field?: unknown }} values
 * @param {string} date
 * @param {{ format: string, farmCode?: string, farmName?: string, existingCodes?: unknown[] }} farm
 */
export function fillLotCode(values, date, farm) {
  return generateLotCode({ ...farm, crop: values.crop, field: values.field, date });
}
