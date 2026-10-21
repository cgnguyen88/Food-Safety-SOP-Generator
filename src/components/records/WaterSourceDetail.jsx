import { useLanguage } from '../../i18n/LanguageContext.jsx';
import { optionLabel } from '../../domain/records/kinds.js';
import { CONCERN_KEYS, sourceHistory } from '../../domain/records/waterAssessment.js';
import { recordsText } from './text.js';
import * as ui from './ui.js';
import Modal from './Modal.jsx';

/** The most assessments, and the most water tests, listed in one source's history. */
export const HISTORY_LIMIT = 20;
export const STATUS_TONE = { flood: ui.TONES.danger, overdue: ui.TONES.danger, not_assessed: ui.TONES.warning, due_soon: ui.TONES.warning, current: ui.TONES.success, archived: ui.TONES.muted };

const small = { ...ui.buttonSecondary, padding: '4px 12px', fontSize: 12 };
const smallDanger = { ...ui.buttonDanger, padding: '4px 12px', fontSize: 12 };
const heading = { fontSize: 13, color: '#475569', margin: '16px 0 6px' };
const listStyle = { listStyle: 'none', margin: 0, padding: 0 };
const itemStyle = { display: 'flex', gap: 12, justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #f1f5f9', fontSize: 13, color: '#334155' };

function Fact({ label, children }) {
  return (
    <div data-testid="water-fact" style={{ display: 'flex', gap: 12, padding: '7px 0', borderBottom: '1px solid #f1f5f9', fontSize: 13 }}>
      <div style={{ width: 150, flexShrink: 0, color: '#64748b' }}>{label}</div>
      <div data-testid="water-fact-value" style={{ flex: 1, color: '#0f172a', wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>{children}</div>
    </div>
  );
}

/**
 * One water source and its condition: what it is, when it was last assessed and is next due, the decision and the measures
 * planned, how each factor was rated, its latest water test, the floods since it was last assessed, and its assessments and
 * water tests. From here an assessment can be started and, for an owner or manager, the source can be changed, archived or
 * deleted. `row` is from `waterSources`, `records` the farm's approved records, `entry` the source on the farm's list (or null).
 */
export default function WaterSourceDetail({ row, records, entry, canManage, canRecord, uses = 0, truncated = false, busy = false, onAssess, onEdit, onToggleActive, onDelete, onClose }) {
  const { lang: rawLang } = useLanguage();
  const lang = rawLang === 'es' ? 'es' : 'en';
  const water = recordsText(lang).water;
  const tt = water.detail;
  const none = water.none;

  const history = sourceHistory(records, row.key);
  const latest = records.find((record) => record.id === row.recordId);
  const decision = (value) => (value ? optionLabel('water_assessment', 'conclusion', value, lang) : none);
  const testResult = (test) => [test.payload.result ? optionLabel('water_test', 'result', test.payload.result, lang) : '', test.payload.result_value ?? ''].filter((part) => part !== '').join(' · ');
  const cutShort = history.assessments.length > HISTORY_LIMIT || history.tests.length > HISTORY_LIMIT;
  const inUse = uses > 0;

  return (
    <Modal title={row.name} onClose={onClose}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ ...STATUS_TONE[row.status], padding: '2px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600 }}>{water.status[row.status]}</span>
        {!row.registered && <span style={{ ...ui.TONES.warning, padding: '2px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600 }}>{water.unlisted}</span>}
      </div>
      {row.archived && <p style={{ fontSize: 12, color: '#475569', background: '#f1f5f9', borderRadius: 8, padding: '8px 12px', margin: '6px 0 0' }}>{tt.archivedNote}</p>}

      <div style={{ marginTop: 8 }}>
        <Fact label={tt.kind}>{row.sourceType ? optionLabel('water_assessment', 'source_type', row.sourceType, lang) : none}</Fact>
        <Fact label={tt.fields}>{row.fields.length > 0 ? row.fields.join(', ') : none}</Fact>
        <Fact label={tt.notes}>{row.notes ?? none}</Fact>
        <Fact label={tt.assessed}>{row.assessedOn ? `${row.assessedOn} · ${water.next.toLowerCase()} ${row.nextReview}` : none}</Fact>
        <Fact label={tt.decision}>{decision(row.conclusion)}</Fact>
        {latest?.payload.conclusion === 'mitigation_needed' && latest.payload.mitigation && <Fact label={tt.measures}>{latest.payload.mitigation}</Fact>}
        <Fact label={tt.test}>{row.lastTest ? water.test(row.lastTest.date, row.lastTest.result ? optionLabel('water_test', 'result', row.lastTest.result, lang) : none) : none}</Fact>
      </div>

      {truncated && <p role="status" style={{ fontSize: 12, color: '#92400e', background: '#fef3c7', borderRadius: 8, padding: '8px 12px', margin: '12px 0 0' }}>{water.incomplete}</p>}

      {latest && (
        <section aria-label={tt.ratings}>
          <h3 style={heading}>{tt.ratings}</h3>
          <ul style={listStyle}>
            {CONCERN_KEYS.map((key) => (
              <li key={key} style={itemStyle}>
                <span>{tt.factors[key]}</span>
                <span style={{ fontWeight: 600 }}>{tt.rating[latest.payload[key]] ?? none}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {row.floods.length > 0 && (
        <section aria-label={tt.floods}>
          <h3 style={heading}>{tt.floods}</h3>
          <ul style={listStyle}>
            {row.floods.map((flood) => <li key={flood.id} style={itemStyle}><span>{water.form.floodItem(flood.date, flood.field)}</span></li>)}
          </ul>
          <p style={{ fontSize: 12, color: '#64748b', margin: '6px 0 0' }}>{water.floodClears}</p>
        </section>
      )}

      <section aria-label={tt.assessments}>
        <h3 style={heading}>{tt.assessments}</h3>
        {history.assessments.length === 0 ? <p style={{ color: '#94a3b8', fontSize: 12, margin: 0 }}>{tt.noAssessments}</p> : (
          <ul style={listStyle}>
            {history.assessments.slice(0, HISTORY_LIMIT).map((record) => <li key={record.id} style={itemStyle}><span>{record.record_date}</span><span>{decision(record.payload.conclusion)}</span></li>)}
          </ul>
        )}
      </section>

      <section aria-label={tt.tests}>
        <h3 style={heading}>{tt.tests}</h3>
        {history.tests.length === 0 ? <p style={{ color: '#94a3b8', fontSize: 12, margin: 0 }}>{tt.noTests}</p> : (
          <ul style={listStyle}>
            {history.tests.slice(0, HISTORY_LIMIT).map((record) => <li key={record.id} style={itemStyle}><span>{record.record_date}</span><span>{testResult(record)}</span></li>)}
          </ul>
        )}
      </section>
      {cutShort && <p style={{ fontSize: 12, color: '#64748b', margin: '8px 0 0' }}>{tt.showingLatest(HISTORY_LIMIT)}</p>}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end', marginTop: 18 }}>
        {canRecord && !row.archived && <button type="button" disabled={busy} onClick={() => onAssess(row)} style={{ ...ui.buttonPrimary, padding: '6px 14px', fontSize: 12, ...(busy ? ui.buttonDisabled : {}) }}>{row.status === 'not_assessed' ? water.assess : water.reassess}</button>}
        {canManage && entry && (
          <>
            <button type="button" disabled={busy} onClick={() => onEdit(entry)} style={{ ...small, ...(busy ? ui.buttonDisabled : {}) }}>{water.actions.edit}</button>
            <button type="button" disabled={busy} onClick={() => onToggleActive(entry)} style={{ ...small, ...(busy ? ui.buttonDisabled : {}) }}>{entry.is_active ? water.actions.archive : water.actions.restore}</button>
            <button
              type="button"
              disabled={busy}
              aria-disabled={inUse || undefined}
              title={inUse ? water.errors.in_use_delete : undefined}
              onClick={() => onDelete(entry)}
              style={{ ...smallDanger, ...(busy || inUse ? ui.buttonDisabled : {}) }}
            >
              {water.actions.delete}
            </button>
          </>
        )}
        <button type="button" onClick={onClose} style={small}>{tt.close}</button>
      </div>
    </Modal>
  );
}
