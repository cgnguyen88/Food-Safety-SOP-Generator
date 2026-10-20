import { useLanguage } from '../../i18n/LanguageContext.jsx';
import { optionLabel } from '../../domain/records/kinds.js';
import { assessConcerns } from '../../domain/records/waterAssessment.js';
import { recordsText } from './text.js';
import * as ui from './ui.js';

const NOTE = { fontSize: 12, margin: '-8px 0 14px', padding: '8px 12px', borderRadius: 8 };
const TONE = {
  good: { background: '#dcfce7', color: '#166534' },
  bad: { background: '#fee2e2', color: '#991b1b' },
  warn: { background: '#fef3c7', color: '#92400e' },
  info: { background: '#e0f2fe', color: '#075985' },
  plain: { background: '#f1f5f9', color: '#475569' },
};

const useText = () => {
  const { lang: rawLang } = useLanguage();
  const lang = rawLang === 'es' ? 'es' : 'en';
  return { lang, tt: recordsText(lang).water };
};

const list = (items, lang) => new Intl.ListFormat(lang, { style: 'long', type: 'conjunction' }).format(items);

/**
 * What an assessment's ratings add up to, with a button to use the suggested conclusion: a suggestion only, since the
 * conclusion is the person's. Also warns when "no measures needed" is chosen with a high concern, and says when
 * measures must be in place if the worry is animals, manure or people near the water.
 *
 * @param {{ values: Record<string, string>, onUse: (conclusion: 'no_mitigation' | 'mitigation_needed') => void }} props
 */
export function ConcernSummary({ values, onUse }) {
  const { lang, tt } = useText();
  const { suggestion, high, some } = assessConcerns(values);
  // A source that is not used any more is not rated.
  if (values.conclusion === 'retired') return null;
  const names = (keys) => list(keys.map((key) => tt.form.factors[key]), lang);
  const usable = suggestion === 'mitigation_needed' || suggestion === 'no_mitigation';

  const message = suggestion === null ? tt.form.incomplete
    : suggestion === 'mitigation_needed' ? tt.form.mitigation_needed(names(high))
      : suggestion === 'judgment' ? tt.form.judgment(names(some))
        : tt.form.no_mitigation;
  const tone = { null: TONE.plain, mitigation_needed: TONE.bad, judgment: TONE.warn, no_mitigation: TONE.good }[suggestion];

  return (
    <>
      <div role="status" style={{ ...NOTE, ...tone, display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <span style={{ flex: '1 1 240px' }}>{message}</span>
        {usable && values.conclusion !== suggestion && (
          <button type="button" onClick={() => onUse(suggestion)} style={{ ...ui.buttonSecondary, padding: '3px 10px', fontSize: 12 }}>
            {tt.form.use(optionLabel('water_assessment', 'conclusion', suggestion, lang))}
          </button>
        )}
      </div>
      {values.conclusion === 'no_mitigation' && high.length > 0 && <p role="alert" style={{ ...NOTE, ...TONE.bad }}>{tt.form.conflict}</p>}
      {values.nearby_concern === 'high' && <p style={{ ...NOTE, ...TONE.info }}>{tt.form.deadline}</p>}
    </>
  );
}

/** The floods in the last year that may have reached this water, for the weather rating. @param {{ status: string, floods: Array<{ id: string, date: string, field: string }>, truncated?: boolean }} props */
export function RecentFloodsNote({ status, floods, truncated = false }) {
  const { tt } = useText();
  if (status === 'error') return <p role="status" style={{ ...NOTE, ...TONE.warn }}>{tt.form.floodsError}</p>;
  if (status !== 'ready') return null;
  if (floods.length === 0) return truncated ? <p role="status" style={{ ...NOTE, ...TONE.warn }}>{tt.incomplete}</p> : null;
  const items = floods.map((flood) => tt.form.floodItem(flood.date, flood.field));
  return (
    <>
      <p role="status" style={{ ...NOTE, ...TONE.info }}>{tt.form.floods(items.join(', '), items.length)}</p>
      {truncated && <p role="status" style={{ ...NOTE, ...TONE.warn }}>{tt.incomplete}</p>}
    </>
  );
}

/**
 * On a flood record: a reminder that the flood can reach the water, and which assessed sources are for this field. It
 * says that no assessment lists the field only once a field or water source has been given (`searched`), and not when the
 * records were cut short (`truncated`), since then it cannot know.
 *
 * @param {{ status: string, sources: Array<{ key: string, name: string }>, searched?: boolean, truncated?: boolean }} props
 */
export function FloodWaterNote({ status, sources, searched = false, truncated = false }) {
  const { tt } = useText();
  const known = status === 'ready';
  return (
    <div role="status" style={{ ...NOTE, ...TONE.info }}>
      <strong>{tt.flood.title}</strong>
      <div>{tt.flood.body}</div>
      {known && sources.length > 0 && <div>{tt.flood.sources(sources.map((source) => source.name).join(', '))}</div>}
      {known && sources.length === 0 && searched && !truncated && <div>{tt.flood.none}</div>}
      {known && truncated && <div>{tt.incomplete}</div>}
    </div>
  );
}

/** A reminder under the source type when it is a public water system. */
export function PublicWaterNote() {
  const { tt } = useText();
  return <p style={{ ...NOTE, ...TONE.info }}>{tt.form.public}</p>;
}

/** Which step of an assessment each field starts. */
export const WATER_SECTION_STARTS = Object.freeze({ source: 'source', source_concern: 'factors', conclusion: 'decision' });

/** The title (and a line of help) that opens a step of the assessment form. @param {{ section: 'source' | 'factors' | 'decision' }} props */
export function WaterSectionHeading({ section }) {
  const { tt } = useText();
  const { title, body } = tt.form.sections[section];
  return (
    <div style={{ margin: '6px 0 12px', paddingTop: 10, borderTop: '1px solid #e2e8f0' }}>
      <h3 style={{ fontSize: 14, color: 'var(--u-navy)', margin: 0 }}>{title}</h3>
      {body && <p style={{ fontSize: 12, color: '#64748b', margin: '2px 0 0' }}>{body}</p>}
    </div>
  );
}

/** Under the fields the water is used on: the names that are not in the farm's field list. @param {{ names: string[] }} props */
export function UnlistedFieldsNote({ names }) {
  const { tt } = useText();
  if (names.length === 0) return null;
  return <p role="status" style={{ ...NOTE, ...TONE.warn }}>{tt.form.notInList(names.join(', '))}</p>;
}
