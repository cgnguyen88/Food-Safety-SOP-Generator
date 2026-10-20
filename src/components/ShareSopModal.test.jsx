// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithLang } from './records/testUtils.jsx';

vi.mock('../lib/sopShares.js', async (importOriginal) => ({ ...(await importOriginal()), getShare: vi.fn(), createShare: vi.fn(), turnOffShare: vi.fn() }));
const { getShare, createShare, turnOffShare } = await import('../lib/sopShares.js');
const { default: ShareSopModal } = await import('./ShareSopModal.jsx');

const TOKEN = 'b'.repeat(64);
const SHARE = { id: 'share-1', sop_id: 1, token: TOKEN };
const setup = (props = {}, lang = 'en') => {
  const onClose = vi.fn();
  const user = userEvent.setup();
  renderWithLang(<ShareSopModal farmId="farm-1" sopId={1} sopTitle="Handwashing" farmName="Green Valley Farm" filledIn onClose={onClose} {...props} />, lang);
  return { user, onClose };
};

beforeEach(() => {
  getShare.mockReset();
  createShare.mockReset();
  turnOffShare.mockReset();
  getShare.mockResolvedValue({ data: null, error: null });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('ShareSopModal: making a link', () => {
  it('warns that anyone with the link can read everything in the SOP, including names and phone numbers', async () => {
    setup();
    expect(await screen.findByText(/Anyone who has this link can read everything written in this SOP/)).toBeTruthy();
  });

  it('offers to create a link when the SOP has none', async () => {
    setup();
    expect(await screen.findByRole('button', { name: 'Create a link' })).toBeTruthy();
    expect(getShare).toHaveBeenCalledWith('farm-1', 1);
  });

  it('creates the link, then shows its address, a QR code and the buttons', async () => {
    createShare.mockResolvedValue({ data: SHARE, error: null });
    const { user } = setup();
    await user.click(await screen.findByRole('button', { name: 'Create a link' }));
    expect(createShare).toHaveBeenCalledWith('farm-1', 1);
    const field = await screen.findByLabelText('Link for workers');
    expect(field.value).toBe(`${window.location.origin}/s/${TOKEN}`);
    expect(field.readOnly).toBe(true);
    expect(document.querySelector('svg')).toBeTruthy();
    for (const name of ['Copy link', 'Print poster', 'Turn off this link']) expect(screen.getByRole('button', { name })).toBeTruthy();
  });

  it('shows the existing link straight away', async () => {
    getShare.mockResolvedValue({ data: SHARE, error: null });
    setup();
    expect((await screen.findByLabelText('Link for workers')).value).toContain(TOKEN);
    expect(screen.queryByRole('button', { name: 'Create a link' })).toBeNull();
  });

  it('says to fill the SOP in first when it is empty, but still lets a link be made', async () => {
    setup({ filledIn: false });
    expect(await screen.findByText('Fill in this SOP first, so workers have something to read.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Create a link' })).toBeTruthy();
  });

  it('says so when the link could not be looked up, or made', async () => {
    getShare.mockResolvedValue({ data: null, error: { code: 'unknown' } });
    setup();
    expect((await screen.findByRole('alert')).textContent).toBe('Something went wrong. Try again.');
    cleanup();
    getShare.mockResolvedValue({ data: null, error: null });
    createShare.mockResolvedValue({ data: null, error: { code: '42501' } });
    const { user } = setup();
    await user.click(await screen.findByRole('button', { name: 'Create a link' }));
    expect((await screen.findByRole('status')).textContent).toBe('Something went wrong. Try again.');
  });
});

describe('ShareSopModal: using a link', () => {
  beforeEach(() => getShare.mockResolvedValue({ data: SHARE, error: null }));

  it('copies the link', async () => {
    const writeText = vi.fn().mockResolvedValue();
    const { user } = setup();
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    await user.click(await screen.findByRole('button', { name: 'Copy link' }));
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/s/${TOKEN}`);
    expect((await screen.findByRole('status')).textContent).toBe('Copied');
  });

  it('says so when the link could not be copied', async () => {
    const { user } = setup();
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText: vi.fn().mockRejectedValue(new Error('no')) } });
    await user.click(await screen.findByRole('button', { name: 'Copy link' }));
    expect((await screen.findByRole('status')).textContent).toMatch(/Could not copy/);
  });

  it('prints a poster in its own window, with the farm, the SOP and the QR code', async () => {
    const popup = { document: { open: vi.fn(), write: vi.fn(), close: vi.fn() }, focus: vi.fn(), print: vi.fn() };
    vi.spyOn(window, 'open').mockReturnValue(popup);
    const { user } = setup();
    await user.click(await screen.findByRole('button', { name: 'Print poster' }));
    const html = popup.document.write.mock.calls[0][0];
    for (const text of ['Green Valley Farm', 'Handwashing', '<svg', 'Scan to read this procedure']) expect(html).toContain(text);
    expect(html).not.toContain(TOKEN);
    expect(popup.print).toHaveBeenCalled();
  });

  it('says so when the browser blocks the poster window', async () => {
    vi.spyOn(window, 'open').mockReturnValue(null);
    const { user } = setup();
    await user.click(await screen.findByRole('button', { name: 'Print poster' }));
    expect((await screen.findByRole('status')).textContent).toMatch(/blocked the poster window/);
  });

  it('turns the link off after asking, and then offers a new one', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    turnOffShare.mockResolvedValue({ data: null, error: null });
    const { user } = setup();
    await user.click(await screen.findByRole('button', { name: 'Turn off this link' }));
    expect(turnOffShare).toHaveBeenCalledWith('share-1');
    expect(await screen.findByText('The link is off. Create a new one when you need it.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Create a link' })).toBeTruthy();
    expect(screen.queryByLabelText('Link for workers')).toBeNull();
  });

  it('does not turn it off when the person says no', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const { user } = setup();
    await user.click(await screen.findByRole('button', { name: 'Turn off this link' }));
    expect(turnOffShare).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Link for workers')).toBeTruthy();
  });

  it('keeps the link when turning it off fails', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    turnOffShare.mockResolvedValue({ data: null, error: { code: '42501' } });
    const { user } = setup();
    await user.click(await screen.findByRole('button', { name: 'Turn off this link' }));
    expect((await screen.findByRole('status')).textContent).toBe('Something went wrong. Try again.');
    expect(screen.getByLabelText('Link for workers')).toBeTruthy();
  });

  it('closes', async () => {
    const { user, onClose } = setup();
    await user.click(await screen.findByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('speaks Spanish', async () => {
    setup({}, 'es');
    expect(await screen.findByRole('dialog', { name: 'Compartir con los trabajadores' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Imprimir cartel' })).toBeTruthy();
  });
});
