import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext.jsx';
import { todayLocalIso } from '../../domain/records/seasons.js';
import { prefillForSource, sourceHistory, unregisteredWaterSources, waterCounts, waterSources } from '../../domain/records/waterAssessment.js';
import { canManageWaterSources } from '../../domain/records/waterSources.js';
import { canSeeKind } from '../../domain/records/workflow.js';
import { addWaterSources, deleteWaterSource, setWaterSourceActive } from '../../lib/waterSources.js';
import { recordsText } from './text.js';
import { useFarmWaterSources } from './farmWaterSources.js';
import useFarmRecords from './useFarmRecords.js';
import * as ui from './ui.js';
import FoundNotice from './FoundNotice.jsx';
import RecordForm from './RecordForm.jsx';
import WaterSourceDetail, { STATUS_TONE } from './WaterSourceDetail.jsx';
import WaterSourceForm from './WaterSourceForm.jsx';
import WaterSourceRow from './WaterSourceRow.jsx';

const WATER_KINDS = ['weather_event', 'water_assessment', 'water_test'];
const th = { textAlign: 'left', padding: '10px 14px', fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid #e2e8f0' };
const small = { ...ui.buttonSecondary, padding: '3px 10px', fontSize: 12 };
const alertBox = { margin: '0 0 14px', padding: '9px 12px', borderRadius: 8, background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', fontSize: 13 };
const retryBox = { ...alertBox, display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' };
const COLUMNS = ['source', 'fields', 'assessed', 'decision', 'test', 'status', 'action'];
const COUNT_ORDER = ['flood', 'overdue', 'not_assessed', 'due_soon', 'current'];

/**
 * The farm's water sources and what state each is in: the list (add, change, archive, delete), and for each source its newest
 * approved assessment, when it is next due (a year on), whether a flood since then means it needs a new one, its decision and
 * its last water test. A source that was never assessed is listed as needing an assessment, and names that records use but the
 * list does not have are offered to be added. Worked out from the approved records every time, so it cannot drift from them.
 */
export default function WaterSourcesPage({ farm, role, today, onChanged }) {
  const { lang: rawLang } = useLanguage();
  const lang = rawLang === 'es' ? 'es' : 'en';
  const tt = recordsText(lang).water;

  const registry = useFarmWaterSources();
  const { status, records, truncated, reload: reloadRecords } = useFarmRecords({ farmId: farm.id, kinds: WATER_KINDS });
  const [filter, setFilter] = useState('attention');
  const [assessing, setAssessing] = useState(null); // null, or { prefill } for the assessment form
  const [sourceForm, setSourceForm] = useState(null); // null, or { source, nameLocked } (no source when adding)
  const [detailKey, setDetailKey] = useState(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState(null);
  const [notice, setNotice] = useState(null);
  // The names the "add them" button has just added: the notice stays hidden until the list has been read again.
  const [justAdded, setJustAdded] = useState('');
  const todayDate = today ?? todayLocalIso();

  const canManage = canManageWaterSources(role);
  const canRecord = canSeeKind('water_assessment', role);
  const listKnown = registry.status === 'ready';

  const rows = useMemo(() => waterSources(records, { today: todayDate, registry: registry.sources, includeArchived: true }), [records, registry.sources, todayDate]);
  const counts = waterCounts(rows);
  const shown = filter === 'archived' ? rows.filter((row) => row.archived) : filter === 'all' ? rows.filter((row) => !row.archived) : rows.filter((row) => !row.archived && row.status !== 'current');
  const found = useMemo(() => (canManage && listKnown && status === 'ready' ? unregisteredWaterSources(records, registry.sources) : []), [canManage, listKnown, status, records, registry.sources]);
  const foundKey = found.map((entry) => entry.name).join('\n');
  const detailRow = rows.find((row) => row.key === detailKey) ?? null;
  const usesOf = (row) => {
    const history = sourceHistory(records, row.key);
    return history.assessments.length + history.tests.length + history.floods.length;
  };

  const refresh = () => {
    registry.reload();
    reloadRecords();
    onChanged?.();
  };

  async function change(action, { deleting = false } = {}) {
    setBusy(true);
    setProblem(null);
    setNotice(null);
    const result = await action();
    setBusy(false);
    if (result.error) {
      setProblem(deleting && result.error.code === 'in_use' ? 'in_use_delete' : result.error.code);
      return false;
    }
    refresh();
    return true;
  }

  async function addFound() {
    setBusy(true);
    setProblem(null);
    setNotice(null);
    const result = await addWaterSources(farm.id, found);
    setBusy(false);
    if (result.error) {
      setProblem(result.error.code);
      if (result.error.added > 0) refresh();
      return;
    }
    setNotice(result.data);
    setJustAdded(foundKey);
    refresh();
  }

  const assess = (row) => {
    setDetailKey(null);
    setAssessing({ prefill: prefillForSource(row, records) });
  };
  const edit = (entry, row) => {
    setDetailKey(null);
    setSourceForm({ source: entry, nameLocked: usesOf(row) > 0 });
  };
  const remove = async (entry, row) => {
    // A source records use cannot be deleted: say so rather than ask. (The database enforces it too.)
    if (usesOf(row) > 0) {
      setNotice(null);
      setProblem('in_use_delete');
      return;
    }
    if (window.confirm(tt.confirmDelete(entry.name)) && (await change(() => deleteWaterSource(entry.id), { deleting: true }))) setDetailKey(null);
  };

  const loading = status === 'loading' || registry.status === 'loading';
  const ready = status === 'ready' && registry.status !== 'loading';

  return (
    <div style={ui.page}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', marginBottom: 18 }}>
        <div style={{ flex: '1 1 320px' }}>
          <h1 style={ui.h1}>{tt.title}</h1>
          <p style={{ ...ui.subtitle, margin: '0 0 6px' }}>{tt.subtitle}</p>
          <p style={{ ...ui.subtitle, margin: 0, fontSize: 12 }}>{tt.rule}</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {canRecord && <button type="button" onClick={() => setAssessing({})} style={ui.buttonSecondary}>{tt.newAssessment}</button>}
          {canManage && <button type="button" onClick={() => setSourceForm({})} style={ui.buttonPrimary}><Plus size={15} aria-hidden="true" />{tt.add}</button>}
        </div>
      </div>

      {!canManage && <p style={{ ...ui.subtitle, margin: '0 0 14px', fontSize: 13 }}>{tt.readOnly}</p>}

      {status === 'error' && (
        <div role="alert" style={retryBox}>
          <span>{tt.error}</span>
          <button type="button" onClick={reloadRecords} style={small}>{tt.retry}</button>
        </div>
      )}
      {registry.status === 'error' && (
        <div role="alert" style={retryBox}>
          <span>{registry.errorCode === 'not_set_up' ? tt.errors.not_set_up : tt.error}</span>
          <button type="button" onClick={registry.reload} style={small}>{tt.retry}</button>
        </div>
      )}
      {problem && <div role="alert" style={alertBox}>{tt.errors[problem] ?? tt.errors.unknown}</div>}
      {notice && (
        <p role="status" style={{ fontSize: 13, color: '#166534', background: '#dcfce7', borderRadius: 8, padding: '8px 12px', margin: '0 0 14px' }}>
          {[tt.found.added(notice.added), notice.remaining > 0 ? tt.found.more(notice.remaining) : null].filter(Boolean).join(' ')}
        </p>
      )}
      {status === 'ready' && truncated && <p role="status" style={{ fontSize: 12, color: '#92400e', background: '#fef3c7', borderRadius: 8, padding: '8px 12px', margin: '0 0 14px' }}>{tt.truncated}</p>}

      {found.length > 0 && foundKey !== justAdded && <FoundNotice found={found} adding={busy} onAdd={addFound} text={tt.found} />}

      {loading && <div style={{ ...ui.card, padding: 32, textAlign: 'center', color: '#94a3b8' }}>{tt.loading}</div>}
      {ready && rows.length === 0 && <div style={{ ...ui.card, padding: '36px 24px', textAlign: 'center', color: '#64748b' }}>{tt.empty}</div>}

      {ready && rows.length > 0 && (
        <>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
            {COUNT_ORDER.filter((key) => counts[key] > 0).map((key) => (
              <span key={key} style={{ ...STATUS_TONE[key], padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700 }}>{tt.counts[key](counts[key])}</span>
            ))}
            <label style={{ marginLeft: 'auto', fontSize: 12, color: '#64748b', display: 'flex', gap: 6, alignItems: 'center' }}>
              {tt.showing}
              <select value={filter} onChange={(event) => setFilter(event.target.value)} style={{ ...ui.input, width: 'auto', padding: '4px 8px' }}>
                <option value="attention">{tt.filter.attention}</option>
                <option value="all">{tt.filter.all}</option>
                <option value="archived">{tt.filter.archived}</option>
              </select>
            </label>
          </div>

          {shown.length === 0 && filter === 'archived' && <div style={{ ...ui.card, padding: '28px 24px', textAlign: 'center', color: '#64748b' }}>{tt.nothingArchived}</div>}
          {shown.length === 0 && filter !== 'archived' && !truncated && <div style={{ ...ui.card, padding: '28px 24px', textAlign: 'center', color: '#166534', background: '#f0fdf4' }}>{tt.nothingDue}</div>}
          {shown.length > 0 && (
            <div style={{ ...ui.card, overflowX: 'auto' }}>
              <table className="stack-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>{COLUMNS.map((column) => <th key={column} style={th}>{tt.columns[column]}</th>)}</tr>
                </thead>
                <tbody>
                  {shown.map((row) => <WaterSourceRow key={row.key} row={row} listKnown={listKnown} canRecord={canRecord} onAssess={assess} onDetails={(chosen) => setDetailKey(chosen.key)} />)}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {detailRow && (
        <WaterSourceDetail
          row={detailRow}
          records={records}
          entry={registry.sources.find((entry) => entry.id === detailRow.sourceId) ?? null}
          canManage={canManage}
          canRecord={canRecord}
          uses={usesOf(detailRow)}
          truncated={truncated}
          busy={busy}
          onAssess={assess}
          onEdit={(entry) => edit(entry, detailRow)}
          onToggleActive={(entry) => change(() => setWaterSourceActive(entry.id, !entry.is_active))}
          onDelete={(entry) => remove(entry, detailRow)}
          onClose={() => setDetailKey(null)}
        />
      )}

      {sourceForm && (
        <WaterSourceForm
          farmId={farm.id}
          source={sourceForm.source}
          nameLocked={sourceForm.nameLocked}
          onSaved={() => {
            setSourceForm(null);
            setProblem(null);
            refresh();
          }}
          onCancel={() => setSourceForm(null)}
        />
      )}

      {assessing && (
        <RecordForm
          kind="water_assessment"
          role={role}
          farmId={farm.id}
          prefill={assessing.prefill}
          onCancel={() => setAssessing(null)}
          onSaved={() => {
            setAssessing(null);
            refresh();
          }}
        />
      )}
    </div>
  );
}
