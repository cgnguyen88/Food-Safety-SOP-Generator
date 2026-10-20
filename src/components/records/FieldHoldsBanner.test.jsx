// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithLang } from './testUtils.jsx';
import FieldHoldsBanner from './FieldHoldsBanner.jsx';

const HOLD = {
  key: 'b4',
  name: 'B4',
  since: '2026-10-01',
  triggers: [
    { id: 'w1', kind: 'weather_event', reason: 'crop_contact', date: '2026-10-01', field: 'B4', detail: 'flood' },
    { id: 'w2', kind: 'wildlife_check', reason: 'animal_signs', date: '2026-10-02', field: 'B4', detail: '' },
  ],
};
afterEach(cleanup);

describe('FieldHoldsBanner', () => {
  it('lists each field on hold with the date and the reasons', () => {
    renderWithLang(<FieldHoldsBanner status="ready" holds={[HOLD]} onClear={() => {}} />);
    expect(screen.getByRole('heading', { name: 'Fields on hold' })).toBeTruthy();
    expect(screen.getByText('B4')).toBeTruthy();
    expect(screen.getByText('On hold since 2026-10-01')).toBeTruthy();
    expect(screen.getByText('Water, ash or debris reached the crop · Signs of animals found')).toBeTruthy();
  });

  it('starts the corrective action for the field that was chosen', async () => {
    const onClear = vi.fn();
    renderWithLang(<FieldHoldsBanner status="ready" holds={[HOLD, { ...HOLD, key: 'a1', name: 'A1' }]} onClear={onClear} />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Record corrective action: A1' }));
    expect(onClear).toHaveBeenCalledWith(expect.objectContaining({ name: 'A1' }));
  });

  it('shows nothing when no field is on hold, or while the holds are still being read', () => {
    const { container, rerender } = renderWithLang(<FieldHoldsBanner status="ready" holds={[]} onClear={() => {}} />);
    expect(container.textContent).toBe('');
    rerender(<FieldHoldsBanner status="loading" holds={[HOLD]} onClear={() => {}} />);
    expect(container.textContent).toBe('');
  });

  it('says so, and offers another try, when the holds could not be read', async () => {
    const onRetry = vi.fn();
    renderWithLang(<FieldHoldsBanner status="error" holds={[]} onClear={() => {}} onRetry={onRetry} />);
    expect(screen.getByRole('alert').textContent).toMatch(/could not be checked/);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalled();
  });

  it('speaks Spanish', () => {
    renderWithLang(<FieldHoldsBanner status="ready" holds={[HOLD]} onClear={() => {}} />, 'es');
    expect(screen.getByRole('heading', { name: 'Campos en retención' })).toBeTruthy();
    expect(screen.getByText('En retención desde 2026-10-01')).toBeTruthy();
  });
});
