import { RECORD_KINDS, KIND_FIELDS } from '../../../src/domain/records/kinds.js';

/**
 * Tool definitions for the extraction agent, generated from the domain's field definitions so
 * the form, the database and the agent describe a record identically. There is one tool per
 * record kind and no other tool: the agent can only PROPOSE records, never approve, edit or
 * delete anything. Its output is re-validated server-side regardless of what the model returns.
 */

const TOOL_PREFIX = 'record_';

/** @param {string} kind */
export const toolNameForKind = (kind) => `${TOOL_PREFIX}${kind}`;

/**
 * @param {unknown} name
 * @returns {string | null} the record kind, or null for any name that is not one of our tools
 */
export function kindForToolName(name) {
  if (typeof name !== 'string' || !name.startsWith(TOOL_PREFIX)) return null;
  const kind = name.slice(TOOL_PREFIX.length);
  return RECORD_KINDS.includes(kind) ? kind : null;
}

/** When to use each tool; also shown to the model in the system prompt. */
export const KIND_GUIDANCE = Object.freeze({
  sanitizer_label: 'A sanitizer or cleaning product\'s label: product name, EPA registration number, active ingredient, what it is approved for (food-contact surfaces, produce wash water, both), the label\'s allowed concentration range in ppm (minimum and maximum), contact time and required protective equipment. Record only what the label shows.',
  sanitizer_purchase: 'A sanitizer or cleaning product that was bought: supplier, product, the product\'s lot number, quantity, cost and invoice number. One call per product line.',
  sanitation_log: 'Cleaning or sanitizing of a surface, tool, bin, truck or area: what was cleaned, whether it was cleaned and sanitized, cleaned only or sanitized only, which sanitizer, the concentration that was measured in ppm (a test strip or meter reading), the field or area, and who did it. Leave check_result null: the app compares the reading with the sanitizer\'s label.',
  weather_event: 'A weather event that may have reached the crop: flood, heavy rain, hail, smoke or ash, extreme heat or high wind. Say which field it affected and whether water, ash or debris reached the crop.',
  wildlife_check: 'A check of a field for signs of animals (droppings, tracks, damaged crop, an animal getting in): which field, whether signs were found, what was found, and the no-harvest zone that was marked.',
  soil_amendment: 'Manure, compost, treated biosolids or another soil amendment APPLIED to a field: the type, product or source, the field, supplier, lot number, quantity and unit, and how it was applied.',
  water_test: 'A water test result: the water source, what the water is used for, the laboratory, the sample ID, the generic E. coli value (CFU or MPN per 100 mL) and whether it meets the standard. Record a pass or fail only when the report says so.',
  water_assessment: 'A pre-harvest agricultural water assessment for one water source: the source, what kind it is, the fields it waters, how it is applied, how worried the assessment is about each factor (low, some or high), and the conclusion. Never decide a concern level or the conclusion yourself: fill them only when the document states them.',
  training: 'Worker training that took place: the topic or SOP, who gave it, the names of the people trained, the language, and how long it lasted.',
  visitor: 'A visitor to the farm or packing area: their name, company, purpose, time in and out, the areas visited, and whether the hygiene rules were explained to them.',
  illness_injury: 'A worker\'s illness or injury (health information, kept private): who, whether it is an illness or an injury, the symptoms or injury, whether the person was kept away from produce and food-contact surfaces, the return-to-work date, and the produce or surfaces that may have been affected. Use this only when someone is clearly describing a real illness or injury.',
  harvest: 'A crop harvested: crop, field, quantity and unit, lot code, harvest crew, and destination or buyer.',
  packing_cooling: 'Packing or cooling of a lot: the lot code, the product, quantity, cooling method, the product temperature and its unit (F or C), and who packed it.',
  shipment: 'A shipment to a customer: the customer, the lot codes shipped, quantity, invoice number, and the carrier or truck.',
  corrective_action: 'A problem that was found and what was done about it: what happened, the fields or lots affected, the action taken, who verified it, and whether it clears a field hold (and for which field).',
  note: 'A free-text observation, reminder or inspection or audit note that fits no other kind.',
});

function fieldSchema(field) {
  const description = `${field.label.en} / ${field.label.es}`;
  if (field.type === 'number') return { type: ['number', 'null'], description };
  if (field.type === 'select') {
    const values = field.options.map((o) => o.value);
    return { anyOf: [{ type: 'string', enum: [...values] }, { type: 'null' }], description: `${description}. One of: ${values.join(', ')}.` };
  }
  return { type: ['string', 'null'], description };
}

function toolFor(kind, strict) {
  const fields = KIND_FIELDS[kind];
  const tool = {
    name: toolNameForKind(kind),
    description: `Record one ${kind} record. ${KIND_GUIDANCE[kind]} Use null for any field that is not stated or visible; never guess.`,
    input_schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        record_date: { type: ['string', 'null'], description: 'The date the event happened, as YYYY-MM-DD, or null if it is not stated or visible. Do not guess.' },
        confidence: { type: 'number', description: 'Your certainty, from 0 to 1, that the key fields were read correctly. Use below 0.6 for blurry or ambiguous input.' },
        payload: {
          type: 'object',
          additionalProperties: false,
          properties: Object.fromEntries(fields.map((f) => [f.key, fieldSchema(f)])),
          required: fields.map((f) => f.key),
        },
      },
      required: ['record_date', 'confidence', 'payload'],
    },
  };
  return strict ? { ...tool, strict: true } : tool;
}

/**
 * @param {{ strict?: boolean }} [options] `strict` (default true) asks the API to guarantee the
 *   arguments match the schema; the server validates them again either way.
 */
export function buildRecordTools({ strict = true } = {}) {
  return RECORD_KINDS.map((kind) => toolFor(kind, strict));
}
