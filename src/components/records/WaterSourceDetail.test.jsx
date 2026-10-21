// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen, cleanup, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithLang } from './testUtils.jsx';
import { waterSources } from '../../domain/records/waterAssessment.js';
import WaterSourceDetail from './WaterSourceDetail.jsx';

const TODAY = '2026-10-19';
const calm = { source_concern: 'low', nearby_concern: 'low', practice_concern: 'low', crop_concern: 'low', weather_concern: 'low', testing_concern: 'low' };
let n = 0;
const assessment = (source, date, payload = {}) => ({
  id: `a${(n += 1)}`, kind: 'water_assessment', status: 'approved', record_date: date, created_at: `${date}T09:00:00Z`,
  payload: { source, source_type: 'enclosed_groundwater', fields_served: 'A1, A2', application_method: 'drip', ...calm, conclusion: 'no_mitigation', ...payload },
});
const test = (source, date, result, value) => ({ id: `t${(n += 1)}`, kind: 'water_test', status: 'approved', record_date: date, created_at: `${date}T09:00:00Z`, payload: { source, result, result_value: value } });
const flood = (field, date, payload = {}) => ({ id: `f${(n += 1)}`, kind: 'weather_event', status: 'approved', record_date: date, created_at: `${date}T15:00:00Z`, payload: { event_type: 'flood', field, crop_contact: 'no', ...payload } });
const entry = (name, extra = {}) => ({ id: `s-${name}`, name, source_type: 'enclosed_groundwater', fields_served: 'A1, A2', notes: 'Behind the barn', is_active: true, ...extra });

const setup = ({ records, registry, key = 'well1', props = {} }, lang = 'en') => {
  const row = waterSources(records, { today: TODAY, registry, includeArchived: true }).find((r) => r.key === key);
  const handlers = { onAssess: vi.fn(), onEdit: vi.fn(), onToggleActive: vi.fn(), onDelete: vi.fn(), onClose: vi.fn() };
  const user = userEvent.setup();
  renderWithLang(<WaterSourceDetail row={row} records={records} entry={registry.find((e) => e.name === row.name) ?? null} canManage canRecord uses={0} {...handlers} {...props} />, lang);
  return { user, row, ...handlers };
};
const fact = (label) => within(screen.getByText(label).closest('[data-testid="water-fact"]')).getByTestId('water-fact-value').textContent;
afterEach(cleanup);

const WELL = entry('Well 1');
const RECORDS = [
  assessment('Well 1', '2026-03-01', { conclusion: 'mitigation_needed', mitigation: 'Seal the casing by December', weather_concern: 'some', nearby_concern: 'high' }),
  assessment('Well 1', '2025-03-01'),
  test('Well 1', '2026-09-01', 'pass', 3),
  test('Well 1', '2026-04-01', 'fail', 250),
  flood('A2', '2026-06-10'),
];

describe('WaterSourceDetail: what the source is and how it stands', () => {
  it('names the source, its kind, the fields it waters and the notes', () => {
    setup({ records: RECORDS, registry: [WELL] });
    expect(screen.getByRole('dialog', { name: 'Well 1' })).toBeTruthy();
    expect(fact('Kind of source')).toBe('Groundwater: sealed, protected well');
    expect(fact('Fields it waters')).toBe('A1, A2');
    expect(fact('Notes')).toBe('Behind the barn');
  });

  it('says when it was last assessed and is next due, the decision, and the measures planned', () => {
    setup({ records: RECORDS, registry: [WELL] });
    expect(fact('Last assessed')).toBe('2026-03-01 · next review 2027-03-01');
    expect(fact('Decision')).toBe('Measures needed');
    expect(fact('Measures planned')).toBe('Seal the casing by December');
  });

  it('shows how each factor was rated in the newest assessment', () => {
    setup({ records: RECORDS, registry: [WELL] });
    const ratings = screen.getByRole('region', { name: 'How each factor was rated' });
    expect(within(ratings).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'The sourceLow concern', 'What is near the waterHigh concern', 'How it is appliedLow concern', 'The cropLow concern', 'The weatherSome concern', 'Test resultsLow concern',
    ]);
  });

  it('shows the last water test, and the floods since the last assessment', () => {
    setup({ records: RECORDS, registry: [WELL] });
    expect(fact('Last water test')).toBe('2026-09-01: Meets the standard');
    expect(within(screen.getByRole('region', { name: 'Floods since it was last assessed' })).getByText('2026-06-10 (A2)')).toBeTruthy();
  });

  it('says a new assessment clears the floods, and that a water test does not', () => {
    setup({ records: RECORDS, registry: [WELL] });
    expect(within(screen.getByRole('region', { name: 'Floods since it was last assessed' })).getByText('Record a new assessment to clear this. A water test helps you rate it, but does not replace it.')).toBeTruthy();
  });

  it('lists its assessments and its water tests, newest first', () => {
    setup({ records: RECORDS, registry: [WELL] });
    const assessments = within(screen.getByRole('region', { name: 'Assessments' })).getAllByRole('listitem').map((li) => li.textContent);
    expect(assessments).toEqual(['2026-03-01Measures needed', '2025-03-01No measures needed']);
    const tests = within(screen.getByRole('region', { name: 'Water tests' })).getAllByRole('listitem').map((li) => li.textContent);
    expect(tests).toEqual(['2026-09-01Meets the standard · 3', '2026-04-01Does not meet the standard · 250']);
  });

  it('says what it does not have yet, for a source that was never assessed or tested', () => {
    setup({ records: [], registry: [entry('New well', { notes: null })], key: 'newwell' });
    expect(fact('Last assessed')).toBe('—');
    expect(fact('Decision')).toBe('—');
    expect(fact('Last water test')).toBe('—');
    expect(fact('Notes')).toBe('—');
    expect(screen.getByText('No approved assessment yet.')).toBeTruthy();
    expect(screen.getByText('No approved water test yet.')).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'How each factor was rated' })).toBeNull();
  });

  it('says it is archived, and what that means', () => {
    setup({ records: RECORDS, registry: [entry('Well 1', { is_active: false })] });
    expect(screen.getByText(/This source is archived/)).toBeTruthy();
    expect(screen.getAllByText('Archived').length).toBeGreaterThan(0);
  });

  it('says when the source is only named in records and is not on the list', () => {
    setup({ records: RECORDS, registry: [] });
    expect(screen.getByText('Not in your list')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull();
  });

  it('says the records were cut short, so it may not show everything', () => {
    setup({ records: RECORDS, registry: [WELL], props: { truncated: true } });
    expect(screen.getByText('You have so many records that some could not be read, so this may not show everything.')).toBeTruthy();
  });

  it('shows only the latest of a long history', () => {
    const many = Array.from({ length: 25 }, (_, i) => test('Well 1', `2026-01-${String(i + 1).padStart(2, '0')}`, 'pass', i));
    setup({ records: [...RECORDS, ...many], registry: [WELL] });
    expect(within(screen.getByRole('region', { name: 'Water tests' })).getAllByRole('listitem')).toHaveLength(20);
    expect(screen.getByText('Showing the latest 20.')).toBeTruthy();
  });
});

describe('WaterSourceDetail: what can be done from it', () => {
  it('lets anyone who can record start an assessment, "again" when there has been one', async () => {
    const { user, onAssess, row } = setup({ records: RECORDS, registry: [WELL] });
    await user.click(screen.getByRole('button', { name: 'Assess again' }));
    expect(onAssess).toHaveBeenCalledWith(row);
  });

  it('says "Assess" for a source never assessed, and offers nothing for an archived one', () => {
    setup({ records: [], registry: [entry('New well')], key: 'newwell' });
    expect(screen.getByRole('button', { name: 'Assess' })).toBeTruthy();
    cleanup();
    setup({ records: RECORDS, registry: [entry('Well 1', { is_active: false })] });
    expect(screen.queryByRole('button', { name: /^Assess/ })).toBeNull();
  });

  it('lets an owner or manager edit, archive and delete a source on the list', async () => {
    const { user, onEdit, onToggleActive, onDelete } = setup({ records: [], registry: [entry('New well')], key: 'newwell' });
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    await user.click(screen.getByRole('button', { name: 'Archive' }));
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onEdit).toHaveBeenCalled();
    expect(onToggleActive).toHaveBeenCalled();
    expect(onDelete).toHaveBeenCalled();
  });

  it('offers to restore an archived source', async () => {
    const { user, onToggleActive } = setup({ records: RECORDS, registry: [entry('Well 1', { is_active: false })] });
    await user.click(screen.getByRole('button', { name: 'Restore' }));
    expect(onToggleActive).toHaveBeenCalled();
  });

  it('shows Delete as unavailable, with the reason, while records use the source, and still explains when it is pressed', async () => {
    const { user, onDelete } = setup({ records: RECORDS, registry: [WELL], props: { uses: 4 } });
    const button = screen.getByRole('button', { name: 'Delete' });
    expect(button.getAttribute('aria-disabled')).toBe('true');
    expect(button.getAttribute('title')).toBe('Records use this water source, so it cannot be deleted. Archive it instead.');
    await user.click(button);
    expect(onDelete).toHaveBeenCalled();
  });

  it('gives crew no way to change the list, and no way to assess if they may not record', () => {
    setup({ records: RECORDS, registry: [WELL], props: { canManage: false } });
    for (const name of ['Edit', 'Archive', 'Delete']) expect(screen.queryByRole('button', { name })).toBeNull();
    expect(screen.getByRole('button', { name: 'Assess again' })).toBeTruthy();
  });

  it('turns its buttons off while something is under way, and closes', async () => {
    const { user, onClose } = setup({ records: RECORDS, registry: [WELL], props: { busy: true } });
    expect(screen.getByRole('button', { name: 'Edit' }).disabled).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('speaks Spanish', () => {
    setup({ records: RECORDS, registry: [WELL] }, 'es');
    expect(screen.getByText('Tipo de fuente')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Evaluar de nuevo' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Editar' })).toBeTruthy();
  });
});
