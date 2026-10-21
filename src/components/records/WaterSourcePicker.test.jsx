// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { useState } from 'react';
import { screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithLang } from './testUtils.jsx';
import WaterSourcePicker from './WaterSourcePicker.jsx';

const s = (name, is_active = true) => ({ id: `id-${name}`, name, is_active });

function Harness({ initial = '', onValue, ...props }) {
  const [value, setValue] = useState(initial);
  return <WaterSourcePicker id="rec-source" label="Water source or system *" value={value} onChange={(next) => { setValue(next); onValue?.(next); }} {...props} />;
}
const setup = (props = {}, lang = 'en') => {
  const onValue = vi.fn();
  const user = userEvent.setup();
  renderWithLang(<Harness sources={[s('Well 1'), s('Canal'), s('Old pond', false)]} onValue={onValue} {...props} />, lang);
  return { user, onValue };
};
const select = () => screen.getByLabelText(/^Water source or system/);
afterEach(cleanup);

describe('WaterSourcePicker', () => {
  it('offers the active water sources, a first choice that says what to do, and "Other"', () => {
    setup();
    expect([...select().options].map((o) => o.textContent)).toEqual(['Choose a water source', 'Well 1', 'Canal', 'Other (type a name)…']);
  });

  it('gives back the name of the one chosen', async () => {
    const { user, onValue } = setup();
    await user.selectOptions(select(), 'Canal');
    expect(onValue).toHaveBeenLastCalledWith('Canal');
  });

  it('lets a name that is not on the list be typed, and says it is not on the list', async () => {
    const { user, onValue } = setup();
    await user.selectOptions(select(), '__other__');
    await user.type(screen.getByLabelText('Water source name'), 'Spring');
    expect(onValue).toHaveBeenLastCalledWith('Spring');
    expect(screen.getByText('This name is not in your list of water sources yet.')).toBeTruthy();
  });

  it('keeps an archived source a record already names, marked archived', () => {
    setup({ initial: 'Old pond' });
    expect(select().value).toBe('Old pond');
    expect([...select().options].map((o) => o.textContent)).toContain('Old pond (archived)');
  });

  it('shows a name not on the list as typed in', () => {
    setup({ initial: 'Spring' });
    expect(select().value).toBe('__other__');
    expect(screen.getByLabelText('Water source name').value).toBe('Spring');
  });

  it('speaks Spanish', () => {
    setup({}, 'es');
    expect([...screen.getByLabelText(/^Water source or system/).options].map((o) => o.textContent)).toEqual(['Elige una fuente de agua', 'Well 1', 'Canal', 'Otra (escribe un nombre)…']);
  });
});
