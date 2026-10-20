// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LanguageContext } from '../i18n/LanguageContext.jsx';
import Sidebar from './Sidebar.jsx';

const setup = (props = {}, lang = 'en') => {
  const handlers = { onNavigate: vi.fn(), onOpenProfile: vi.fn(), onLogout: vi.fn() };
  const toggleLang = vi.fn();
  const user = userEvent.setup();
  render(
    <LanguageContext.Provider value={{ lang, toggleLang }}>
      <Sidebar activePage="home" currentUser={{ name: 'Ana Diaz' }} farmProfile={null} needsReviewCount={0} {...handlers} {...props} />
    </LanguageContext.Provider>,
  );
  return { user, toggleLang, ...handlers };
};
afterEach(cleanup);

const menuLabels = () => within(screen.getByRole('navigation', { name: 'Main' })).getAllByRole('button').map((b) => b.textContent.replace(/\d+\+?$/, ''));

describe('Sidebar', () => {
  it('is short: eight pages, a farm profile button, the language and sign out, and nothing to open or close', () => {
    setup();
    expect(menuLabels()).toEqual(['ES', 'Home', 'All records', 'Needs review', 'Fields', 'Training due', 'Trace & recall', 'Reports', 'SOPs & plan', 'Farm profile', 'Sign out']);
    expect(screen.getAllByRole('button').some((b) => b.hasAttribute('aria-expanded'))).toBe(false);
  });

  it('goes to each page', async () => {
    const { user, onNavigate } = setup();
    for (const name of ['Home', 'All records', 'Needs review', 'Fields', 'Training due', 'Trace & recall', 'Reports', 'SOPs & plan']) {
      await user.click(screen.getByRole('button', { name: new RegExp(`^${name}`) }));
    }
    expect(onNavigate.mock.calls.map((c) => c[0])).toEqual(['home', 'farmRecords', 'needsReview', 'recordFields', 'recordTraining', 'recordTrace', 'recordReports', 'sops']);
  });

  it('marks the page that is open', () => {
    setup({ activePage: 'recordFields' });
    expect(screen.getByRole('button', { name: /^Fields/ }).getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('button', { name: /^Home/ }).getAttribute('aria-current')).toBeNull();
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

  it('shows the farm’s name on the profile button once there is one', async () => {
    const { user, onOpenProfile } = setup({ farmProfile: { farm_name: 'Green Valley Farm' } });
    await user.click(screen.getByRole('button', { name: 'Green Valley Farm' }));
    expect(onOpenProfile).toHaveBeenCalled();
  });

  it('shows who is signed in, and signs out', async () => {
    const { user, onLogout } = setup();
    expect(screen.getByText('Ana Diaz')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(onLogout).toHaveBeenCalled();
  });

  it('switches language', async () => {
    const { user, toggleLang } = setup();
    await user.click(screen.getByRole('button', { name: 'Switch to Spanish' }));
    expect(toggleLang).toHaveBeenCalled();
  });

  it('speaks Spanish', () => {
    setup({}, 'es');
    expect(menuLabels()).toEqual(['EN', 'Inicio', 'Todos los registros', 'Por revisar', 'Campos', 'Capacitación pendiente', 'Rastreo y retiro', 'Informes', 'POEs y plan', 'Perfil de la granja', 'Cerrar sesión']);
  });
});
