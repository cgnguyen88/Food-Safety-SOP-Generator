import { useMemo } from 'react';
import { useLanguage } from '../../i18n/LanguageContext.jsx';
import { todayLocalIso } from '../../domain/records/seasons.js';
import { floodLinks, prefillFromAssessment, waterSources } from '../../domain/records/waterAssessment.js';
import { recordsText } from './text.js';
import useFarmRecords from './useFarmRecords.js';
import * as ui from './ui.js';

const WATER_KINDS = ['weather_event', 'water_assessment'];
const NOTE = { fontSize: 13, margin: 0, padding: '8px 12px', borderRadius: 8, background: '#f1f5f9', color: '#475569' };

/**
 * On a flood record: the water sources it may have reached (the one it names, and those that water the field it hit),
 * and which of them need a new assessment because of it. Each can be assessed again from here, starting from its last
 * answers. Says so rather than guessing when the farm's assessments could not be read.
 *
 * @param {{ record: object, farmId: string, onAssess: (prefill: Record<string, unknown>) => void }} props
 */
export default function FloodWaterPanel({ record, farmId, onAssess }) {
  const { lang: rawLang } = useLanguage();
  const lang = rawLang === 'es' ? 'es' : 'en';
  const tt = recordsText(lang).water.floodDetail;

  const { status, records } = useFarmRecords({ farmId, kinds: WATER_KINDS });
  const today = todayLocalIso();
  const links = useMemo(() => floodLinks(record, waterSources(records, { today })), [record, records, today]);
  const assessmentOf = (source) => records.find((candidate) => candidate.id === source.recordId);

  return (
    <section aria-label={tt.title} style={{ margin: '16px 0 4px' }}>
      <h3 style={{ fontSize: 13, color: '#475569', margin: '0 0 6px' }}>{tt.title}</h3>
      {status === 'error' && <p role="status" style={{ ...NOTE, background: '#fef3c7', color: '#92400e' }}>{tt.error}</p>}
      {status === 'ready' && links.length === 0 && <p style={NOTE}>{tt.none}</p>}
      {status === 'ready' && links.length > 0 && (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 6 }}>
          {links.map(({ source, needsAssessment }) => (
            <li key={source.key} style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', fontSize: 13 }}>
              <span style={{ fontWeight: 600, color: '#0f172a' }}>{source.name}</span>
              {needsAssessment ? (
                <>
                  <span style={{ ...ui.TONES.danger, padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600 }}>{tt.needs}</span>
                  <button type="button" onClick={() => onAssess(prefillFromAssessment(assessmentOf(source)))} style={{ ...ui.buttonSecondary, padding: '3px 10px', fontSize: 12 }}>{tt.reassess(source.name)}</button>
                </>
              ) : (
                <span style={{ ...ui.TONES.success, padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600 }}>{tt.done(source.assessedOn)}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
