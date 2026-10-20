import { addDays, recordDay } from './dates.js';
import { fieldKey, tidyFieldName } from './fields.js';

/**
 * Tracing a lot. From a lot code the farm's approved records answer, forward, where the lot went (packing,
 * shipments, customers, how much), and back, where it came from (the field, the crew, and what happened there:
 * soil amendments, water tests, cleaning, weather, animals, corrective actions). It also lists what an auditor
 * would ask for and the records do not show. Everything is worked out from the records every time.
 */

/** How far before a harvest a soil amendment is still part of the lot's history. */
export const AMENDMENT_LOOKBACK_DAYS = 365;
/** How far before a harvest a weather event or an animal check is still part of the lot's history. */
export const EVENT_LOOKBACK_DAYS = 30;

const lotKey = (value) => (typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').toUpperCase() : '');
const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Characters a lot code is made of: another one right beside a code means it is a different code ("GVF-1" is not in "GVF-10"). */
const CODE_CHARS = 'A-Z0-9_.-';

const mention = (lot) => new RegExp(`(^|[^${CODE_CHARS}])${escapeRegExp(lot)}(?![${CODE_CHARS}])`, 'g');
const words = (value) => (typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '');

/**
 * Whether a box of text (a shipment's lot codes, a corrective action's "affected") names a lot code. Lot codes are free
 * text, so one may have spaces or slashes in it and a list may be separated by anything; the code is looked for as a
 * whole, not beside another letter or digit of a longer code.
 *
 * @param {unknown} text
 * @param {unknown} code
 */
export function mentionsLot(text, code) {
  const lot = lotKey(code);
  return lot !== '' && typeof text === 'string' && mention(lot).test(lotKey(text));
}

/** Whether the text names this lot and nothing else. */
function namesOnly(text, lot) {
  return !/[A-Z0-9]/.test(lotKey(text).replace(mention(lot), ' '));
}

const approved = (record, ...kinds) => record.status === 'approved' && kinds.includes(record.kind) && record.payload && typeof record.payload === 'object';
const byDay = (a, b) => recordDay(a).localeCompare(recordDay(b));
const unique = (list) => [...new Map(list.map((item) => [item.key, item.value])).values()];

/**
 * The lot codes harvests have used, newest first.
 * @param {object[]} records
 * @returns {Array<{ code: string, date: string, crop: string, field: string }>}
 */
export function knownLots(records) {
  const latest = new Map();
  for (const record of records) {
    if (!approved(record, 'harvest')) continue;
    const code = lotKey(record.payload.lot_code);
    if (code === '') continue;
    const date = recordDay(record);
    const seen = latest.get(code);
    if (!seen || date > seen.date) latest.set(code, { code, date, crop: words(record.payload.crop), field: tidyFieldName(record.payload.field) });
  }
  return [...latest.values()].sort((a, b) => b.date.localeCompare(a.date) || a.code.localeCompare(b.code));
}

/** Quantities added up for each unit, in the order the units first appear. */
function totals(records) {
  const sums = new Map();
  for (const record of records) {
    const quantity = Number(record.payload.quantity);
    if (!Number.isFinite(quantity)) continue;
    const unit = words(record.payload.unit);
    sums.set(unit, (sums.get(unit) ?? 0) + quantity);
  }
  return [...sums].map(([unit, quantity]) => ({ unit, quantity }));
}

function customersOf(shipments) {
  const byName = new Map();
  for (const shipment of shipments) {
    const name = words(shipment.payload.customer);
    if (name === '') continue;
    const key = name.toLowerCase();
    byName.set(key, { name: byName.get(key)?.name ?? name, shipments: [...(byName.get(key)?.shipments ?? []), shipment] });
  }
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function backTrace(records, harvests, packing, lot) {
  const dated = harvests.map((harvest) => ({ day: recordDay(harvest), field: fieldKey(harvest.payload.field) })).filter((h) => h.day !== '');
  const fieldKeys = new Set(harvests.map((harvest) => fieldKey(harvest.payload.field)).filter(Boolean));
  const earliest = dated.map((h) => h.day).sort()[0] ?? '';
  const workDays = new Set([...harvests, ...packing].map(recordDay).filter(Boolean));

  const onField = (record) => fieldKeys.has(fieldKey(record.payload.field));
  const beforeAHarvest = (record, days, sameField) => {
    const day = recordDay(record);
    return day !== '' && dated.some((h) => (!sameField || h.field === fieldKey(record.payload.field)) && day <= h.day && day >= addDays(h.day, -days));
  };

  const amendments = records.filter((r) => approved(r, 'soil_amendment') && onField(r) && beforeAHarvest(r, AMENDMENT_LOOKBACK_DAYS, true)).sort(byDay);
  const fieldEvents = records.filter((r) => approved(r, 'weather_event', 'wildlife_check') && onField(r) && beforeAHarvest(r, EVENT_LOOKBACK_DAYS, true)).sort(byDay);
  const sanitation = records.filter((r) => approved(r, 'sanitation_log') && workDays.has(recordDay(r))).sort(byDay);

  // The latest water test of each use, on or before the harvest.
  const latestByUse = new Map();
  for (const test of records.filter((r) => approved(r, 'water_test'))) {
    const day = recordDay(test);
    if (day === '' || !dated.some((h) => day <= h.day)) continue;
    const use = test.payload.water_use ?? '';
    const best = latestByUse.get(use);
    if (!best || day > recordDay(best)) latestByUse.set(use, test);
  }
  const waterTests = [...latestByUse.values()].sort(byDay);

  const correctiveActions = records.filter((r) => {
    if (!approved(r, 'corrective_action')) return false;
    const day = recordDay(r);
    if (earliest !== '' && day !== '' && day < addDays(earliest, -EVENT_LOOKBACK_DAYS)) return false;
    return onField(r) || mentionsLot(r.payload.affected, lot);
  }).sort(byDay);

  return { amendments, waterTests, sanitation, fieldEvents, correctiveActions };
}

/**
 * Everything the records say about one lot.
 *
 * @param {object[]} records
 * @param {unknown} code
 * @returns {null | {
 *   code: string, found: boolean, harvests: object[], packing: object[], shipments: object[],
 *   fields: string[], crops: string[], crew: string[], harvested: Array<{ unit: string, quantity: number }>,
 *   shipped: Array<{ unit: string, quantity: number }>, sharedShipments: number,
 *   customers: Array<{ name: string, shipments: object[] }>,
 *   back: { amendments: object[], waterTests: object[], sanitation: object[], fieldEvents: object[], correctiveActions: object[] },
 *   gaps: Array<'no_harvest' | 'no_crew' | 'no_water_test' | 'no_sanitation' | 'no_shipment'>,
 * }} null for a blank code
 */
export function traceLot(records, code) {
  const lot = lotKey(code);
  if (lot === '') return null;

  const harvests = records.filter((r) => approved(r, 'harvest') && lotKey(r.payload.lot_code) === lot).sort(byDay);
  const packing = records.filter((r) => approved(r, 'packing_cooling') && lotKey(r.payload.lot_code) === lot).sort(byDay);
  const shipments = records.filter((r) => approved(r, 'shipment') && mentionsLot(r.payload.lot_codes, lot)).sort(byDay);
  const found = harvests.length + packing.length + shipments.length > 0;

  const pick = (list, value) => unique(list.map((record) => ({ key: value(record).toLowerCase(), value: value(record) })).filter((item) => item.key !== ''));
  const fields = unique(harvests.map((r) => ({ key: fieldKey(r.payload.field), value: tidyFieldName(r.payload.field) })).filter((item) => item.key !== ''));
  const crops = pick(harvests, (r) => words(r.payload.crop));
  const crew = pick(harvests, (r) => words(r.payload.crew));
  const onlyThisLot = shipments.filter((r) => namesOnly(r.payload.lot_codes, lot));

  const back = found ? backTrace(records, harvests, packing, lot) : { amendments: [], waterTests: [], sanitation: [], fieldEvents: [], correctiveActions: [] };
  const gaps = !found ? [] : [
    harvests.length === 0 && 'no_harvest',
    harvests.length > 0 && crew.length === 0 && 'no_crew',
    back.waterTests.length === 0 && 'no_water_test',
    back.sanitation.length === 0 && 'no_sanitation',
    shipments.length === 0 && 'no_shipment',
  ].filter(Boolean);

  return {
    code: lot,
    found,
    harvests,
    packing,
    shipments,
    fields,
    crops,
    crew,
    harvested: totals(harvests),
    shipped: totals(onlyThisLot),
    sharedShipments: shipments.length - onlyThisLot.length,
    customers: customersOf(shipments),
    back,
    gaps,
  };
}
