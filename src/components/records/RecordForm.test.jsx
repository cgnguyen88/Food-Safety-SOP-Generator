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
