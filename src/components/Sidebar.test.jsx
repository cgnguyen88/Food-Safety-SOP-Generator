// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LanguageContext } from '../i18n/LanguageContext.jsx';
import Sidebar from './Sidebar.jsx';

const setup = (props = {}, lang = 'en') => {
  const handlers = { onNavigate: vi.fn(), onOpenProfile: vi.fn(), onLogout: vi.fn() };
  const toggleLang = vi.fn();
  const user = userEvent.setup();
  const view = render(
    <LanguageContext.Provider value={{ lang, toggleLang }}>
      <Sidebar activePage="home" currentUser={{ name: 'Ana Diaz' }} farmProfile={null} needsReviewCount={0} {...handlers} {...props} />
    </LanguageContext.Provider>,
  );
  return { user, toggleLang, ...view, ...handlers };
};
beforeEach(() => localStorage.clear());
afterEach(cleanup);

const names = (root) => within(root).getAllByRole('button').map((b) => b.textContent.replace(/\d+\+?$/, ''));
const section = (title) => screen.getByRole('button', { name: new RegExp(`^${title}`) }).closest('section');

describe('Sidebar', () => {
  it('has the app’s name and mark at the top', () => {
    const { container } = setup();
    expect(screen.getByText('FarmSafe')).toBeTruthy();
    expect(screen.getByText('UC ANR Food Safety System')).toBeTruthy();
    expect(container.querySelector('.menu-mark')).toBeTruthy();
  });

  it('is two pages and two sections: Home and SOPs & plan, then Records and Traceability, each a card that opens and closes', () => {
    setup();
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(names(nav)).toEqual(['Home', 'SOPs & plan', 'Records', 'All records', 'Needs review', 'Fields', 'Water sources', 'Training due', 'Traceability', 'Trace & recall', 'Reports']);
    expect(names(section('Records')).slice(1)).toEqual(['All records', 'Needs review', 'Fields', 'Water sources', 'Training due']);
    expect(names(section('Traceability')).slice(1)).toEqual(['Trace & recall', 'Reports']);
    expect(screen.getByRole('button', { name: /^Records/ }).getAttribute('aria-expanded')).toBe('true');
  });

  it('closes a section from its heading, and shows how many pages are inside while it is closed', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: /^Records/ }));
    expect(screen.queryByRole('button', { name: /^Fields/ })).toBeNull();
    expect(within(section('Records')).getByText('5')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: /^Records/ }));
    expect(screen.getByRole('button', { name: /^Fields/ })).toBeTruthy();
  });

  it('goes to each page', async () => {
    const { user, onNavigate } = setup();
    for (const name of ['Home', 'All records', 'Needs review', 'Fields', 'Water sources', 'Training due', 'Trace & recall', 'Reports', 'SOPs & plan']) {
      await user.click(screen.getByRole('button', { name: new RegExp(`^${name}`) }));
    }
    expect(onNavigate.mock.calls.map((c) => c[0])).toEqual(['home', 'farmRecords', 'needsReview', 'recordFields', 'recordWater', 'recordTraining', 'recordTrace', 'recordReports', 'sops']);
  });

  it('marks the page that is open', () => {
    setup({ activePage: 'recordFields' });
    expect(screen.getByRole('button', { name: /^Fields/ }).getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('button', { name: /^Home/ }).getAttribute('aria-current')).toBeNull();
  });

  it('keeps the section of the open page open, even if it was closed before', () => {
    localStorage.setItem('farmsafe_menu_section_traceability', 'false');
    setup({ activePage: 'recordReports' });
    expect(screen.getByRole('button', { name: /^Reports/ }).getAttribute('aria-current')).toBe('page');
  });

  it('lets the section of the open page be closed, and keeps it closed while moving about inside it', async () => {
    const { user, rerender } = setup({ activePage: 'recordFields' });
    await user.click(screen.getByRole('button', { name: /^Records/ }));
    expect(screen.getByRole('button', { name: /^Records/ }).getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('button', { name: /^Fields/ })).toBeNull();
    rerender(
      <LanguageContext.Provider value={{ lang: 'en', toggleLang: () => {} }}>
        <Sidebar activePage="needsReview" currentUser={{ name: 'Ana Diaz' }} farmProfile={null} needsReviewCount={0} onNavigate={() => {}} onOpenProfile={() => {}} onLogout={() => {}} />
      </LanguageContext.Provider>,
    );
    expect(screen.getByRole('button', { name: /^Records/ }).getAttribute('aria-expanded')).toBe('false');
  });

  it.each(['log:harvest', 'view:abc', 'changeHistory'])('keeps "All records" marked on %s', (page) => {
    setup({ activePage: page });
    expect(screen.getByRole('button', { name: /^All records/ }).getAttribute('aria-current')).toBe('page');
  });

  it.each(['sops', 'sop', 'plan_generator'])('keeps "SOPs & plan" marked on %s', (page) => {
    setup({ activePage: page });
    expect(screen.getByRole('button', { name: /^SOPs & plan/ }).getAttribute('aria-current')).toBe('page');
  });

  it('shows how many records are waiting for review', () => {
    setup({ needsReviewCount: 4 });
    expect(within(screen.getByRole('button', { name: /^Needs review/ })).getByText('4')).toBeTruthy();
  });

  it('shows the farm’s name on the profile button once there is one, and opens the profile', async () => {
    const { user, onOpenProfile } = setup({ farmProfile: { farm_name: 'Green Valley Farm' } });
    await user.click(screen.getByRole('button', { name: 'Green Valley Farm' }));
    expect(onOpenProfile).toHaveBeenCalled();
  });

  it('says Farm profile until there is a farm name', () => {
    setup();
    expect(screen.getByRole('button', { name: 'Farm profile' })).toBeTruthy();
  });

  it('shows who is signed in, with their initials, and signs out', async () => {
    const { user, onLogout, container } = setup();
    expect(screen.getByText('Ana Diaz')).toBeTruthy();
    expect(container.querySelector('.menu-avatar').textContent).toBe('AD');
    await user.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(onLogout).toHaveBeenCalled();
  });

  it('shows nobody when no one is signed in', () => {
    setup({ currentUser: null });
    expect(screen.queryByRole('button', { name: 'Sign out' })).toBeNull();
  });

  it('chooses the language from a two-way switch, showing the one in use', async () => {
    const { user, toggleLang } = setup();
    const group = screen.getByRole('group', { name: 'Language' });
    expect(within(group).getByRole('button', { name: 'EN' }).getAttribute('aria-pressed')).toBe('true');
    expect(within(group).getByRole('button', { name: 'ES' }).getAttribute('aria-pressed')).toBe('false');
    await user.click(within(group).getByRole('button', { name: 'EN' }));
    expect(toggleLang).not.toHaveBeenCalled();
    await user.click(within(group).getByRole('button', { name: 'ES' }));
    expect(toggleLang).toHaveBeenCalledTimes(1);
  });

  it('speaks Spanish', () => {
    setup({}, 'es');
    const nav = screen.getByRole('navigation', { name: 'Principal' });
    expect(names(nav)).toEqual(['Inicio', 'POEs y plan', 'Registros', 'Todos los registros', 'Por revisar', 'Campos', 'Fuentes de agua', 'Capacitación pendiente', 'Trazabilidad', 'Rastreo y retiro', 'Informes']);
    expect(screen.getByRole('group', { name: 'Idioma' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Perfil de la granja' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Cerrar sesión' })).toBeTruthy();
  });
});

describe('Sidebar as a drawer on a phone', () => {
  const drawer = (open, onClose = vi.fn()) => setup({ drawer: true, open, onClose });

  it('is out of reach while closed, and its close button takes focus when it opens', () => {
    const closed = drawer(false);
    const menu = document.getElementById('app-menu');
    expect(menu.hasAttribute('inert')).toBe(true);
    expect(menu.getAttribute('aria-hidden')).toBe('true');
    expect(closed.container.querySelector('.menu-scrim')).toBeNull();
    closed.unmount();
    drawer(true);
    expect(document.getElementById('app-menu').hasAttribute('inert')).toBe(false);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Close menu' }));
  });

  it('closes from the close button and from the dimmed page', async () => {
    const onClose = vi.fn();
    const { user, container } = drawer(true, onClose);
    await user.click(screen.getByRole('button', { name: 'Close menu' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    await user.click(container.querySelector('.menu-scrim'));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('has no close button on a computer', () => {
    setup();
    expect(screen.queryByRole('button', { name: 'Close menu' })).toBeNull();
  });
});
