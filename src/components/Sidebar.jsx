import { useEffect, useRef } from 'react';
import { ClipboardCheck, ClipboardList, FileText, GraduationCap, Home, Library, LogOut, MapPin, Route, ShieldCheck, UserCog, Waves, X } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import { ROUTES } from '../lib/recordsRoute.js';
import { homeText } from './homeText.js';
import NavGroup from './nav/NavGroup.jsx';
import NavItem from './nav/NavItem.jsx';

const HOME = 'home';
const SOPS = 'sops';

/** The pages that belong to the SOP library, so its menu item stays marked while a SOP or the plan is open. */
const LIBRARY_PAGES = [SOPS, 'sop', 'plan_generator'];
/** The records pages that have no menu item of their own, shown under "All records". */
const isRecordsHome = (page) => page === ROUTES.overview || page.startsWith('log:') || page.startsWith('view:') || page === ROUTES.history;
const RECORDS_PAGES = [ROUTES.review, ROUTES.fields, ROUTES.water, ROUTES.training];
const TRACE_PAGES = [ROUTES.trace, ROUTES.reports];

// Each section has its own quiet accent, so the sections are easy to tell apart at a glance.
const RECORDS_ACCENT = '#4fd1a5';
const TRACE_ACCENT = '#5bbcf0';

const initialsOf = (name) => (name ? name.split(' ').filter(Boolean).map((word) => word[0]).join('').slice(0, 2).toUpperCase() : '?');

/**
 * The side menu, as a dark "liquid glass" panel: Home and the SOP library, then two sections that open and close
 * (the records pages, and traceability), with the language, the farm profile and the account in a card at the foot.
 * Its look comes from the `.side-menu` rules in global.js. On a phone (`drawer`) it slides in over the page; while it is
 * closed it is out of reach of keyboards and screen readers, and when it opens the focus goes to its close button.
 */
export default function Sidebar({ activePage, onNavigate, onOpenProfile, onLogout, currentUser, farmProfile, needsReviewCount = 0, drawer = false, open = false, onClose }) {
  const { lang, toggleLang } = useLanguage();
  const tt = homeText(lang);
  const closeButton = useRef(null);
  const hidden = drawer && !open;
  const go = (page) => () => onNavigate(page);

  useEffect(() => {
    if (drawer && open) closeButton.current?.focus();
  }, [drawer, open]);

  const className = ['side-menu', 'no-print', drawer && 'side-menu--drawer', drawer && open && 'is-open'].filter(Boolean).join(' ');

  return (
    <>
    {drawer && open && <div className="menu-scrim no-print" aria-hidden="true" onClick={onClose} />}
    <aside id="app-menu" className={className} inert={hidden || undefined} aria-hidden={hidden || undefined}>
      {/* A faint, still wash of colour behind the glass, so the blur has something to soften. Purely decorative. */}
      <div className="menu-backdrop" aria-hidden="true">
        <span className="menu-orb menu-orb-sky" />
        <span className="menu-orb menu-orb-green" />
      </div>

      <div className="menu-panel">
        <div style={{ padding: '18px 16px 12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div aria-hidden="true" className="menu-mark">
              <ShieldCheck size={17} color="var(--u-navy)" strokeWidth={2.25} />
            </div>
            <span style={{ flex: 1, color: '#fff', fontFamily: 'Lora, serif', fontWeight: 700, fontSize: 17, letterSpacing: '-0.01em' }}>FarmSafe</span>
            {drawer && (
              <button ref={closeButton} type="button" className="menu-icon-button" onClick={onClose} aria-label={tt.nav.closeMenu}>
                <X size={18} aria-hidden="true" />
              </button>
            )}
          </div>
          <div style={{ marginTop: 6, color: 'var(--menu-muted)', fontSize: 11.5 }}>{tt.appSub}</div>
        </div>

        <nav className="menu-nav" aria-label={tt.nav.label} style={{ flex: 1, overflowY: 'auto', padding: '2px 8px 24px' }}>
          <div>
            <NavItem icon={Home} label={tt.nav.home} active={activePage === HOME} onClick={go(HOME)} />
            <NavItem icon={Library} label={tt.nav.sops} active={LIBRARY_PAGES.includes(activePage)} onClick={go(SOPS)} />
          </div>

          <NavGroup id="records" label={tt.nav.groups.records} icon={ClipboardList} accent={RECORDS_ACCENT} count={5} forceOpen={isRecordsHome(activePage) || RECORDS_PAGES.includes(activePage)}>
            <NavItem icon={ClipboardList} label={tt.nav.records} active={isRecordsHome(activePage)} onClick={go(ROUTES.overview)} />
            <NavItem icon={ClipboardCheck} label={tt.nav.review} badge={needsReviewCount} active={activePage === ROUTES.review} onClick={go(ROUTES.review)} />
            <NavItem icon={MapPin} label={tt.nav.fields} active={activePage === ROUTES.fields} onClick={go(ROUTES.fields)} />
            <NavItem icon={Waves} label={tt.nav.water} active={activePage === ROUTES.water} onClick={go(ROUTES.water)} />
            <NavItem icon={GraduationCap} label={tt.nav.training} active={activePage === ROUTES.training} onClick={go(ROUTES.training)} />
          </NavGroup>

          <NavGroup id="traceability" label={tt.nav.groups.traceability} icon={Route} accent={TRACE_ACCENT} count={2} forceOpen={TRACE_PAGES.includes(activePage)}>
            <NavItem icon={Route} label={tt.nav.trace} active={activePage === ROUTES.trace} onClick={go(ROUTES.trace)} />
            <NavItem icon={FileText} label={tt.nav.reports} active={activePage === ROUTES.reports} onClick={go(ROUTES.reports)} />
          </NavGroup>
        </nav>

        <div className="menu-footer">
          <div className="menu-segment" role="group" aria-label={tt.nav.language} style={{ marginBottom: 8 }}>
            {[['en', 'EN'], ['es', 'ES']].map(([code, text]) => (
              <button key={code} type="button" aria-pressed={lang === code} onClick={() => { if (lang !== code) toggleLang(); }}>{text}</button>
            ))}
          </div>

          <NavItem icon={UserCog} label={farmProfile?.farm_name ? farmProfile.farm_name.slice(0, 24) : tt.nav.profile} onClick={onOpenProfile} />

          {currentUser && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 4px 0' }}>
              <div aria-hidden="true" className="menu-avatar">{initialsOf(currentUser.name)}</div>
              <div style={{ flex: 1, minWidth: 0, color: 'rgba(255,255,255,0.92)', fontSize: 12.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{currentUser.name}</div>
              <button type="button" className="menu-icon-button" onClick={onLogout} aria-label={tt.nav.signOut} title={tt.nav.signOut}>
                <LogOut size={15} aria-hidden="true" />
              </button>
            </div>
          )}
        </div>
      </div>
    </aside>
    </>
  );
}
