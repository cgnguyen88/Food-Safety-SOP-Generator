// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, cleanup, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithLang } from './testUtils.jsx';

vi.mock('../../lib/records.js', () => ({ createRecord: vi.fn(), updateRecord: vi.fn() }));
vi.mock('../../lib/reportData.js', () => ({ listRecordsForReport: vi.fn() }));
vi.mock('../../lib/waterSources.js', () => ({
  createWaterSource: vi.fn(), updateWaterSource: vi.fn(), setWaterSourceActive: vi.fn(), deleteWaterSource: vi.fn(), addWaterSources: vi.fn(), listWaterSources: vi.fn(),
}));
const { createRecord } = await import('../../lib/records.js');
const { listRecordsForReport } = await import('../../lib/reportData.js');
const sourcesLib = await import('../../lib/waterSources.js');
const { FarmWaterSourcesContext } = await import('./farmWaterSources.js');
const { default: WaterSourcesPage } = await import('./WaterSourcesPage.jsx');

const calm = { source_concern: 'low', nearby_concern: 'low', practice_concern: 'low', crop_concern: 'low', weather_concern: 'low', testing_concern: 'low' };
let n = 0;
const assessment = (source, fields, date, extra = {}) => ({
  id: `a${(n += 1)}`, kind: 'water_assessment', status: 'approved', record_date: date, created_at: `${date}T09:00:00Z`,
  payload: { source, source_type: 'enclosed_groundwater', fields_served: fields, application_method: 'drip', ...calm, conclusion: 'no_mitigation', ...extra },
});
const flood = (field, date) => ({ id: `f${(n += 1)}`, kind: 'weather_event', status: 'approved', record_date: date, created_at: `${date}T15:00:00Z`, payload: { event_type: 'flood', field, crop_contact: 'no' } });
const test = (source, date, result, value) => ({ id: `t${(n += 1)}`, kind: 'water_test', status: 'approved', record_date: date, created_at: `${date}T09:00:00Z`, payload: { source, result, result_value: value } });
const src = (name, extra = {}) => ({ id: `s-${name}`, farm_id: 'farm-1', name, source_type: null, fields_served: null, notes: null, is_active: true, ...extra });

const RECORDS = [
  assessment('Well 1', 'A1, A2', '2026-03-01', { assessed_by: 'Ana' }), // a flood on A2 came after
  flood('A2', '2026-06-10'),
  assessment('Canal', 'B1', '2025-10-01', { conclusion: 'mitigation_needed', mitigation: 'Fence the bank' }), // overdue
  assessment('Pond', 'C1', '2025-11-10'), // due soon
  assessment('Spring', 'D1', '2026-09-01'), // up to date
  assessment('Stray pond', 'F1', '2026-08-01', { source_type: 'surface' }), // not on the list
  test('Well 1', '2026-09-01', 'pass', 3),
];
const REGISTRY = [
  src('Well 1', { source_type: 'enclosed_groundwater', fields_served: 'A1, A2' }), src('Canal', { source_type: 'canal', fields_served: 'B1' }), src('Pond', { fields_served: 'C1' }),
  src('Spring', { fields_served: 'D1' }), src('New well', { source_type: 'open_groundwater', fields_served: 'E1' }), src('Old well', { is_active: false }),
];
const ok = (records, truncated = false) => ({ data: { records, truncated }, error: null });
const setup = ({ registry = REGISTRY, status = 'ready', errorCode = null, ...props } = {}, lang = 'en') => {
  const onChanged = vi.fn();
  const reload = vi.fn();
  const user = userEvent.setup();
  const view = renderWithLang(
    <FarmWaterSourcesContext.Provider value={{ status, sources: registry, errorCode, reload }}>
      <WaterSourcesPage farm={{ id: 'farm-1' }} role="manager" today="2026-10-19" onChanged={onChanged} {...props} />
    </FarmWaterSourcesContext.Provider>,
    lang,
  );
  return { user, onChanged, reload, ...view };
};
const rows = () => screen.getAllByRole('row').slice(1);
const names = () => rows().map((row) => within(row).getAllByRole('cell')[0].querySelector('[data-testid="source-name"]').textContent);
const cells = (row) => within(row).getAllByRole('cell').map((cell) => cell.textContent);
const rowOf = (name) => rows().find((row) => within(row).getAllByRole('cell')[0].querySelector('[data-testid="source-name"]').textContent === name);

beforeEach(() => {
  createRecord.mockReset();
  listRecordsForReport.mockReset();
  listRecordsForReport.mockResolvedValue(ok(RECORDS));
  Object.values(sourcesLib).forEach((fn) => fn.mockReset());
});
afterEach(cleanup);

describe('WaterSourcesPage: what it shows', () => {
  it('asks for the approved floods, assessments and water tests of this farm', async () => {
    setup();
    await screen.findByRole('heading', { name: 'Water sources' });
    await waitFor(() => expect(listRecordsForReport).toHaveBeenCalledWith(expect.objectContaining({ farmId: 'farm-1', kinds: ['weather_event', 'water_assessment', 'water_test'], includeUnapproved: false })));
  });

  it('says what the rule asks for, and where to check it', async () => {
    setup();
    expect(await screen.findByText(/21 CFR 112.43/)).toBeTruthy();
  });

  it('counts the sources that stand each way, leaving out any that none does', async () => {
    setup();
    expect(await screen.findByText('1 to assess after a flood')).toBeTruthy();
    expect(screen.getByText('1 overdue')).toBeTruthy();
    expect(screen.getByText('1 not assessed yet')).toBeTruthy();
    expect(screen.getByText('1 due soon')).toBeTruthy();
    expect(screen.getByText('2 up to date')).toBeTruthy();
  });

  it('lists what needs attention, a flood first, then overdue, never assessed, due soon; and leaves out what is up to date or archived', async () => {
    setup();
    await screen.findByText('1 overdue');
    expect(names()).toEqual(['Well 1', 'Canal', 'New well', 'Pond']);
  });

  it('gives, for each source, its kind, fields, last assessment and next review, decision, last water test and status', async () => {
    setup();
    await screen.findByText('1 overdue');
    expect(cells(rowOf('Well 1')).slice(0, 6)).toEqual([
      'Well 1Groundwater: sealed, protected well',
      'A1, A2',
      '2026-03-01Next review 2027-03-01 (in 133 days)',
      'No measures needed',
      '2026-09-01: Meets the standard',
      'Assess againFlood on 2026-06-10 (A2)',
    ]);
    expect(cells(rowOf('Canal')).slice(2, 5)).toEqual(['2025-10-01Next review 2026-10-01 (18 days ago)', 'Measures needed', '—']);
  });

  it('shows a source that was never assessed, with its kind and fields from the list, as needing an assessment', async () => {
    setup();
    await screen.findByText('1 overdue');
    expect(cells(rowOf('New well')).slice(0, 6)).toEqual(['New wellGroundwater: open or unprotected well', 'E1', '—', '—', '—', 'Not assessed yet']);
  });

  it('can show every active source, marking one an assessment names that is not on the list', async () => {
    const { user } = setup();
    await screen.findByText('1 overdue');
    await user.selectOptions(screen.getByLabelText('Show'), 'all');
    expect(names()).toEqual(['Well 1', 'Canal', 'New well', 'Pond', 'Stray pond', 'Spring']);
    expect(within(rowOf('Stray pond')).getByText('Not in your list')).toBeTruthy();
    expect(within(rowOf('Spring')).queryByText('Not in your list')).toBeNull();
  });

  it('can show the archived sources', async () => {
    const { user } = setup();
    await screen.findByText('1 overdue');
    await user.selectOptions(screen.getByLabelText('Show'), 'archived');
    expect(names()).toEqual(['Old well']);
    expect(cells(rowOf('Old well'))[5]).toBe('Archived');
  });

  it('says every source is up to date when none needs attention, and that none is archived when none is', async () => {
    listRecordsForReport.mockResolvedValue(ok([assessment('Spring', 'D1', '2026-09-01')]));
    const { user } = setup({ registry: [src('Spring', { fields_served: 'D1' })] });
    expect(await screen.findByText('Every water source is up to date.')).toBeTruthy();
    await user.selectOptions(screen.getByLabelText('Show'), 'archived');
    expect(screen.getByText('No water source is archived.')).toBeTruthy();
  });

  it('does not say every source is up to date when the records were cut short, only warns', async () => {
    listRecordsForReport.mockResolvedValue(ok([assessment('Spring', 'D1', '2026-09-01')], true));
    setup({ registry: [src('Spring', { fields_served: 'D1' })] });
    expect(await screen.findByText(/very large number of records/)).toBeTruthy();
    expect(screen.queryByText('Every water source is up to date.')).toBeNull();
  });

  it('explains an empty page and offers to add the first source', async () => {
    listRecordsForReport.mockResolvedValue(ok([]));
    setup({ registry: [] });
    expect(await screen.findByText(/No water sources yet/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Add water source' })).toBeTruthy();
  });

  it('says so, and offers to try again, when the records could not be read, and when the list could not be', async () => {
    listRecordsForReport.mockResolvedValueOnce({ data: null, error: { code: 'unknown' } });
    listRecordsForReport.mockResolvedValue(ok(RECORDS));
    const { user } = setup();
    expect((await screen.findByRole('alert')).textContent).toContain('The water sources could not be loaded.');
    expect(screen.queryByText('Every water source is up to date.')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('1 overdue')).toBeTruthy();
  });

  it('says the database update is missing when the list cannot be read for that reason', async () => {
    const { reload, user } = setup({ registry: [], status: 'error', errorCode: 'not_set_up' });
    expect((await screen.findByRole('alert')).textContent).toMatch(/not set up on the server yet/);
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(reload).toHaveBeenCalled();
  });
});

describe('WaterSourcesPage: water sources in the records that are not on the list', () => {
  it('names them, with how often records use them, and adds them with the kind and fields of the newest assessment', async () => {
    sourcesLib.addWaterSources.mockResolvedValue({ data: { added: 1, skipped: 0, remaining: 0 }, error: null });
    const { user, reload } = setup();
    expect(await screen.findByText('1 water source in your records is not on this list')).toBeTruthy();
    expect(screen.getByText('Stray pond (1)')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Add them to the list' }));
    await waitFor(() => expect(sourcesLib.addWaterSources).toHaveBeenCalledWith('farm-1', [{ name: 'Stray pond', uses: 1, source_type: 'surface', fields_served: 'F1' }]));
    expect(await screen.findByText('1 water source added.')).toBeTruthy();
    expect(reload).toHaveBeenCalled();
    // The notice goes away until the list has been read again, so the same names are not offered twice.
    expect(screen.queryByRole('button', { name: 'Add them to the list' })).toBeNull();
  });

  it('says how many were left for another go, and says if it could not add them', async () => {
    sourcesLib.addWaterSources.mockResolvedValue({ data: { added: 50, skipped: 0, remaining: 3 }, error: null });
    const { user } = setup();
    await user.click(await screen.findByRole('button', { name: 'Add them to the list' }));
    expect(await screen.findByText(/3 more were not added yet/)).toBeTruthy();
  });

  it('says why when they could not be added', async () => {
    sourcesLib.addWaterSources.mockResolvedValue({ data: null, error: { code: 'forbidden' } });
    const { user } = setup();
    await user.click(await screen.findByRole('button', { name: 'Add them to the list' }));
    expect((await screen.findAllByRole('alert')).map((a) => a.textContent).join(' ')).toContain('Only an owner or manager can change water sources.');
  });

  it('is not shown to crew, or when every name is on the list', async () => {
    setup({ role: 'crew' });
    await screen.findByText('1 overdue');
    expect(screen.queryByText(/not on this list/)).toBeNull();
    cleanup();
    listRecordsForReport.mockResolvedValue(ok(RECORDS.filter((r) => r.payload.source !== 'Stray pond')));
    setup();
    await screen.findByText('1 overdue');
    expect(screen.queryByText(/not on this list/)).toBeNull();
  });
});

describe('WaterSourcesPage: adding and assessing', () => {
  it('adds a water source to the list, then reads the list again and tells the parent', async () => {
    const { user, reload, onChanged } = setup();
    await screen.findByText('1 overdue');
    await user.click(screen.getByRole('button', { name: 'Add water source' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add water source' });
    sourcesLib.createWaterSource.mockResolvedValue({ data: src('Creek'), error: null });
    await user.type(within(dialog).getByLabelText('Name'), 'Creek');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(sourcesLib.createWaterSource).toHaveBeenCalledWith(expect.objectContaining({ farmId: 'farm-1', name: 'Creek' })));
    await waitFor(() => expect(reload).toHaveBeenCalled());
    expect(onChanged).toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('starts a new assessment from nothing', async () => {
    const { user } = setup();
    await screen.findByText('1 overdue');
    await user.click(screen.getByRole('button', { name: 'New assessment' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add water assessment' });
    expect(within(dialog).getByLabelText(/^Water source or system/).value).toBe('');
  });

  it('assesses a source again from its last answers, with the decision left to make', async () => {
    const { user } = setup();
    await screen.findByText('1 overdue');
    await user.click(within(rowOf('Well 1')).getByRole('button', { name: 'Assess again: Well 1' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add water assessment' });
    expect(within(dialog).getByLabelText(/^Water source or system/).value).toBe('Well 1');
    expect(within(dialog).getByLabelText(/^Fields this water is used on/).value).toBe('A1, A2');
    expect(within(dialog).getByLabelText(/^What kind of source it is/).value).toBe('enclosed_groundwater');
    expect(within(dialog).getByLabelText(/^Assessed by/).value).toBe('Ana');
    expect(within(dialog).getByLabelText(/^What you decided/).value).toBe('');
  });

  it('assesses a source that was never assessed, starting from what the list says about it', async () => {
    const { user } = setup();
    await screen.findByText('1 overdue');
    await user.click(within(rowOf('New well')).getByRole('button', { name: 'Assess: New well' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add water assessment' });
    expect(within(dialog).getByLabelText(/^Water source or system/).value).toBe('New well');
    expect(within(dialog).getByLabelText(/^Fields this water is used on/).value).toBe('E1');
    expect(within(dialog).getByLabelText(/^What kind of source it is/).value).toBe('open_groundwater');
  });

  it('reads the records again and tells the parent once an assessment is saved', async () => {
    createRecord.mockResolvedValue({ data: { id: 'new' }, error: null });
    const { user, onChanged } = setup();
    await screen.findByText('1 overdue');
    await user.click(within(rowOf('Canal')).getByRole('button', { name: 'Assess again: Canal' }));
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

  it('lets crew start an assessment, which will wait for review, but not change the list', async () => {
    const { user } = setup({ role: 'crew' });
    await screen.findByText('1 overdue');
    expect(screen.queryByRole('button', { name: 'Add water source' })).toBeNull();
    expect(screen.getByText('Only an owner or manager can change the list of water sources.')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'New assessment' }));
    expect(await screen.findByRole('button', { name: 'Submit for review' })).toBeTruthy();
  });
});

describe('WaterSourcesPage: a source’s details, and changing the list from them', () => {
  const openDetails = async (user, name) => {
    await screen.findByText('1 overdue');
    await user.click(within(rowOf(name)).getByRole('button', { name: `Details: ${name}` }));
    return screen.findByRole('dialog', { name });
  };

  it('opens a source’s details, and closes them', async () => {
    const { user } = setup();
    const dialog = await openDetails(user, 'Well 1');
    expect(within(dialog).getByText('Kind of source')).toBeTruthy();
    await user.click(within(dialog).getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('starts an assessment from the details, closing them', async () => {
    const { user } = setup();
    const dialog = await openDetails(user, 'Canal');
    await user.click(within(dialog).getByRole('button', { name: 'Assess again' }));
    const form = await screen.findByRole('dialog', { name: 'Add water assessment' });
    expect(within(form).getByLabelText(/^Water source or system/).value).toBe('Canal');
    expect(screen.queryByRole('dialog', { name: 'Canal' })).toBeNull();
  });

  it('edits a source, with its name fixed while records use it, then reads the list again and tells the parent', async () => {
    sourcesLib.updateWaterSource.mockResolvedValue({ data: REGISTRY[1], error: null });
    const { user, reload, onChanged } = setup();
    const dialog = await openDetails(user, 'Canal');
    await user.click(within(dialog).getByRole('button', { name: 'Edit' }));
    const form = await screen.findByRole('dialog', { name: 'Edit water source' });
    expect(within(form).getByLabelText('Name').readOnly).toBe(true);
    await user.click(within(form).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(sourcesLib.updateWaterSource).toHaveBeenCalledWith('s-Canal', expect.objectContaining({ name: 'Canal' })));
    await waitFor(() => expect(reload).toHaveBeenCalled());
    expect(onChanged).toHaveBeenCalled();
  });

  it('lets the name of a source no record uses be changed', async () => {
    const { user } = setup();
    const dialog = await openDetails(user, 'New well');
    await user.click(within(dialog).getByRole('button', { name: 'Edit' }));
    const form = await screen.findByRole('dialog', { name: 'Edit water source' });
    expect(within(form).getByLabelText('Name').readOnly).toBe(false);
  });

  it('archives a source, and restores one, from the details', async () => {
    sourcesLib.setWaterSourceActive.mockResolvedValue({ data: {}, error: null });
    const { user, reload } = setup();
    const dialog = await openDetails(user, 'New well');
    await user.click(within(dialog).getByRole('button', { name: 'Archive' }));
    await waitFor(() => expect(sourcesLib.setWaterSourceActive).toHaveBeenCalledWith('s-New well', false));
    await waitFor(() => expect(reload).toHaveBeenCalled());
  });

  it('restores an archived source', async () => {
    sourcesLib.setWaterSourceActive.mockResolvedValue({ data: {}, error: null });
    const { user } = setup();
    await screen.findByText('1 overdue');
    await user.selectOptions(screen.getByLabelText('Show'), 'archived');
    await user.click(within(rowOf('Old well')).getByRole('button', { name: 'Details: Old well' }));
    await user.click(await screen.findByRole('button', { name: 'Restore' }));
    await waitFor(() => expect(sourcesLib.setWaterSourceActive).toHaveBeenCalledWith('s-Old well', true));
  });

  it('deletes a source no record uses, after asking, and closes the details', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    sourcesLib.deleteWaterSource.mockResolvedValue({ data: null, error: null });
    const { user, reload } = setup();
    const dialog = await openDetails(user, 'New well');
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));
    expect(window.confirm).toHaveBeenCalledWith('Delete the water source “New well”? This cannot be undone.');
    await waitFor(() => expect(sourcesLib.deleteWaterSource).toHaveBeenCalledWith('s-New well'));
    await waitFor(() => expect(reload).toHaveBeenCalled());
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('deletes nothing when the person does not confirm', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const { user } = setup();
    const dialog = await openDetails(user, 'New well');
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));
    expect(sourcesLib.deleteWaterSource).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'New well' })).toBeTruthy();
  });

  it('explains, without asking or deleting, that a source records use cannot be deleted', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { user } = setup();
    const dialog = await openDetails(user, 'Canal');
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));
    expect((await screen.findAllByRole('alert')).map((a) => a.textContent).join(' ')).toContain('Records use this water source, so it cannot be deleted. Archive it instead.');
    expect(confirm).not.toHaveBeenCalled();
    expect(sourcesLib.deleteWaterSource).not.toHaveBeenCalled();
  });

  it('says why when the database refuses a delete because records use the source (a draft, say)', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    sourcesLib.deleteWaterSource.mockResolvedValue({ data: null, error: { code: 'in_use' } });
    const { user } = setup();
    const dialog = await openDetails(user, 'New well');
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));
    expect((await screen.findAllByRole('alert')).map((a) => a.textContent).join(' ')).toContain('Records use this water source, so it cannot be deleted. Archive it instead.');
    expect(screen.getByRole('dialog', { name: 'New well' })).toBeTruthy();
  });

  it('gives crew the details, to read and to assess from, but no way to change the list', async () => {
    const { user } = setup({ role: 'crew' });
    const dialog = await openDetails(user, 'Canal');
    expect(within(dialog).getByRole('button', { name: 'Assess again' })).toBeTruthy();
    for (const name of ['Edit', 'Archive', 'Delete']) expect(within(dialog).queryByRole('button', { name })).toBeNull();
  });

  it('says why when archiving fails', async () => {
    sourcesLib.setWaterSourceActive.mockResolvedValue({ data: null, error: { code: 'forbidden' } });
    const { user } = setup();
    const dialog = await openDetails(user, 'New well');
    await user.click(within(dialog).getByRole('button', { name: 'Archive' }));
    expect((await screen.findAllByRole('alert')).map((a) => a.textContent).join(' ')).toContain('Only an owner or manager can change water sources.');
  });
});

describe('WaterSourcesPage: Spanish', () => {
  it('speaks Spanish', async () => {
    setup({}, 'es');
    expect(await screen.findByRole('heading', { name: 'Fuentes de agua' })).toBeTruthy();
    expect(await screen.findByText('1 por evaluar tras una inundación')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Agregar fuente de agua' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Nueva evaluación' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Evaluar de nuevo: Well 1' })).toBeTruthy();
  });
});
