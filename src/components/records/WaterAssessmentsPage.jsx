import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext.jsx';
import { optionLabel } from '../../domain/records/kinds.js';
import { todayLocalIso } from '../../domain/records/seasons.js';
import { prefillFromAssessment, waterCounts, waterSources } from '../../domain/records/waterAssessment.js';
import { canSeeKind } from '../../domain/records/workflow.js';
import { recordsText } from './text.js';
import useFarmRecords from './useFarmRecords.js';
import RecordForm from './RecordForm.jsx';
import * as ui from './ui.js';

const WATER_KINDS = ['weather_event', 'water_assessment'];
const th = { textAlign: 'left', padding: '10px 14px', fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid #e2e8f0' };
const td = { padding: '10px 14px', fontSize: 13, color: '#334155', borderBottom: '1px solid #f1f5f9', verticalAlign: 'middle' };
const small = { ...ui.buttonSecondary, padding: '3px 10px', fontSize: 12 };
const COLUMNS = ['source', 'fields', 'last', 'due', 'decision', 'status', 'action'];
const TONE = { flood: ui.TONES.danger, overdue: ui.TONES.danger, due_soon: ui.TONES.warning, current: ui.TONES.success };
const COUNT_ORDER = ['flood', 'overdue', 'due_soon', 'current'];

/**
 * The farm's water sources: each one with its newest approved assessment, when it is next due (a year on), and whether a
 * flood since then means it needs a new one. Assessing a source again starts from its last answers; the decision is made
 * again each time. Worked out from the approved records every time, so it cannot drift from them.
 */
export default function WaterAssessmentsPage({ farm, role, today, onChanged }) {
  const { lang: rawLang } = useLanguage();
  const lang = rawLang === 'es' ? 'es' : 'en';
  const tt = recordsText(lang).water;

  const { status, records, truncated, reload } = useFarmRecords({ farmId: farm.id, kinds: WATER_KINDS });
  const [showAll, setShowAll] = useState(false);
  const [adding, setAdding] = useState(null); // null, or { prefill } for the assessment form
  const todayDate = today ?? todayLocalIso();

  const sources = useMemo(() => waterSources(records, { today: todayDate }), [records, todayDate]);
  const counts = waterCounts(sources);
  const shown = showAll ? sources : sources.filter((source) => source.status !== 'current');
  const canRecord = canSeeKind('water_assessment', role);
  const lastAnswers = (source) => prefillFromAssessment(records.find((record) => record.id === source.recordId));
  const assessAgain = (source) => setAdding({ prefill: lastAnswers(source) });
  // Taking a source off the list is one more assessment of it, whose decision is that it is not used any more.
  const retire = (source) => setAdding({ prefill: { ...lastAnswers(source), conclusion: 'retired' } });

  return (
    <div style={ui.page}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', marginBottom: 18 }}>
        <div style={{ flex: '1 1 320px' }}>
          <h1 style={ui.h1}>{tt.title}</h1>
          <p style={{ ...ui.subtitle, margin: '0 0 6px' }}>{tt.subtitle}</p>
          <p style={{ ...ui.subtitle, margin: 0, fontSize: 12 }}>{tt.rule}</p>
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

      {status === 'ready' && sources.length === 0 && <div style={{ ...ui.card, padding: '36px 24px', textAlign: 'center', color: '#64748b' }}>{tt.empty}</div>}

      {status === 'ready' && sources.length > 0 && (
        <>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
            {COUNT_ORDER.map((key) => (
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

          {shown.length === 0 && truncated ? null : shown.length === 0 ? (
            <div style={{ ...ui.card, padding: '28px 24px', textAlign: 'center', color: '#166534', background: '#f0fdf4' }}>{tt.nothingDue}</div>
          ) : (
            <div style={{ ...ui.card, overflowX: 'auto' }}>
              <table className="stack-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>{COLUMNS.map((column) => <th key={column} style={th}>{tt.columns[column]}</th>)}</tr>
                </thead>
                <tbody>
                  {shown.map((source) => (
                    <tr key={source.key}>
                      <td className="stack-title" style={{ ...td, fontWeight: 600, color: '#0f172a' }}>{source.name}</td>
                      <td data-label={tt.columns.fields} style={td}>{source.fields.join(', ')}</td>
                      <td data-label={tt.columns.last} style={{ ...td, whiteSpace: 'nowrap' }}>{source.assessedOn}</td>
                      <td data-label={tt.columns.due} style={{ ...td, whiteSpace: 'nowrap' }}>{source.nextReview} <span style={{ color: '#94a3b8' }}>({tt.dueIn(source.daysLeft)})</span></td>
                      <td data-label={tt.columns.decision} style={td}>{source.conclusion ? optionLabel('water_assessment', 'conclusion', source.conclusion, lang) : ''}</td>
                      <td data-label={tt.columns.status} style={td}>
                        <span style={{ ...TONE[source.status], padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600 }}>{tt.status[source.status]}</span>
                        {source.floods.length > 0 && <div style={{ fontSize: 12, color: '#991b1b', marginTop: 4 }}>{tt.floodOn(source.floods)}</div>}
                      </td>
                      <td className="stack-actions" style={td}>
                        {canRecord && (
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            <button type="button" aria-label={tt.reassessFor(source.name)} onClick={() => assessAgain(source)} style={small}>{tt.reassess}</button>
                            <button type="button" aria-label={tt.retireFor(source.name)} onClick={() => retire(source)} style={small}>{tt.retire}</button>
                          </div>
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
          kind="water_assessment"
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
