// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithLang } from './records/testUtils.jsx';

vi.mock('../lib/records.js', () => ({ createRecord: vi.fn(), updateRecord: vi.fn() }));
vi.mock('../lib/reportData.js', () => ({ listRecordsForReport: vi.fn() }));
vi.mock('../lib/fields.js', () => ({ listFields: vi.fn() }));
const { listRecordsForReport } = await import('../lib/reportData.js');
const { listFields } = await import('../lib/fields.js');
const { default: Home } = await import('./Home.jsx');

const FLOOD = { id: 'w1', kind: 'weather_event', status: 'approved', record_date: '2026-10-01', payload: { event_type: 'flood', field: 'B4', crop_contact: 'yes' } };
const OLD_TRAINING = { id: 't1', kind: 'training', status: 'approved', record_date: '2024-01-10', created_at: '2024-01-10T09:00:00Z', payload: { topic: 'Handwashing', trainer: 'Ana', attendees: 'Maria Lopez\nJose Ruiz' } };
const farmHas = (records) => listRecordsForReport.mockImplementation(async ({ kinds }) => ({ data: { records: records.filter((r) => kinds.includes(r.kind)), truncated: false }, error: null }));

const setup = (props = {}, lang = 'en') => {
  const handlers = { onNavigate: vi.fn(), onOpenProfile: vi.fn(), onChanged: vi.fn() };
  const user = userEvent.setup();
  renderWithLang(
    <Home farm={{ id: 'farm-1', name: 'Sunny' }} farmProfile={{ farm_name: 'Green Valley Farm' }} role="manager" needsReviewCount={0} reviewStatus="ready" {...handlers} {...props} />,
    lang,
  );
  return { user, ...handlers };
};

beforeEach(() => {
  listRecordsForReport.mockReset();
  listFields.mockReset();
  listFields.mockResolvedValue({ data: [], error: null });
  farmHas([]);
});
afterEach(cleanup);

describe('Home: what needs attention', () => {
  it('names the farm and says when nothing needs attention', async () => {
    setup();
    expect(screen.getByRole('heading', { name: 'Green Valley Farm' })).toBeTruthy();
    expect(await screen.findByText('Nothing needs your attention right now.')).toBeTruthy();
  });

  it('does not say all is well before the holds and training have been checked', () => {
    setup();
    expect(screen.queryByText('Nothing needs your attention right now.')).toBeNull();
  });

  it('does not say all is well when the review queue could not be read, even though its count shows 0', async () => {
    setup({ reviewStatus: 'error' });
    expect(await screen.findByText('The review queue could not be checked right now.')).toBeTruthy();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(screen.queryByText('Nothing needs your attention right now.')).toBeNull();
  });

  it('does not say all is well while the review queue is still being read', async () => {
    setup({ reviewStatus: 'loading' });
    await waitFor(() => expect(listRecordsForReport).toHaveBeenCalled());
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(screen.queryByText('Nothing needs your attention right now.')).toBeNull();
  });

  it('says so, and offers another try, when the training records could not be read, and does not say all is well', async () => {
    listRecordsForReport.mockImplementation(async ({ kinds }) => (kinds.includes('training') ? { data: null, error: { code: 'unknown' } } : { data: { records: [], truncated: false }, error: null }));
    setup();
    expect(await screen.findByText('Training could not be checked right now.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
    expect(screen.queryByText('Nothing needs your attention right now.')).toBeNull();
    expect(screen.queryByText('Field holds could not be checked', { exact: false })).toBeNull();
  });

  it.each([['hold', ['weather_event']], ['training', ['training']]])('does not say all is well when the %s records were cut short', async (_label, truncatedKinds) => {
    listRecordsForReport.mockImplementation(async ({ kinds }) => ({ data: { records: [], truncated: kinds.some((k) => truncatedKinds.includes(k)) }, error: null }));
    setup();
    expect(await screen.findByText(/very large number of records/)).toBeTruthy();
    expect(screen.queryByText('Nothing needs your attention right now.')).toBeNull();
  });

  it('points to records waiting for review', async () => {
    const { user, onNavigate } = setup({ needsReviewCount: 3 });
    expect(screen.getByText('3 records are waiting for review')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Review' }));
    expect(onNavigate).toHaveBeenCalledWith('needsReview');
    expect(screen.queryByText('Nothing needs your attention right now.')).toBeNull();
  });

  it('points to people overdue for training', async () => {
    farmHas([OLD_TRAINING]);
    const { user, onNavigate } = setup();
    expect(await screen.findByText('2 people are overdue for training')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'See who' }));
    expect(onNavigate).toHaveBeenCalledWith('recordTraining');
  });

  it('lists the fields on hold, and starts the corrective action that clears one', async () => {
    farmHas([FLOOD]);
    const { user } = setup();
    expect(await screen.findByRole('heading', { name: 'Fields on hold' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Record corrective action: B4' }));
    expect(screen.getByRole('dialog', { name: 'Add corrective action' })).toBeTruthy();
    expect(screen.getByLabelText(/^Field whose hold this clears/).value).toBe('B4');
    expect(screen.getByLabelText(/^Does this clear a field hold/).value).toBe('yes');
    expect(screen.queryByText('Nothing needs your attention right now.')).toBeNull();
  });

  it('says so when the holds could not be checked, and does not claim all is well', async () => {
    listRecordsForReport.mockResolvedValue({ data: null, error: { code: 'unknown' } });
    setup();
    expect((await screen.findAllByRole('alert'))[0].textContent).toMatch(/could not be checked/);
    expect(screen.queryByText('Nothing needs your attention right now.')).toBeNull();
  });
});

describe('Home: adding records', () => {
  it('offers the records added most, and opens the form for one', async () => {
    const { user } = setup();
    for (const name of ['Harvest', 'Cleaning & sanitizing', 'Wildlife check', 'Shipment', 'Visitor', 'Training']) {
      expect(screen.getByRole('button', { name }), name).toBeTruthy();
    }
    await user.click(screen.getByRole('button', { name: 'Harvest' }));
    expect(screen.getByRole('dialog', { name: 'Add harvest' })).toBeTruthy();
  });

  it('goes to the log of a record once it is saved, and tells the app something changed', async () => {
    const { createRecord } = await import('../lib/records.js');
    createRecord.mockResolvedValue({ data: { id: 'new' }, error: null });
    const { user, onNavigate, onChanged } = setup();
    await user.click(screen.getByRole('button', { name: 'Visitor' }));
    await user.type(screen.getByLabelText(/^Visitor name/), 'Pat');
    await user.type(screen.getByLabelText(/^Purpose of visit/), 'Delivery');
    await user.selectOptions(screen.getByLabelText(/^Told the hygiene rules/), 'yes');
    await user.click(screen.getByRole('button', { name: 'Save & approve' }));
    await waitFor(() => expect(onNavigate).toHaveBeenCalledWith('log:visitor'));
    expect(onChanged).toHaveBeenCalled();
  });

  it('opens all the record types', async () => {
    const { user, onNavigate } = setup();
    await user.click(screen.getByRole('button', { name: 'All record types' }));
    expect(onNavigate).toHaveBeenCalledWith('farmRecords');
  });
});

describe('Home: setting up', () => {
  it('asks for the farm’s details until a farm name is saved', async () => {
    const { user, onOpenProfile } = setup({ farmProfile: null });
    expect(screen.getByRole('heading', { name: 'Sunny' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Set up farm profile' }));
    expect(onOpenProfile).toHaveBeenCalled();
  });

  it('does not ask once there is a profile', () => {
    setup();
    expect(screen.queryByRole('button', { name: 'Set up farm profile' })).toBeNull();
  });

  it('keeps the credit and reference links at the bottom', () => {
    setup();
    expect(screen.getByRole('link', { name: 'Cornell PSA Resources' }).getAttribute('href')).toMatch(/^https:\/\//);
    expect(screen.getByText('Jimmy Nguyen')).toBeTruthy();
  });

  it('speaks Spanish', async () => {
    setup({ needsReviewCount: 2 }, 'es');
    expect(screen.getByText('2 registros esperan revisión')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Cosecha' })).toBeTruthy();
  });
});
