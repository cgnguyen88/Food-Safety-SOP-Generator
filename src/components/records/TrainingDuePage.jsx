import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext.jsx';
import { trainingCounts, trainingDueList } from '../../domain/records/training.js';
import { todayLocalIso } from '../../domain/records/seasons.js';
import { canSeeKind } from '../../domain/records/workflow.js';
import { recordsText } from './text.js';
import useFarmRecords from './useFarmRecords.js';
import RecordForm from './RecordForm.jsx';
import * as ui from './ui.js';

const TRAINING_KINDS = ['training'];
const th = { textAlign: 'left', padding: '10px 14px', fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid #e2e8f0' };
const td = { padding: '10px 14px', fontSize: 13, color: '#334155', borderBottom: '1px solid #f1f5f9', verticalAlign: 'middle' };
const small = { ...ui.buttonSecondary, padding: '3px 10px', fontSize: 12 };
const COLUMNS = ['person', 'topic', 'last', 'due', 'status', 'action'];
const TONE = { overdue: ui.TONES.danger, due_soon: ui.TONES.warning, current: ui.TONES.success };

/**
 * Who needs training again: each person and topic from the approved training records, with the date they are due.
 * Recording the training again starts a new training record for that person and topic.
 */
export default function TrainingDuePage({ farm, role, today, onChanged }) {
  const { lang: rawLang } = useLanguage();
  const lang = rawLang === 'es' ? 'es' : 'en';
  const tt = recordsText(lang).training;

  const { status, records, truncated, reload } = useFarmRecords({ farmId: farm.id, kinds: TRAINING_KINDS });
  const [showAll, setShowAll] = useState(false);
  const [adding, setAdding] = useState(null); // null, or { prefill } for the training form
  const todayDate = today ?? todayLocalIso();

  const rows = useMemo(() => trainingDueList(records, { today: todayDate }), [records, todayDate]);
  const counts = trainingCounts(rows);
  const shown = showAll ? rows : rows.filter((row) => row.status !== 'current');
  const canRecord = canSeeKind('training', role);

  return (
    <div style={ui.page}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', marginBottom: 18 }}>
        <div style={{ flex: '1 1 320px' }}>
          <h1 style={ui.h1}>{tt.title}</h1>
          <p style={{ ...ui.subtitle, margin: 0 }}>{tt.subtitle}</p>
        </div>
        {canRecord && (
          <button type="button" onClick={() => setAdding({})} style={ui.buttonPrimary}>
            <Plus size={15} aria-hidden="true" />{tt.add}
          </button>
        )}
      </div>

      {status === 'loading' && <div style={{ ...ui.card, padding: 32, textAlign: 'center', color: '#94a3b8' }}>{tt.loading}</div>}
      {status === 'error' && (
        <div role="alert" style={{ margin: '0 0 14px', padding: '9px 12px', borderRadius: 8, background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', fontSize: 13, display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <span>{tt.error}</span>
          <button type="button" onClick={reload} style={small}>{tt.retry}</button>
        </div>
      )}
      {status === 'ready' && truncated && <p role="status" style={{ fontSize: 12, color: '#92400e', background: '#fef3c7', borderRadius: 8, padding: '8px 12px', margin: '0 0 14px' }}>{tt.truncated}</p>}

      {status === 'ready' && rows.length === 0 && <div style={{ ...ui.card, padding: '36px 24px', textAlign: 'center', color: '#64748b' }}>{tt.empty}</div>}

      {status === 'ready' && rows.length > 0 && (
        <>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
            {['overdue', 'due_soon', 'current'].map((key) => (
              <span key={key} style={{ ...TONE[key], padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700 }}>{tt.counts[key](counts[key])}</span>
            ))}
            <label style={{ marginLeft: 'auto', fontSize: 12, color: '#64748b', display: 'flex', gap: 6, alignItems: 'center' }}>
              {tt.showing}
              <select value={showAll ? 'all' : 'attention'} onChange={(event) => setShowAll(event.target.value === 'all')} style={{ ...ui.input, width: 'auto', padding: '4px 8px' }}>
                <option value="attention">{tt.filter.attention}</option>
                <option value="all">{tt.filter.all}</option>
              </select>
            </label>
          </div>

          {shown.length === 0 ? (
            <div style={{ ...ui.card, padding: '28px 24px', textAlign: 'center', color: '#166534', background: '#f0fdf4' }}>{tt.nothingDue}</div>
          ) : (
            <div style={{ ...ui.card, overflowX: 'auto' }}>
              <table className="stack-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>{COLUMNS.map((column) => <th key={column} style={th}>{tt.columns[column]}</th>)}</tr>
                </thead>
                <tbody>
                  {shown.map((row) => (
                    <tr key={`${row.person}|${row.topic}`}>
                      <td className="stack-title" style={{ ...td, fontWeight: 600, color: '#0f172a' }}>{row.person}</td>
                      <td data-label={tt.columns.topic} style={td}>{row.topic}</td>
                      <td data-label={tt.columns.last} style={{ ...td, whiteSpace: 'nowrap' }}>{row.lastTrained}</td>
                      <td data-label={tt.columns.due} style={{ ...td, whiteSpace: 'nowrap' }}>{row.dueDate} <span style={{ color: '#94a3b8' }}>({tt.dueIn(row.daysLeft)})</span></td>
                      <td data-label={tt.columns.status} style={td}>
                        <span style={{ ...TONE[row.status], padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600 }}>{tt.status[row.status]}</span>
                      </td>
                      <td className="stack-actions" style={td}>
                        {canRecord && (
                          <button type="button" aria-label={tt.renewFor(row.person, row.topic)} onClick={() => setAdding({ prefill: { topic: row.topic, attendees: row.person } })} style={small}>{tt.renew}</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {adding && (
        <RecordForm
          kind="training"
          role={role}
          farmId={farm.id}
          prefill={adding.prefill}
          onCancel={() => setAdding(null)}
          onSaved={() => {
            setAdding(null);
            reload();
            onChanged?.();
          }}
        />
      )}
    </div>
  );
}
