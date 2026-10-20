// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithLang } from './records/testUtils.jsx';
import { LanguageProvider } from '../i18n/LanguageContext.jsx';
import { SOP_DATA } from '../data/sop-data.js';

vi.mock('../lib/publicSop.js', async (importOriginal) => ({ ...(await importOriginal()), loadSharedSop: vi.fn(), signSharedSop: vi.fn() }));
const { loadSharedSop, signSharedSop } = await import('../lib/publicSop.js');
const { default: SharedSopPage } = await import('./SharedSopPage.jsx');

const TOKEN = 'd'.repeat(64);
const SOP = SOP_DATA[0];
const FIELD = SOP.sections.flatMap((s) => s.fields)[0];
const READY = { sopId: 1, farmName: 'Green Valley Farm', values: { [FIELD.id]: 'Wash hands for 20 seconds.' } };
const setup = (lang = 'en') => {
  const user = userEvent.setup();
  renderWithLang(<SharedSopPage token={TOKEN} />, lang);
  return { user };
};

beforeEach(() => {
  loadSharedSop.mockReset();
  signSharedSop.mockReset();
  loadSharedSop.mockResolvedValue({ data: READY, error: null });
});
afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('SharedSopPage: reading', () => {
  it('shows the farm, the SOP and what the farm wrote in it', async () => {
    setup();
    expect(await screen.findByRole('heading', { level: 1, name: SOP.title })).toBeTruthy();
    expect(screen.getByText('Green Valley Farm')).toBeTruthy();
    expect(screen.getByText('Wash hands for 20 seconds.')).toBeTruthy();
    expect(screen.getByText(FIELD.label)).toBeTruthy();
    expect(loadSharedSop).toHaveBeenCalledWith(TOKEN);
  });

  it('shows only the fields that have something in them', async () => {
    setup();
    await screen.findByText('Wash hands for 20 seconds.');
    const others = SOP.sections.flatMap((s) => s.fields).filter((f) => f.id !== FIELD.id);
    for (const field of others.slice(0, 5)) expect(screen.queryByText(field.label)).toBeNull();
  });

  it('shows lists as bullets', async () => {
    const listField = SOP.sections.flatMap((s) => s.fields).find((f) => f.checkboxOptions);
    loadSharedSop.mockResolvedValue({ data: { ...READY, values: { [listField.id]: ['First', 'Second'] } }, error: null });
    setup();
    expect(await screen.findAllByRole('listitem')).toHaveLength(2);
  });

  it('says so when the SOP has not been filled in, but still lets the person sign', async () => {
    loadSharedSop.mockResolvedValue({ data: { ...READY, values: {} }, error: null });
    setup();
    expect(await screen.findByText('This procedure has not been filled in yet.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Sign' })).toBeTruthy();
  });

  it('can be read in Spanish, with the SOP’s own Spanish title', async () => {
    localStorage.clear();
    const user = userEvent.setup();
    render(<LanguageProvider><SharedSopPage token={TOKEN} /></LanguageProvider>);
    await screen.findByRole('heading', { level: 1 });
    await user.click(screen.getByRole('button', { name: 'Español' }));
    expect(screen.getByRole('button', { name: 'English' })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1 }).textContent).not.toBe(SOP.title);
    expect(screen.getByRole('button', { name: 'Firmar' })).toBeTruthy();
  });

  it('says the link is not valid, with no way to try again', async () => {
    loadSharedSop.mockResolvedValue({ data: null, error: { code: 'invalid' } });
    setup();
    expect((await screen.findByRole('alert')).textContent).toContain('This link is not valid any more');
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Sign' })).toBeNull();
  });

  it('says so, and tries again on request, when the page could not be loaded', async () => {
    loadSharedSop.mockResolvedValueOnce({ data: null, error: { code: 'unknown' } });
    const { user } = setup();
    expect((await screen.findByRole('alert')).textContent).toContain('could not be loaded');
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('heading', { level: 1 })).toBeTruthy();
  });

  it('says when too many people are using it', async () => {
    loadSharedSop.mockResolvedValue({ data: null, error: { code: 'busy' } });
    setup();
    expect((await screen.findByRole('alert')).textContent).toContain('Too many people');
  });
});

describe('SharedSopPage: signing', () => {
  const fill = async (user, { name = 'Maria Lopez', agree = true } = {}) => {
    await screen.findByRole('heading', { level: 1 });
    if (name) await user.type(screen.getByLabelText('Your name'), name);
    if (agree) await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Sign' }));
  };

  it('sends the name, the confirmation and the language, and thanks the person', async () => {
    signSharedSop.mockResolvedValue({ data: { ok: true }, error: null });
    const { user } = setup();
    await fill(user, { name: '  Maria   Lopez ' });
    expect(signSharedSop).toHaveBeenCalledWith({ token: TOKEN, name: 'Maria Lopez', agree: true, lang: 'en' });
    expect((await screen.findByRole('status')).textContent).toContain('Thank you, Maria Lopez.');
  });

  it('offers to sign for someone else, starting from a clean form', async () => {
    signSharedSop.mockResolvedValue({ data: { ok: true }, error: null });
    const { user } = setup();
    await fill(user);
    await user.click(await screen.findByRole('button', { name: 'Sign for someone else' }));
    expect(screen.getByLabelText('Your name').value).toBe('');
    expect(screen.getByRole('checkbox').checked).toBe(false);
  });

  it('asks for a name, and for the confirmation, before sending anything', async () => {
    const { user } = setup();
    await fill(user, { name: '', agree: true });
    expect((await screen.findByRole('alert')).textContent).toContain('Type your name');
    await user.type(screen.getByLabelText('Your name'), 'Ana');
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Sign' }));
    expect((await screen.findByRole('alert')).textContent).toContain('Check the box');
    expect(signSharedSop).not.toHaveBeenCalled();
  });

  it('says so when the sign-off could not be sent, and keeps what was typed', async () => {
    signSharedSop.mockResolvedValue({ data: null, error: { code: 'unknown' } });
    const { user } = setup();
    await fill(user);
    expect((await screen.findByRole('alert')).textContent).toContain('could not be sent');
    expect(screen.getByLabelText('Your name').value).toBe('Maria Lopez');
    expect(screen.getByRole('button', { name: 'Sign' }).disabled).toBe(false);
  });

  it('turns the button off while sending', async () => {
    let finish;
    signSharedSop.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    const { user } = setup();
    await fill(user);
    expect(screen.getByRole('button', { name: 'Sending…' }).disabled).toBe(true);
    finish({ data: { ok: true }, error: null });
    await waitFor(() => expect(screen.getByRole('status')).toBeTruthy());
  });

  it('signs in Spanish when the page is read in Spanish', async () => {
    signSharedSop.mockResolvedValue({ data: { ok: true }, error: null });
    const { user } = setup('es');
    await screen.findByRole('heading', { level: 1 });
    await user.type(screen.getByLabelText('Tu nombre'), 'Maria');
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Firmar' }));
    expect(signSharedSop).toHaveBeenCalledWith(expect.objectContaining({ lang: 'es' }));
    expect((await screen.findByRole('status')).textContent).toContain('Gracias, Maria.');
  });
});
