import { cleanText } from './csv.js';
import { FIELD_NAME_MAX, canManageFields, tidyFieldName } from './fields.js';
import { KIND_FIELDS } from './kinds.js';

/**
 * The farm's list of water sources: the named wells, canals, ponds and supplies it waters crops from. A source's name is
 * written like a field's (one line, single spaces, up to 60 characters), because records name a source in free text and
 * the list gives each farm one spelling to choose from.
 */

const TEXT_MAX = 1000;
/** The kinds of source: the same as in the assessment form. */
export const WATER_SOURCE_TYPES = Object.freeze(KIND_FIELDS.water_assessment.find((f) => f.key === 'source_type').options.map((o) => o.value));

/** Who may add, change, archive and delete water sources (the database lets only these roles). @param {unknown} role */
export const canManageWaterSources = canManageFields;

/** Counted the way the database counts: by characters, not by the UTF-16 units JavaScript's `length` counts. */
const lengthOf = (text) => [...text].length;

/**
 * Check what was typed for a water source and write it the way the database keeps it.
 *
 * @param {{ name?: unknown, source_type?: unknown, fields_served?: unknown, notes?: unknown } | undefined} input
 * @returns {{ ok: true, errors: {}, value: { name: string, source_type: string | null, fields_served: string | null, notes: string | null } }
 *   | { ok: false, errors: Record<string, string>, value: null }}
 */
export function validateWaterSourceInput(input) {
  const { name: rawName, source_type: rawType, fields_served: rawFields, notes: rawNotes } = input ?? {};
  const errors = {};

  const name = tidyFieldName(rawName);
  if (name === '') errors.name = 'required';
  else if (lengthOf(name) > FIELD_NAME_MAX) errors.name = 'too_long';

  let sourceType = null;
  if (rawType !== undefined && rawType !== null && rawType !== '') {
    if (WATER_SOURCE_TYPES.includes(rawType)) sourceType = rawType;
    else errors.source_type = 'invalid';
  }

  const fieldsServed = cleanText(rawFields).trim();
  if (lengthOf(fieldsServed) > TEXT_MAX) errors.fields_served = 'too_long';
  const notes = cleanText(rawNotes).trim();
  if (lengthOf(notes) > TEXT_MAX) errors.notes = 'too_long';

  if (Object.keys(errors).length > 0) return { ok: false, errors, value: null };
  return { ok: true, errors: {}, value: { name, source_type: sourceType, fields_served: fieldsServed === '' ? null : fieldsServed, notes: notes === '' ? null : notes } };
}
