import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext.jsx';
import { KIND_GROUPS, KIND_META } from '../../domain/records/kinds.js';
import { canSeeKind } from '../../domain/records/workflow.js';
import { DEFAULT_SAVED_VIEWS } from '../../domain/records/savedViews.js';
import { ROUTES, logRoute, viewRoute } from '../../lib/recordsRoute.js';
import { recordsText, viewName } from './text.js';
import { KIND_ICONS } from './icons.js';
import * as ui from './ui.js';
import RecordForm from './RecordForm.jsx';

/** All the logs, by group: open one to read its records, or add a record to it. Then the saved views. */
export default function RecordsOverview({ farm, role, savedViews, needsReviewCount, onNavigate, onChanged }) {
  const { lang: rawLang } = useLanguage();
  const lang = rawLang === 'es' ? 'es' : 'en';
  const tt = recordsText(lang);
  const [adding, setAdding] = useState(null);

  return (
    <div style={ui.page}>
      <h1 style={ui.h1}>{tt.overview.title}</h1>
      <p style={{ ...ui.subtitle, marginBottom: 22 }}>{tt.overview.subtitle}</p>

      {needsReviewCount > 0 && (
        <div style={{ ...ui.card, borderColor: '#fde68a', background: '#fffbeb', padding: '14px 18px', marginBottom: 22, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 14, color: '#92400e', fontWeight: 600 }}>{tt.overview.needsReview(needsReviewCount)}</span>
          <button type="button" onClick={() => onNavigate(ROUTES.review)} style={ui.buttonPrimary}>{tt.overview.openReview}</button>
        </div>
      )}

      <h2 style={{ fontSize: 14, color: '#475569', margin: '0 0 10px' }}>{tt.overview.addTitle}</h2>
      {KIND_GROUPS.map((group) => {
        const kinds = group.kinds.filter((kind) => canSeeKind(kind, role));
        if (kinds.length === 0) return null;
        return (
          <section key={group.id} aria-label={group.label[lang]} style={{ marginBottom: 18 }}>
            <h3 style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#64748b', margin: '0 0 8px' }}>{group.label[lang]}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 10 }}>
              {kinds.map((kind) => {
                const Icon = KIND_ICONS[KIND_META[kind].icon];
                const addLabel = tt.log.add(KIND_META[kind].label[lang]);
                return (
                  <div key={kind} style={{ ...ui.card, display: 'flex', alignItems: 'stretch' }}>
                    <button type="button" onClick={() => onNavigate(logRoute(kind))} style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#0f172a', textAlign: 'left' }}>
                      <span style={{ width: 28, height: 28, flexShrink: 0, borderRadius: 8, background: `${KIND_META[kind].color}1f`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Icon size={15} color={KIND_META[kind].color} aria-hidden="true" />
                      </span>
                      {KIND_META[kind].plural[lang]}
                    </button>
                    <button type="button" aria-label={addLabel} title={addLabel} onClick={() => setAdding(kind)} style={{ width: 44, border: 'none', borderLeft: '1px solid #e2e8f0', background: 'none', cursor: 'pointer', color: 'var(--u-navy)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Plus size={16} aria-hidden="true" />
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}

      {savedViews.length > 0 && (
        <>
          <h2 style={{ fontSize: 14, color: '#475569', margin: '8px 0 10px' }}>{tt.overview.viewsTitle}</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10 }}>
            {savedViews.map((view) => (
              <button key={view.id} type="button" onClick={() => onNavigate(viewRoute(view.id))} style={{ ...ui.card, padding: '14px 16px', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--u-navy)', textAlign: 'left' }}>
                {viewName(view, DEFAULT_SAVED_VIEWS, lang)}
              </button>
            ))}
          </div>
        </>
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
