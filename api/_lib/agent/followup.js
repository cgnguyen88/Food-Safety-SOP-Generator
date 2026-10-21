import { KIND_FIELDS } from '../../../src/domain/records/kinds.js';
import { evaluateRecord } from '../../../src/domain/records/schemas.js';
import { buildReplySystem } from './prompts.js';
import { buildRecordTools, toolNameForKind } from './tools.js';
import { isObject, withoutBlank } from './sanitize.js';
import { fieldListLine, waterSourceListLine } from './fieldNames.js';

/** Ask for at most this many details per message; the rest follow in the next round. */
export const MAX_QUESTIONS = 3;

const QUESTIONS = {
  en: {
    record_date: 'What date was this?',
    product: 'Which product?',
    supplier: 'Which supplier?',
    approved_use: 'What is it approved for (food-contact surfaces, produce wash water, both)?',
    item: 'What was cleaned?',
    method: 'How was it done (cleaned and sanitized, cleaned only, sanitized only)?',
    sanitizer: 'Which sanitizer was used?',
    ppm: 'What concentration (ppm) was measured?',
    field: 'Which field or block?',
    event_type: 'What kind of event was it (flood, heavy rain, hail, smoke or ash, heat, wind)?',
    crop_contact: 'Did water, ash or debris reach the crop (yes, no or not sure)?',
    evidence: 'Were there signs of animals (yes or no)?',
    evidence_description: 'What did you find?',
    no_harvest_zone: 'Where is the no-harvest zone marked?',
    amendment_type: 'What type of amendment was it (raw manure, compost, biosolids, other, synthetic)?',
    source: 'Which water source?',
    result: 'What was the result (meets the standard, does not meet it, or waiting for the lab)?',
    topic: 'What was the training about?',
    trainer: 'Who gave the training?',
    attendees: 'Who was trained?',
    visitor_name: 'What is the visitor’s name?',
    purpose: 'What was the purpose of the visit?',
    hygiene_briefing: 'Were the hygiene rules explained to the visitor (yes or no)?',
    person: 'Who was it?',
    type: 'Was it an illness or an injury?',
    description: 'What were the symptoms or what happened?',
    removed_from_contact: 'Was the person kept away from produce and food-contact surfaces (yes or no)?',
    crop: 'Which crop?',
    quantity: 'How much?',
    unit: 'In what unit?',
    lot_code: 'What is the lot code?',
    lot_codes: 'Which lot codes were shipped?',
    customer: 'Which customer?',
    problem: 'What happened?',
    action: 'What was done about it?',
    text: 'What should the note say?',
    source_type: 'What kind of water source is it (sealed well, open well, pond or river, canal, public water system, other)?',
    fields_served: 'Which fields does this water irrigate (separate them with commas)?',
    application_method: 'How is the water applied (drip, furrow or flood, overhead or sprinkler)?',
    source_concern: 'How worried are you about the source and how the water travels (low, some or high)?',
    nearby_concern: 'How worried are you about animals, manure, compost or human waste near the water (low, some or high)?',
    practice_concern: 'How worried are you about how the water is applied and the time before harvest (low, some or high)?',
    crop_concern: 'How worried are you about the crop (low, some or high)?',
    weather_concern: 'How worried are you about the weather, such as heavy rain or flooding (low, some or high)?',
    testing_concern: 'How worried are you about the water test results (low, some or high, or no test results)?',
    conclusion: 'What did you decide: are measures needed to protect the water, or not?',
    mitigation: 'What measures will you take, and by when?',
  },
  es: {
    record_date: '¿De qué fecha es?',
    product: '¿Qué producto?',
    supplier: '¿Qué proveedor?',
    approved_use: '¿Para qué está aprobado (superficies en contacto con alimentos, agua de lavado, ambos)?',
    item: '¿Qué se limpió?',
    method: '¿Cómo se hizo (limpiado y desinfectado, solo limpiado, solo desinfectado)?',
    sanitizer: '¿Qué desinfectante se usó?',
    ppm: '¿Qué concentración (ppm) se midió?',
    field: '¿Qué campo o bloque?',
    event_type: '¿Qué tipo de evento fue (inundación, lluvia intensa, granizo, humo o ceniza, calor, viento)?',
    crop_contact: '¿El agua, la ceniza o los escombros llegaron al cultivo (sí, no o no sé)?',
    evidence: '¿Había señales de animales (sí o no)?',
    evidence_description: '¿Qué encontraste?',
    no_harvest_zone: '¿Dónde está marcada la zona de no cosecha?',
    amendment_type: '¿Qué tipo de enmienda fue (estiércol crudo, composta, biosólidos, otro, sintético)?',
    source: '¿Qué fuente de agua?',
    result: '¿Cuál fue el resultado (cumple la norma, no la cumple, o esperando al laboratorio)?',
    topic: '¿De qué fue la capacitación?',
    trainer: '¿Quién dio la capacitación?',
    attendees: '¿Quiénes fueron capacitados?',
    visitor_name: '¿Cómo se llama el visitante?',
    purpose: '¿Cuál fue el motivo de la visita?',
    hygiene_briefing: '¿Se le explicaron al visitante las reglas de higiene (sí o no)?',
    person: '¿Quién fue?',
    type: '¿Fue una enfermedad o una lesión?',
    description: '¿Cuáles fueron los síntomas o qué pasó?',
    removed_from_contact: '¿Se mantuvo a la persona alejada de los productos y de las superficies en contacto con alimentos (sí o no)?',
    crop: '¿Qué cultivo?',
    quantity: '¿Cuánto?',
    unit: '¿En qué unidad?',
    lot_code: '¿Cuál es el código de lote?',
    lot_codes: '¿Qué códigos de lote se enviaron?',
    customer: '¿Qué cliente?',
    problem: '¿Qué pasó?',
    action: '¿Qué se hizo al respecto?',
    text: '¿Qué debe decir la nota?',
    source_type: '¿Qué tipo de fuente de agua es (pozo sellado, pozo abierto, estanque o río, canal, sistema público de agua, otro)?',
    fields_served: '¿Qué campos riega esta agua (sepáralos con comas)?',
    application_method: '¿Cómo se aplica el agua (goteo, surco o inundación, aspersión o por encima)?',
    source_concern: '¿Qué tanto te preocupa la fuente y cómo viaja el agua (poca, alguna o mucha)?',
    nearby_concern: '¿Qué tanto te preocupan los animales, el estiércol, la composta o los desechos humanos cerca del agua (poca, alguna o mucha)?',
    practice_concern: '¿Qué tanto te preocupa cómo se aplica el agua y el tiempo antes de la cosecha (poca, alguna o mucha)?',
    crop_concern: '¿Qué tanto te preocupa el cultivo (poca, alguna o mucha)?',
    weather_concern: '¿Qué tanto te preocupa el clima, como la lluvia intensa o las inundaciones (poca, alguna o mucha)?',
    testing_concern: '¿Qué tanto te preocupan los resultados de los análisis del agua (poca, alguna o mucha, o sin resultados)?',
    conclusion: '¿Qué decidiste: se necesitan medidas para proteger el agua, o no?',
    mitigation: '¿Qué medidas tomarás y para cuándo?',
  },
};

const labelOf = (kind, key, lang) => KIND_FIELDS[kind]?.find((f) => f.key === key)?.label[lang] ?? key;

/**
 * The follow-up question(s) for what a record is still missing, in the worker's language. These
 * are templates, so asking costs nothing and cannot be steered by anything in the input.
 *
 * @param {string} kind
 * @param {string[]} missing keys from the record's evaluation
 * @param {string} lang 'en' | 'es'
 * @returns {{ text: string, asked: string[] }}
 */
export function questionsFor(kind, missing, lang) {
  const L = lang === 'es' ? 'es' : 'en';
  const asked = missing.slice(0, MAX_QUESTIONS);
  if (asked.length === 0) return { text: '', asked: [] };

  const lines = asked.map((key) => QUESTIONS[L][key] ?? (L === 'es' ? `¿Cuál es ${labelOf(kind, key, L)}?` : `What is the ${labelOf(kind, key, L)}?`));
  const intro = asked.length === 1
    ? (L === 'es' ? 'Un dato más:' : 'One more detail:')
    : (L === 'es' ? 'Necesito estos datos para completar el registro:' : 'I need a few details to finish this record:');
  return { text: [intro, ...lines.map((line) => `• ${line}`)].join('\n'), asked };
}

/**
 * Merge a worker's reply into a draft record. The model fills only the fields the reply states;
 * everything it returns is re-validated, and a value that does not validate is ignored (and
 * reported) rather than stored.
 *
 * @param {{
 *   anthropic: { messages: { create: Function } },
 *   config: { agent: { model: string, maxTokens: number, effort: string, strictTools: boolean, requestTimeoutMs: number } },
 *   draft: { kind: string, record_date?: string | null, payload?: Record<string, unknown> },
 *   replyText: string,
 *   today: string,
 *   signal?: AbortSignal,
 *   allowedKeys?: string[],
 *   fieldNames?: string[],
 *   waterSourceNames?: string[],
 * }} args
 *   `allowedKeys` (payload keys, and/or 'record_date') limits what a reply may change; anything
 *   else the model returns is ignored and reported in `rejected`. Omit it to allow every field.
 */
export async function applyReply({ anthropic, config, draft, replyText, today, signal, allowedKeys, fieldNames, waterSourceNames }) {
  const reply = typeof replyText === 'string' ? replyText.trim() : '';
  if (reply === '') throw new Error('A reply is required.');

  const { kind } = draft;
  const tool = buildRecordTools({ strict: config.agent.strictTools }).find((t) => t.name === toolNameForKind(kind));
  const current = JSON.stringify({ kind, record_date: draft.record_date ?? null, payload: draft.payload ?? {} });
  const namesBlock = [fieldListLine(fieldNames), waterSourceListLine(waterSourceNames)].filter(Boolean).join('\n');

  const response = await anthropic.messages.create(
    {
      model: config.agent.model,
      max_tokens: config.agent.maxTokens,
      system: buildReplySystem({ today, kind }),
      tools: [tool],
      tool_choice: { type: 'auto' },
      output_config: { effort: config.agent.effort },
      messages: [{ role: 'user', content: `Current record (JSON):\n${current}\n\n${namesBlock ? `${namesBlock}\n\n` : ''}Worker's reply:\n${reply}` }],
    },
    { timeout: config.agent.requestTimeoutMs, ...(signal ? { signal } : {}) },
  );

  const blocks = response.content ?? [];
  const call = blocks.find((b) => b.type === 'tool_use' && b.name === tool.name);
  const message = blocks.filter((b) => b.type === 'text' && b.text).map((b) => b.text).join('\n').trim();

  const baseDate = draft.record_date ?? undefined;
  const basePayload = draft.payload ?? {};
  const patch = isObject(call?.input) ? call.input : {};
  const proposedPayload = isObject(patch.payload) ? withoutBlank(patch.payload) : {};
  const proposedDate = typeof patch.record_date === 'string' && patch.record_date.trim() ? patch.record_date.trim() : undefined;

  // A reply fills in what was asked; it must not be able to quietly rewrite other fields (the
  // record's own text, which came from a photo, is untrusted input to this very model call).
  const allowed = allowedKeys ? new Set(allowedKeys) : null;
  const outOfScope = [];
  const inScope = (key, proposed, current) => {
    if (!allowed || allowed.has(key)) return true;
    if (proposed !== current) outOfScope.push(key);
    return false;
  };
  const patchPayload = Object.fromEntries(Object.entries(proposedPayload).filter(([key, value]) => inScope(key, value, basePayload[key])));
  const patchDate = proposedDate !== undefined && inScope('record_date', proposedDate, baseDate) ? proposedDate : undefined;

  let date = patchDate ?? baseDate;
  let payload = { ...basePayload, ...patchPayload };
  let evaluation = evaluateRecord(kind, { record_date: date, payload });
  const rejected = [...outOfScope];

  if (!evaluation.ok) {
    for (const key of Object.keys(evaluation.errors)) {
      rejected.push(key);
      if (key === 'record_date') date = baseDate;
      else if (key in basePayload) payload[key] = basePayload[key];
      else delete payload[key];
    }
    evaluation = evaluateRecord(kind, { record_date: date, payload });
  }

  const finalPayload = evaluation.value?.payload ?? basePayload;
  const finalDate = evaluation.value?.record_date ?? null;
  const applied = [
    ...(finalDate !== (draft.record_date ?? null) ? ['record_date'] : []),
    ...Object.keys(patchPayload).filter((key) => !rejected.includes(key) && finalPayload[key] !== basePayload[key]),
  ];

  return {
    record: { kind, record_date: finalDate, payload: finalPayload },
    evaluation,
    applied,
    rejected,
    message,
    usage: { input_tokens: response.usage?.input_tokens ?? 0, output_tokens: response.usage?.output_tokens ?? 0 },
  };
}
