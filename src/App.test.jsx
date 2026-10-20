// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('./lib/useFarmAccount.js', () => ({ default: vi.fn() }));
vi.mock('./components/records/useRecordsMeta.js', () => ({ default: vi.fn() }));
vi.mock('./lib/reportData.js', () => ({ listRecordsForReport: vi.fn() }));
vi.mock('./lib/fields.js', () => ({ listFields: vi.fn() }));
vi.mock('./lib/records.js', () => ({ createRecord: vi.fn(), updateRecord: vi.fn() }));
const { default: useFarmAccount } = await import('./lib/useFarmAccount.js');
const { default: useRecordsMeta } = await import('./components/records/useRecordsMeta.js');
const { listRecordsForReport } = await import('./lib/reportData.js');
const { listFields } = await import('./lib/fields.js');
const { default: App } = await import('./App.jsx');

const signedIn = (overrides = {}) => ({
  status: 'ready',
  account: { user: { id: 'u1', name: 'Ana Diaz' }, farm: { id: 'farm-1', name: 'Sunny' }, role: 'manager' },
  data: { farm_profile: { farm_name: 'Green Valley Farm' }, incidents: [], cost_settings: {}, sop_activity_records: [] },
  saveStatus: 'saved',
  importOffer: null,
  importResult: { imported: [], kept: [], failed: [] },
  mergedNotice: false,
  justSignedIn: false,
  setValue: vi.fn(),
  signOut: vi.fn(),
  ...overrides,
});

beforeEach(() => {
  localStorage.clear();
  Element.prototype.scrollIntoView = vi.fn();
  useFarmAccount.mockReturnValue(signedIn());
  useRecordsMeta.mockReturnValue({ role: 'manager', savedViews: [], needsReviewCount: 2, reviewKnown: true, ready: true, refresh: vi.fn() });
  listRecordsForReport.mockResolvedValue({ data: { records: [], truncated: false }, error: null });
  listFields.mockResolvedValue({ data: [], error: null });
});
afterEach(cleanup);

describe('App', () => {
  it('opens on the home page, with the short menu', async () => {
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Green Valley Farm' })).toBeTruthy();
    const menu = within(screen.getByRole('navigation', { name: 'Main' }));
    expect(menu.getByRole('button', { name: /^Needs review/ })).toBeTruthy();
    expect(menu.queryByText(/Violation|Economic/)).toBeNull();
  });

  it('moves between home, the records pages and the SOP library from the menu', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('heading', { name: 'Green Valley Farm' });

    await user.click(screen.getByRole('button', { name: /^All records/ }));
    expect(await screen.findByRole('heading', { name: 'Records' })).toBeTruthy();

    await user.click(screen.getByRole('button', { name: /^Training due/ }));
    expect(await screen.findByRole('heading', { name: 'Training due' })).toBeTruthy();

    await user.click(screen.getByRole('button', { name: /^SOPs & plan/ }));
    expect(await screen.findByRole('heading', { name: 'SOPs & plan' })).toBeTruthy();

    await user.click(screen.getByRole('button', { name: /^Home/ }));
    expect(await screen.findByRole('heading', { name: 'Green Valley Farm' })).toBeTruthy();
  });

  it('opens a SOP from the library and comes back to the library', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByRole('button', { name: /^SOPs & plan/ }));
    await user.click((await screen.findAllByRole('button', { name: /Handwashing/i }))[0]);
    await user.click(await screen.findByRole('button', { name: /Back/ }));
    expect(await screen.findByRole('heading', { name: 'SOPs & plan' })).toBeTruthy();
  });

  it('offers the general assistant everywhere except inside a SOP, which has its own beside the form', async () => {
    const user = userEvent.setup();
    render(<App />);
    expect(await screen.findByTitle('Chat with Jimmy')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: /^SOPs & plan/ }));
    expect(screen.getByTitle('Chat with Jimmy')).toBeTruthy();
    await user.click((await screen.findAllByRole('button', { name: /Handwashing/i }))[0]);
    await screen.findByRole('button', { name: /Back/ });
    expect(screen.queryByTitle('Chat with Jimmy')).toBeNull();
    await user.click(screen.getByRole('button', { name: /Back/ }));
    expect(await screen.findByTitle('Chat with Jimmy')).toBeTruthy();
  });

  it('saves what an owner or manager writes in a SOP with the farm, next to the other SOPs', async () => {
    const account = signedIn({ data: { farm_profile: { farm_name: 'Green Valley Farm' }, sop_forms: { 5: { farm_name: 'Other SOP' } } } });
    useFarmAccount.mockReturnValue(account);
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByRole('button', { name: /^SOPs & plan/ }));
    await user.click((await screen.findAllByRole('button', { name: /Handwashing/i }))[0]);
    await screen.findByRole('button', { name: /Back/ });
    fireEvent.change(document.getElementById('field-prepared_by').querySelector('input, textarea'), { target: { value: 'Maria' } });
    expect(account.setValue).toHaveBeenCalledTimes(1);
    const [key, update] = account.setValue.mock.calls[0];
    expect(key).toBe('sop_forms');
    expect(update({ 5: { farm_name: 'Other SOP' } })).toEqual({ 5: { farm_name: 'Other SOP' }, 1: expect.objectContaining({ prepared_by: 'Maria' }) });
  });

  it('does not try to save what crew write in a SOP, because only owners and managers can', async () => {
    const account = signedIn({ account: { user: { id: 'u1', name: 'Crew' }, farm: { id: 'farm-1', name: 'Sunny' }, role: 'crew' } });
    useFarmAccount.mockReturnValue(account);
    useRecordsMeta.mockReturnValue({ role: 'crew', savedViews: [], needsReviewCount: 0, ready: true, refresh: vi.fn() });
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByRole('button', { name: /^SOPs & plan/ }));
    await user.click((await screen.findAllByRole('button', { name: /Handwashing/i }))[0]);
    await screen.findByRole('button', { name: /Back/ });
    fireEvent.change(document.getElementById('field-prepared_by').querySelector('input, textarea'), { target: { value: 'Maria' } });
    expect(account.setValue).not.toHaveBeenCalled();
  });

  it('explains that the farm is not set up yet, with a way to try again, instead of showing the library as home', async () => {
    const account = signedIn({ account: { user: { id: 'u1', name: 'Ana Diaz' }, farm: null, role: null }, retryLoad: vi.fn() });
    useFarmAccount.mockReturnValue(account);
    useRecordsMeta.mockReturnValue({ role: null, savedViews: [], needsReviewCount: 0, reviewKnown: false, ready: true, refresh: vi.fn() });
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByRole('button', { name: 'Try again' }));
    expect(account.retryLoad).toHaveBeenCalled();
  });

  it('opens the farm food safety plan from the library', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByRole('button', { name: /^SOPs & plan/ }));
    await user.click(await screen.findByRole('button', { name: /Farm food safety plan/ }));
    expect(await screen.findByRole('heading', { name: /Food Safety Plan Generator/ })).toBeTruthy();
  });

  it('signs out from the menu', async () => {
    const account = signedIn();
    useFarmAccount.mockReturnValue(account);
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByRole('button', { name: 'Sign out' }));
    expect(account.signOut).toHaveBeenCalled();
  });

  it('shows the sign-in screen when signed out, and nothing while checking', () => {
    useFarmAccount.mockReturnValue({ status: 'checking' });
    const { container, rerender } = render(<App />);
    expect(container.querySelector('nav')).toBeNull();
    useFarmAccount.mockReturnValue({ status: 'signed-out' });
    rerender(<App />);
    expect(screen.queryByRole('navigation', { name: 'Main' })).toBeNull();
  });
});
