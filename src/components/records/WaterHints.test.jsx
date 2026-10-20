// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithLang } from './testUtils.jsx';
import { ConcernSummary, FloodWaterNote, RecentFloodsNote } from './WaterHints.jsx';

afterEach(cleanup);

const calm = { source_concern: 'low', nearby_concern: 'low', practice_concern: 'low', crop_concern: 'low', weather_concern: 'low', testing_concern: 'low' };

describe('ConcernSummary', () => {
  const setup = (values, lang = 'en') => {
    const onUse = vi.fn();
    const user = userEvent.setup();
    renderWithLang(<ConcernSummary values={values} onUse={onUse} />, lang);
    return { user, onUse };
  };

  it('asks for every factor to be rated before it says anything', () => {
    setup({ ...calm, crop_concern: '' });
    expect(screen.getByRole('status').textContent).toBe('Rate every factor to see what your answers add up to.');
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('says measures look needed, naming the high-concern factors, and offers to use that conclusion', async () => {
    const { user, onUse } = setup({ ...calm, nearby_concern: 'high', weather_concern: 'high' });
    expect(screen.getByRole('status').textContent).toContain('You rated what is near the water and the weather as high concern, so measures to protect the water look needed.');
    await user.click(screen.getByRole('button', { name: 'Use “Measures needed”' }));
    expect(onUse).toHaveBeenCalledWith('mitigation_needed');
  });

  it('says no measures look needed when everything is low concern, and offers that conclusion', async () => {
    const { user, onUse } = setup(calm);
    expect(screen.getByRole('status').textContent).toContain('Every factor is low concern, so no measures look needed.');
    await user.click(screen.getByRole('button', { name: 'Use “No measures needed”' }));
    expect(onUse).toHaveBeenCalledWith('no_mitigation');
  });

  it('leaves it to the person when some factors are of some concern, without offering a conclusion', () => {
    setup({ ...calm, crop_concern: 'some', source_concern: 'some' });
    expect(screen.getByRole('status').textContent).toContain('You rated the source and the crop as some concern. Decide whether measures are needed, and write why in the notes.');
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('does not offer the conclusion that is already chosen', () => {
    setup({ ...calm, conclusion: 'no_mitigation' });
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('warns when something is high concern but the conclusion is that no measures are needed', () => {
    setup({ ...calm, weather_concern: 'high', conclusion: 'no_mitigation' });
    expect(screen.getByText('You rated something as high concern but chose “No measures needed”. Write why in the notes.')).toBeTruthy();
    cleanup();
    setup({ ...calm, weather_concern: 'high', conclusion: 'mitigation_needed' });
    expect(screen.queryByText(/Write why in the notes/)).toBeNull();
  });

  it('says when measures must be in place if the concern is animals, manure or people near the water', () => {
    setup({ ...calm, nearby_concern: 'high' });
    expect(screen.getByText(/must be in place promptly, and no later than the same growing season/)).toBeTruthy();
    cleanup();
    setup({ ...calm, weather_concern: 'high' });
    expect(screen.queryByText(/same growing season/)).toBeNull();
  });

  it('speaks Spanish', () => {
    setup({ ...calm, nearby_concern: 'high', weather_concern: 'high' }, 'es');
    expect(screen.getByRole('status').textContent).toContain('Calificaste lo que hay cerca del agua y el clima con mucha preocupación');
    expect(screen.getByRole('button', { name: 'Usar “Se necesitan medidas”' })).toBeTruthy();
  });
});

describe('RecentFloodsNote', () => {
  it('names the floods in the last year that may have reached this water', () => {
    renderWithLang(<RecentFloodsNote status="ready" floods={[{ id: 'f1', date: '2026-06-10', field: 'A2' }, { id: 'f2', date: '2026-03-01', field: '' }]} />);
    expect(screen.getByRole('status').textContent).toBe('Flood in the last year that may have reached this water: 2026-06-10 (A2), 2026-03-01. Think about it when you rate the weather.');
  });

  it('says nothing when there are none, and says so when floods could not be checked', () => {
    const { container } = renderWithLang(<RecentFloodsNote status="ready" floods={[]} />);
    expect(container.textContent).toBe('');
    cleanup();
    renderWithLang(<RecentFloodsNote status="error" floods={[]} />);
    expect(screen.getByRole('status').textContent).toContain('Floods could not be checked right now');
  });

  it('says nothing while it is still reading', () => {
    const { container } = renderWithLang(<RecentFloodsNote status="loading" floods={[]} />);
    expect(container.textContent).toBe('');
  });
});

describe('FloodWaterNote', () => {
  it('reminds that a flood can reach the water, and names the assessed sources for the field', () => {
    renderWithLang(<FloodWaterNote status="ready" sources={[{ key: 'well 1', name: 'Well 1' }, { key: 'canal', name: 'Canal' }]} />);
    const note = screen.getByRole('status').textContent;
    expect(note).toContain('A flood can reach your water');
    expect(note).toContain('After you save, check whether the water sources for this field need a new assessment.');
    expect(note).toContain('Water sources for this field: Well 1, Canal.');
  });

  it('says no assessment lists the field when none does', () => {
    renderWithLang(<FloodWaterNote status="ready" sources={[]} />);
    expect(screen.getByRole('status').textContent).toContain('No water assessment lists this field yet.');
  });

  it('does not claim to know the sources while still reading, or when it could not', () => {
    renderWithLang(<FloodWaterNote status="loading" sources={[]} />);
    expect(screen.getByRole('status').textContent).not.toContain('Water sources for this field');
    expect(screen.getByRole('status').textContent).not.toContain('No water assessment lists');
    cleanup();
    renderWithLang(<FloodWaterNote status="error" sources={[]} />);
    expect(screen.getByRole('status').textContent).not.toContain('No water assessment lists');
  });

  it('speaks Spanish', () => {
    renderWithLang(<FloodWaterNote status="ready" sources={[{ key: 'pozo', name: 'Pozo 1' }]} />, 'es');
    expect(screen.getByRole('status').textContent).toContain('Una inundación puede llegar a tu agua');
    expect(screen.getByRole('status').textContent).toContain('Fuentes de agua de este campo: Pozo 1.');
  });
});
