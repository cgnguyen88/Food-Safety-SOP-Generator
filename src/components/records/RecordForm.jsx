import { useMemo, useState } from 'react';
import { useLanguage } from '../../i18n/LanguageContext.jsx';
import { KIND_FIELDS, KIND_META, requiredFieldKeys } from '../../domain/records/kinds.js';
import { evaluateRecord } from '../../domain/records/schemas.js';
import { todayLocalIso } from '../../domain/records/seasons.js';
import { canReview } from '../../domain/records/workflow.js';
import { applySanitationCheck, checkSanitizerConcentration } from '../../domain/records/sanitation.js';
import { holdFor } from '../../domain/records/holds.js';
import { findField } from '../../domain/records/fields.js';
import { fieldNamesIn, recentFloods, sourcesServing, waterSources } from '../../domain/records/waterAssessment.js';
import { createRecord, updateRecord } from '../../lib/records.js';
import { recordsText } from './text.js';
import * as ui from './ui.js';
import { useFarmFields } from './farmFields.js';
import { useFarmWaterSources } from './farmWaterSources.js';
import FieldPicker from './FieldPicker.jsx';
import LotCodeTools from './LotCodeTools.jsx';
import Modal from './Modal.jsx';
import SanitizerHint from './SanitizerHint.jsx';
import { ConcernSummary, FloodWaterNote, PublicWaterNote, RecentFloodsNote, UnlistedFieldsNote, WATER_SECTION_STARTS, WaterSectionHeading } from './WaterHints.jsx';
import WaterSourcePicker from './WaterSourcePicker.jsx';
import useFarmRecords from './useFarmRecords.js';
import useFieldHolds from './useFieldHolds.js';

const SANITIZER_LABELS = ['sanitizer_label'];
/** What the water hints read: floods, and the farm's water assessments. */
const WATER_KINDS = ['weather_event', 'water_assessment'];
/** The box in which each kind of record names a water source. */
const WATER_SOURCE_KEYS = Object.freeze({ water_assessment: 'source', water_test: 'source', weather_event: 'water_source' });

const blank = (value) => value === undefined || value === null || String(value).trim() === '';

function Field({ field, lang, value, required, invalid, onChange, id, invalidText, disabled, heading }) {
  const label = `${field.label[lang]}${required ? ' *' : ''}`;
  const errorId = `${id}-error`;
  const common = {
    id,
    value,
    onChange: (event) => onChange(event.target.value),
    disabled: disabled || undefined,
    'aria-required': required ? 'true' : undefined,
    'aria-invalid': invalid ? 'true' : undefined,
    'aria-describedby': invalid ? errorId : undefined,
    style: invalid ? ui.inputError : ui.input,
  };
  return (
    <div style={{ marginBottom: 14 }}>
      {heading}
      <label htmlFor={id} style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>{label}</label>
      {field.type === 'select' ? (
        <select {...common}>
          <option value="" />
          {field.options.map((option) => <option key={option.value} value={option.value}>{option[lang]}</option>)}
        </select>
      ) : field.type === 'textarea' ? (
        <textarea {...common} rows={3} style={{ ...common.style, resize: 'vertical' }} />
      ) : (
        <input {...common} type="text" inputMode={field.type === 'number' ? 'decimal' : undefined} />
      )}
      {invalid && <div id={errorId} style={{ color: '#b91c1c', fontSize: 11, marginTop: 3 }}>{invalidText}</div>}
    </div>
  );
}

/**
 * Create or edit a record of one kind (a new one can start from some `prefill` values). Fields come from the domain definition, so the
 * form, validation and storage can never disagree. What is still missing is shown live,
 * and who can submit what depends on the role (crew submit; owners/managers approve).
 */
export default function RecordForm({ kind, role, farmId, record, advanceTo = null, prefill, today, onSaved, onCancel }) {
  const { lang: rawLang } = useLanguage();
  const lang = rawLang === 'es' ? 'es' : 'en';
  const tt = recordsText(lang);
  const fields = KIND_FIELDS[kind];
  const isEdit = Boolean(record);
  // An existing record starts from its own values; a new one can start from some given (a new count of an item already counted).
  const startingPayload = record ? record.payload : prefill;
  // The farm's own list of fields to pick from (a plain box until it has an active field).
  const farmFields = useFarmFields().fields;
  const pickFromFarmFields = farmFields.some((f) => f.is_active);
  // The farm's list of water sources, for the boxes that name one.
  const farmWaterSources = useFarmWaterSources().sources;
  const pickFromWaterSources = farmWaterSources.some((source) => source.is_active);
  const waterSourceKey = WATER_SOURCE_KEYS[kind];

  // Remember what the form started with, to tell whether the person has typed anything.
  const [initial] = useState(() => ({
    values: Object.fromEntries(fields.map((f) => [f.key, blank(startingPayload?.[f.key]) ? '' : String(startingPayload[f.key])])),
    // An existing record with no date stays without one; only a NEW record defaults to today.
    date: record ? record.record_date ?? '' : today ?? todayLocalIso(),
  }));
  const [values, setValues] = useState(initial.values);
  const [date, setDate] = useState(initial.date);
  const [submitting, setSubmitting] = useState(null);
  const [error, setError] = useState(null);

  // A cleaning log's pass or fail comes from the sanitizer's label, not from what is typed.
  const sanitizing = kind === 'sanitation_log';
  const labels = useFarmRecords({ farmId: sanitizing ? farmId : undefined, kinds: SANITIZER_LABELS });
  const labelsReady = sanitizing && labels.status === 'ready';
  const payload = useMemo(() => (labelsReady ? applySanitationCheck(values, labels.records, date) : values), [labelsReady, values, labels.records, date]);
  const concentration = useMemo(
    () => (labelsReady && ['clean_sanitize', 'sanitize_only'].includes(values.method) ? checkSanitizerConcentration({ ppm: values.ppm, sanitizer: values.sanitizer, date }, labels.records) : null),
    [labelsReady, values.method, values.ppm, values.sanitizer, labels.records, date],
  );

  // A harvest from a field that is on hold needs a corrective action first.
  const holds = useFieldHolds({ farmId: kind === 'harvest' ? farmId : undefined });
  const hold = kind === 'harvest' ? holdFor(holds.holds, values.field) : null;
  // A hold that began after the day of the harvest does not apply to it.
  const heldField = hold && !(hold.since && date && date < hold.since) ? hold : null;
  // Produce from a field on hold must not leave the farm with a lot code on it. That is checked when a harvest is approved or
  // sent for review (a new one, or an edit that also moves it on). Saving changes to one already on file is not blocked (taking
  // its lot code off would break the trail), and while the holds cannot be read, a lot code cannot be vouched for.
  const movesForward = !isEdit || advanceTo !== null;
  const lotCodeOnHeldField = movesForward && Boolean(heldField) && !blank(values.lot_code);
  const holdsUnreadable = kind === 'harvest' && movesForward && holds.status !== 'ready' && !blank(values.lot_code);
  const submitBlocked = lotCodeOnHeldField || holdsUnreadable;

  // Water: an assessment looks at floods of the last year; a flood record points at the water sources for its field.
  const assessing = kind === 'water_assessment';
  const recordingFlood = kind === 'weather_event' && values.event_type === 'flood';
  const water = useFarmRecords({ farmId: assessing || recordingFlood ? farmId : undefined, kinds: WATER_KINDS });
  const waterToday = today ?? todayLocalIso();
  const recentFloodList = useMemo(
    () => (assessing ? recentFloods(water.records, { fields: values.fields_served, source: values.source, today: waterToday }) : []),
    [assessing, water.records, values.fields_served, values.source, waterToday],
  );
  // Names typed in the box of fields that are not in the farm's list (only when the farm has a list to check against).
  const unlistedFields = useMemo(
    () => (assessing && pickFromFarmFields ? fieldNamesIn(values.fields_served).filter((name) => !findField(name, farmFields)) : []),
    [assessing, pickFromFarmFields, values.fields_served, farmFields],
  );
  const sourcesForFlood = useMemo(
    () => (recordingFlood ? sourcesServing(waterSources(water.records, { today: waterToday, registry: farmWaterSources }), { field: values.field, waterSource: values.water_source }) : []),
    [recordingFlood, water.records, farmWaterSources, values.field, values.water_source, waterToday],
  );

  // Choosing a source in an assessment fills in its kind and the fields it waters from the list, where those are still blank.
  const chooseWaterSource = (key, value) => setValues((current) => {
    const next = { ...current, [key]: value };
    const listed = assessing ? findField(value, farmWaterSources) : null;
    if (listed?.source_type && blank(current.source_type)) next.source_type = listed.source_type;
    if (listed?.fields_served && blank(current.fields_served)) next.fields_served = listed.fields_served;
    return next;
  });

  const evaluation = useMemo(() => evaluateRecord(kind, { record_date: date, payload }), [kind, date, payload]);
  const filled = useMemo(() => Object.fromEntries(Object.entries(values).filter(([, v]) => !blank(v))), [values]);
  const required = useMemo(() => new Set(requiredFieldKeys(kind, filled)), [kind, filled]);

  const labelOf = (key) => (key === 'record_date' ? tt.form.date : fields.find((f) => f.key === key)?.label[lang] ?? key);
  const hasErrors = !evaluation.ok;
  const busy = submitting !== null;

  async function save(status) {
    setSubmitting(status);
    setError(null);
    const result = isEdit
      ? await updateRecord(record.id, { kind, recordDate: date, payload })
      : await createRecord({ farmId, kind, recordDate: date, payload, status });
    setSubmitting(null);
    if (result.error) {
      setError(result.error);
      return;
    }
    // An edit that also moves the record on: the one that opened the form takes it from here, as it does for any status change.
    if (isEdit && status !== record.status) onSaved?.(result.data, status);
    else onSaved?.(result.data);
  }

  const dirty = date !== initial.date || fields.some((f) => values[f.key] !== initial.values[f.key]);

  function requestClose() {
    if (busy) return;
    if (dirty && !window.confirm(tt.form.discard)) return;
    onCancel?.();
  }

  const reviewer = canReview(role);
  const kindLabel = KIND_META[kind].label[lang];
  const title = isEdit ? tt.form.editTitle(kindLabel) : tt.form.addTitle(kindLabel);

  return (
    <Modal title={title} onClose={requestClose} dismissible={!busy}>
      <div style={{ marginBottom: 14 }}>
        <label htmlFor="rec-date" style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>{tt.form.date}</label>
        <input
          id="rec-date"
          type="date"
          value={date}
          onChange={(event) => setDate(event.target.value)}
          aria-invalid={evaluation.errors.record_date ? 'true' : undefined}
          aria-describedby={evaluation.errors.record_date ? 'rec-date-error' : undefined}
          style={evaluation.errors.record_date ? ui.inputError : ui.input}
        />
        {evaluation.errors.record_date && <div id="rec-date-error" style={{ color: '#b91c1c', fontSize: 11, marginTop: 3 }}>{tt.field.invalid}</div>}
      </div>

      {fields.map((field) => field.key === waterSourceKey && pickFromWaterSources ? (
        <WaterSourcePicker
          key={field.key}
          id={`rec-${field.key}`}
          label={`${field.label[lang]}${required.has(field.key) ? ' *' : ''}`}
          sources={farmWaterSources}
          value={values[field.key]}
          required={required.has(field.key)}
          invalid={Boolean(evaluation.errors[field.key])}
          invalidText={tt.field.invalid}
          onChange={(value) => chooseWaterSource(field.key, value)}
        />
      ) : field.key === 'field' && pickFromFarmFields ? (
        <FieldPicker
          key={field.key}
          id={`rec-${field.key}`}
          label={`${field.label[lang]}${required.has(field.key) ? ' *' : ''}`}
          fields={farmFields}
          value={values[field.key]}
          required={required.has(field.key)}
          invalid={Boolean(evaluation.errors[field.key])}
          invalidText={tt.field.invalid}
          onChange={(value) => setValues((current) => ({ ...current, [field.key]: value }))}
        />
      ) : (
        <Field
          key={field.key}
          id={`rec-${field.key}`}
          field={field}
          lang={lang}
          value={field.key === 'check_result' && concentration?.result ? concentration.result : values[field.key]}
          disabled={field.key === 'check_result' && (Boolean(concentration?.result) || (sanitizing && labels.status === 'loading'))}
          heading={assessing && WATER_SECTION_STARTS[field.key] ? <WaterSectionHeading section={WATER_SECTION_STARTS[field.key]} /> : undefined}
          required={required.has(field.key)}
          invalid={Boolean(evaluation.errors[field.key])}
          invalidText={tt.field.invalid}
          onChange={(value) => setValues((current) => ({ ...current, [field.key]: value }))}
        />
      )).flatMap((node, index) => {
        const key = fields[index].key;
        if (key === 'ppm' && sanitizing) return [node, <SanitizerHint key="ppm-hint" check={concentration} loading={labels.status === 'loading' && !blank(values.ppm)} error={labels.status === 'error'} />];
        if (key === 'field' && heldField) return [node, <p key="hold-warning" role="alert" style={{ fontSize: 12, margin: '-8px 0 14px', padding: '6px 10px', borderRadius: 8, background: '#fee2e2', color: '#991b1b' }}>{lotCodeOnHeldField ? tt.lots.heldWithCode(heldField.name) : tt.holds.harvestWarning(heldField.name)}</p>];
        if (key === 'lot_code' && kind === 'harvest') {
          return [node, ...(holdsUnreadable ? [<p key="holds-unreadable" role="alert" style={{ fontSize: 12, margin: '-8px 0 14px', padding: '6px 10px', borderRadius: 8, background: '#fef3c7', color: '#92400e' }}>{holds.status === 'error' ? tt.holds.unknown : tt.lots.checkingHolds}</p>] : []), <LotCodeTools key="lot-tools" farmId={farmId} recordId={record?.id} values={values} date={date} holds={holds} heldField={heldField} onMade={(code) => setValues((current) => ({ ...current, lot_code: code }))} />];
        }
        if (assessing && key === 'source_type' && values.source_type === 'public') return [node, <PublicWaterNote key="public-water" />];
        if (assessing && key === 'fields_served') return [node, <UnlistedFieldsNote key="unlisted-fields" names={unlistedFields} />];
        if (assessing && key === 'weather_concern') return [node, <RecentFloodsNote key="recent-floods" status={water.status} floods={recentFloodList} truncated={water.truncated} />];
        if (assessing && key === 'testing_concern') return [node, <ConcernSummary key="concerns" values={values} onUse={(conclusion) => setValues((current) => ({ ...current, conclusion }))} />];
        if (recordingFlood && key === 'water_source') return [node, <FloodWaterNote key="flood-water" status={water.status} sources={sourcesForFlood} searched={!blank(values.field) || !blank(values.water_source)} truncated={water.truncated} />];
        return [node];
      })}

      {!evaluation.complete && !hasErrors && evaluation.missing.length > 0 && (
        <p style={{ fontSize: 12, color: '#92400e', background: '#fef3c7', borderRadius: 8, padding: '8px 12px', margin: '4px 0 14px' }}>
          {tt.form.missing} {evaluation.missing.map(labelOf).join(', ')}
        </p>
      )}

      {error && (
        <div role="alert" style={{ marginBottom: 14, padding: '9px 12px', borderRadius: 8, background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', fontSize: 13 }}>
          {tt.errors[error.code] ?? tt.errors.unknown}
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        <button type="button" onClick={requestClose} style={ui.buttonSecondary}>{tt.form.cancel}</button>
        {isEdit ? (
          <>
            <button type="button" disabled={hasErrors || busy} onClick={() => save(record.status)} style={{ ...(advanceTo ? ui.buttonSecondary : ui.buttonPrimary), ...(hasErrors || busy ? ui.buttonDisabled : {}) }}>
              {submitting === record.status ? tt.form.saving : tt.form.saveChanges}
            </button>
            {advanceTo && (
              <button
                type="button"
                disabled={!evaluation.complete || busy || submitBlocked}
                onClick={() => save(advanceTo)}
                style={{ ...(advanceTo === 'approved' ? ui.buttonSuccess : ui.buttonPrimary), ...(!evaluation.complete || busy || submitBlocked ? ui.buttonDisabled : {}) }}
              >
                {submitting === advanceTo ? tt.form.saving : advanceTo === 'approved' ? tt.form.approve : tt.form.submit}
              </button>
            )}
          </>
        ) : (
          <>
            <button type="button" disabled={hasErrors || busy} onClick={() => save('draft')} style={{ ...ui.buttonSecondary, ...(hasErrors || busy ? ui.buttonDisabled : {}) }}>
              {submitting === 'draft' ? tt.form.saving : tt.form.saveDraft}
            </button>
            <button
              type="button"
              disabled={!evaluation.complete || busy || submitBlocked}
              onClick={() => save(reviewer ? 'approved' : 'pending_review')}
              style={{ ...(reviewer ? ui.buttonSuccess : ui.buttonPrimary), ...(!evaluation.complete || busy || submitBlocked ? ui.buttonDisabled : {}) }}
            >
              {submitting === 'approved' || submitting === 'pending_review' ? tt.form.saving : reviewer ? tt.form.approve : tt.form.submit}
            </button>
          </>
        )}
      </div>
    </Modal>
  );
}
