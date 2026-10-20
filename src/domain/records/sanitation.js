import { parseDecimalText } from './numbers.js';

/**
 * The sanitizer check: a cleaning-and-sanitizing log says what concentration (ppm) was measured, and the sanitizer's
 * label says what range it must be in. The comparison is made here, from the approved label, so a log's pass or
 * fail never depends on someone remembering the number. When the label cannot decide (no label for that product,
 * no range on it, no reading) there is no result at all, never a guess.
 */

/** A name must be at least this long to match part of a label's product name (and a product name to be matched within a log's). */
const MIN_PARTIAL_LENGTH = 3;

/** Capital letters, accents, punctuation and spacing do not tell two spellings of a product apart. */
const nameKey = (value) =>
  typeof value === 'string'
    ? value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
    : '';

const isApprovedLabel = (record) => record?.kind === 'sanitizer_label' && record.status === 'approved' && nameKey(record.payload?.product) !== '';

const newestFirst = (a, b) => String(b.record_date ?? '').localeCompare(String(a.record_date ?? '')) || String(b.created_at ?? '').localeCompare(String(a.created_at ?? ''));

/** The label of a product that was in force on a day: the newest recorded by then (or the newest there is, when all are later). */
const inForce = (labels, date) => {
  const sorted = [...labels].sort(newestFirst);
  return (typeof date === 'string' && date !== '' ? sorted.find((l) => (l.record_date ?? '') <= date) : null) ?? sorted[0];
};

/**
 * The approved label for a sanitizer a log names: an exact product name first, then a name that is part of one
 * label's product name (or contains it). A name that fits several different products matches none. When the same
 * product has labels for different uses with different ranges (food-contact surfaces and wash water, say) it cannot be
 * told which one the log is about, so that is said rather than guessed.
 *
 * @param {unknown} name
 * @param {object[]} labels sanitizer label records
 * @param {string} [date] the day of the log (YYYY-MM-DD): a newer label does not apply to an older log
 * @returns {{ label: object | null, ambiguous: boolean }}
 */
export function resolveSanitizerLabel(name, labels, date) {
  const none = { label: null, ambiguous: false };
  const wanted = nameKey(name);
  if (wanted === '') return none;

  const usable = labels.filter(isApprovedLabel);
  let matches = usable.filter((l) => nameKey(l.payload.product) === wanted);
  if (matches.length === 0) {
    if (wanted.length < MIN_PARTIAL_LENGTH) return none;
    const partial = usable.filter((l) => {
      const product = nameKey(l.payload.product);
      return product.length >= MIN_PARTIAL_LENGTH && (product.includes(wanted) || wanted.includes(product));
    });
    if (new Set(partial.map((l) => nameKey(l.payload.product))).size !== 1) return none;
    matches = partial;
  }

  // The label in force for each use, and whether the uses agree on the range.
  const byUse = new Map();
  for (const label of matches) byUse.set(String(label.payload.approved_use ?? ''), [...(byUse.get(String(label.payload.approved_use ?? '')) ?? []), label]);
  const perUse = [...byUse.values()].map((group) => inForce(group, date));
  const ranges = new Set(perUse.map((label) => JSON.stringify(labelRange(label))));
  if (ranges.size > 1) return { label: null, ambiguous: true };
  return { label: inForce(perUse, date), ambiguous: false };
}

/** The label a log is about, or null when there is none or it cannot be told which. */
export const findSanitizerLabel = (name, labels, date) => resolveSanitizerLabel(name, labels, date).label;

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
 * @param {{ ppm?: unknown, sanitizer?: unknown, date?: string }} reading
 * @param {object[]} labels sanitizer label records
 * @returns {{ result: 'pass' | 'fail' | null, reason: 'too_low' | 'too_high' | 'no_reading' | 'no_label' | 'ambiguous_label' | 'no_range' | null,
 *   min: number | null, max: number | null, label: object | null }}
 */
export function checkSanitizerConcentration({ ppm, sanitizer, date }, labels) {
  const none = (reason, label = null) => ({ result: null, reason, min: null, max: null, label });

  const reading = parsePpm(ppm);
  if (reading === null || reading === undefined) return none('no_reading');

  const { label, ambiguous } = resolveSanitizerLabel(sanitizer, labels, date);
  if (ambiguous) return none('ambiguous_label');
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
 * @param {string} [date] the day of the log
 * @returns {Record<string, unknown>} a new payload
 */
export function applySanitationCheck(payload, labels, date) {
  if (payload?.method && !SANITIZING.includes(payload.method)) return { ...payload };
  const { result } = checkSanitizerConcentration({ ppm: payload?.ppm, sanitizer: payload?.sanitizer, date }, labels);
  return result ? { ...payload, check_result: result } : { ...payload };
}
