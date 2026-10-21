import { useState } from 'react';
import { useLanguage } from '../../i18n/LanguageContext.jsx';
import { KIND_FIELDS } from '../../domain/records/kinds.js';
import { validateWaterSourceInput } from '../../domain/records/waterSources.js';
import { createWaterSource, updateWaterSource } from '../../lib/waterSources.js';
import { recordsText } from './text.js';
import * as ui from './ui.js';
import Modal from './Modal.jsx';

const KINDS = KIND_FIELDS.water_assessment.find((f) => f.key === 'source_type').options;
/** The boxes of the form, in order, with the key their complaints go under. */
const BOXES = [{ key: 'name', id: 'water-name' }, { key: 'source_type', id: 'water-type' }, { key: 'fields_served', id: 'water-fields' }, { key: 'notes', id: 'water-notes' }];
const labelStyle = { fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 };
const helpStyle = { color: '#64748b', fontSize: 11, marginTop: 3 };
const errorStyle = { color: '#b91c1c', fontSize: 11, marginTop: 3 };

const startingValues = (source) => ({
  name: source?.name ?? '',
  source_type: source?.source_type ?? '',
  fields_served: source?.fields_served ?? '',
  notes: source?.notes ?? '',
});

/** One box of the form, with its label, its hint and its complaint. */
function Box({ id, label, error, errorText, help, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label htmlFor={id} style={labelStyle}>{label}</label>
      {children({ id, 'aria-invalid': error ? 'true' : undefined, 'aria-describedby': error ? `${id}-error` : help ? `${id}-help` : undefined, style: error ? ui.inputError : ui.input })}
      {error ? <div id={`${id}-error`} role="alert" style={errorStyle}>{errorText}</div> : help && <div id={`${id}-help`} style={helpStyle}>{help}</div>}
    </div>
  );
}

/**
 * Add a water source to the farm's list, or change one (its name unless records use it, its kind, the fields it waters and its
 * notes). Checks what was typed first, so each complaint sits next to its box; the database enforces the same rules.
 */
export default function WaterSourceForm({ farmId, source, nameLocked = false, onSaved, onCancel }) {
  const { lang: rawLang } = useLanguage();
  const lang = rawLang === 'es' ? 'es' : 'en';
  const tt = recordsText(lang).water;
  const form = tt.sourceForm;

  const [values, setValues] = useState(() => startingValues(source));
  const [errors, setErrors] = useState({});
  const [alertCode, setAlertCode] = useState(null);
  const [busy, setBusy] = useState(false);

  const change = (key) => (event) => {
    setValues((current) => ({ ...current, [key]: event.target.value }));
    setErrors((current) => Object.fromEntries(Object.entries(current).filter(([name]) => name !== key)));
  };
  const complaint = (key) => (errors[key] ? tt.errors[errors[key]] ?? tt.errors.invalid : null);

  // Show what is wrong next to its box and put the cursor in the first such box.
  function complain(complaints) {
    setErrors(complaints);
    const first = BOXES.find((box) => complaints[box.key]);
    if (first) document.getElementById(first.id)?.focus();
  }

  async function save() {
    const checked = validateWaterSourceInput(values);
    if (!checked.ok) {
      complain(checked.errors);
      return;
    }
    setBusy(true);
    setAlertCode(null);
    const result = source ? await updateWaterSource(source.id, values) : await createWaterSource({ farmId, ...values });
    setBusy(false);
    if (result.error?.fields) {
      complain(result.error.fields);
      return;
    }
    // A name that is taken, or that records use, is a complaint about the name box.
    if (result.error?.code === 'duplicate' || result.error?.code === 'in_use') {
      complain({ name: result.error.code });
      return;
    }
    if (result.error) {
      setAlertCode(result.error.code);
      return;
    }
    onSaved?.(result.data);
  }

  return (
    <Modal title={source ? form.editTitle : form.addTitle} onClose={onCancel} dismissible={!busy}>
      <form noValidate onSubmit={(event) => { event.preventDefault(); if (!busy) save(); }}>
        <Box id="water-name" label={form.name} error={errors.name} errorText={complaint('name')} help={nameLocked ? form.renameLocked : form.nameHelp}>
          {(props) => <input {...props} type="text" value={values.name} readOnly={nameLocked} onChange={change('name')} autoComplete="off" />}
        </Box>

        <Box id="water-type" label={form.type} error={errors.source_type} errorText={complaint('source_type')}>
          {(props) => (
            <select {...props} value={values.source_type} onChange={change('source_type')}>
              <option value="" />
              {KINDS.map((kind) => <option key={kind.value} value={kind.value}>{kind[lang]}</option>)}
            </select>
          )}
        </Box>

        <Box id="water-fields" label={form.fields} error={errors.fields_served} errorText={complaint('fields_served')}>
          {(props) => <textarea {...props} rows={2} value={values.fields_served} onChange={change('fields_served')} style={{ ...props.style, resize: 'vertical' }} />}
        </Box>

        <Box id="water-notes" label={form.notes} error={errors.notes} errorText={complaint('notes')}>
          {(props) => <textarea {...props} rows={3} value={values.notes} onChange={change('notes')} style={{ ...props.style, resize: 'vertical' }} />}
        </Box>

        {alertCode && (
          <div role="alert" style={{ marginBottom: 14, padding: '9px 12px', borderRadius: 8, background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', fontSize: 13 }}>
            {tt.errors[alertCode] ?? tt.errors.unknown}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button type="button" onClick={onCancel} disabled={busy} style={{ ...ui.buttonSecondary, ...(busy ? ui.buttonDisabled : {}) }}>{form.cancel}</button>
          <button type="submit" disabled={busy} style={{ ...ui.buttonPrimary, ...(busy ? ui.buttonDisabled : {}) }}>{busy ? form.saving : form.save}</button>
        </div>
      </form>
    </Modal>
  );
}
