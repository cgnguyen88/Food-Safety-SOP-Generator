import { useEffect, useRef } from 'react';
import { ClipboardCheck, ClipboardList, FileText, GraduationCap, Home, Library, MapPin, Route, UserCog, X } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import { ROUTES } from '../lib/recordsRoute.js';
import { homeText } from './homeText.js';
import NavItem from './nav/NavItem.jsx';

const HOME = 'home';
const SOPS = 'sops';

/** The pages that belong to the SOP library, so its menu item stays marked while a SOP or the plan is open. */
const LIBRARY_PAGES = [SOPS, 'sop', 'plan_generator'];
/** The records pages that have no menu item of their own, shown under "All records". */
const isRecordsPage = (page) => page === ROUTES.overview || page.startsWith('log:') || page.startsWith('view:') || page === ROUTES.history;

/**
 * The side menu: Home, then the records pages, then traceability, then the SOP library. Short enough to see at a
 * glance, with nothing to open or close.
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
    <nav id="app-menu" aria-label="Main" className={className} inert={hidden || undefined} aria-hidden={hidden || undefined}>
      <div style={{ padding: '20px 20px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div>
          <div style={{ fontFamily: 'Lora,serif', fontSize: 22, fontWeight: 700, lineHeight: 1.1 }}>FarmSafe</div>
          <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,.65)', marginTop: 3 }}>{tt.appSub}</div>
        </div>
        <button
          type="button"
          onClick={toggleLang}
          title={tt.nav.switchLanguage}
          aria-label={tt.nav.switchLanguage}
          style={{ padding: '6px 12px', borderRadius: 20, border: '1.5px solid var(--u-gold)', background: 'transparent', color: 'var(--u-gold)', cursor: 'pointer', fontSize: 12, fontWeight: 800, letterSpacing: 0.4, flexShrink: 0 }}
        >
          {lang === 'en' ? 'ES' : 'EN'}
        </button>
        {drawer && (
          <button ref={closeButton} type="button" className="menu-icon-button" onClick={onClose} aria-label={tt.nav.closeMenu}>
            <X size={20} aria-hidden="true" />
          </button>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 12px 16px' }}>
        <NavItem icon={Home} label={tt.nav.home} active={activePage === HOME} onClick={go(HOME)} />

        <div className="nav-subhead" style={{ marginTop: 14 }}>{tt.nav.groups.records}</div>
        <NavItem icon={ClipboardList} label={tt.nav.records} active={isRecordsPage(activePage)} onClick={go(ROUTES.overview)} />
        <NavItem icon={ClipboardCheck} label={tt.nav.review} badge={needsReviewCount} active={activePage === ROUTES.review} onClick={go(ROUTES.review)} />
        <NavItem icon={MapPin} label={tt.nav.fields} active={activePage === ROUTES.fields} onClick={go(ROUTES.fields)} />
        <NavItem icon={GraduationCap} label={tt.nav.training} active={activePage === ROUTES.training} onClick={go(ROUTES.training)} />

        <div className="nav-subhead" style={{ marginTop: 14 }}>{tt.nav.groups.traceability}</div>
        <NavItem icon={Route} label={tt.nav.trace} active={activePage === ROUTES.trace} onClick={go(ROUTES.trace)} />
        <NavItem icon={FileText} label={tt.nav.reports} active={activePage === ROUTES.reports} onClick={go(ROUTES.reports)} />

        <div className="nav-subhead" style={{ marginTop: 14 }}>{tt.nav.groups.library}</div>
        <NavItem icon={Library} label={tt.nav.sops} active={LIBRARY_PAGES.includes(activePage)} onClick={go(SOPS)} />
      </div>

      <div style={{ padding: '12px 12px 14px', borderTop: '1px solid rgba(255,255,255,.15)' }}>
        <NavItem icon={UserCog} label={farmProfile?.farm_name ? farmProfile.farm_name.slice(0, 24) : tt.nav.profile} onClick={onOpenProfile} />
        {currentUser && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 10px 4px' }}>
            <div aria-hidden="true" style={{ width: 30, height: 30, borderRadius: '50%', flexShrink: 0, background: 'var(--u-gold)', color: 'var(--u-navy-d)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700 }}>
              {currentUser.name?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{currentUser.name}</div>
            </div>
            <button type="button" onClick={onLogout} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,.65)', cursor: 'pointer', fontSize: 12, textDecoration: 'underline', padding: 0 }}>
              {tt.nav.signOut}
            </button>
          </div>
        )}
      </div>
    </nav>
    </>
  );
}
