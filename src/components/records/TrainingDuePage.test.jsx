// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, cleanup, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithLang } from './testUtils.jsx';

vi.mock('../../lib/records.js', () => ({ createRecord: vi.fn(), updateRecord: vi.fn() }));
vi.mock('../../lib/reportData.js', () => ({ listRecordsForReport: vi.fn() }));
const { createRecord } = await import('../../lib/records.js');
const { listRecordsForReport } = await import('../../lib/reportData.js');
const { default: TrainingDuePage } = await import('./TrainingDuePage.jsx');

let n = 0;
const training = (topic, attendees, date) => ({ id: `t${(n += 1)}`, kind: 'training', status: 'approved', record_date: date, created_at: `${date}T09:00:00Z`, payload: { topic, trainer: 'Ana', attendees } });
const RECORDS = [
  training('Handwashing', 'Maria Lopez\nJose Ruiz', '2025-06-01'), // overdue
  training('Handwashing', 'Ana Diaz', '2025-11-01'), // due soon (due 2026-11-01)
  training('Field hygiene', 'Maria Lopez', '2026-09-01'), // up to date
];
const ok = (records, truncated = false) => ({ data: { records, truncated }, error: null });
const setup = (props = {}, lang = 'en') => {
  const user = userEvent.setup();
  renderWithLang(<TrainingDuePage farm={{ id: 'farm-1' }} role="manager" today="2026-10-19" {...props} />, lang);
  return { user };
};

beforeEach(() => {
  createRecord.mockReset();
  listRecordsForReport.mockReset();
  listRecordsForReport.mockResolvedValue(ok(RECORDS));
});
afterEach(cleanup);

describe('TrainingDuePage', () => {
  it('asks for the approved training records of this farm', async () => {
    setup();
    await screen.findByRole('heading', { name: 'Training due' });
    await waitFor(() => expect(listRecordsForReport).toHaveBeenCalledWith(expect.objectContaining({ farmId: 'farm-1', kinds: ['training'], includeUnapproved: false })));
  });

  it('counts the people overdue, due soon and up to date', async () => {
    setup();
    expect(await screen.findByText('2 overdue')).toBeTruthy();
    expect(screen.getByText('1 due soon')).toBeTruthy();
    expect(screen.getByText('1 up to date')).toBeTruthy();
  });

  it('lists who needs attention, most overdue first, and leaves out those up to date', async () => {
    setup();
    await screen.findByText('2 overdue');
    const rows = screen.getAllByRole('row').slice(1).map((row) => within(row).getAllByRole('cell').map((c) => c.textContent).slice(0, 5));
    expect(rows).toEqual([
      ['Jose Ruiz', 'Handwashing', '2025-06-01', '2026-06-01 (140 days ago)', 'Overdue'],
      ['Maria Lopez', 'Handwashing', '2025-06-01', '2026-06-01 (140 days ago)', 'Overdue'],
      ['Ana Diaz', 'Handwashing', '2025-11-01', '2026-11-01 (in 13 days)', 'Due soon'],
    ]);
  });

  it('can show everyone', async () => {
    const { user } = setup();
    await screen.findByText('2 overdue');
    await user.selectOptions(screen.getByLabelText('Show'), 'all');
    expect(screen.getAllByRole('row')).toHaveLength(5);
    expect(screen.getByText('Up to date', { selector: 'span:not(:has(*))' })).toBeTruthy();
  });

  it('says so when nobody needs training', async () => {
    listRecordsForReport.mockResolvedValue(ok([training('Handwashing', 'Ana', '2026-09-01')]));
    setup();
    expect(await screen.findByText('No one needs training right now.')).toBeTruthy();
  });

  it('explains what to do when there is no training yet', async () => {
    listRecordsForReport.mockResolvedValue(ok([]));
    setup();
    expect(await screen.findByText(/No training has been recorded yet/)).toBeTruthy();
  });

  it('says so, and tries again on request, when the records could not be read', async () => {
    listRecordsForReport.mockResolvedValueOnce({ data: null, error: { code: 'unknown' } });
    const { user } = setup();
    expect((await screen.findByRole('alert')).textContent).toMatch(/could not be loaded/);
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('2 overdue')).toBeTruthy();
  });

  it('warns when there were too many records to read them all', async () => {
    listRecordsForReport.mockResolvedValue(ok(RECORDS, true));
    setup();
    expect((await screen.findByRole('status')).textContent).toMatch(/very large number/);
  });

  it('starts a training record for that person and topic, and reads the list again once it is saved', async () => {
    createRecord.mockResolvedValue({ data: { id: 'new' }, error: null });
    const { user } = setup();
    await user.click(await screen.findByRole('button', { name: 'Record training again: Ana Diaz, Handwashing' }));
    expect(screen.getByRole('dialog', { name: 'Add training' })).toBeTruthy();
    expect(screen.getByLabelText(/^Topic/).value).toBe('Handwashing');
    expect(screen.getByLabelText(/^People trained/).value).toBe('Ana Diaz');
    await user.type(screen.getByLabelText(/^Trainer/), 'Ana');
    const calls = listRecordsForReport.mock.calls.length;
    await user.click(screen.getByRole('button', { name: 'Save & approve' }));
    await waitFor(() => expect(listRecordsForReport.mock.calls.length).toBeGreaterThan(calls));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('starts an empty training record from the add button', async () => {
    const { user } = setup();
    await user.click(await screen.findByRole('button', { name: 'Record training' }));
    expect(screen.getByLabelText(/^Topic/).value).toBe('');
  });

  it('speaks Spanish', async () => {
    setup({}, 'es');
    expect(await screen.findByRole('heading', { name: 'Capacitación pendiente' })).toBeTruthy();
    expect(await screen.findByText('2 vencidas')).toBeTruthy();
    expect(screen.getByText('1 por vencer')).toBeTruthy();
  });
});
