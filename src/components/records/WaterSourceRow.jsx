import { useLanguage } from '../../i18n/LanguageContext.jsx';
import { optionLabel } from '../../domain/records/kinds.js';
import { recordsText } from './text.js';
import { STATUS_TONE } from './WaterSourceDetail.jsx';
import * as ui from './ui.js';

const td = { padding: '10px 14px', fontSize: 13, color: '#334155', borderBottom: '1px solid #f1f5f9', verticalAlign: 'middle' };
const small = { ...ui.buttonSecondary, padding: '3px 10px', fontSize: 12 };

/**
 * One water source in the list, from `waterSources`: what it is, its fields, when it was last assessed and is next due, the
 * decision, its last water test and where it stands, with a button to assess it (again) and one for its details.
 * `listKnown` is whether the farm's list was read, since "not in your list" cannot be said without it.
 */
export default function WaterSourceRow({ row, listKnown, canRecord, onAssess, onDetails }) {
  const { lang: rawLang } = useLanguage();
  const lang = rawLang === 'es' ? 'es' : 'en';
  const tt = recordsText(lang).water;
  const archived = row.archived;
  const muted = archived ? { color: '#94a3b8' } : null;
  const result = (value) => (value ? optionLabel('water_test', 'result', value, lang) : tt.none);

  return (
    <tr>
      <td className="stack-title" style={{ ...td, ...muted }}>
        <div data-testid="source-name" style={{ fontWeight: 600, color: archived ? '#94a3b8' : '#0f172a' }}>{row.name}</div>
        {row.sourceType && <div style={{ fontSize: 12, color: '#94a3b8' }}>{optionLabel('water_assessment', 'source_type', row.sourceType, lang)}</div>}
        {listKnown && !row.registered && <span style={{ ...ui.TONES.warning, display: 'inline-block', marginTop: 4, padding: '1px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600 }}>{tt.unlisted}</span>}
      </td>
      <td data-label={tt.columns.fields} style={{ ...td, ...muted }}>{row.fields.length > 0 ? row.fields.join(', ') : tt.none}</td>
      <td data-label={tt.columns.assessed} style={{ ...td, ...muted }}>
        {row.assessedOn ? (
          <>
            <span style={{ whiteSpace: 'nowrap' }}>{row.assessedOn}</span>
            <div style={{ fontSize: 12, color: '#94a3b8' }}>{tt.next} {row.nextReview} ({tt.dueIn(row.daysLeft)})</div>
          </>
        ) : tt.none}
      </td>
      <td data-label={tt.columns.decision} style={{ ...td, ...muted }}>{row.conclusion ? optionLabel('water_assessment', 'conclusion', row.conclusion, lang) : tt.none}</td>
      <td data-label={tt.columns.test} style={{ ...td, ...muted }}>{row.lastTest ? tt.test(row.lastTest.date, result(row.lastTest.result)) : tt.none}</td>
      <td data-label={tt.columns.status} style={td}>
        <span style={{ ...STATUS_TONE[row.status], padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600 }}>{tt.status[row.status]}</span>
        {row.floods.length > 0 && <div style={{ fontSize: 12, color: '#991b1b', marginTop: 4 }}>{tt.floodOn(row.floods)}</div>}
      </td>
      <td className="stack-actions" style={{ ...td, whiteSpace: 'nowrap' }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {canRecord && !archived && (
            <button type="button" aria-label={row.status === 'not_assessed' ? tt.assessFor(row.name) : tt.reassessFor(row.name)} onClick={() => onAssess(row)} style={small}>
              {row.status === 'not_assessed' ? tt.assess : tt.reassess}
            </button>
          )}
          <button type="button" aria-label={tt.actionFor(tt.actions.details, row.name)} onClick={() => onDetails(row)} style={small}>{tt.actions.details}</button>
        </div>
      </td>
    </tr>
  );
}
