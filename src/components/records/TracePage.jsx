import { useEffect, useMemo, useState } from 'react';
import { useLanguage } from '../../i18n/LanguageContext.jsx';
import { knownLots, traceLot } from '../../domain/records/trace.js';
import { summarizeRecord } from '../../domain/records/schemas.js';
import { todayLocalIso } from '../../domain/records/seasons.js';
import { canReview } from '../../domain/records/workflow.js';
import { createRecord } from '../../lib/records.js';
import { formatNumber } from './format.js';
import { recordsText } from './text.js';
import useFarmRecords from './useFarmRecords.js';
import * as ui from './ui.js';

const TRACE_KINDS = ['harvest', 'packing_cooling', 'shipment', 'soil_amendment', 'water_test', 'sanitation_log', 'weather_event', 'wildlife_check', 'corrective_action'];
const RECENT_LOTS = 8;
const TICK_MS = 1000;
const small = { ...ui.buttonSecondary, padding: '3px 10px', fontSize: 12 };
const heading = { fontSize: 14, color: '#475569', margin: '22px 0 10px' };

/** A record is worth a second look when it records a problem. */
const isFlagged = (record) => record.payload.check_result === 'fail' || record.payload.result === 'fail' || record.payload.evidence === 'yes' || record.payload.crop_contact === 'yes';

function Row({ record, lang, flaggedText }) {
  const flagged = isFlagged(record);
  return (
    <li style={{ display: 'flex', gap: 10, fontSize: 13, color: '#334155', padding: '4px 0' }}>
      <span style={{ color: '#94a3b8', whiteSpace: 'nowrap' }}>{record.record_date ?? ''}</span>
      <span style={{ flex: 1 }}>{summarizeRecord(record, lang)}</span>
      {flagged && <span style={{ ...ui.TONES.danger, padding: '1px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700, alignSelf: 'flex-start' }}>{flaggedText}</span>}
    </li>
  );
}

function History({ title, records, lang, none, flaggedText }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', marginBottom: 4 }}>{title}</div>
      {records.length === 0 ? <div style={{ fontSize: 13, color: '#94a3b8' }}>{none}</div> : <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>{records.map((record) => <Row key={record.id} record={record} lang={lang} flaggedText={flaggedText} />)}</ul>}
    </div>
  );
}

const quantities = (list, lang) => list.map(({ quantity, unit }) => `${formatNumber(quantity, lang)}${unit ? ` ${unit}` : ''}`).join(', ');

function Result({ trace, lang, tt }) {
  if (!trace.found) return <div style={{ ...ui.card, padding: 24, color: '#64748b' }}>{tt.notFound(trace.code)}</div>;
  const field = (label, value) => value && <div style={{ fontSize: 13, marginBottom: 4 }}><span style={{ color: '#64748b' }}>{label}: </span><strong style={{ color: '#0f172a' }}>{value}</strong></div>;
  return (
    <div style={{ ...ui.card, padding: 22 }}>
      <h2 style={{ fontSize: 16, color: '#0f172a', margin: '0 0 12px' }}>{tt.sections.lot}: {trace.code}</h2>
      {field(tt.labels.crop, trace.crops.join(', '))}
      {field(tt.labels.field, trace.fields.join(', '))}
      {field(tt.labels.crew, trace.crew.join(', '))}
      {field(tt.labels.harvested, quantities(trace.harvested, lang))}

      <h3 style={heading}>{tt.sections.forward}</h3>
      {field(tt.labels.packed, trace.packing.map((record) => record.record_date).filter(Boolean).join(', '))}
      {field(tt.labels.shipped, quantities(trace.shipped, lang))}
      {trace.sharedShipments > 0 && <p style={{ fontSize: 12, color: '#92400e', margin: '4px 0 8px' }}>{tt.shared(trace.sharedShipments)}</p>}
      <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', margin: '8px 0 4px' }}>{tt.labels.customers}</div>
      {trace.customers.length === 0 ? <div style={{ fontSize: 13, color: '#94a3b8' }}>{tt.none}</div> : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {trace.customers.map((customer) => (
            <li key={customer.name} style={{ fontSize: 13, padding: '4px 0', color: '#334155' }}>
              <strong>{customer.name}</strong>
              <span style={{ color: '#94a3b8' }}> · {customer.shipments.map((s) => [s.record_date, s.payload.quantity !== undefined ? `${s.payload.quantity}${s.payload.unit ? ` ${s.payload.unit}` : ''}` : '', s.payload.invoice_number && `#${s.payload.invoice_number}`].filter(Boolean).join(' ')).join(' · ')}</span>
            </li>
          ))}
        </ul>
      )}

      <h3 style={heading}>{tt.sections.back}</h3>
      {Object.keys(tt.history).map((key) => <History key={key} title={tt.history[key]} records={trace.back[key]} lang={lang} none={tt.none} flaggedText={tt.flagged} />)}

      {trace.gaps.length > 0 && (
        <>
          <h3 style={heading}>{tt.sections.gaps}</h3>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: '#92400e' }}>{trace.gaps.map((gap) => <li key={gap}>{tt.gaps[gap]}</li>)}</ul>
        </>
      )}
    </div>
  );
}

/** The drill: a stopwatch for the mock recall, and a note in the records saying how long it took. */
function Drill({ tt, drill, now, trace, role, farmId, onFinish, onCancel }) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [problem, setProblem] = useState(false);
  const seconds = Math.max(0, Math.round(((drill.finishedAt ?? now) - drill.startedAt) / 1000));
  const time = tt.drill.time(Math.floor(seconds / 60), seconds % 60);

  async function save() {
    setSaving(true);
    setProblem(false);
    const text = tt.drill.note(trace.code, time, trace.fields.length, trace.customers.length, trace.gaps.length);
    const result = await createRecord({ farmId, kind: 'note', recordDate: todayLocalIso(new Date(drill.startedAt)), payload: { text, category: 'inspection' }, status: canReview(role) ? 'approved' : 'pending_review' });
    setSaving(false);
    if (result.error) setProblem(true);
    else setSaved(true);
  }

  return (
    <div style={{ ...ui.card, padding: '14px 18px', marginBottom: 18, borderColor: '#fde68a', background: '#fffbeb' }}>
      {drill.finishedAt === null ? (
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <strong style={{ color: '#92400e' }}>{tt.drill.running}: <span aria-live="off" style={{ fontVariantNumeric: 'tabular-nums' }}>{time}</span></strong>
          <span style={{ flex: 1, fontSize: 12, color: '#92400e' }}>{trace ? '' : tt.drill.needsLot}</span>
          <button type="button" disabled={!trace} onClick={onFinish} style={{ ...ui.buttonPrimary, ...(trace ? {} : ui.buttonDisabled) }}>{tt.drill.finish}</button>
          <button type="button" onClick={onCancel} style={ui.buttonSecondary}>{tt.drill.cancel}</button>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <strong style={{ color: '#166534' }}>{tt.drill.finished(time)}</strong>
          {!saved && <button type="button" disabled={saving} onClick={save} style={{ ...ui.buttonPrimary, ...(saving ? ui.buttonDisabled : {}) }}>{saving ? tt.drill.saving : tt.drill.save}</button>}
          {saved && <span role="status" style={{ color: '#166534', fontSize: 13 }}>{tt.drill.saved}</span>}
          {problem && <span role="alert" style={{ color: '#b91c1c', fontSize: 13 }}>{tt.drill.saveError}</span>}
          <button type="button" onClick={onCancel} style={ui.buttonSecondary}>{tt.drill.done}</button>
        </div>
      )}
    </div>
  );
}

/**
 * Trace a lot: where it came from and where it went, from the approved records, with a stopwatch for practising a
 * mock recall. A drill that is finished can be saved as a note in the records.
 */
export default function TracePage({ farm, role, now: clock = Date.now }) {
  const { lang: rawLang } = useLanguage();
  const lang = rawLang === 'es' ? 'es' : 'en';
  const tt = recordsText(lang).trace;

  const { status, records, truncated, reload } = useFarmRecords({ farmId: farm.id, kinds: TRACE_KINDS });
  const [typed, setTyped] = useState('');
  const [code, setCode] = useState('');
  const [drill, setDrill] = useState(null); // null, or { startedAt, finishedAt }
  const [now, setNow] = useState(() => clock());

  useEffect(() => {
    if (!drill || drill.finishedAt !== null) return undefined;
    const timer = setInterval(() => setNow(clock()), TICK_MS);
    return () => clearInterval(timer);
  }, [drill, clock]);

  const lots = useMemo(() => knownLots(records), [records]);
  const trace = useMemo(() => (status === 'ready' ? traceLot(records, code) : null), [status, records, code]);
  const run = (value) => {
    setTyped(value);
    setCode(value);
  };

  return (
    <div style={ui.page}>
      <h1 style={ui.h1}>{tt.title}</h1>
      <p style={{ ...ui.subtitle, marginBottom: 20 }}>{tt.subtitle}</p>

      {status === 'loading' && <div style={{ ...ui.card, padding: 32, textAlign: 'center', color: '#94a3b8' }}>{tt.loading}</div>}
      {status === 'error' && (
        <div role="alert" style={{ margin: '0 0 14px', padding: '9px 12px', borderRadius: 8, background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', fontSize: 13, display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <span>{tt.error}</span>
          <button type="button" onClick={reload} style={small}>{tt.retry}</button>
        </div>
      )}

      {status === 'ready' && (
        <>
          {truncated && <p role="status" style={{ fontSize: 12, color: '#92400e', background: '#fef3c7', borderRadius: 8, padding: '8px 12px', margin: '0 0 14px' }}>{tt.truncated}</p>}

          {drill ? (
            <Drill
              tt={tt}
              drill={drill}
              now={now}
              trace={trace}
              role={role}
              farmId={farm.id}
              onFinish={() => setDrill((current) => ({ ...current, finishedAt: clock() }))}
              onCancel={() => setDrill(null)}
            />
          ) : (
            <div style={{ ...ui.card, padding: '12px 18px', marginBottom: 18, display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
              <span style={{ flex: '1 1 300px', fontSize: 13, color: '#475569' }}>{tt.drill.intro}</span>
              <button type="button" onClick={() => { setNow(clock()); setDrill({ startedAt: clock(), finishedAt: null }); }} style={ui.buttonSecondary}>{tt.drill.start}</button>
            </div>
          )}

          <form onSubmit={(event) => { event.preventDefault(); setCode(typed); }} style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 12 }}>
            <div style={{ flex: '1 1 260px' }}>
              <label htmlFor="trace-lot" style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>{tt.lotLabel}</label>
              <input id="trace-lot" list="trace-lots" value={typed} placeholder={tt.lotPlaceholder} autoComplete="off" onChange={(event) => setTyped(event.target.value)} style={ui.input} />
              <datalist id="trace-lots">{lots.map((lot) => <option key={lot.code} value={lot.code} />)}</datalist>
            </div>
            <button type="submit" style={ui.buttonPrimary}>{tt.trace}</button>
          </form>

          {lots.length === 0 ? (
            <p style={{ fontSize: 13, color: '#94a3b8' }}>{tt.noLots}</p>
          ) : (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 18 }}>
              <span style={{ fontSize: 12, color: '#64748b' }}>{tt.recent}:</span>
              {lots.slice(0, RECENT_LOTS).map((lot) => (
                <button key={lot.code} type="button" onClick={() => run(lot.code)} style={small}>{lot.code}</button>
              ))}
            </div>
          )}

          {trace && <Result trace={trace} lang={lang} tt={tt} />}
        </>
      )}
    </div>
  );
}
