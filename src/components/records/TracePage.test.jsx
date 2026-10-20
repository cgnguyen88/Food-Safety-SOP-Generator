// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, cleanup, within, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithLang } from './testUtils.jsx';

vi.mock('../../lib/records.js', () => ({ createRecord: vi.fn() }));
vi.mock('../../lib/reportData.js', () => ({ listRecordsForReport: vi.fn() }));
const { createRecord } = await import('../../lib/records.js');
const { listRecordsForReport } = await import('../../lib/reportData.js');
const { default: TracePage } = await import('./TracePage.jsx');

let n = 0;
const rec = (kind, record_date, payload) => ({ id: `r${(n += 1)}`, kind, status: 'approved', record_date, created_at: `${record_date}T08:00:00Z`, payload });
const RECORDS = [
  rec('harvest', '2026-07-03', { crop: 'Lettuce', field: 'A1', quantity: 40, unit: 'cartons', lot_code: 'GVF-LETTUCE-20260703-A1', crew: 'Crew 2' }),
  rec('harvest', '2026-07-10', { crop: 'Kale', field: 'B2', quantity: 10, unit: 'cartons', lot_code: 'GVF-KALE-20260710-B2' }),
  rec('packing_cooling', '2026-07-03', { lot_code: 'GVF-LETTUCE-20260703-A1' }),
  rec('shipment', '2026-07-04', { customer: 'Fresh Mart', lot_codes: 'GVF-LETTUCE-20260703-A1', quantity: 25, unit: 'cartons', invoice_number: '1042' }),
  rec('shipment', '2026-07-04', { customer: 'Corner Grocer', lot_codes: 'GVF-LETTUCE-20260703-A1, GVF-KALE-20260710-B2', quantity: 30, unit: 'cartons' }),
  rec('soil_amendment', '2026-05-01', { amendment_type: 'compost', field: 'A1', product: 'Mix' }),
  rec('water_test', '2026-06-20', { source: 'Well 1', water_use: 'pre_harvest', result: 'fail' }),
  rec('sanitation_log', '2026-07-03', { item: 'Harvest bins', method: 'clean_sanitize', check_result: 'pass' }),
];
const ok = (records, truncated = false) => ({ data: { records, truncated }, error: null });

let clock = 1_000_000;
const setup = (props = {}, lang = 'en') => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  renderWithLang(<TracePage farm={{ id: 'farm-1' }} role="manager" now={() => clock} {...props} />, lang);
  return { user };
};
const trace = async (user, code) => {
  await user.type(await screen.findByLabelText('Lot code'), code);
  await user.click(screen.getByRole('button', { name: 'Trace' }));
};

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  clock = 1_000_000;
  createRecord.mockReset();
  listRecordsForReport.mockReset();
  listRecordsForReport.mockResolvedValue(ok(RECORDS));
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('TracePage: tracing a lot', () => {
  it('reads the approved records the trace needs', async () => {
    setup();
    await screen.findByLabelText('Lot code');
    expect(listRecordsForReport).toHaveBeenCalledWith(expect.objectContaining({ farmId: 'farm-1', includeUnapproved: false, kinds: expect.arrayContaining(['harvest', 'shipment', 'soil_amendment', 'water_test']) }));
    expect(listRecordsForReport.mock.calls[0][0].kinds).not.toContain('illness_injury');
  });

  it('shows where a lot came from and where it went', async () => {
    const { user } = setup();
    await trace(user, 'gvf-lettuce-20260703-a1');
    expect(await screen.findByText('This lot: GVF-LETTUCE-20260703-A1')).toBeTruthy();
    expect(screen.getByText('Lettuce')).toBeTruthy();
    expect(screen.getByText('A1')).toBeTruthy();
    expect(screen.getByText('Crew 2')).toBeTruthy();
    expect(screen.getByText('40 cartons')).toBeTruthy();
    expect(screen.getByText('Fresh Mart')).toBeTruthy();
    expect(screen.getByText('Corner Grocer')).toBeTruthy();
    expect(screen.getByText(/1 shipment also carried other lots/)).toBeTruthy();
  });

  it('shows the field’s history, and flags a failed water test', async () => {
    const { user } = setup();
    await trace(user, 'GVF-LETTUCE-20260703-A1');
    await screen.findByText('This lot: GVF-LETTUCE-20260703-A1');
    const water = screen.getByText('Latest water tests').parentElement;
    expect(within(water).getByText('Well 1 · Does not meet the standard')).toBeTruthy();
    expect(within(water).getByText('Needs a look')).toBeTruthy();
    expect(within(screen.getByText('Soil amendments (past year)').parentElement).getByText('Compost (treated) · A1')).toBeTruthy();
  });

  it('lists what the records do not show', async () => {
    const { user } = setup();
    await trace(user, 'GVF-KALE-20260710-B2');
    expect(await screen.findByText('No harvest crew is recorded.')).toBeTruthy();
    expect(screen.getByText('No cleaning is recorded around the harvest or packing day.')).toBeTruthy();
  });

  it('says so when no record uses the lot code', async () => {
    const { user } = setup();
    await trace(user, 'NOPE');
    expect(await screen.findByText('No approved records use the lot code NOPE.')).toBeTruthy();
  });

  it('offers the recent lots, and traces one when it is chosen', async () => {
    const { user } = setup();
    await user.click(await screen.findByRole('button', { name: 'GVF-KALE-20260710-B2' }));
    expect(await screen.findByText('This lot: GVF-KALE-20260710-B2')).toBeTruthy();
    expect(screen.getByLabelText('Lot code').value).toBe('GVF-KALE-20260710-B2');
  });

  it('says there are no lots yet when no harvest has a lot code', async () => {
    listRecordsForReport.mockResolvedValue(ok([]));
    setup();
    expect(await screen.findByText('No lots yet. Harvests with a lot code will show up here.')).toBeTruthy();
  });

  it('says so, and tries again on request, when the records could not be read', async () => {
    listRecordsForReport.mockResolvedValueOnce({ data: null, error: { code: 'unknown' } });
    const { user } = setup();
    expect((await screen.findByRole('alert')).textContent).toMatch(/could not be loaded/);
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByLabelText('Lot code')).toBeTruthy();
  });

  it('warns when there were too many records to read them all', async () => {
    listRecordsForReport.mockResolvedValue(ok(RECORDS, true));
    setup();
    expect((await screen.findByRole('status')).textContent).toMatch(/very large number/);
  });

  it('speaks Spanish', async () => {
    setup({}, 'es');
    expect(await screen.findByRole('heading', { name: 'Rastreo y retiro' })).toBeTruthy();
    expect(screen.getByLabelText('Código de lote')).toBeTruthy();
  });
});

describe('TracePage: the timed drill', () => {
  it('times the drill, and finishes it once a lot has been traced', async () => {
    const { user } = setup();
    await user.click(await screen.findByRole('button', { name: 'Start a timed drill' }));
    expect(screen.getByRole('button', { name: 'Finish drill' }).disabled).toBe(true);
    expect(screen.getByText('Trace a lot that is in your records, then finish the drill.')).toBeTruthy();

    await trace(user, 'GVF-LETTUCE-20260703-A1');
    await screen.findByText('This lot: GVF-LETTUCE-20260703-A1');
    clock += 4 * 60_000 + 12_000;
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(screen.getByText('4 min 12 s')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Finish drill' }));
    expect(screen.getByText('Finished in 4 min 12 s.')).toBeTruthy();
  });

  it('saves a finished drill as a note, approved for a manager', async () => {
    createRecord.mockResolvedValue({ data: { id: 'new' }, error: null });
    const { user } = setup();
    await user.click(await screen.findByRole('button', { name: 'Start a timed drill' }));
    await trace(user, 'GVF-LETTUCE-20260703-A1');
    clock += 90_000;
    await user.click(await screen.findByRole('button', { name: 'Finish drill' }));
    await user.click(screen.getByRole('button', { name: 'Save the drill as a record' }));
    await waitFor(() => expect(createRecord).toHaveBeenCalledTimes(1));
    const call = createRecord.mock.calls[0][0];
    expect(call).toMatchObject({ farmId: 'farm-1', kind: 'note', status: 'approved', payload: { category: 'inspection' } });
    expect(call.payload.text).toBe('Mock recall drill for lot GVF-LETTUCE-20260703-A1. Traced in 1 min 30 s. Found 1 field(s) and 2 customer(s). Nothing was missing from the records.');
    expect(call.recordDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(await screen.findByText('Saved as a note in your records.')).toBeTruthy();
  });

  it('sends the drill to review when crew save it', async () => {
    createRecord.mockResolvedValue({ data: { id: 'new' }, error: null });
    const { user } = setup({ role: 'crew' });
    await user.click(await screen.findByRole('button', { name: 'Start a timed drill' }));
    await trace(user, 'GVF-LETTUCE-20260703-A1');
    await user.click(await screen.findByRole('button', { name: 'Finish drill' }));
    await user.click(screen.getByRole('button', { name: 'Save the drill as a record' }));
    await waitFor(() => expect(createRecord).toHaveBeenCalled());
    expect(createRecord.mock.calls[0][0].status).toBe('pending_review');
  });

  it('says so, and lets the person try again, when the drill could not be saved', async () => {
    createRecord.mockResolvedValueOnce({ data: null, error: { code: 'unknown' } });
    const { user } = setup();
    await user.click(await screen.findByRole('button', { name: 'Start a timed drill' }));
    await trace(user, 'GVF-LETTUCE-20260703-A1');
    await user.click(await screen.findByRole('button', { name: 'Finish drill' }));
    await user.click(screen.getByRole('button', { name: 'Save the drill as a record' }));
    expect((await screen.findByRole('alert')).textContent).toBe('The drill could not be saved. Try again.');
    expect(screen.getByRole('button', { name: 'Save the drill as a record' }).disabled).toBe(false);
  });

  it('cannot be finished on a lot that is not in the records, so no note says nothing was missing', async () => {
    const { user } = setup();
    await user.click(await screen.findByRole('button', { name: 'Start a timed drill' }));
    await trace(user, 'XYZ');
    expect(await screen.findByText('No approved records use the lot code XYZ.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Finish drill' }).disabled).toBe(true);
    expect(screen.getByText('Trace a lot that is in your records, then finish the drill.')).toBeTruthy();
  });

  it('saves what the trace said when the drill was finished, even if the lot box is changed afterwards', async () => {
    createRecord.mockResolvedValue({ data: { id: 'new' }, error: null });
    const { user } = setup();
    await user.click(await screen.findByRole('button', { name: 'Start a timed drill' }));
    await trace(user, 'GVF-LETTUCE-20260703-A1');
    await user.click(await screen.findByRole('button', { name: 'Finish drill' }));
    await user.clear(screen.getByLabelText('Lot code'));
    await user.click(screen.getByRole('button', { name: 'Trace' }));
    await user.click(screen.getByRole('button', { name: 'Save the drill as a record' }));
    await waitFor(() => expect(createRecord).toHaveBeenCalled());
    expect(createRecord.mock.calls[0][0].payload.text).toContain('lot GVF-LETTUCE-20260703-A1.');
    expect(await screen.findByText('Saved as a note in your records.')).toBeTruthy();
  });

  it('can be cancelled', async () => {
    const { user } = setup();
    await user.click(await screen.findByRole('button', { name: 'Start a timed drill' }));
    await user.click(screen.getByRole('button', { name: 'Cancel drill' }));
    expect(screen.getByRole('button', { name: 'Start a timed drill' })).toBeTruthy();
  });
});
