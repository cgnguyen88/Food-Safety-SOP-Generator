import { useState } from 'react';
import { Package, Pin, Plus, Sprout, SprayCan, StickyNote, Users } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext.jsx';
import { KIND_GROUPS, KIND_META } from '../../domain/records/kinds.js';
import { canSeeKind } from '../../domain/records/workflow.js';
import { DEFAULT_SAVED_VIEWS } from '../../domain/records/savedViews.js';
import { ROUTES, logRoute, viewRoute } from '../../lib/recordsRoute.js';
import { recordsText, viewName } from './text.js';
import { KIND_ICONS } from './icons.js';
import * as ui from './ui.js';
import LogGroup from './LogGroup.jsx';
import PhotoBanner from '../PhotoBanner.jsx';
import RecordForm from './RecordForm.jsx';

/** Each group's icon and colour: dark enough to read on white. */
const GROUP_LOOKS = {
  sanitation: { icon: SprayCan, accent: '#0e7490' },
  field: { icon: Sprout, accent: '#15803d' },
  people: { icon: Users, accent: '#7c3aed' },
  harvest: { icon: Package, accent: '#b45309' },
  other: { icon: StickyNote, accent: '#475569' },
};
const VIEWS_LOOK = { icon: Pin, accent: '#4f46e5' };

/**
 * All the logs, in groups that open into a list: open a group, then a log to read its records, or + to add a record to
 * it. Then the saved views, as one more group. Only the first group is open the first time; after that each stays as it
 * was left.
 */
export default function RecordsOverview({ farm, role, savedViews, needsReviewCount, onNavigate, onChanged }) {
  const { lang: rawLang } = useLanguage();
  const lang = rawLang === 'es' ? 'es' : 'en';
  const tt = recordsText(lang);
  const [adding, setAdding] = useState(null);

  return (
    <div style={ui.page}>
      <PhotoBanner image="/photos/produce.jpg" title={tt.overview.title} subtitle={tt.overview.subtitle} />
      <div style={{ height: 22 }} />

      {needsReviewCount > 0 && (
        <div style={{ ...ui.card, borderColor: '#fde68a', background: '#fffbeb', padding: '14px 18px', marginBottom: 22, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 14, color: '#92400e', fontWeight: 600 }}>{tt.overview.needsReview(needsReviewCount)}</span>
          <button type="button" onClick={() => onNavigate(ROUTES.review)} style={ui.buttonPrimary}>{tt.overview.openReview}</button>
        </div>
      )}

      <h2 style={{ fontSize: 15, fontWeight: 600, color: '#1e293b', margin: '0 0 10px' }}>{tt.overview.addTitle}</h2>
      {KIND_GROUPS.map((group, index) => {
        const kinds = group.kinds.filter((kind) => canSeeKind(kind, role));
        if (kinds.length === 0) return null;
        const { icon, accent } = GROUP_LOOKS[group.id];
        return (
          <LogGroup key={group.id} id={group.id} label={group.label[lang]} icon={icon} accent={accent} count={kinds.length} defaultOpen={index === 0}>
            {kinds.map((kind) => {
              const Icon = KIND_ICONS[KIND_META[kind].icon];
              const addLabel = tt.log.add(KIND_META[kind].label[lang]);
              return (
                <li key={kind} className="log-row">
                  <button type="button" className="log-row-open" onClick={() => onNavigate(logRoute(kind))}>
                    <span className="log-row-icon" aria-hidden="true" style={{ background: `${KIND_META[kind].color}1f` }}>
                      <Icon size={15} color={KIND_META[kind].color} />
                    </span>
                    {KIND_META[kind].plural[lang]}
                  </button>
                  <button type="button" className="log-row-add" aria-label={addLabel} title={addLabel} onClick={() => setAdding(kind)}>
                    <Plus size={17} aria-hidden="true" />
                  </button>
                </li>
              );
            })}
          </LogGroup>
        );
      })}

      {savedViews.length > 0 && (
        <LogGroup id="views" label={tt.overview.viewsTitle} icon={VIEWS_LOOK.icon} accent={VIEWS_LOOK.accent} count={savedViews.length}>
          {savedViews.map((view) => (
            <li key={view.id} className="log-row">
              <button type="button" className="log-row-open" onClick={() => onNavigate(viewRoute(view.id))}>{viewName(view, DEFAULT_SAVED_VIEWS, lang)}</button>
            </li>
          ))}
        </LogGroup>
      )}

      {adding && (
        <RecordForm
          kind={adding}
          role={role}
          farmId={farm.id}
          onCancel={() => setAdding(null)}
          onSaved={() => {
            const kind = adding;
            setAdding(null);
            onChanged?.();
            onNavigate(logRoute(kind));
          }}
        />
      )}
    </div>
  );
}
