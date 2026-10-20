import { parseDecimalText } from './numbers.js';

/**
 * The sanitizer check: a cleaning-and-sanitizing log says what concentration (ppm) was measured, and the sanitizer's
 * label says what range it must be in. The comparison is made here, from the approved label, so a log's pass or
 * fail never depends on someone remembering the number. When the label cannot decide (no label for that product,
 * no range on it, no reading) there is no result at all, never a guess.
 */

/** A name must be at least this long to match part of a label's product name. */
const MIN_PARTIAL_LENGTH = 3;

/** Capital letters, accents, punctuation and spacing do not tell two spellings of a product apart. */
const nameKey = (value) =>
  typeof value === 'string'
    ? value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
    : '';

const isApprovedLabel = (record) => record?.kind === 'sanitizer_label' && record.status === 'approved' && nameKey(record.payload?.product) !== '';

const newestFirst = (a, b) => String(b.record_date ?? '').localeCompare(String(a.record_date ?? '')) || String(b.created_at ?? '').localeCompare(String(a.created_at ?? ''));

/** The newest label of one product. */
const newest = (labels) => [...labels].sort(newestFirst)[0];

/**
 * The approved label for a sanitizer a log names: an exact product name first, then a name that is part of one
 * label's product name (or contains it). A name that fits several different products matches none.
 *
 * @param {unknown} name
 * @param {object[]} labels sanitizer label records
 * @returns {object | null}
 */
export function findSanitizerLabel(name, labels) {
  const wanted = nameKey(name);
  if (wanted === '') return null;

  const usable = labels.filter(isApprovedLabel);
  const exact = usable.filter((l) => nameKey(l.payload.product) === wanted);
  if (exact.length > 0) return newest(exact);
  if (wanted.length < MIN_PARTIAL_LENGTH) return null;

  const partial = usable.filter((l) => {
    const product = nameKey(l.payload.product);
    return product.includes(wanted) || wanted.includes(product);
  });
  const products = new Set(partial.map((l) => nameKey(l.payload.product)));
  return products.size === 1 ? newest(partial) : null;
}

const isBlank = (value) => value === undefined || value === null || (typeof value === 'string' && value.trim() === '');

/** @returns {number | null | undefined} a number, null for blank, undefined for something that is not a ppm figure */
function parsePpm(value) {
  if (isBlank(value)) return null;
  const number = typeof value === 'number' ? value : typeof value === 'string' ? parseDecimalText(value) : Number.NaN;
  return Number.isFinite(number) && number >= 0 ? number : undefined;
}

/**
 * The range a label allows, or null if it has none that makes sense.
 * @param {{ payload?: { ppm_min?: unknown, ppm_max?: unknown } } | null | undefined} label
 * @returns {{ min: number | null, max: number | null } | null}
 */
export function labelRange(label) {
  const min = parsePpm(label?.payload?.ppm_min);
  const max = parsePpm(label?.payload?.ppm_max);
  if (min === undefined || max === undefined) return null;
  if (min === null && max === null) return null;
  if (min !== null && max !== null && min > max) return null;
  return { min, max };
}

/**
 * Compare a measured concentration with the label of the sanitizer used.
 *
 * @param {{ ppm?: unknown, sanitizer?: unknown }} reading
 * @param {object[]} labels sanitizer label records
 * @returns {{ result: 'pass' | 'fail' | null, reason: 'too_low' | 'too_high' | 'no_reading' | 'no_label' | 'no_range' | null,
 *   min: number | null, max: number | null, label: object | null }}
 */
export function checkSanitizerConcentration({ ppm, sanitizer }, labels) {
  const none = (reason, label = null) => ({ result: null, reason, min: null, max: null, label });

  const reading = parsePpm(ppm);
  if (reading === null || reading === undefined) return none('no_reading');

  const label = findSanitizerLabel(sanitizer, labels);
  if (!label) return none('no_label');

  const range = labelRange(label);
  if (!range) return none('no_range', label);

  const { min, max } = range;
  if (min !== null && reading < min) return { result: 'fail', reason: 'too_low', min, max, label };
  if (max !== null && reading > max) return { result: 'fail', reason: 'too_high', min, max, label };
  return { result: 'pass', reason: null, min, max, label };
}

/** The steps that put a sanitizer on a surface (a cleaning-only step has no concentration to check). */
const SANITIZING = ['clean_sanitize', 'sanitize_only'];

/**
 * A cleaning log's payload with its concentration check written in from the label. When the label cannot decide,
 * what the person chose stays as it was.
 *
 * @param {Record<string, unknown>} payload
 * @param {object[]} labels
 * @returns {Record<string, unknown>} a new payload
 */
export function applySanitationCheck(payload, labels) {
  if (payload?.method && !SANITIZING.includes(payload.method)) return { ...payload };
  const { result } = checkSanitizerConcentration({ ppm: payload?.ppm, sanitizer: payload?.sanitizer }, labels);
  return result ? { ...payload, check_result: result } : { ...payload };
}
