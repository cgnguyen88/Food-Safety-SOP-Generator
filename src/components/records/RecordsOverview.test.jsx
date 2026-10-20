// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithLang } from './testUtils.jsx';

vi.mock('../../lib/records.js', () => ({ createRecord: vi.fn(), updateRecord: vi.fn() }));
vi.mock('../../lib/reportData.js', () => ({ listRecordsForReport: vi.fn() }));
const { listRecordsForReport } = await import('../../lib/reportData.js');
const { default: RecordsOverview } = await import('./RecordsOverview.jsx');

const FLOOD = { id: 'w1', kind: 'weather_event', status: 'approved', record_date: '2026-10-01', payload: { event_type: 'flood', field: 'B4', crop_contact: 'yes' } };
const farmHas = (records) => listRecordsForReport.mockImplementation(async ({ kinds }) => ({ data: { records: records.filter((r) => kinds.includes(r.kind)), truncated: false }, error: null }));
const setup = (props = {}, lang = 'en') => {
  const user = userEvent.setup();
  renderWithLang(<RecordsOverview farm={{ id: 'farm-1' }} role="manager" savedViews={[]} needsReviewCount={0} onNavigate={() => {}} onChanged={() => {}} {...props} />, lang);
  return { user };
};

beforeEach(() => {
  listRecordsForReport.mockReset();
  farmHas([]);
});
afterEach(cleanup);

describe('RecordsOverview: field holds', () => {
  it('shows the fields on hold', async () => {
    farmHas([FLOOD]);
    setup();
    expect(await screen.findByRole('heading', { name: 'Fields on hold' })).toBeTruthy();
    expect(screen.getByText('B4')).toBeTruthy();
  });

  it('shows no hold box when nothing is on hold', async () => {
    setup();
    await waitFor(() => expect(listRecordsForReport).toHaveBeenCalled());
    expect(screen.queryByRole('heading', { name: 'Fields on hold' })).toBeNull();
  });

  it('starts a corrective action for the field, already marked as clearing its hold', async () => {
    farmHas([FLOOD]);
    const { user } = setup();
    await user.click(await screen.findByRole('button', { name: 'Record corrective action: B4' }));
    expect(screen.getByRole('dialog', { name: 'Add corrective action' })).toBeTruthy();
    expect(screen.getByLabelText(/^Field whose hold this clears/).value).toBe('B4');
    expect(screen.getByLabelText(/^Does this clear a field hold/).value).toBe('yes');
  });

  it('starts an ordinary record with nothing filled in, even after a corrective action was started', async () => {
    farmHas([FLOOD]);
    const { user } = setup();
    await user.click(await screen.findByRole('button', { name: 'Record corrective action: B4' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await user.click(screen.getByRole('button', { name: 'Harvest' }));
    expect(screen.getByLabelText(/^Field \/ block/).value).toBe('');
  });
});
