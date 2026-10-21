// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithLang } from './testUtils.jsx';

vi.mock('../../lib/waterSources.js', () => ({ createWaterSource: vi.fn(), updateWaterSource: vi.fn() }));
const { createWaterSource, updateWaterSource } = await import('../../lib/waterSources.js');
const { default: WaterSourceForm } = await import('./WaterSourceForm.jsx');

const setup = (props = {}, lang = 'en') => {
  const onSaved = vi.fn();
  const onCancel = vi.fn();
  const user = userEvent.setup();
  renderWithLang(<WaterSourceForm farmId="farm-1" onSaved={onSaved} onCancel={onCancel} {...props} />, lang);
  return { user, onSaved, onCancel };
};
const WELL = { id: 's-1', farm_id: 'farm-1', name: 'Well 1', source_type: 'enclosed_groundwater', fields_served: 'A1, A2', notes: 'Behind the barn', is_active: true };
const name = () => screen.getByLabelText('Name');

beforeEach(() => {
  createWaterSource.mockReset();
  updateWaterSource.mockReset();
});
afterEach(cleanup);

describe('WaterSourceForm: adding', () => {
  it('asks for a name, the kind of source, the fields it waters and notes', () => {
    setup();
    expect(screen.getByRole('dialog', { name: 'Add water source' })).toBeTruthy();
    expect(name().value).toBe('');
    const kinds = [...screen.getByLabelText(/^What kind of source it is/).options].map((o) => o.textContent);
    expect(kinds).toEqual(['', 'Groundwater: sealed, protected well', 'Groundwater: open or unprotected well', 'Surface water: pond, river or stream', 'Open canal or ditch', 'Public water system', 'Other']);
    expect(screen.getByLabelText(/^Fields it waters/)).toBeTruthy();
    expect(screen.getByLabelText(/^Notes/)).toBeTruthy();
  });

  it('saves what was typed to this farm, and hands the new source back', async () => {
    createWaterSource.mockResolvedValue({ data: { id: 's-9', name: 'Canal' }, error: null });
    const { user, onSaved } = setup();
    await user.type(name(), 'Canal');
    await user.selectOptions(screen.getByLabelText(/^What kind of source it is/), 'canal');
    await user.type(screen.getByLabelText(/^Fields it waters/), 'B1, B2');
    await user.type(screen.getByLabelText(/^Notes/), 'Dry in August');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith({ id: 's-9', name: 'Canal' }));
    expect(createWaterSource).toHaveBeenCalledWith({ farmId: 'farm-1', name: 'Canal', source_type: 'canal', fields_served: 'B1, B2', notes: 'Dry in August' });
  });

  it('says what is wrong next to its box, puts the cursor there, and asks nothing of the database', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByText('Enter a name.')).toBeTruthy();
    expect(document.activeElement).toBe(name());
    expect(name().getAttribute('aria-invalid')).toBe('true');
    expect(createWaterSource).not.toHaveBeenCalled();
    await user.type(name(), 'x');
    expect(screen.queryByText('Enter a name.')).toBeNull();
  });

  it.each([
    ['a name that is taken', 'duplicate', 'You already have a water source with that name.'],
    ['a name records use', 'in_use', /Records use this name/],
  ])('says %s next to the name box', async (_label, code, message) => {
    createWaterSource.mockResolvedValue({ data: null, error: { code } });
    const { user, onSaved } = setup();
    await user.type(name(), 'Well 1');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText(message)).toBeTruthy();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('says what the database complained about, box by box', async () => {
    createWaterSource.mockResolvedValue({ data: null, error: { code: 'invalid', fields: { notes: 'too_long' } } });
    const { user } = setup();
    await user.type(name(), 'Well 1');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('That is too long.')).toBeTruthy();
  });

  it.each([
    ['forbidden', 'Only an owner or manager can change water sources.'],
    ['too_many', /at most 200 water sources/],
    ['not_set_up', /not set up on the server yet/],
    ['unknown', 'Something went wrong. Please try again.'],
  ])('explains a %s failure in an alert', async (code, message) => {
    createWaterSource.mockResolvedValue({ data: null, error: { code } });
    const { user } = setup();
    await user.type(name(), 'Well 1');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(message);
  });

  it('turns its buttons off while it saves, and cancels without saving', async () => {
    let finish;
    createWaterSource.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    const { user, onCancel } = setup();
    await user.type(name(), 'Well 1');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByRole('button', { name: 'Saving…' }).disabled).toBe(true);
    expect(screen.getByRole('button', { name: 'Cancel' }).disabled).toBe(true);
    finish({ data: { id: 's' }, error: null });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save' })).toBeTruthy());
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalled();
  });
});

describe('WaterSourceForm: editing', () => {
  it('starts from the source, and saves the changes with updateWaterSource', async () => {
    updateWaterSource.mockResolvedValue({ data: { ...WELL, notes: 'Moved' }, error: null });
    const { user, onSaved } = setup({ source: WELL });
    expect(screen.getByRole('dialog', { name: 'Edit water source' })).toBeTruthy();
    expect(name().value).toBe('Well 1');
    expect(screen.getByLabelText(/^What kind of source it is/).value).toBe('enclosed_groundwater');
    expect(screen.getByLabelText(/^Fields it waters/).value).toBe('A1, A2');
    await user.clear(screen.getByLabelText(/^Notes/));
    await user.type(screen.getByLabelText(/^Notes/), 'Moved');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(updateWaterSource).toHaveBeenCalledWith('s-1', { name: 'Well 1', source_type: 'enclosed_groundwater', fields_served: 'A1, A2', notes: 'Moved' });
    expect(createWaterSource).not.toHaveBeenCalled();
  });

  it('shows empty boxes for what the source does not have', () => {
    setup({ source: { id: 's-2', name: 'Canal', source_type: null, fields_served: null, notes: null, is_active: true } });
    expect(screen.getByLabelText(/^What kind of source it is/).value).toBe('');
    expect(screen.getByLabelText(/^Notes/).value).toBe('');
  });

  it('keeps the name as it is, and says why, while records use it', async () => {
    updateWaterSource.mockResolvedValue({ data: WELL, error: null });
    const { user } = setup({ source: WELL, nameLocked: true });
    expect(name().readOnly).toBe(true);
    expect(screen.getByText(/Records use this name, so it cannot be changed/)).toBeTruthy();
    await user.type(name(), 'zzz');
    expect(name().value).toBe('Well 1');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(updateWaterSource).toHaveBeenCalled());
  });
});

describe('WaterSourceForm: Spanish', () => {
  it('speaks Spanish', () => {
    setup({}, 'es');
    expect(screen.getByRole('dialog', { name: 'Agregar fuente de agua' })).toBeTruthy();
    expect(screen.getByLabelText('Nombre')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeTruthy();
  });
});
