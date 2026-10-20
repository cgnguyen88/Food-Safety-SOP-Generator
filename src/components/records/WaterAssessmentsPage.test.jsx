// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, cleanup, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithLang } from './testUtils.jsx';

vi.mock('../../lib/records.js', () => ({ createRecord: vi.fn(), updateRecord: vi.fn() }));
vi.mock('../../lib/reportData.js', () => ({ listRecordsForReport: vi.fn() }));
const { createRecord } = await import('../../lib/records.js');
const { listRecordsForReport } = await import('../../lib/reportData.js');
const { default: WaterAssessmentsPage } = await import('./WaterAssessmentsPage.jsx');

const calm = { source_concern: 'low', nearby_concern: 'low', practice_concern: 'low', crop_concern: 'low', weather_concern: 'low', testing_concern: 'low' };
let n = 0;
const assessment = (source, fields, date, extra = {}) => ({
  id: `a${(n += 1)}`, kind: 'water_assessment', status: 'approved', record_date: date, created_at: `${date}T09:00:00Z`,
  payload: { source, source_type: 'enclosed_groundwater', fields_served: fields, application_method: 'drip', ...calm, conclusion: 'no_mitigation', ...extra },
});
const flood = (field, date) => ({ id: `f${(n += 1)}`, kind: 'weather_event', status: 'approved', record_date: date, created_at: `${date}T15:00:00Z`, payload: { event_type: 'flood', field, crop_contact: 'no' } });
const RECORDS = [
  assessment('Well 1', 'A1, A2', '2026-03-01', { assessed_by: 'Ana' }), // a flood on A2 came after
  flood('A2', '2026-06-10'),
  assessment('Canal', 'B1', '2025-10-01', { conclusion: 'mitigation_needed', mitigation: 'Fence the bank' }), // overdue
  assessment('Pond', 'C1', '2025-11-10'), // due soon
  assessment('Spring', 'D1', '2026-09-01'), // up to date
];
const ok = (records, truncated = false) => ({ data: { records, truncated }, error: null });
const setup = (props = {}, lang = 'en') => {
  const onChanged = vi.fn();
  const user = userEvent.setup();
  renderWithLang(<WaterAssessmentsPage farm={{ id: 'farm-1' }} role="manager" today="2026-10-19" onChanged={onChanged} {...props} />, lang);
  return { user, onChanged };
};
const rows = () => screen.getAllByRole('row').slice(1).map((row) => within(row).getAllByRole('cell').map((cell) => cell.textContent));

beforeEach(() => {
  createRecord.mockReset();
  listRecordsForReport.mockReset();
  listRecordsForReport.mockResolvedValue(ok(RECORDS));
});
afterEach(cleanup);

describe('WaterAssessmentsPage', () => {
  it('asks for the approved water assessments and floods of this farm', async () => {
    setup();
    await screen.findByRole('heading', { name: 'Water assessments' });
    await waitFor(() => expect(listRecordsForReport).toHaveBeenCalledWith(expect.objectContaining({ farmId: 'farm-1', kinds: ['weather_event', 'water_assessment'], includeUnapproved: false })));
  });

  it('says what the rule asks for, and where to check it', async () => {
    setup();
    expect(await screen.findByText(/21 CFR 112.43/)).toBeTruthy();
  });

  it('counts the sources after a flood, overdue, due soon and up to date', async () => {
    setup();
    expect(await screen.findByText('1 to assess after a flood')).toBeTruthy();
    expect(screen.getByText('1 overdue')).toBeTruthy();
    expect(screen.getByText('1 due soon')).toBeTruthy();
    expect(screen.getByText('1 up to date')).toBeTruthy();
  });

  it('lists what needs attention, a flood first, and leaves out sources that are up to date', async () => {
    setup();
    await screen.findByText('1 overdue');
    const table = rows().map((cells) => cells.slice(0, 6));
    expect(table).toEqual([
      ['Well 1', 'A1, A2', '2026-03-01', '2027-03-01 (in 133 days)', 'No measures needed', 'Assess againFlood on 2026-06-10 (A2)'],
      ['Canal', 'B1', '2025-10-01', '2026-10-01 (18 days ago)', 'Measures needed', 'Overdue'],
      ['Pond', 'C1', '2025-11-10', '2026-11-10 (in 22 days)', 'No measures needed', 'Due soon'],
    ]);
  });

  it('can show every source', async () => {
    const { user } = setup();
    await screen.findByText('1 overdue');
    await user.selectOptions(screen.getByLabelText('Show'), 'all');
    expect(rows().map((cells) => cells[0])).toEqual(['Well 1', 'Canal', 'Pond', 'Spring']);
  });

  it('says every source is up to date when none needs attention', async () => {
    listRecordsForReport.mockResolvedValue(ok([assessment('Spring', 'D1', '2026-09-01')]));
    setup();
    expect(await screen.findByText('Every water source is up to date.')).toBeTruthy();
  });

  it('explains an empty page and offers the first assessment', async () => {
    listRecordsForReport.mockResolvedValue(ok([]));
    setup();
    expect(await screen.findByText(/No water assessments yet/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'New assessment' })).toBeTruthy();
  });

  it('starts a new assessment from nothing', async () => {
    const { user } = setup();
    await screen.findByText('1 overdue');
    await user.click(screen.getByRole('button', { name: 'New assessment' }));
    expect(await screen.findByRole('dialog', { name: 'Add water assessment' })).toBeTruthy();
    expect(screen.getByLabelText(/^Water source or system/).value).toBe('');
  });

  it('starts an assessment again from the last one’s answers, with the decision left to make', async () => {
    const { user } = setup();
    await screen.findByText('1 overdue');
    await user.click(screen.getByRole('button', { name: 'Assess Well 1 again' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add water assessment' });
    expect(within(dialog).getByLabelText(/^Water source or system/).value).toBe('Well 1');
    expect(within(dialog).getByLabelText(/^Fields this water is used on/).value).toBe('A1, A2');
    expect(within(dialog).getByLabelText(/^What kind of source it is/).value).toBe('enclosed_groundwater');
    expect(within(dialog).getByLabelText(/^Assessed by/).value).toBe('Ana');
    expect(within(dialog).getByLabelText(/^What you decided/).value).toBe('');
  });

  it('reads the records again and tells the parent once an assessment is saved', async () => {
    createRecord.mockResolvedValue({ data: { id: 'new' }, error: null });
    const { user, onChanged } = setup();
    await screen.findByText('1 overdue');
    await user.click(screen.getByRole('button', { name: 'Assess Canal again' }));
    const dialog = await screen.findByRole('dialog');
    for (const label of [/^The source and how/, /^Animals, manure/, /^How the water is applied, and the time/, /^The crop/, /^The weather/, /^Water test results/]) {
      await user.selectOptions(within(dialog).getByLabelText(label), 'low');
    }
    await user.selectOptions(within(dialog).getByLabelText(/^What you decided/), 'no_mitigation');
    const calls = listRecordsForReport.mock.calls.length;
    await user.click(within(dialog).getByRole('button', { name: 'Save & approve' }));
    await waitFor(() => expect(createRecord).toHaveBeenCalledWith(expect.objectContaining({ kind: 'water_assessment' })));
    await waitFor(() => expect(listRecordsForReport.mock.calls.length).toBeGreaterThan(calls));
    expect(onChanged).toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('lets crew start an assessment too, which will wait for review', async () => {
    const { user } = setup({ role: 'crew' });
    await screen.findByText('1 overdue');
    await user.click(screen.getByRole('button', { name: 'New assessment' }));
    expect(await screen.findByRole('button', { name: 'Submit for review' })).toBeTruthy();
  });

  it('says so, and offers to try again, when the records could not be read', async () => {
    listRecordsForReport.mockResolvedValueOnce({ data: null, error: { code: 'unknown' } });
    listRecordsForReport.mockResolvedValue(ok(RECORDS));
    const { user } = setup();
    expect((await screen.findByRole('alert')).textContent).toContain('The water assessments could not be loaded.');
    expect(screen.queryByText('Every water source is up to date.')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('1 overdue')).toBeTruthy();
  });

  it('warns when there are too many records to have read them all', async () => {
    listRecordsForReport.mockResolvedValue(ok(RECORDS, true));
    setup();
    expect(await screen.findByRole('status')).toBeTruthy();
    expect(screen.getByText(/very large number of records/)).toBeTruthy();
  });

  it('speaks Spanish', async () => {
    setup({}, 'es');
    expect(await screen.findByRole('heading', { name: 'Evaluaciones del agua' })).toBeTruthy();
    expect(await screen.findByText('1 por evaluar tras una inundación')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Nueva evaluación' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Evaluar de nuevo Well 1' })).toBeTruthy();
  });
});
