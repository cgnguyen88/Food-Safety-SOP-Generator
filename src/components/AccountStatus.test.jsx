// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LanguageContext } from '../i18n/LanguageContext.jsx';
import { AccountMessage, ImportNotice, ImportOffer, MergedNotice, SaveIndicator } from './AccountStatus.jsx';

const inLang = (ui, lang = 'en') => render(<LanguageContext.Provider value={{ lang, toggleLang: () => {} }}>{ui}</LanguageContext.Provider>);

afterEach(cleanup);

describe('AccountMessage', () => {
  it('says the farm is loading', () => {
    inLang(<AccountMessage kind="loading" />);
    expect(screen.getByRole('status').textContent).toMatch(/loading your farm/i);
  });

  it('shows the error with a way to try again and to sign out', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    const onSignOut = vi.fn();
    inLang(<AccountMessage kind="error" message="Could not load your farm." onRetry={onRetry} onSignOut={onSignOut} />);
    expect(screen.getByRole('alert').textContent).toContain('Could not load your farm.');
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    await user.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(onRetry).toHaveBeenCalledOnce();
    expect(onSignOut).toHaveBeenCalledOnce();
  });

  it('speaks Spanish', () => {
    inLang(<AccountMessage kind="error" message="x" onRetry={() => {}} onSignOut={() => {}} />, 'es');
    expect(screen.getByRole('button', { name: 'Intentar de nuevo' })).toBeTruthy();
  });
});

describe('ImportNotice', () => {
  it('shows nothing when nothing was copied or failed', () => {
    const { container } = inLang(<ImportNotice result={{ imported: [], kept: [], failed: [] }} onDismiss={() => {}} />);
    expect(container.textContent).toBe('');
  });

  it('says what was copied from this browser, and can be closed', async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    inLang(<ImportNotice result={{ imported: ['incidents', 'farm_profile'], kept: ['cost_settings'], failed: [] }} onDismiss={onDismiss} />);
    const notice = screen.getByRole('status');
    expect(notice.textContent).toMatch(/copied.*this browser/i);
    expect(notice.textContent).toMatch(/incident log/i);
    expect(notice.textContent).toMatch(/farm profile/i);
    expect(notice.textContent).toMatch(/already had cost settings/i);
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it('says so when the account already had everything, so the browser copy only went to a backup', () => {
    inLang(<ImportNotice result={{ imported: [], kept: ['farm_profile'], failed: [] }} onDismiss={() => {}} />);
    expect(screen.getByRole('status').textContent).toMatch(/already had farm profile/i);
  });

  it('warns about data that could not be copied and stays in the browser', () => {
    inLang(<ImportNotice result={{ imported: [], kept: [], failed: ['incidents'] }} onDismiss={() => {}} />);
    expect(screen.getByRole('alert').textContent).toMatch(/incident log.*could not be copied.*next time you sign in/i);
  });
});

describe('SaveIndicator', () => {
  it('shows nothing once everything is saved', () => {
    const { container } = inLang(<SaveIndicator status={{ state: 'saved', error: null }} onRetry={() => {}} />);
    expect(container.textContent).toBe('');
  });

  it('says it is saving', () => {
    inLang(<SaveIndicator status={{ state: 'saving', error: null }} onRetry={() => {}} />);
    expect(screen.getByRole('status').textContent).toMatch(/saving/i);
  });

  it('shows a failed save with its reason and a retry button', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    inLang(<SaveIndicator status={{ state: 'error', error: 'Your changes could not be saved.' }} onRetry={onRetry} />);
    expect(screen.getByRole('alert').textContent).toContain('Your changes could not be saved.');
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});

describe('ImportOffer', () => {
  const offer = { values: { incidents: [{ id: 1 }, { id: 2 }], farm_profile: { farm_name: 'Old' } }, owner: 'old@example.com' };

  it('shows nothing without an offer', () => {
    const { container } = inLang(<ImportOffer offer={null} farmName="GV" onAccept={() => {}} onDecline={() => {}} />);
    expect(container.textContent).toBe('');
  });

  it('says what this browser holds, whose it was and which farm it would go to, and copies only when asked', async () => {
    const user = userEvent.setup();
    const onAccept = vi.fn();
    const onDecline = vi.fn();
    inLang(<ImportOffer offer={offer} farmName="Green Valley" onAccept={onAccept} onDecline={onDecline} />);
    const region = screen.getByRole('region', { name: /data saved in this browser/i });
    expect(region.textContent).toMatch(/incident log \(2\)/i);
    expect(region.textContent).toMatch(/farm profile/i);
    expect(region.textContent).toContain('old@example.com');
    expect(region.textContent).toContain('Green Valley');
    expect(onAccept).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Copy into Green Valley' }));
    await user.click(screen.getByRole('button', { name: 'Not now' }));
    expect(onAccept).toHaveBeenCalledOnce();
    expect(onDecline).toHaveBeenCalledOnce();
  });

  it('works without knowing whose it was, and in Spanish', () => {
    inLang(<ImportOffer offer={{ ...offer, owner: null }} farmName="GV" onAccept={() => {}} onDecline={() => {}} />, 'es');
    expect(screen.getByRole('button', { name: 'Copiar a GV' })).toBeTruthy();
    expect(screen.getByRole('region').textContent).not.toContain('null');
  });
});

describe('MergedNotice', () => {
  it('says changes from another device were combined, and can be closed', async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    const { rerender } = inLang(<MergedNotice show={false} onDismiss={onDismiss} />);
    expect(screen.queryByRole('status')).toBeNull();
    rerender(<LanguageContext.Provider value={{ lang: 'en', toggleLang: () => {} }}><MergedNotice show onDismiss={onDismiss} /></LanguageContext.Provider>);
    expect(screen.getByRole('status').textContent).toMatch(/another device/i);
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(onDismiss).toHaveBeenCalledOnce();
  });
});
