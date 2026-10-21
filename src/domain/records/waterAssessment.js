import { addYears, daysBetween, recordDay } from './dates.js';
import { tidyFieldName } from './fields.js';
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

/**
 * What two spellings of a field or a water source have in common. Capital letters, accents, spacing and punctuation do
 * not tell two names apart ("A-2", "A 2" and "a2" are one field; "Peña" and "Pena" are one place), because a mistaken
 * "these are different" would mean a flood that is never tied to the water it reached, which is worse than a flood
 * tied to a neighbour.
 */
const looseKey = (text) => tidyFieldName(text).normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

/** What separates one name from the next in a box of names: commas, semicolons, lines, slashes, "&", "and" and "y". */
const SEPARATORS = /[,;\n/&]|\s+(?:and|y)\s+/i;

/**
 * The fields (or water sources) a box of text names, each once, as first written.
 * @param {unknown} text
 * @returns {string[]}
 */
export function fieldNamesIn(text) {
  if (typeof text !== 'string') return [];
  const seen = new Set();
  const names = [];
  for (const piece of text.split(SEPARATORS)) {
    const name = tidyFieldName(piece);
    const key = looseKey(name);
    if (key === '' || seen.has(key)) continue;
    seen.add(key);
    names.push(name);
  }
  return names;
}

const newestFirst = (a, b) => b.day.localeCompare(a.day) || String(b.record.created_at ?? '').localeCompare(String(a.record.created_at ?? ''));

/** Whether a flood came after an assessment. On the same day, only if it was recorded later: with no times to compare, the assessment is taken to come after. */
function floodIsAfter(flood, assessed) {
  if (flood.day !== assessed.day) return flood.day > assessed.day;
  return flood.moment !== null && assessed.moment !== null && flood.moment > assessed.moment;
}

/** How a flood is tied to a water source: the flood names the source, or it hit a field the source waters. */
function linkReason(floodPayload, source) {
  if (source.key !== '' && fieldNamesIn(floodPayload?.water_source).some((name) => looseKey(name) === source.key)) return { reason: 'named', field: tidyFieldName(floodPayload.field) };
  const hit = fieldNamesIn(floodPayload?.field).find((name) => source.fieldKeys.has(looseKey(name)));
  return hit === undefined ? null : { reason: 'field', field: hit };
}

const isApproved = (record, kind) => record.kind === kind && record.status === 'approved' && record.payload && typeof record.payload === 'object';
const STANDING = { flood: 0, overdue: 1, not_assessed: 2, due_soon: 3, current: 4, archived: 5 };

/** The newest record of each source (keyed loosely by name), among `candidates` of `{ record, day }`. */
function newestBySource(candidates, keyOf) {
  const newest = new Map();
  for (const candidate of candidates) {
    const key = keyOf(candidate.record);
    const current = newest.get(key);
    if (!current || newestFirst(candidate, current) < 0) newest.set(key, candidate);
  }
  return newest;
}

/** The approved records of a kind that name a source and have a day that is not after `today`, as `{ record, day }`. */
function datedBy(records, kind, today) {
  return records
    .filter((record) => isApproved(record, kind) && looseKey(record.payload.source) !== '')
    .map((record) => ({ record, day: recordDay(record) }))
    .filter(({ day }) => day !== '' && day <= today);
}

/**
 * One row for each water source: the farm's list of water sources (when it has one) and every source an approved
 * assessment names. Each has its newest approved assessment, when it is next due (a year on), whether a flood since then
 * means it needs a new one, and its latest water test. A source on the list that was never assessed is a row of its own
 * ("not assessed"); one that is archived is left out; one an assessment names that is not on the list is still shown
 * (`registered: false`). A source is spelled as the list spells it, else as its newest assessment does, and names are
 * matched loosely. Floods are tied to a source through the fields on the list as well as the fields it was assessed for.
 * Assessments dated in the future have not happened yet, so they do not count. Most urgent first.
 *
 * @param {object[]} records
 * @param {{ today: string, registry?: Array<{ id: string, name: string, source_type?: string | null, fields_served?: string | null, notes?: string | null, is_active: boolean }>, includeArchived?: boolean }} options
 *   `today` is a YYYY-MM-DD date; `includeArchived` adds the archived sources, marked `archived` and with the status "archived"
 * @returns {Array<{
 *   key: string, name: string, fields: string[], fieldKeys: Set<string>, sourceId: string | null, registered: boolean, sourceType: string | null, notes: string | null,
 *   recordId: string | null, assessedOn: string | null, assessedAt: string | null, nextReview: string | null, daysLeft: number | null, conclusion: string | undefined,
 *   archived: boolean, status: 'flood' | 'overdue' | 'not_assessed' | 'due_soon' | 'current' | 'archived',
 *   floods: Array<{ id: string, date: string, field: string, reason: 'field' | 'named' }>,
 *   lastTest: { id: string, date: string, result: string | undefined, value: number | null } | null,
 * }>}
 */
export function waterSources(records, { today, registry = [], includeArchived = false }) {
  const listed = new Map();
  for (const entry of registry) {
    const key = looseKey(entry.name);
    if (key !== '' && !listed.has(key)) listed.set(key, entry);
  }

  const assessments = newestBySource(datedBy(records, 'water_assessment', today), (record) => looseKey(record.payload.source));
  const tests = newestBySource(datedBy(records, 'water_test', today), (record) => looseKey(record.payload.source));
  const floods = records
    .filter((record) => isApproved(record, 'weather_event') && record.payload.event_type === 'flood')
    .map((record) => ({ record, day: recordDay(record), moment: momentOf(record) }))
    .filter((flood) => flood.day !== '' && flood.day <= today);

  const keys = new Set([...assessments.keys(), ...[...listed].filter(([, entry]) => entry.is_active || includeArchived).map(([key]) => key)]);
  const rows = [...keys].flatMap((key) => {
    const entry = listed.get(key);
    const archived = Boolean(entry) && !entry.is_active;
    if (archived && !includeArchived) return [];
    const assessed = assessments.get(key);
    const test = tests.get(key);

    const listedNames = fieldNamesIn(entry?.fields_served);
    const assessedNames = fieldNamesIn(assessed?.record.payload.fields_served);
    const fieldKeys = new Set([...listedNames, ...assessedNames].map(looseKey));
    const base = {
      key,
      name: tidyFieldName(entry ? entry.name : assessed.record.payload.source),
      fields: listedNames.length > 0 ? listedNames : assessedNames,
      fieldKeys,
      sourceId: entry?.id ?? null,
      registered: Boolean(entry),
      archived,
      sourceType: entry?.source_type ?? assessed?.record.payload.source_type ?? null,
      notes: entry?.notes ?? null,
      lastTest: test ? { id: test.record.id, date: test.day, result: test.record.payload.result, value: test.record.payload.result_value ?? null } : null,
    };

    if (!assessed) return [{ ...base, recordId: null, assessedOn: null, assessedAt: null, nextReview: null, daysLeft: null, conclusion: undefined, status: archived ? 'archived' : 'not_assessed', floods: [] }];

    const { record, day } = assessed;
    const source = { key, fieldKeys };
    const when = { day, moment: momentOf(record) };
    const hits = archived ? [] : floods.flatMap((flood) => {
      const link = linkReason(flood.record.payload, source);
      return link && floodIsAfter(flood, when) ? [{ id: flood.record.id, date: flood.day, field: link.field, reason: link.reason }] : [];
    }).sort((a, b) => a.date.localeCompare(b.date));

    const nextReview = addYears(day, 1);
    const daysLeft = daysBetween(today, nextReview);
    const status = archived ? 'archived' : hits.length > 0 ? 'flood' : daysLeft < 0 ? 'overdue' : daysLeft <= DUE_SOON_DAYS ? 'due_soon' : 'current';
    return [{ ...base, recordId: record.id, assessedOn: day, assessedAt: record.created_at ?? null, nextReview, daysLeft, conclusion: record.payload.conclusion, status, floods: hits }];
  });

  return rows.sort((a, b) => STANDING[a.status] - STANDING[b.status] || (a.floods[0]?.date ?? '').localeCompare(b.floods[0]?.date ?? '') || (a.daysLeft ?? 0) - (b.daysLeft ?? 0) || a.name.localeCompare(b.name));
}

/**
 * The water sources a flood may have reached (the ones it names, and the ones that water the field it hit), and whether
 * each still needs a new assessment because of it. Works for a flood still being worked on, but not one that was
 * voided or rejected, and not one dated after `today` (when it is given): those did not happen.
 *
 * @param {{ status?: string, payload?: Record<string, unknown>, record_date?: string | null, created_at?: string } | null | undefined} flood
 * @param {ReturnType<typeof waterSources>} sources
 * @param {{ today?: string }} [options]
 * @returns {Array<{ source: ReturnType<typeof waterSources>[number], needsAssessment: boolean, reason: 'field' | 'named' }>}
 */
export function floodLinks(flood, sources, { today } = {}) {
  const day = flood ? recordDay(flood) : '';
  if (!flood || flood.payload?.event_type !== 'flood' || day === '') return [];
  if (flood.status === 'voided' || flood.status === 'rejected' || (today !== undefined && day > today)) return [];
  const moment = momentOf(flood);
  return sources.flatMap((source) => {
    const link = linkReason(flood.payload, source);
    if (!link) return [];
    // A source that was never assessed needs an assessment whatever came before.
    const needsAssessment = source.assessedOn === null || floodIsAfter({ day, moment }, { day: source.assessedOn, moment: Date.parse(source.assessedAt) || null });
    return [{ source, reason: link.reason, needsAssessment }];
  });
}

/** How many sources stand each way. @param {Array<{ status: string }>} rows */
export function waterCounts(rows) {
  const counts = { flood: 0, overdue: 0, not_assessed: 0, due_soon: 0, current: 0 };
  for (const row of rows) if (row.status in counts) counts[row.status] += 1;
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
 * The answers to start an assessment of a source from, as the page and a flood's panel start one: the last assessment's answers
 * (without the decision), with what the farm's list says about the source (its kind and fields) for whatever the last assessment
 * did not say, and the source's name as the list spells it. A source never assessed starts from the list alone.
 *
 * @param {ReturnType<typeof waterSources>[number]} row
 * @param {object[]} records the farm's approved records, to find the last assessment in
 * @returns {Record<string, unknown>}
 */
export function prefillForSource(row, records) {
  const fromList = { source: row.name, ...(row.sourceType ? { source_type: row.sourceType } : {}), ...(row.fields.length > 0 ? { fields_served: row.fields.join(', ') } : {}) };
  return { ...fromList, ...prefillFromAssessment(records.find((record) => record.id === row.recordId)), source: row.name };
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
  const key = looseKey(source);
  const target = { key, fieldKeys: new Set(fieldNamesIn(fields).map(looseKey)) };
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

const SOURCE_TYPES = KIND_FIELDS.water_assessment.find((f) => f.key === 'source_type').options.map((o) => o.value);
const SOURCE_NAME_MAX = 60;

/**
 * The water sources that approved assessments, water tests and floods name but that are not on the farm's list (archived
 * ones count as on it), most used first, each spelled the way the records spell it most often, with the kind and the fields
 * of its newest approved assessment. A name that cannot be a source's name (too long, or a list: it holds a comma or a
 * semicolon) is left out. For the notice that offers to add them.
 *
 * @param {object[]} records
 * @param {Array<{ name: string }>} registry
 * @returns {Array<{ name: string, uses: number, source_type: string | undefined, fields_served: string | undefined }>}
 */
export function unregisteredWaterSources(records, registry) {
  const known = new Set(registry.map((entry) => looseKey(entry.name)));
  const named = records.flatMap((record) => {
    if (record.status !== 'approved' || !record.payload || typeof record.payload !== 'object') return [];
    const raw = record.kind === 'water_assessment' || record.kind === 'water_test' ? record.payload.source : record.kind === 'weather_event' ? record.payload.water_source : undefined;
    const name = typeof raw === 'string' ? tidyFieldName(raw) : '';
    return name === '' || [...name].length > SOURCE_NAME_MAX || /[,;]/.test(name) || looseKey(name) === '' || known.has(looseKey(name)) ? [] : [name];
  });

  const byKey = new Map();
  for (const name of named) {
    const key = looseKey(name);
    const entry = byKey.get(key) ?? { uses: 0, spellings: new Map() };
    entry.uses += 1;
    entry.spellings.set(name, (entry.spellings.get(name) ?? 0) + 1);
    byKey.set(key, entry);
  }

  const assessments = newestBySource(datedBy(records, 'water_assessment', '9999-12-31'), (record) => looseKey(record.payload.source));
  return [...byKey].map(([key, { uses, spellings }]) => {
    const name = [...spellings].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0][0];
    const payload = assessments.get(key)?.record.payload;
    const fields = typeof payload?.fields_served === 'string' ? payload.fields_served.trim().slice(0, 1000) : '';
    return { name, uses, source_type: SOURCE_TYPES.includes(payload?.source_type) ? payload.source_type : undefined, fields_served: fields === '' ? undefined : fields };
  }).sort((a, b) => b.uses - a.uses || (a.name < b.name ? -1 : 1));
}

/**
 * The approved records that name a water source: its assessments, its water tests and the floods that name it, each newest
 * first. `key` is the source's key as `waterSources` gives it (its name, matched loosely).
 *
 * @param {object[]} records
 * @param {string} key
 * @returns {{ assessments: object[], tests: object[], floods: object[] }}
 */
export function sourceHistory(records, key) {
  const newestRecordFirst = (a, b) => recordDay(b).localeCompare(recordDay(a)) || String(b.created_at ?? '').localeCompare(String(a.created_at ?? ''));
  const mine = (kind, name) => records.filter((record) => isApproved(record, kind) && name(record.payload).some((one) => looseKey(one) === key)).sort(newestRecordFirst);
  const source = (payload) => [payload.source];
  return { assessments: mine('water_assessment', source), tests: mine('water_test', source), floods: mine('weather_event', (payload) => fieldNamesIn(payload.water_source)) };
}
