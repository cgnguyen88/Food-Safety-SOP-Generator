// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LanguageContext } from '../i18n/LanguageContext.jsx';
import FarmProfileModal from './FarmProfileModal.jsx';

const setup = (profile = {}, lang = 'en') => {
  const onSave = vi.fn();
  const user = userEvent.setup();
  render(
    <LanguageContext.Provider value={{ lang, toggleLang: () => {} }}>
      <FarmProfileModal profile={profile} onSave={onSave} onClose={() => {}} />
    </LanguageContext.Provider>,
  );
  return { user, onSave };
};
const box = () => screen.getByLabelText('Lot Code Format');
afterEach(cleanup);

describe('FarmProfileModal: the lot code format', () => {
  it('shows the saved format, with the parts that can be used', () => {
    setup({ lot_code_format: '{FARM}-{YYYYMMDD}' });
    expect(box().value).toBe('{FARM}-{YYYYMMDD}');
    expect(screen.getByText(/Parts you can use/)).toBeTruthy();
  });

  it('saves a good format with the rest of the profile', async () => {
    const { user, onSave } = setup({ farm_name: 'Sunny' });
    await user.type(box(), '{{FARM}-{{YYYYMMDD}-{{SEQ}');
    await user.click(screen.getByRole('button', { name: 'Save Profile' }));
    expect(onSave).toHaveBeenCalledWith({ farm_name: 'Sunny', lot_code_format: '{FARM}-{YYYYMMDD}-{SEQ}' });
  });

  it('saves a blank format (the usual one is then used)', async () => {
    const { user, onSave } = setup({ farm_name: 'Sunny' });
    await user.click(screen.getByRole('button', { name: 'Save Profile' }));
    expect(onSave).toHaveBeenCalledWith({ farm_name: 'Sunny' });
  });

  it('says a format cannot be used, and will not save it', async () => {
    const { user, onSave } = setup();
    await user.type(box(), '{{FARM}-{{COLOR}');
    expect(box().getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByText(/can't be used/)).toBeTruthy();
    const save = screen.getByRole('button', { name: 'Save Profile' });
    expect(save.disabled).toBe(true);
    await user.click(save);
    expect(onSave).not.toHaveBeenCalled();
  });

  it('refuses a format with no date part', async () => {
    const { user } = setup();
    await user.type(box(), '{{FARM}-{{CROP}');
    expect(screen.getByRole('button', { name: 'Save Profile' }).disabled).toBe(true);
  });

  it('speaks Spanish', () => {
    setup({}, 'es');
    expect(screen.getByLabelText('Formato del Código de Lote')).toBeTruthy();
    expect(screen.getByText(/Partes que puedes usar/)).toBeTruthy();
  });
});
