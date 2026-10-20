import { recordDay as dayOf } from './dates.js';
import { fieldKey, tidyFieldName } from './fields.js';

/**
 * Field holds. A flood that reached the crop, or signs of animals in a field, puts that field on hold: nothing
 * from it should be harvested and given a lot code until someone has dealt with the problem. A corrective action
 * marked "clears a field hold" for that field, recorded after the event, lifts the hold. Holds are worked out
 * from the approved records every time; nothing is stored, so a hold can never be out of step with the records.
 * "Not sure whether it reached the crop" holds the field too: not knowing is not a reason to harvest. A record may name
 * several fields ("A1, A2"); each one is held, or cleared, by itself.
 */

/** The kinds of record that decide whether a field is on hold. */
export const HOLD_KINDS = Object.freeze(['weather_event', 'wildlife_check', 'corrective_action']);

const TRIGGERS = Object.freeze([
  { kind: 'weather_event', reason: 'crop_contact', applies: (payload) => payload.crop_contact === 'yes' },
  { kind: 'weather_event', reason: 'crop_contact_unknown', applies: (payload) => payload.crop_contact === 'unknown' },
  { kind: 'wildlife_check', reason: 'animal_signs', applies: (payload) => payload.evidence === 'yes' },
]);

const momentOf = (record) => {
  const time = Date.parse(record.created_at);
  return Number.isNaN(time) ? null : time;
};

/** Whether a clearing action comes after an event. With no date on either side it cannot be told, so it does not. */
function comesAfter(action, trigger) {
  if (action.date === '' || trigger.date === null) return false;
  // An action cannot have dealt with an event that was recorded after the action was.
  if (action.moment !== null && trigger.moment !== null && action.moment < trigger.moment) return false;
  if (action.date !== trigger.date) return action.date > trigger.date;
  // The same day: recorded after the event, or not known which came first (then the person's action is taken to be after).
  return action.moment === null || trigger.moment === null || action.moment >= trigger.moment;
}

const describeTrigger = (record, rule, text) => ({
  id: record.id,
  kind: rule.kind,
  reason: rule.reason,
  date: dayOf(record) || null,
  field: text,
  detail: String((rule.kind === 'weather_event' ? record.payload.event_type : record.payload.evidence_description) ?? ''),
});

/** The fields a record names: one, or several separated by commas, semicolons or lines. @param {unknown} text */
const fieldNames = (text) => (typeof text === 'string' ? text.split(/[,;\n]/).map(tidyFieldName).filter((name) => name !== '') : []);

/**
 * The fields that are on hold, oldest hold first.
 *
 * @param {object[]} records
 * @returns {Array<{ key: string, name: string, since: string | null, triggers: Array<{ id: string, kind: string, reason: 'crop_contact' | 'crop_contact_unknown' | 'animal_signs', date: string | null, field: string, detail: string }> }>}
 */
export function computeFieldHolds(records) {
  const approved = records.filter((r) => r.status === 'approved' && r.payload && typeof r.payload === 'object');

  const triggers = [];
  for (const record of approved) {
    const rule = TRIGGERS.find((t) => t.kind === record.kind && t.applies(record.payload));
    if (!rule) continue;
    for (const name of fieldNames(record.payload.field)) {
      triggers.push({ ...describeTrigger(record, rule, name), key: fieldKey(name), moment: momentOf(record), order: dayOf(record) });
    }
  }

  const actions = approved
    .filter((r) => r.kind === 'corrective_action' && r.payload.clears_hold === 'yes')
    .flatMap((r) => fieldNames(r.payload.field).map((name) => ({ key: fieldKey(name), date: dayOf(r), moment: momentOf(r) })));

  const open = triggers.filter((t) => !actions.some((a) => a.key === t.key && comesAfter(a, t)));

  const byField = new Map();
  for (const trigger of open) byField.set(trigger.key, [...(byField.get(trigger.key) ?? []), trigger]);

  return [...byField.entries()]
    .map(([key, list]) => {
      const sorted = [...list].sort((a, b) => (a.order || '9999').localeCompare(b.order || '9999'));
      const dates = sorted.map((t) => t.date).filter(Boolean);
      return {
        key,
        name: sorted[0].field,
        since: dates[0] ?? null,
        triggers: sorted.map(({ key: _key, moment: _moment, order: _order, ...visible }) => visible),
      };
    })
    .sort((a, b) => (a.since ?? '9999').localeCompare(b.since ?? '9999') || a.name.localeCompare(b.name));
}

/** The hold on a field, if it has one; for a record naming several fields, the first of them that is held. @param {ReturnType<typeof computeFieldHolds>} holds @param {unknown} fieldText */
export function holdFor(holds, fieldText) {
  for (const name of fieldNames(fieldText)) {
    const hold = holds.find((h) => h.key === fieldKey(name));
    if (hold) return hold;
  }
  return null;
}
