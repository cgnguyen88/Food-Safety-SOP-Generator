import { addYears, daysBetween, recordDay } from './dates.js';
import { fieldKey, tidyFieldName } from './fields.js';
import { KIND_FIELDS } from './kinds.js';

/**
 * Water assessments. The Produce Safety Rule (21 CFR 112.43) asks a farm to look at each water source it uses on
 * its crops: the source and how the water travels, what is near it, how it is applied, the crop, the weather and any
 * test results, and to decide whether measures are needed. It is done at the start of the season and at least once a
 * year, and again when something significant changes, such as a flood. Each assessment is a record; this works out,
 * from the approved ones every time, what the answers add up to and which water sources are due for a new one.
 */

/** The things an assessment rates, in the order the form asks. */
export const CONCERN_KEYS = Object.freeze(['source_concern', 'nearby_concern', 'practice_concern', 'crop_concern', 'weather_concern', 'testing_concern']);

/** How many days before the review date a source shows as due soon. */
export const DUE_SOON_DAYS = 30;

const RATINGS = ['low', 'some', 'high'];
const isRating = (key, value) => RATINGS.includes(value) || (key === 'testing_concern' && value === 'none');

/**
 * What the ratings add up to. This only suggests: the conclusion is the person's to make.
 *  - any factor of high concern: measures look needed
 *  - some factors of some concern: a judgment call
 *  - everything low: no measures look needed
 * Nothing is suggested until every factor has been rated. "No test results" is not a concern in itself.
 *
 * @param {Record<string, unknown> | null | undefined} payload
 * @returns {{ suggestion: 'mitigation_needed' | 'judgment' | 'no_mitigation' | null, high: string[], some: string[] }}
 */
export function assessConcerns(payload) {
  const high = CONCERN_KEYS.filter((key) => payload?.[key] === 'high');
  const some = CONCERN_KEYS.filter((key) => payload?.[key] === 'some');
  const answered = CONCERN_KEYS.every((key) => isRating(key, payload?.[key]));
  if (!answered) return { suggestion: null, high, some };
  return { suggestion: high.length > 0 ? 'mitigation_needed' : some.length > 0 ? 'judgment' : 'no_mitigation', high, some };
}

const momentOf = (record) => {
  const time = Date.parse(record?.created_at);
  return Number.isNaN(time) ? null : time;
};

/** The fields a record names: one, or several separated by commas, semicolons or lines. @param {unknown} text */
const namesOf = (text) => (typeof text === 'string' ? text.split(/[,;\n]/).map(tidyFieldName).filter((name) => name !== '') : []);

const newestFirst = (a, b) => b.day.localeCompare(a.day) || String(b.record.created_at ?? '').localeCompare(String(a.record.created_at ?? ''));

/** Whether a flood came after an assessment. On the same day, only if it was recorded later: with no times to compare, the assessment is taken to come after. */
function floodIsAfter(flood, assessed) {
  if (flood.day !== assessed.day) return flood.day > assessed.day;
  return flood.moment !== null && assessed.moment !== null && flood.moment > assessed.moment;
}

/** How a flood is tied to a water source: the flood names the source, or it hit a field the source waters. */
function linkReason(floodPayload, source) {
  if (fieldKey(floodPayload?.water_source) === source.key && source.key !== '') return { reason: 'named', field: tidyFieldName(floodPayload.field) };
  const hit = namesOf(floodPayload?.field).find((name) => source.fieldKeys.has(fieldKey(name)));
  return hit === undefined ? null : { reason: 'field', field: hit };
}

const isApproved = (record, kind) => record.kind === kind && record.status === 'approved' && record.payload && typeof record.payload === 'object';
const STANDING = { flood: 0, overdue: 1, due_soon: 2, current: 3 };

/**
 * One row for each water source: its newest approved assessment, when it is next due (a year on), and whether a flood
 * since then means it needs a new one. A source is spelled as its newest assessment spells it. Assessments dated in the
 * future have not happened yet, so they do not count. Most urgent first.
 *
 * @param {object[]} records
 * @param {{ today: string }} options `today` is a YYYY-MM-DD date
 * @returns {Array<{
 *   key: string, name: string, fields: string[], fieldKeys: Set<string>, recordId: string, assessedOn: string, assessedAt: string | null,
 *   nextReview: string, daysLeft: number, conclusion: string | undefined, status: 'flood' | 'overdue' | 'due_soon' | 'current',
 *   floods: Array<{ id: string, date: string, field: string, reason: 'field' | 'named' }>,
 * }>}
 */
export function waterSources(records, { today }) {
  const latest = new Map();
  for (const record of records) {
    if (!isApproved(record, 'water_assessment')) continue;
    const key = fieldKey(record.payload.source);
    const day = recordDay(record);
    if (key === '' || day === '' || day > today) continue;
    const candidate = { record, day };
    const current = latest.get(key);
    if (!current || newestFirst(candidate, current) < 0) latest.set(key, candidate);
  }

  const floods = records
    .filter((record) => isApproved(record, 'weather_event') && record.payload.event_type === 'flood')
    .map((record) => ({ record, day: recordDay(record), moment: momentOf(record) }))
    .filter((flood) => flood.day !== '' && flood.day <= today);

  const rows = [...latest.entries()].map(([key, { record, day }]) => {
    const names = namesOf(record.payload.fields_served);
    const source = { key, fieldKeys: new Set(names.map(fieldKey)) };
    const assessed = { day, moment: momentOf(record) };
    const hits = floods.flatMap((flood) => {
      const link = linkReason(flood.record.payload, source);
      return link && floodIsAfter(flood, assessed) ? [{ id: flood.record.id, date: flood.day, field: link.field, reason: link.reason }] : [];
    }).sort((a, b) => a.date.localeCompare(b.date));

    const nextReview = addYears(day, 1);
    const daysLeft = daysBetween(today, nextReview);
    const status = hits.length > 0 ? 'flood' : daysLeft < 0 ? 'overdue' : daysLeft <= DUE_SOON_DAYS ? 'due_soon' : 'current';
    return {
      key,
      name: tidyFieldName(record.payload.source),
      fields: names,
      fieldKeys: source.fieldKeys,
      recordId: record.id,
      assessedOn: day,
      assessedAt: record.created_at ?? null,
      nextReview,
      daysLeft,
      conclusion: record.payload.conclusion,
      status,
      floods: hits,
    };
  });

  return rows.sort((a, b) => STANDING[a.status] - STANDING[b.status] || (a.floods[0]?.date ?? '').localeCompare(b.floods[0]?.date ?? '') || a.daysLeft - b.daysLeft || a.name.localeCompare(b.name));
}

/**
 * The water sources a flood may have reached (the ones it names, and the ones that water the field it hit), and whether
 * each still needs a new assessment because of it. Works for a flood in any status.
 *
 * @param {{ payload?: Record<string, unknown>, record_date?: string | null, created_at?: string } | null | undefined} flood
 * @param {ReturnType<typeof waterSources>} sources
 * @returns {Array<{ source: ReturnType<typeof waterSources>[number], needsAssessment: boolean, reason: 'field' | 'named' }>}
 */
export function floodLinks(flood, sources) {
  const day = flood ? recordDay(flood) : '';
  if (!flood || flood.payload?.event_type !== 'flood' || day === '') return [];
  const moment = momentOf(flood);
  return sources.flatMap((source) => {
    const link = linkReason(flood.payload, source);
    if (!link) return [];
    return [{ source, reason: link.reason, needsAssessment: floodIsAfter({ day, moment }, { day: source.assessedOn, moment: Date.parse(source.assessedAt) || null }) }];
  });
}

/** How many sources stand each way. @param {Array<{ status: string }>} rows */
export function waterCounts(rows) {
  const counts = { flood: 0, overdue: 0, due_soon: 0, current: 0 };
  for (const row of rows) counts[row.status] += 1;
  return counts;
}

const NOT_CARRIED_OVER = new Set(['conclusion', 'mitigation', 'notes']);

/**
 * The answers to start a new assessment of a source from: what the last one said, without the decision, which is made
 * again each time.
 *
 * @param {{ payload?: Record<string, unknown> } | null | undefined} record
 * @returns {Record<string, unknown>}
 */
export function prefillFromAssessment(record) {
  const payload = record?.payload ?? {};
  return Object.fromEntries(
    KIND_FIELDS.water_assessment.filter((f) => !NOT_CARRIED_OVER.has(f.key) && payload[f.key] !== undefined).map((f) => [f.key, payload[f.key]]),
  );
}

/**
 * Floods in the last year that may have reached the water of a source being assessed: the ones that name it, and the
 * ones that hit a field it waters. For the weather part of an assessment. Newest first.
 *
 * @param {object[]} records
 * @param {{ fields?: unknown, source?: unknown, today: string }} options `fields` is the box of fields the source waters
 * @returns {Array<{ id: string, date: string, field: string, reason: 'field' | 'named' }>}
 */
export function recentFloods(records, { fields, source, today }) {
  const key = fieldKey(source);
  const target = { key, fieldKeys: new Set(namesOf(fields).map(fieldKey)) };
  if (target.key === '' && target.fieldKeys.size === 0) return [];
  const since = addYears(today, -1);
  return records
    .filter((record) => isApproved(record, 'weather_event') && record.payload.event_type === 'flood')
    .flatMap((record) => {
      const day = recordDay(record);
      const link = linkReason(record.payload, target);
      return link && day !== '' && day >= since && day <= today ? [{ id: record.id, date: day, field: link.field, reason: link.reason }] : [];
    })
    .sort((a, b) => b.date.localeCompare(a.date));
}

/**
 * The assessed water sources that water a field (or fields) or that are named: for a flood being recorded.
 *
 * @param {ReturnType<typeof waterSources>} sources
 * @param {{ field?: unknown, waterSource?: unknown }} where
 */
export function sourcesServing(sources, { field, waterSource }) {
  const payload = { field, water_source: waterSource };
  return sources.filter((source) => linkReason(payload, source) !== null);
}
