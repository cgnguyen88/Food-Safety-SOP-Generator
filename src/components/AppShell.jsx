import { useEffect, useRef, useState } from 'react';
import { Menu } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import { KIND_META } from '../domain/records/kinds.js';
import { ROUTES } from '../lib/recordsRoute.js';
import useMediaQuery, { PHONE_QUERY } from '../lib/useMediaQuery.js';
import { homeText } from './homeText.js';
import Sidebar from './Sidebar.jsx';

/** The name of the page for the phone's top bar. */
function pageTitle(page, lang, nav) {
  if (page.startsWith('log:')) return KIND_META[page.slice(4)]?.plural[lang] ?? nav.records;
  const titles = {
    home: nav.home,
    [ROUTES.overview]: nav.records,
    [ROUTES.review]: nav.review,
    [ROUTES.fields]: nav.fields,
    [ROUTES.training]: nav.training,
    [ROUTES.trace]: nav.trace,
    [ROUTES.reports]: nav.reports,
    [ROUTES.history]: nav.history,
    sops: nav.sops,
    sop: nav.sops,
    plan_generator: nav.sops,
  };
  return titles[page] ?? 'FarmSafe';
}

/**
 * The frame around every page: the side menu and the scrolling page area. On a phone the menu becomes a drawer that
 * slides over the page from a top-bar button, and closes after a choice, with Escape, or with a tap on the dimmed page.
 *
 * @param {{ activePage: string, onNavigate: (page: string) => void, sidebar: object, children: import('react').ReactNode }} props
 *   `sidebar` holds the Sidebar props other than the page and navigation.
 */
export default function AppShell({ activePage, onNavigate, sidebar, children }) {
  const { lang: rawLang } = useLanguage();
  const lang = rawLang === 'es' ? 'es' : 'en';
  const nav = homeText(lang).nav;
  const isPhone = useMediaQuery(PHONE_QUERY);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButton = useRef(null);
  const main = useRef(null);
  const drawerOpen = isPhone && menuOpen;

  useEffect(() => {
    if (main.current) main.current.scrollTop = 0;
  }, [activePage]);

  useEffect(() => {
    if (!drawerOpen) return undefined;
    const onKey = (event) => {
      if (event.key !== 'Escape') return;
      setMenuOpen(false);
      menuButton.current?.focus();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [drawerOpen]);

  const navigate = (page) => {
    setMenuOpen(false);
    onNavigate(page);
  };

  return (
    <div className={`app-shell${isPhone ? ' app-shell--phone' : ''}`}>
      {isPhone && (
        <header className="mobile-topbar no-print">
          <button ref={menuButton} type="button" className="mobile-topbar-button" aria-label={nav.openMenu} aria-expanded={drawerOpen} aria-controls="app-menu" onClick={() => setMenuOpen(true)}>
            <Menu size={22} aria-hidden="true" />
          </button>
          <span className="mobile-topbar-title">{pageTitle(activePage, lang, nav)}</span>
        </header>
      )}
      <Sidebar {...sidebar} activePage={activePage} onNavigate={navigate} drawer={isPhone} open={drawerOpen} onClose={() => setMenuOpen(false)} />
      <main ref={main} className="app-main">
        {children}
      </main>
    </div>
  );
}
