// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithLang } from './testUtils.jsx';

vi.mock('../../lib/records.js', () => ({ createRecord: vi.fn(), updateRecord: vi.fn() }));
vi.mock('../../lib/reportData.js', () => ({ listRecordsForReport: vi.fn() }));
const { createRecord, updateRecord } = await import('../../lib/records.js');
const { listRecordsForReport } = await import('../../lib/reportData.js');
const { default: RecordForm } = await import('./RecordForm.jsx');
const { FarmFieldsContext } = await import('./farmFields.js');
const { LotCodeSettingsContext } = await import('./lotCodeSettings.js');

const FARM = 'farm-1';
const LOTS = { format: '{FARM}-{CROP}-{YYYYMMDD}-{FIELD}', farmCode: 'GVF', farmName: 'Green Valley Farm' };
const setup = ({ lots = LOTS, ...props } = {}, lang = 'en') => {
  const onSaved = vi.fn();
  const onCancel = vi.fn();
  const user = userEvent.setup();
  renderWithLang(
    <LotCodeSettingsContext.Provider value={lots}>
      <RecordForm kind="harvest" role="crew" farmId={FARM} today="2026-10-12" onSaved={onSaved} onCancel={onCancel} {...props} />
    </LotCodeSettingsContext.Provider>,
    lang,
  );
  return { user, onSaved, onCancel };
};

const fillHarvest = async (user) => {
  await user.type(screen.getByLabelText(/^Crop/), 'Lettuce');
  await user.type(screen.getByLabelText(/^Field/), 'B4');
  await user.type(screen.getByLabelText(/^Quantity/), '12.5');
  await user.type(screen.getByLabelText(/^Unit/), 'lb');
};

/** What the farm already has recorded, as the form reads it (by kind). */
const farmHas = (records) => listRecordsForReport.mockImplementation(async ({ kinds }) => ({ data: { records: records.filter((r) => kinds.includes(r.kind)), truncated: false }, error: null }));

beforeEach(() => {
  createRecord.mockReset();
  updateRecord.mockReset();
  listRecordsForReport.mockReset();
  farmHas([]);
});
afterEach(cleanup);

describe('RecordForm: fields', () => {
  it('shows a labelled input for every field of the kind, and the date', () => {
    setup();
    for (const label of ['Date', 'Crop', 'Field / block', 'Quantity', 'Unit', 'Lot code', 'Harvest crew', 'Destination / buyer', 'Notes']) {
      expect(screen.getByLabelText(new RegExp(`^${label}`)), label).toBeTruthy();
    }
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('defaults the date to today', () => {
    setup();
    expect(screen.getByLabelText(/^Date/).value).toBe('2026-10-12');
  });

  it('marks required fields as required', () => {
    setup();
    expect(screen.getByLabelText(/^Crop/).getAttribute('aria-required')).toBe('true');
    expect(screen.getByLabelText(/^Lot code/).getAttribute('aria-required')).not.toBe('true');
  });

  it('shows Spanish labels and buttons in Spanish', () => {
    setup({}, 'es');
    expect(screen.getByLabelText(/^Cultivo/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Enviar a revisión' })).toBeTruthy();
  });

  it('renders select fields with their localized options', async () => {
    const { user } = setup({ kind: 'weather_event' });
    const select = screen.getByLabelText(/^Event/);
    expect([...select.options].map((o) => o.textContent)).toEqual(expect.arrayContaining(['Flood', 'Heavy rain']));
    await user.selectOptions(select, 'flood');
    expect(select.value).toBe('flood');
  });
});

describe('RecordForm: live validation', () => {
  it('lists what is still needed and keeps Submit disabled until the record is complete', async () => {
    const { user } = setup();
    expect(screen.getByText(/Still needed:/).textContent).toMatch(/Crop.*Field \/ block.*Quantity.*Unit/);
    expect(screen.getByRole('button', { name: 'Submit for review' }).disabled).toBe(true);

    await fillHarvest(user);
    expect(screen.queryByText(/Still needed:/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Submit for review' }).disabled).toBe(false);
  });

  it('makes the sanitizer and its concentration required only when something was sanitized', async () => {
    const { user } = setup({ kind: 'sanitation_log' });
    await user.type(screen.getByLabelText(/^Item or surface/), 'Harvest bins');
    await user.selectOptions(screen.getByLabelText(/^What was done/), 'clean_only');
    expect(screen.queryByText(/Still needed:/)).toBeNull();
    expect(screen.getByLabelText(/^Sanitizer used/).getAttribute('aria-required')).not.toBe('true');

    await user.selectOptions(screen.getByLabelText(/^What was done/), 'clean_sanitize');
    expect(screen.getByText(/Still needed:/).textContent).toMatch(/Sanitizer used.*Concentration \(ppm\)/);
    expect(screen.getByLabelText(/^Sanitizer used/).getAttribute('aria-required')).toBe('true');
    expect(screen.getByLabelText(/^Concentration \(ppm\)/).getAttribute('aria-required')).toBe('true');
  });

  it('flags an invalid number right away and blocks saving', async () => {
    const { user } = setup();
    await fillHarvest(user);
    await user.clear(screen.getByLabelText(/^Quantity/));
    await user.type(screen.getByLabelText(/^Quantity/), '12abc');
    expect(screen.getByLabelText(/^Quantity/).getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByRole('button', { name: 'Submit for review' }).disabled).toBe(true);
    expect(screen.getByRole('button', { name: 'Save as draft' }).disabled).toBe(true);
  });
});

describe('RecordForm: who can do what', () => {
  it('offers crew "Submit for review", never approval', () => {
    setup({ role: 'crew' });
    expect(screen.getByRole('button', { name: 'Submit for review' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Save & approve' })).toBeNull();
  });

  it.each(['owner', 'manager'])('offers a %s "Save & approve"', (role) => {
    setup({ role });
    expect(screen.getByRole('button', { name: 'Save & approve' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Submit for review' })).toBeNull();
  });
});

describe('RecordForm: saving', () => {
  it('submits a normalized record for review and reports it saved', async () => {
    createRecord.mockResolvedValue({ data: { id: 'r1' }, error: null });
    const { user, onSaved } = setup();
    await fillHarvest(user);
    await user.click(screen.getByRole('button', { name: 'Submit for review' }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith({ id: 'r1' }));
    expect(createRecord).toHaveBeenCalledWith({
      farmId: FARM, kind: 'harvest', recordDate: '2026-10-12', status: 'pending_review',
      payload: expect.objectContaining({ crop: 'Lettuce', field: 'B4', quantity: '12.5', unit: 'lb' }),
    });
  });

  it('lets an owner save and approve in one step', async () => {
    createRecord.mockResolvedValue({ data: { id: 'r2' }, error: null });
    const { user } = setup({ role: 'owner' });
    await fillHarvest(user);
    await user.click(screen.getByRole('button', { name: 'Save & approve' }));
    await waitFor(() => expect(createRecord).toHaveBeenCalledWith(expect.objectContaining({ status: 'approved' })));
  });

  it('saves an incomplete record as a draft', async () => {
    createRecord.mockResolvedValue({ data: { id: 'r3' }, error: null });
    const { user, onSaved } = setup();
    await user.type(screen.getByLabelText(/^Crop/), 'Lettuce');
    await user.click(screen.getByRole('button', { name: 'Save as draft' }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(createRecord).toHaveBeenCalledWith(expect.objectContaining({ status: 'draft' }));
  });

  it('explains a failure in plain language and does not report success', async () => {
    createRecord.mockResolvedValue({ data: null, error: { code: 'forbidden' } });
    const { user, onSaved } = setup();
    await fillHarvest(user);
    await user.click(screen.getByRole('button', { name: 'Submit for review' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/permission/i);
    expect(onSaved).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Submit for review' }).disabled).toBe(false); // can retry
  });

  it('prevents a double submit while saving', async () => {
    let finish;
    createRecord.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    const { user } = setup();
    await fillHarvest(user);
    await user.click(screen.getByRole('button', { name: 'Submit for review' }));
    expect(screen.getByRole('button', { name: 'Saving…' }).disabled).toBe(true);
    finish({ data: { id: 'r' }, error: null });
    await waitFor(() => expect(createRecord).toHaveBeenCalledTimes(1));
  });

  it('cancels without saving', async () => {
    const { user, onCancel } = setup();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalled();
    expect(createRecord).not.toHaveBeenCalled();
  });
});

describe('RecordForm: closing and accessibility', () => {
  it('asks before discarding typed data, and keeps the form if the user says no', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const { user, onCancel } = setup();
    await user.type(screen.getByLabelText(/^Crop/), 'Lettuce');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(confirm).toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();

    confirm.mockReturnValue(true);
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalled();
    confirm.mockRestore();
  });

  it('does not ask when nothing was typed', async () => {
    const confirm = vi.spyOn(window, 'confirm');
    const { user, onCancel } = setup();
    await user.keyboard('{Escape}');
    expect(confirm).not.toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalled();
    confirm.mockRestore();
  });

  it('cannot be dismissed (Escape or backdrop) while a save is in flight', async () => {
    createRecord.mockReturnValue(new Promise(() => {}));
    const { user, onCancel } = setup();
    await fillHarvest(user);
    await user.click(screen.getByRole('button', { name: 'Submit for review' }));
    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('dialog').parentElement);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('links an invalid field to its message for screen readers', async () => {
    const { user } = setup();
    await user.type(screen.getByLabelText(/^Quantity/), '12abc');
    const input = screen.getByLabelText(/^Quantity/);
    const message = document.getElementById(input.getAttribute('aria-describedby'));
    expect(message.textContent).toMatch(/not a valid value/i);
  });

  it('says so when the date is outside the supported range (e.g. a year typo; browsers never accept an impossible day like Feb 30)', async () => {
    setup();
    const date = screen.getByLabelText(/^Date/);
    expect(date.getAttribute('aria-invalid')).not.toBe('true');
    const { fireEvent } = await import('@testing-library/react');
    fireEvent.change(date, { target: { value: '2101-01-01' } });
    expect(date.getAttribute('aria-invalid')).toBe('true');
    expect(document.getElementById(date.getAttribute('aria-describedby')).textContent).toMatch(/not a valid value/i);
  });
});

describe('RecordForm: editing', () => {
  it('does not invent a date for a record that has none (it stays missing until someone sets it)', () => {
    setup({ record: { id: 'x', kind: 'harvest', status: 'needs_info', record_date: null, payload: { crop: 'Kale', field: 'A1', quantity: 5, unit: 'lb' } }, role: 'owner' });
    expect(screen.getByLabelText(/^Date/).value).toBe('');
    expect(screen.getByText(/Still needed:/).textContent).toMatch(/Date/);
  });

  const existing = { id: 'rec-9', kind: 'harvest', status: 'pending_review', record_date: '2026-09-30', payload: { crop: 'Kale', field: 'A1', quantity: 5, unit: 'lb' } };

  it('prefills the record and saves changes with updateRecord', async () => {
    updateRecord.mockResolvedValue({ data: { ...existing }, error: null });
    const { user, onSaved } = setup({ record: existing, role: 'owner' });
    expect(screen.getByLabelText(/^Crop/).value).toBe('Kale');
    expect(screen.getByLabelText(/^Quantity/).value).toBe('5');
    expect(screen.getByLabelText(/^Date/).value).toBe('2026-09-30');

    await user.clear(screen.getByLabelText(/^Crop/));
    await user.type(screen.getByLabelText(/^Crop/), 'Chard');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(updateRecord).toHaveBeenCalledWith('rec-9', { kind: 'harvest', recordDate: '2026-09-30', payload: expect.objectContaining({ crop: 'Chard', quantity: '5' }) });
    expect(createRecord).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Save & approve' })).toBeNull();
  });
});

describe('RecordForm: the farm’s field list', () => {
  const f = (name, is_active = true) => ({ id: `id-${name}`, name, is_active });
  const withFields = (fields, props = {}, status = 'ready') => {
    const onSaved = vi.fn();
    const user = userEvent.setup();
    renderWithLang(
      <FarmFieldsContext.Provider value={{ status, fields, reload: () => {} }}>
        <RecordForm kind="harvest" role="crew" farmId={FARM} today="2026-10-12" onSaved={onSaved} onCancel={() => {}} {...props} />
      </FarmFieldsContext.Provider>,
    );
    return { user, onSaved };
  };

  it('lets the person pick one of the farm’s fields, and saves its name', async () => {
    createRecord.mockResolvedValue({ data: { id: 'r1' }, error: null });
    const { user, onSaved } = withFields([f('B2'), f('North 40')]);
    expect(screen.getByLabelText(/^Field \/ block/).tagName).toBe('SELECT');
    await user.type(screen.getByLabelText(/^Crop/), 'Lettuce');
    await user.selectOptions(screen.getByLabelText(/^Field \/ block/), 'North 40');
    await user.type(screen.getByLabelText(/^Quantity/), '12.5');
    await user.type(screen.getByLabelText(/^Unit/), 'lb');
    expect(screen.queryByText(/Still needed:/)).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Submit for review' }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(createRecord).toHaveBeenCalledWith(expect.objectContaining({ payload: expect.objectContaining({ field: 'North 40' }) }));
  });

  it('still asks for the field until one is chosen', () => {
    withFields([f('B2')]);
    expect(screen.getByText(/Still needed:/).textContent).toMatch(/Field \/ block/);
  });

  it('lets the person type a field that is not in the list, and saves it as typed', async () => {
    createRecord.mockResolvedValue({ data: { id: 'r1' }, error: null });
    const { user, onSaved } = withFields([f('B2')]);
    await user.type(screen.getByLabelText(/^Crop/), 'Lettuce');
    await user.selectOptions(screen.getByLabelText(/^Field \/ block/), 'Other (type a name)…');
    await user.type(screen.getByLabelText('Field name'), 'Back Yard');
    await user.type(screen.getByLabelText(/^Quantity/), '3');
    await user.type(screen.getByLabelText(/^Unit/), 'lb');
    await user.click(screen.getByRole('button', { name: 'Submit for review' }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(createRecord).toHaveBeenCalledWith(expect.objectContaining({ payload: expect.objectContaining({ field: 'Back Yard' }) }));
  });

  it('shows a plain box when the farm has no fields, only archived ones, or they are still loading', () => {
    withFields([]);
    expect(screen.getByLabelText(/^Field \/ block/).tagName).toBe('INPUT');
    cleanup();
    withFields([f('Old', false)]);
    expect(screen.getByLabelText(/^Field \/ block/).tagName).toBe('INPUT');
    cleanup();
    withFields([], {}, 'loading');
    expect(screen.getByLabelText(/^Field \/ block/).tagName).toBe('INPUT');
  });

  it('opens a record with the field it already has chosen', () => {
    withFields([f('B2'), f('A1')], { record: { id: 'x', kind: 'harvest', status: 'pending_review', record_date: '2026-09-30', payload: { crop: 'Kale', field: 'a1', quantity: 5, unit: 'lb' } }, role: 'owner' });
    expect(screen.getByLabelText(/^Field \/ block/).value).toBe('A1');
  });

  it('keeps a record’s own field name, even one the list does not have, when other things are changed', async () => {
    updateRecord.mockResolvedValue({ data: { id: 'x' }, error: null });
    const { user, onSaved } = withFields([f('B2')], { record: { id: 'x', kind: 'harvest', status: 'pending_review', record_date: '2026-09-30', payload: { crop: 'Kale', field: 'Back Yard', quantity: 5, unit: 'lb' } }, role: 'owner' });
    expect(screen.getByLabelText('Field name').value).toBe('Back Yard');
    await user.clear(screen.getByLabelText(/^Crop/));
    await user.type(screen.getByLabelText(/^Crop/), 'Chard');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(updateRecord).toHaveBeenCalledWith('x', expect.objectContaining({ payload: expect.objectContaining({ field: 'Back Yard', crop: 'Chard' }) }));
  });

  it('uses the picker for the field of other kinds of record too, and leaves a kind with no field alone', () => {
    withFields([f('B2')], { kind: 'wildlife_check' });
    expect(screen.getByLabelText(/^Field \/ block/).tagName).toBe('SELECT');
    cleanup();
    withFields([f('B2')], { kind: 'sanitizer_purchase' });
    expect(screen.queryByLabelText(/^Field \/ block/)).toBeNull();
  });
});

describe('RecordForm: starting from some values', () => {
  const prefill = { product: 'Sani-Clean', unit: 'gal', lot_number: 'L-5', approved_use: 'food_contact' };

  it('fills the boxes it is given, and asks only for what is still missing', () => {
    setup({ kind: 'sanitizer_purchase', prefill });
    expect(screen.getByLabelText(/^Product(?! lot)/).value).toBe('Sani-Clean');
    expect(screen.getByLabelText(/^Unit/).value).toBe('gal');
    expect(screen.getByLabelText(/^Product lot number/).value).toBe('L-5');
    expect(screen.getByText(/Still needed:/).textContent).toMatch(/Supplier/);
    expect(screen.getByText(/Still needed:/).textContent).not.toMatch(/Product|Unit/);
  });

  it('makes a NEW record from them (it is not an edit), with today’s date', async () => {
    createRecord.mockResolvedValue({ data: { id: 'new' }, error: null });
    const { user, onSaved } = setup({ kind: 'sanitizer_purchase', prefill });
    expect(screen.getByRole('dialog', { name: 'Add sanitizer purchase' })).toBeTruthy();
    expect(screen.getByLabelText(/^Date/).value).toBe('2026-10-12');
    await user.type(screen.getByLabelText(/^Supplier/), 'Acme');
    await user.type(screen.getByLabelText(/^Quantity/), '3');
    await user.click(screen.getByRole('button', { name: 'Submit for review' }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(updateRecord).not.toHaveBeenCalled();
    expect(createRecord).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'sanitizer_purchase', recordDate: '2026-10-12', status: 'pending_review',
      payload: expect.objectContaining({ product: 'Sani-Clean', unit: 'gal', quantity: '3', supplier: 'Acme', lot_number: 'L-5' }),
    }));
  });

  it('closes without asking "discard?" when nothing was changed from what it started with', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const { user, onCancel } = setup({ kind: 'sanitizer_purchase', prefill });
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(confirm).not.toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalled();
    confirm.mockRestore();
  });

  it('ignores a value for a box the kind does not have, and a value that is not text', () => {
    setup({ kind: 'sanitizer_purchase', prefill: { product: 'Kelp', bogus: 'x', quantity: 7, notes: null } });
    expect(screen.getByLabelText(/^Product(?! lot)/).value).toBe('Kelp');
    expect(screen.getByLabelText(/^Quantity/).value).toBe('7');
    expect(screen.getByLabelText(/^Notes/).value).toBe('');
  });

  it('lets a record being edited keep its own values over any it was started with', () => {
    setup({ kind: 'harvest', role: 'owner', prefill: { crop: 'Wrong' }, record: { id: 'x', kind: 'harvest', status: 'pending_review', record_date: '2026-09-30', payload: { crop: 'Kale', field: 'A1', quantity: 5, unit: 'lb' } } });
    expect(screen.getByLabelText(/^Crop/).value).toBe('Kale');
  });
});

describe('RecordForm: the sanitizer check', () => {
  const LABEL = { id: 'l1', kind: 'sanitizer_label', status: 'approved', record_date: '2026-03-01', payload: { product: 'Peracetic Acid 15%', ppm_min: 100, ppm_max: 200 } };

  const fillCleaning = async (user, ppm) => {
    await user.type(screen.getByLabelText(/^Item or surface/), 'Harvest bins');
    await user.selectOptions(screen.getByLabelText(/^What was done/), 'clean_sanitize');
    await user.type(screen.getByLabelText(/^Sanitizer used/), 'peracetic acid');
    await user.type(screen.getByLabelText(/^Concentration \(ppm\)/), ppm);
  };

  it('says a reading inside the label range is within it, and fills in the pass', async () => {
    farmHas([LABEL]);
    const { user } = setup({ kind: 'sanitation_log' });
    await fillCleaning(user, '150');
    expect(await screen.findByText('Within the label range (100 to 200 ppm).')).toBeTruthy();
    const check = screen.getByLabelText(/^Concentration check/);
    expect(check.value).toBe('pass');
    expect(check.disabled).toBe(true);
  });

  it('says when a reading is too high, and saves the record as a fail whatever else was chosen', async () => {
    farmHas([LABEL]);
    createRecord.mockResolvedValue({ data: { id: 'new' }, error: null });
    const { user } = setup({ kind: 'sanitation_log', role: 'manager' });
    await fillCleaning(user, '300');
    expect(await screen.findByText('Too high. The label says 100 to 200 ppm.')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Save & approve' }));
    await waitFor(() => expect(createRecord).toHaveBeenCalled());
    expect(createRecord.mock.calls[0][0].payload).toMatchObject({ ppm: '300', check_result: 'fail' });
  });

  it('explains when there is no label to check against, and lets the person choose the result', async () => {
    farmHas([]);
    const { user } = setup({ kind: 'sanitation_log' });
    await fillCleaning(user, '150');
    expect(await screen.findByText(/no approved label for this sanitizer/)).toBeTruthy();
    expect(screen.getByLabelText(/^Concentration check/).disabled).toBe(false);
  });

  it('does not check anything when the step only cleaned', async () => {
    farmHas([LABEL]);
    const { user } = setup({ kind: 'sanitation_log' });
    await user.selectOptions(screen.getByLabelText(/^What was done/), 'clean_only');
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.getByLabelText(/^Concentration check/).disabled).toBe(false);
  });

  it('says so when the sanitizer labels could not be read, instead of staying quiet', async () => {
    listRecordsForReport.mockResolvedValue({ data: null, error: { code: 'unknown' } });
    const { user } = setup({ kind: 'sanitation_log' });
    await fillCleaning(user, '150');
    expect(await screen.findByText(/sanitizer labels could not be read/)).toBeTruthy();
    expect(screen.getByLabelText(/^Concentration check/).disabled).toBe(false);
  });

  it('says it cannot tell which label to use when the sanitizer has labels with different ranges', async () => {
    farmHas([
      { ...LABEL, payload: { product: 'Peracetic Acid 15%', approved_use: 'produce_wash', ppm_min: 50, ppm_max: 80 } },
      { ...LABEL, id: 'l2', record_date: '2026-02-01', payload: { product: 'Peracetic Acid 15%', approved_use: 'food_contact', ppm_min: 100, ppm_max: 200 } },
    ]);
    const { user } = setup({ kind: 'sanitation_log' });
    await fillCleaning(user, '60');
    expect(await screen.findByText(/more than one label with different ranges/)).toBeTruthy();
    expect(screen.getByLabelText(/^Concentration check/).disabled).toBe(false);
  });

  it('checks against the label in force on the day of the log', async () => {
    farmHas([{ ...LABEL, record_date: '2026-09-01', payload: { product: 'Peracetic Acid 15%', ppm_min: 10, ppm_max: 20 } }, { ...LABEL, id: 'old', record_date: '2026-01-01' }]);
    const { user } = setup({ kind: 'sanitation_log', today: '2026-03-01' });
    await fillCleaning(user, '150');
    expect(await screen.findByText('Within the label range (100 to 200 ppm).')).toBeTruthy();
  });

  it('speaks Spanish', async () => {
    farmHas([LABEL]);
    const { user } = setup({ kind: 'sanitation_log' }, 'es');
    await user.type(screen.getByLabelText(/^Artículo o superficie/), 'Cajas');
    await user.selectOptions(screen.getByLabelText(/^Qué se hizo/), 'clean_sanitize');
    await user.type(screen.getByLabelText(/^Desinfectante usado/), 'peracetic');
    await user.type(screen.getByLabelText(/^Concentración \(ppm\)/), '50');
    expect(await screen.findByText('Demasiado baja. La etiqueta indica de 100 a 200 ppm.')).toBeTruthy();
  });
});

describe('RecordForm: a field on hold', () => {
  const FLOOD = { id: 'w1', kind: 'weather_event', status: 'approved', record_date: '2026-10-01', payload: { event_type: 'flood', field: 'B4', crop_contact: 'yes' } };

  it('warns when a harvest is from a field that is on hold', async () => {
    farmHas([FLOOD]);
    const { user } = setup({ role: 'manager' });
    await user.type(screen.getByLabelText(/^Field/), 'b4');
    expect(await screen.findByText('B4 is on hold. Record the corrective action that clears it before harvesting from it.')).toBeTruthy();
  });

  it('says nothing for a field that is not on hold', async () => {
    farmHas([FLOOD]);
    const { user } = setup({ role: 'manager' });
    await user.type(screen.getByLabelText(/^Field/), 'A1');
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(screen.queryByText(/is on hold/)).toBeNull();
  });

  it('still lets the harvest be recorded: what happened has to be written down', async () => {
    farmHas([FLOOD]);
    createRecord.mockResolvedValue({ data: { id: 'new' }, error: null });
    const { user, onSaved } = setup({ role: 'manager' });
    await fillHarvest(user);
    await user.clear(screen.getByLabelText(/^Field/));
    await user.type(screen.getByLabelText(/^Field/), 'B4');
    await user.click(screen.getByRole('button', { name: 'Save & approve' }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
  });
});

describe('RecordForm: lot codes', () => {
  const FLOOD = { id: 'w1', kind: 'weather_event', status: 'approved', record_date: '2026-10-01', payload: { event_type: 'flood', field: 'B4', crop_contact: 'yes' } };
  const harvest = (id, lot_code, status = 'approved') => ({ id, kind: 'harvest', status, record_date: '2026-10-12', payload: { crop: 'Lettuce', field: 'A1', quantity: 1, unit: 'lb', lot_code } });
  const button = () => screen.getByRole('button', { name: /lot code$/ });

  it('makes a lot code from the harvest in the farm’s format', async () => {
    const { user } = setup({ role: 'manager' });
    await user.type(screen.getByLabelText(/^Crop/), 'Lettuce');
    await user.type(screen.getByLabelText(/^Field/), 'A1');
    await waitFor(() => expect(button().disabled).toBe(false));
    await user.click(button());
    expect(screen.getByLabelText(/^Lot code/).value).toBe('GVF-LETTUCE-20261012-A1');
    expect(screen.getByText('Lot code GVF-LETTUCE-20261012-A1 made.')).toBeTruthy();
  });

  it('uses the date of the harvest, not today’s', async () => {
    const { user } = setup({ role: 'manager' });
    await user.type(screen.getByLabelText(/^Crop/), 'Kale');
    await user.type(screen.getByLabelText(/^Field/), 'B2');
    await user.clear(screen.getByLabelText(/^Date/));
    await user.type(screen.getByLabelText(/^Date/), '2026-09-30');
    await waitFor(() => expect(button().disabled).toBe(false));
    await user.click(button());
    expect(screen.getByLabelText(/^Lot code/).value).toBe('GVF-KALE-20260930-B2');
  });

  it('adds a number to a code that is already used, even by a harvest that is not approved yet', async () => {
    farmHas([harvest('h1', 'GVF-LETTUCE-20261012-A1', 'pending_review')]);
    const { user } = setup({ role: 'manager' });
    await user.type(screen.getByLabelText(/^Crop/), 'Lettuce');
    await user.type(screen.getByLabelText(/^Field/), 'A1');
    await waitFor(() => expect(button().disabled).toBe(false));
    await user.click(button());
    expect(screen.getByLabelText(/^Lot code/).value).toBe('GVF-LETTUCE-20261012-A1-2');
    expect(listRecordsForReport).toHaveBeenCalledWith(expect.objectContaining({ kinds: ['harvest'], includeUnapproved: true }));
  });

  it('does not count the harvest being edited against itself', async () => {
    const own = harvest('h1', 'GVF-LETTUCE-20261012-A1');
    farmHas([own]);
    const { user } = setup({ role: 'manager', record: { ...own, payload: { ...own.payload } } });
    await waitFor(() => expect(button().disabled).toBe(false));
    await user.click(button());
    expect(screen.getByLabelText(/^Lot code/).value).toBe('GVF-LETTUCE-20261012-A1');
  });

  it('says what to fill in first', async () => {
    const { user } = setup({ role: 'manager' });
    await user.type(screen.getByLabelText(/^Crop/), 'Lettuce');
    await waitFor(() => expect(button().disabled).toBe(false));
    await user.click(button());
    expect(screen.getByText('Fill in the field first.')).toBeTruthy();
    expect(screen.getByLabelText(/^Lot code/).value).toBe('');
  });

  it('offers a new code when the box already has one', async () => {
    const { user } = setup({ role: 'manager', prefill: { lot_code: 'OLD-1' } });
    expect(screen.getByRole('button', { name: 'Make a new lot code' })).toBeTruthy();
    await user.type(screen.getByLabelText(/^Crop/), 'Lettuce');
    await user.type(screen.getByLabelText(/^Field/), 'A1');
    await waitFor(() => expect(button().disabled).toBe(false));
    await user.click(button());
    expect(screen.getByLabelText(/^Lot code/).value).toBe('GVF-LETTUCE-20261012-A1');
  });

  it('will not make a code for a field on hold, and says why', async () => {
    farmHas([FLOOD]);
    const { user } = setup({ role: 'manager' });
    await user.type(screen.getByLabelText(/^Crop/), 'Lettuce');
    await user.type(screen.getByLabelText(/^Field/), 'B4');
    expect(await screen.findByText(/can’t get a lot code until the corrective action/)).toBeTruthy();
    expect(button().disabled).toBe(true);
  });

  it('will not submit a harvest that has a lot code on a field on hold, but keeps it as a draft', async () => {
    farmHas([FLOOD]);
    createRecord.mockResolvedValue({ data: { id: 'new' }, error: null });
    const { user, onSaved } = setup({ role: 'manager' });
    await fillHarvest(user);
    await user.clear(screen.getByLabelText(/^Field/));
    await user.type(screen.getByLabelText(/^Field/), 'B4');
    await user.type(screen.getByLabelText(/^Lot code/), 'X-1');
    expect(await screen.findByText(/Take out the lot code/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Save & approve' }).disabled).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Save as draft' }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(createRecord.mock.calls[0][0].status).toBe('draft');
  });

  it('does not hold a harvest dated before the field’s hold began', async () => {
    farmHas([FLOOD]);
    const { user } = setup({ role: 'manager', today: '2026-09-15' });
    await user.type(screen.getByLabelText(/^Field/), 'B4');
    await user.type(screen.getByLabelText(/^Lot code/), 'X-1');
    await waitFor(() => expect(listRecordsForReport).toHaveBeenCalled());
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(screen.queryByText(/is on hold/)).toBeNull();
  });

  it('will not submit a harvest with a lot code while the holds cannot be read, but keeps it as a draft', async () => {
    listRecordsForReport.mockResolvedValue({ data: null, error: { code: 'unknown' } });
    createRecord.mockResolvedValue({ data: { id: 'new' }, error: null });
    const { user, onSaved } = setup({ role: 'manager' });
    await fillHarvest(user);
    await user.type(screen.getByLabelText(/^Lot code/), 'X-1');
    expect((await screen.findAllByText(/could not be checked right now/)).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Save & approve' }).disabled).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Save as draft' }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
  });

  it('does not block saving a change to a harvest that is already on file, whatever its field is doing now', async () => {
    farmHas([FLOOD]);
    updateRecord.mockResolvedValue({ data: { id: 'h1' }, error: null });
    const record = { id: 'h1', kind: 'harvest', status: 'approved', record_date: '2026-10-05', payload: { crop: 'Lettuce', field: 'B4', quantity: 5, unit: 'lb', lot_code: 'GVF-1' } };
    const { user, onSaved } = setup({ role: 'manager', record });
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
  });

  it('will not make a code when there are too many harvests to read all the codes already used', async () => {
    listRecordsForReport.mockImplementation(async ({ kinds }) => ({ data: { records: [], truncated: kinds.includes('harvest') }, error: null }));
    const { user } = setup({ role: 'manager' });
    await user.type(screen.getByLabelText(/^Crop/), 'Lettuce');
    await user.type(screen.getByLabelText(/^Field/), 'A1');
    expect(await screen.findByText(/so many harvests that the lot codes already used could not all be read/)).toBeTruthy();
    expect(button().disabled).toBe(true);
  });

  it('will not make a code when the holds or the used codes could not be read', async () => {
    listRecordsForReport.mockResolvedValue({ data: null, error: { code: 'unknown' } });
    const { user } = setup({ role: 'manager' });
    await user.type(screen.getByLabelText(/^Crop/), 'Lettuce');
    await user.type(screen.getByLabelText(/^Field/), 'A1');
    expect(await screen.findByText(/could not be checked right now/)).toBeTruthy();
    expect(button().disabled).toBe(true);
  });

  it('is only on a harvest', () => {
    setup({ kind: 'packing_cooling' });
    expect(screen.queryByRole('button', { name: /lot code$/ })).toBeNull();
  });

  it('speaks Spanish', async () => {
    const { user } = setup({ role: 'manager' }, 'es');
    await user.type(screen.getByLabelText(/^Cultivo/), 'Lechuga');
    await user.type(screen.getByLabelText(/^Campo/), 'A1');
    const make = screen.getByRole('button', { name: 'Crear código de lote' });
    await waitFor(() => expect(make.disabled).toBe(false));
    await user.click(make);
    expect(screen.getByLabelText(/^Código de lote/).value).toBe('GVF-LECHUGA-20261012-A1');
  });
});

describe('RecordForm: editing a record that can be moved on', () => {
  const draft = { id: 'h1', kind: 'harvest', status: 'draft', record_date: '2026-10-12', payload: { crop: 'Lettuce', field: 'A1', quantity: 5, unit: 'cartons' } };
  const FLOOD = { id: 'w1', kind: 'weather_event', status: 'approved', record_date: '2026-10-01', payload: { event_type: 'flood', field: 'B4', crop_contact: 'yes' } };
  const saveAnd = (name) => screen.getByRole('button', { name });

  it('offers only Save changes when the record cannot be moved on', () => {
    setup({ record: draft, role: 'owner' });
    expect(saveAnd('Save changes')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Save & approve' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Submit for review' })).toBeNull();
  });

  it('offers Save & approve next to Save changes, and saves then hands the approval on', async () => {
    updateRecord.mockResolvedValue({ data: { ...draft, id: 'h1' }, error: null });
    const { user, onSaved } = setup({ record: draft, role: 'owner', advanceTo: 'approved' });
    await user.clear(screen.getByLabelText(/^Quantity/));
    await user.type(screen.getByLabelText(/^Quantity/), '6');
    await user.click(saveAnd('Save & approve'));
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ id: 'h1' }), 'approved'));
    expect(updateRecord).toHaveBeenCalledWith('h1', expect.objectContaining({ payload: expect.objectContaining({ quantity: '6' }) }));
    expect(createRecord).not.toHaveBeenCalled();
  });

  it('says Submit for review when the person can send it on but not approve it', async () => {
    updateRecord.mockResolvedValue({ data: draft, error: null });
    const { user, onSaved } = setup({ record: draft, role: 'crew', advanceTo: 'pending_review' });
    expect(screen.queryByRole('button', { name: 'Save & approve' })).toBeNull();
    await user.click(saveAnd('Submit for review'));
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(expect.anything(), 'pending_review'));
  });

  it('keeps Save changes as a plain save that moves nothing', async () => {
    updateRecord.mockResolvedValue({ data: draft, error: null });
    const { user, onSaved } = setup({ record: draft, role: 'owner', advanceTo: 'approved' });
    await user.click(saveAnd('Save changes'));
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(onSaved.mock.calls[0]).toHaveLength(1);
  });

  it('cannot approve a record that is still missing something, but can save it', async () => {
    const { user } = setup({ record: { ...draft, payload: { crop: 'Lettuce', field: 'A1' } }, role: 'owner', advanceTo: 'approved' });
    expect(saveAnd('Save & approve').disabled).toBe(true);
    expect(saveAnd('Save changes').disabled).toBe(false);
    expect(screen.getByText(/Still needed:/).textContent).toMatch(/Quantity/);
    await user.type(screen.getByLabelText(/^Quantity/), '5');
    await user.type(screen.getByLabelText(/^Unit/), 'lb');
    await waitFor(() => expect(saveAnd('Save & approve').disabled).toBe(false));
  });

  it('does not save the changes when the save fails, and does not move the record on', async () => {
    updateRecord.mockResolvedValue({ data: null, error: { code: 'forbidden' } });
    const { user, onSaved } = setup({ record: draft, role: 'owner', advanceTo: 'approved' });
    await user.click(saveAnd('Save & approve'));
    expect((await screen.findByRole('alert')).textContent).toMatch(/permission/i);
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('will not approve a harvest with a lot code on a field on hold, but can still save the changes', async () => {
    farmHas([FLOOD]);
    const record = { ...draft, payload: { ...draft.payload, field: 'B4', lot_code: 'X-1' } };
    updateRecord.mockResolvedValue({ data: record, error: null });
    const { user, onSaved } = setup({ record, role: 'owner', advanceTo: 'approved' });
    expect(await screen.findByText(/Take out the lot code/)).toBeTruthy();
    expect(saveAnd('Save & approve').disabled).toBe(true);
    await user.click(saveAnd('Save changes'));
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ id: 'h1' })));
  });

  it('will not approve a harvest with a lot code while the holds cannot be read', async () => {
    listRecordsForReport.mockResolvedValue({ data: null, error: { code: 'unknown' } });
    const record = { ...draft, payload: { ...draft.payload, lot_code: 'X-1' } };
    setup({ record, role: 'owner', advanceTo: 'approved' });
    expect((await screen.findAllByText(/could not be checked right now/)).length).toBeGreaterThan(0);
    expect(saveAnd('Save & approve').disabled).toBe(true);
    expect(saveAnd('Save changes').disabled).toBe(false);
  });

  it('approves a harvest with no lot code on a field on hold: only the lot code is the problem', async () => {
    farmHas([FLOOD]);
    const record = { ...draft, payload: { ...draft.payload, field: 'B4' } };
    setup({ record, role: 'owner', advanceTo: 'approved' });
    await waitFor(() => expect(listRecordsForReport).toHaveBeenCalled());
    expect(saveAnd('Save & approve').disabled).toBe(false);
  });
});

describe('RecordForm: water assessments', () => {
  const LABEL = {
    source: /^Water source or system/,
    source_type: /^What kind of source it is/,
    fields_served: /^Fields this water is used on/,
    application_method: /^How the water is applied \*/,
    source_concern: /^The source and how the water travels/,
    nearby_concern: /^Animals, manure, compost or human waste/,
    practice_concern: /^How the water is applied, and the time before harvest/,
    crop_concern: /^The crop/,
    weather_concern: /^The weather/,
    testing_concern: /^Water test results/,
    conclusion: /^What you decided/,
  };
  const CONCERNS = ['source_concern', 'nearby_concern', 'practice_concern', 'crop_concern', 'weather_concern', 'testing_concern'];
  const rateAll = async (user, level, overrides = {}) => {
    for (const key of CONCERNS) await user.selectOptions(screen.getByLabelText(LABEL[key]), overrides[key] ?? level);
  };
  const FLOOD = { id: 'w1', kind: 'weather_event', status: 'approved', record_date: '2026-06-10', created_at: '2026-06-10T15:00:00Z', payload: { event_type: 'flood', field: 'A1', crop_contact: 'no' } };
  const WELL = { id: 'a1', kind: 'water_assessment', status: 'approved', record_date: '2026-03-01', created_at: '2026-03-01T09:00:00Z', payload: { source: 'Well 1', fields_served: 'A1, A2', conclusion: 'no_mitigation' } };
  const assessment = (props = {}) => setup({ kind: 'water_assessment', role: 'manager', ...props });

  it('goes in three steps: the source, each thing the rule asks about, and the decision', () => {
    assessment();
    expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual(['The water source', 'Look at each thing the rule asks about', 'Your decision']);
    expect(screen.getByText('Rate how worried you are about each one: low, some or high concern.')).toBeTruthy();
  });

  it('has no such steps on other records', () => {
    setup({ kind: 'harvest', role: 'manager' });
    expect(screen.queryAllByRole('heading', { level: 3 })).toEqual([]);
  });

  it('asks for every factor to be rated, then says what the ratings add up to', async () => {
    const { user } = assessment();
    expect(screen.getByText('Rate every factor to see what your answers add up to.')).toBeTruthy();
    await rateAll(user, 'low');
    expect(await screen.findByText('Every factor is low concern, so no measures look needed.')).toBeTruthy();
  });

  it('fills in the suggested conclusion when asked, and the person can still choose the other', async () => {
    const { user } = assessment();
    await rateAll(user, 'low');
    await user.click(screen.getByRole('button', { name: 'Use “No measures needed”' }));
    expect(screen.getByLabelText(LABEL.conclusion).value).toBe('no_mitigation');
    await user.selectOptions(screen.getByLabelText(LABEL.conclusion), 'mitigation_needed');
    expect(screen.getByLabelText(LABEL.conclusion).value).toBe('mitigation_needed');
  });

  it('suggests measures when a factor is high concern, and warns if the person then says none are needed', async () => {
    const { user } = assessment();
    await rateAll(user, 'low', { weather_concern: 'high' });
    expect(await screen.findByText(/so measures to protect the water look needed/)).toBeTruthy();
    await user.selectOptions(screen.getByLabelText(LABEL.conclusion), 'no_mitigation');
    expect(screen.getByRole('alert').textContent).toContain('Write why in the notes.');
  });

  it('asks what the measures are only once the conclusion is that measures are needed', async () => {
    const { user } = assessment();
    expect(screen.queryByLabelText(/^The measures you will take/)).toBeTruthy();
    expect(screen.getByLabelText(/^The measures you will take/).getAttribute('aria-required')).toBeNull();
    await user.selectOptions(screen.getByLabelText(LABEL.conclusion), 'mitigation_needed');
    expect(screen.getByLabelText(/^The measures you will take/).getAttribute('aria-required')).toBe('true');
  });

  it('reminds that a public water system may not need an assessment', async () => {
    const { user } = assessment();
    expect(screen.queryByText(/A public water system may not need a written assessment/)).toBeNull();
    await user.selectOptions(screen.getByLabelText(LABEL.source_type), 'public');
    expect(screen.getByText(/A public water system may not need a written assessment/)).toBeTruthy();
  });

  it('tells the person about a flood in the last year on the fields the water is used on', async () => {
    farmHas([FLOOD]);
    const { user } = assessment();
    await user.type(screen.getByLabelText(LABEL.fields_served), 'A1, B2');
    expect(await screen.findByText('Flood in the last year that may have reached this water: 2026-06-10 (A1). Think about it when you rate the weather.')).toBeTruthy();
  });

  it('says nothing about floods on other fields', async () => {
    farmHas([FLOOD]);
    const { user } = assessment();
    await user.type(screen.getByLabelText(LABEL.fields_served), 'C3');
    await waitFor(() => expect(listRecordsForReport).toHaveBeenCalled());
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(screen.queryByText(/Flood in the last year/)).toBeNull();
  });

  it('says so when it could not check for floods', async () => {
    listRecordsForReport.mockResolvedValue({ data: null, error: { code: 'unknown' } });
    assessment();
    expect(await screen.findByText(/Floods could not be checked right now/)).toBeTruthy();
  });

  it('saves a complete assessment for a manager as approved', async () => {
    createRecord.mockResolvedValue({ data: { id: 'new' }, error: null });
    const { user, onSaved } = assessment();
    await user.type(screen.getByLabelText(LABEL.source), 'Well 1');
    await user.selectOptions(screen.getByLabelText(LABEL.source_type), 'enclosed_groundwater');
    await user.type(screen.getByLabelText(LABEL.fields_served), 'A1');
    await user.selectOptions(screen.getByLabelText(LABEL.application_method), 'drip');
    await rateAll(user, 'low');
    await user.click(screen.getByRole('button', { name: 'Use “No measures needed”' }));
    await user.click(screen.getByRole('button', { name: 'Save & approve' }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(createRecord).toHaveBeenCalledWith(expect.objectContaining({ kind: 'water_assessment', status: 'approved', payload: expect.objectContaining({ source: 'Well 1', conclusion: 'no_mitigation', weather_concern: 'low' }) }));
  });

  it('starts a new assessment from the answers it is given', () => {
    assessment({ prefill: { source: 'Well 1', source_type: 'enclosed_groundwater', fields_served: 'A1, A2', application_method: 'drip', weather_concern: 'some' } });
    expect(screen.getByLabelText(LABEL.source).value).toBe('Well 1');
    expect(screen.getByLabelText(LABEL.weather_concern).value).toBe('some');
    expect(screen.getByLabelText(LABEL.conclusion).value).toBe('');
  });

  it('does not read the farm’s records for any other kind of record', async () => {
    setup({ kind: 'note', role: 'manager' });
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(listRecordsForReport).not.toHaveBeenCalled();
  });

  describe('on a flood record', () => {
    const floodForm = async (user, props = {}) => {
      await user.selectOptions(screen.getByLabelText(/^Event/), 'flood');
      return props;
    };

    it('reminds that a flood can reach the water, and names the assessed sources for the field', async () => {
      farmHas([WELL]);
      const { user } = setup({ kind: 'weather_event', role: 'manager' });
      await floodForm(user);
      await user.type(screen.getByLabelText(/^Field/), 'a2');
      expect(await screen.findByText('A flood can reach your water')).toBeTruthy();
      expect(await screen.findByText('Water sources for this field: Well 1.')).toBeTruthy();
    });

    it('says when no assessment lists the field', async () => {
      farmHas([WELL]);
      const { user } = setup({ kind: 'weather_event', role: 'manager' });
      await floodForm(user);
      await user.type(screen.getByLabelText(/^Field/), 'Z9');
      expect(await screen.findByText(/No water assessment lists this field yet/)).toBeTruthy();
    });

    it('also finds the source the flood names', async () => {
      farmHas([WELL]);
      const { user } = setup({ kind: 'weather_event', role: 'manager' });
      await floodForm(user);
      await user.type(screen.getByLabelText(/^Field/), 'Z9');
      await user.type(screen.getByLabelText(/^Water source it may have reached/), 'well 1');
      expect(await screen.findByText('Water sources for this field: Well 1.')).toBeTruthy();
    });

    it('says nothing about water for other weather, and reads nothing', async () => {
      const { user } = setup({ kind: 'weather_event', role: 'manager' });
      await user.selectOptions(screen.getByLabelText(/^Event/), 'hail');
      expect(screen.queryByText('A flood can reach your water')).toBeNull();
      expect(listRecordsForReport).not.toHaveBeenCalled();
    });

    it('does not name sources before the farm’s assessments have been read', async () => {
      listRecordsForReport.mockReturnValue(new Promise(() => {}));
      const { user } = setup({ kind: 'weather_event', role: 'manager' });
      await floodForm(user);
      await user.type(screen.getByLabelText(/^Field/), 'A1');
      expect(screen.getByText('A flood can reach your water')).toBeTruthy();
      expect(screen.queryByText(/No water assessment lists this field yet/)).toBeNull();
    });
  });
});
