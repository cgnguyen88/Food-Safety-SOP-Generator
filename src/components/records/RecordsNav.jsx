import { useState } from 'react';
import { ClipboardList, ClipboardCheck, FileText, GraduationCap, History, Layers, MapPin, Route, Timer, ChevronDown, ChevronRight, ShieldCheck, Pin } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext.jsx';
import { KIND_GROUPS, KIND_META } from '../../domain/records/kinds.js';
import { canSeeKind } from '../../domain/records/workflow.js';
import { DEFAULT_SAVED_VIEWS } from '../../domain/records/savedViews.js';
import { ROUTES, logRoute, viewRoute, parseRecordsRoute } from '../../lib/recordsRoute.js';
import { recordsText, viewName } from './text.js';
import NavGroup from '../nav/NavGroup.jsx';
import NavItem from '../nav/NavItem.jsx';

// Each main section has its own quiet accent, so they are easy to tell apart at a glance.
const RECORDS_ACCENT = '#4fd1a5';
const VIEWS_ACCENT = '#b69cff';

/**
 * The records part of the sidebar, as two sections of their own: "Food Safety Records" (overview, the
 * review queue with its count, the logs by group, fields, the change history, reports) and "Saved Views"
 * (the farm's pinned shortcuts). Illness and injury reports are listed for owners and managers only.
 */
export default function RecordsNav({ activePage, onNavigate, role, needsReviewCount = 0, savedViews = [] }) {
  const { lang: rawLang } = useLanguage();
  const lang = rawLang === 'es' ? 'es' : 'en';
  const tt = recordsText(lang);

  const route = parseRecordsRoute(activePage);
  const [logsOpen, setLogsOpen] = useState(false);
  const showLogs = logsOpen || route?.type === 'log';

  const pinned = savedViews.filter((v) => v.pinned).sort((a, b) => a.position - b.position);

  return (
    <>
      <NavGroup id="records" label={tt.nav.section} icon={ShieldCheck} accent={RECORDS_ACCENT} forceOpen={Boolean(route) && route.type !== 'view'}>
        <NavItem icon={ClipboardList} label={tt.nav.overview} active={activePage === ROUTES.overview} onClick={() => onNavigate(ROUTES.overview)} />
        <NavItem icon={ClipboardCheck} label={tt.nav.review} badge={needsReviewCount} active={activePage === ROUTES.review} onClick={() => onNavigate(ROUTES.review)} />

        <NavItem
          icon={Layers}
          label={tt.nav.logs}
          expanded={showLogs}
          onClick={() => setLogsOpen((open) => !open)}
          trailing={showLogs ? <ChevronDown size={14} aria-hidden="true" /> : <ChevronRight size={14} aria-hidden="true" />}
        />
        {showLogs && KIND_GROUPS.map((group) => {
          const kinds = group.kinds.filter((kind) => canSeeKind(kind, role));
          if (kinds.length === 0) return null;
          return (
            <div key={group.id} role="group" aria-label={group.label[lang]}>
              <div className="nav-subhead" aria-hidden="true">{group.label[lang]}</div>
              {kinds.map((kind) => (
                <NavItem key={kind} indent={2} wrap label={KIND_META[kind].plural[lang]} active={activePage === logRoute(kind)} onClick={() => onNavigate(logRoute(kind))} />
              ))}
            </div>
          );
        })}

        <NavItem icon={MapPin} label={tt.nav.fields} active={activePage === ROUTES.fields} onClick={() => onNavigate(ROUTES.fields)} />
        <NavItem icon={GraduationCap} label={tt.nav.training} active={activePage === ROUTES.training} onClick={() => onNavigate(ROUTES.training)} />
        <NavItem icon={Route} label={tt.nav.trace} active={activePage === ROUTES.trace} onClick={() => onNavigate(ROUTES.trace)} />
        <NavItem icon={Timer} label={tt.nav.recall} active={activePage === ROUTES.recall} onClick={() => onNavigate(ROUTES.recall)} />
        <NavItem icon={History} label={tt.nav.history} active={activePage === ROUTES.history} onClick={() => onNavigate(ROUTES.history)} />
        <NavItem icon={FileText} label={tt.nav.reports} active={activePage === ROUTES.reports} onClick={() => onNavigate(ROUTES.reports)} />
      </NavGroup>

      {pinned.length > 0 && (
        <NavGroup id="saved-views" label={tt.nav.views} icon={Pin} accent={VIEWS_ACCENT} count={pinned.length} forceOpen={route?.type === 'view'}>
          {pinned.map((view) => (
            <NavItem key={view.id} indent wrap label={viewName(view, DEFAULT_SAVED_VIEWS, lang)} active={activePage === viewRoute(view.id)} onClick={() => onNavigate(viewRoute(view.id))} />
          ))}
        </NavGroup>
      )}
    </>
  );
}
