import { useLanguage } from '../../i18n/LanguageContext.jsx';
import { recordsText } from './text.js';
import * as ui from './ui.js';

const box = { ...ui.card, padding: '14px 18px', marginBottom: 22 };

/**
 * The fields that are on hold, each with why and since when, and a button to record the corrective action that
 * clears it. When the holds could not be read it says so, rather than showing nothing: a farm must not read
 * "nothing is on hold" from a failed check.
 *
 * @param {{ status: 'loading' | 'ready' | 'error', holds: ReturnType<typeof import('../../domain/records/holds.js').computeFieldHolds>, onClear: (hold: object) => void, onRetry?: () => void }} props
 */
export default function FieldHoldsBanner({ status, holds, onClear, onRetry }) {
  const { lang: rawLang } = useLanguage();
  const tt = recordsText(rawLang === 'es' ? 'es' : 'en').holds;

  if (status === 'error') {
    return (
      <div role="alert" style={{ ...box, borderColor: '#fecaca', background: '#fef2f2', display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 14, color: '#b91c1c' }}>{tt.unknown}</span>
        {onRetry && <button type="button" onClick={onRetry} style={ui.buttonSecondary}>{tt.retry}</button>}
      </div>
    );
  }
  if (status !== 'ready' || holds.length === 0) return null;

  return (
    <section aria-label={tt.title} style={{ ...box, borderColor: '#fecaca', background: '#fef2f2' }}>
      <h2 style={{ fontSize: 15, color: '#991b1b', margin: '0 0 4px' }}>{tt.title}</h2>
      <p style={{ fontSize: 13, color: '#7f1d1d', margin: '0 0 12px' }}>{tt.intro}</p>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 10 }}>
        {holds.map((hold) => (
          <li key={hold.key} style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', background: 'white', borderRadius: 10, border: '1px solid #fecaca', padding: '10px 14px' }}>
            <div>
              <div style={{ fontWeight: 700, color: '#0f172a' }}>{hold.name}</div>
              <div style={{ fontSize: 12, color: '#991b1b' }}>{tt.since(hold.since)}</div>
              <div style={{ fontSize: 12, color: '#475569' }}>{[...new Set(hold.triggers.map((t) => tt.reason[t.reason]))].join(' · ')}</div>
            </div>
            <button type="button" aria-label={`${tt.clear}: ${hold.name}`} onClick={() => onClear(hold)} style={ui.buttonPrimary}>{tt.clear}</button>
          </li>
        ))}
      </ul>
    </section>
  );
}
