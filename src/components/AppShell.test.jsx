// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, cleanup, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithLang } from './records/testUtils.jsx';
import AppShell from './AppShell.jsx';

const SIDEBAR = { currentUser: { name: 'Ana Reyes' }, farmProfile: null, onOpenProfile: () => {}, onLogout: () => {} };

function screenIsPhone(isPhone) {
  vi.stubGlobal('matchMedia', (query) => ({ media: query, matches: isPhone, addEventListener: () => {}, removeEventListener: () => {} }));
}

function renderShell({ activePage = 'home', onNavigate = vi.fn(), lang = 'en' } = {}) {
  const view = renderWithLang(
    <AppShell activePage={activePage} onNavigate={onNavigate} sidebar={SIDEBAR}>
      <p>Page content</p>
    </AppShell>,
    lang,
  );
  return { ...view, onNavigate };
}

const mainMenu = () => screen.queryByRole('navigation', { name: 'Main' });

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('AppShell on a computer', () => {
  it('shows the side menu beside the page and no menu button', () => {
    screenIsPhone(false);
    renderShell();
    expect(mainMenu()).toBeTruthy();
    expect(screen.getByText('Page content')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Open menu' })).toBeNull();
    expect(screen.queryByRole('banner')).toBeNull();
  });
});

describe('AppShell on a phone', () => {
  beforeEach(() => screenIsPhone(true));

  it('shows a top bar with a menu button and the name of the page, and keeps the menu closed', () => {
    renderShell({ activePage: 'recordTraining' });
    expect(screen.getByRole('button', { name: 'Open menu' }).getAttribute('aria-expanded')).toBe('false');
    expect(screen.getByRole('banner').textContent).toContain('Training due');
    expect(mainMenu()).toBeNull();
    expect(document.getElementById('app-menu').hasAttribute('inert')).toBe(true);
  });

  it.each([
    ['home', 'Home'],
    ['farmRecords', 'All records'],
    ['log:harvest', 'Harvest Log'],
    ['changeHistory', 'Change history'],
    ['sop', 'SOPs & plan'],
    ['view:abc', 'FarmSafe'],
  ])('names the %s page %s in the top bar', (page, title) => {
    renderShell({ activePage: page });
    expect(screen.getByRole('banner').textContent).toContain(title);
  });

  it('opens the menu as a drawer over the page, with a way to close it', async () => {
    const user = userEvent.setup();
    renderShell();
    await user.click(screen.getByRole('button', { name: 'Open menu' }));
    expect(mainMenu()).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Open menu' }).getAttribute('aria-expanded')).toBe('true');
    expect(document.getElementById('app-menu').hasAttribute('inert')).toBe(false);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Close menu' }));
    await user.click(screen.getByRole('button', { name: 'Close menu' }));
    expect(mainMenu()).toBeNull();
  });

  it('goes to the page chosen in the menu and closes the menu', async () => {
    const user = userEvent.setup();
    const { onNavigate } = renderShell();
    await user.click(screen.getByRole('button', { name: 'Open menu' }));
    await user.click(screen.getByRole('button', { name: 'Fields' }));
    expect(onNavigate).toHaveBeenCalledWith('recordFields');
    expect(mainMenu()).toBeNull();
  });

  it('closes the menu with Escape and puts the focus back on the menu button', async () => {
    const user = userEvent.setup();
    renderShell();
    await user.click(screen.getByRole('button', { name: 'Open menu' }));
    await user.keyboard('{Escape}');
    expect(mainMenu()).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Open menu' }));
  });

  it('puts the page and the top bar out of reach while the menu is open, and back when it closes', async () => {
    const user = userEvent.setup();
    renderShell();
    expect(screen.getByRole('main').hasAttribute('inert')).toBe(false);
    await user.click(screen.getByRole('button', { name: 'Open menu' }));
    expect(screen.getByRole('main').hasAttribute('inert')).toBe(true);
    expect(document.querySelector('.mobile-topbar').hasAttribute('inert')).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Close menu' }));
    expect(screen.getByRole('main').hasAttribute('inert')).toBe(false);
    expect(document.querySelector('.mobile-topbar').hasAttribute('inert')).toBe(false);
  });

  it.each([
    ['the close button', async (user) => user.click(screen.getByRole('button', { name: 'Close menu' }))],
    ['the dimmed page', async (user) => user.click(document.querySelector('.menu-scrim'))],
    ['choosing a page', async (user) => user.click(screen.getByRole('button', { name: 'Fields' }))],
  ])('puts the focus back on the menu button when the menu is closed with %s', async (_label, close) => {
    const user = userEvent.setup();
    renderShell();
    await user.click(screen.getByRole('button', { name: 'Open menu' }));
    await close(user);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Open menu' }));
  });

  it('does not bring an open menu back when the window goes wide and then narrow again', async () => {
    const user = userEvent.setup();
    let listener = () => {};
    let phone = true;
    vi.stubGlobal('matchMedia', (query) => ({ media: query, get matches() { return phone; }, addEventListener: (_t, fn) => { listener = fn; }, removeEventListener: () => {} }));
    renderShell();
    await user.click(screen.getByRole('button', { name: 'Open menu' }));
    expect(mainMenu()).toBeTruthy();
    phone = false;
    act(() => listener());
    phone = true;
    act(() => listener());
    expect(mainMenu()).toBeNull();
  });

  it('closes the menu when the dimmed page behind it is tapped', async () => {
    const user = userEvent.setup();
    renderShell();
    await user.click(screen.getByRole('button', { name: 'Open menu' }));
    await user.click(document.querySelector('.menu-scrim'));
    expect(mainMenu()).toBeNull();
  });

  it('speaks Spanish in a Spanish app', () => {
    renderShell({ lang: 'es' });
    expect(screen.getByRole('button', { name: 'Abrir menú' })).toBeTruthy();
    expect(screen.getByRole('banner').textContent).toContain('Inicio');
  });

  it('names the menu in Spanish too', async () => {
    const user = userEvent.setup();
    renderShell({ lang: 'es' });
    await user.click(screen.getByRole('button', { name: 'Abrir menú' }));
    expect(screen.getByRole('navigation', { name: 'Principal' })).toBeTruthy();
  });
});

describe('AppShell: moving between pages', () => {
  it('starts each new page at the top', () => {
    screenIsPhone(false);
    const { rerender } = renderShell({ activePage: 'home' });
    const main = screen.getByRole('main');
    main.scrollTop = 500;
    rerender(<AppShell activePage="sops" onNavigate={() => {}} sidebar={SIDEBAR}><p>Page content</p></AppShell>);
    expect(main.scrollTop).toBe(0);
  });
});
