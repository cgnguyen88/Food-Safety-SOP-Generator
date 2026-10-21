import { describe, it, expect } from 'vitest';
import { canManageWaterSources, validateWaterSourceInput, WATER_SOURCE_TYPES } from './waterSources.js';

describe('validateWaterSourceInput: what a water source on the farm’s list may hold', () => {
  const ok = (input) => validateWaterSourceInput(input);

  it('tidies the name, and keeps the kind, the fields and the notes', () => {
    expect(ok({ name: '  Well   1 ', source_type: 'enclosed_groundwater', fields_served: ' A1, A2 ', notes: ' Behind the barn ' })).toEqual({
      ok: true, errors: {}, value: { name: 'Well 1', source_type: 'enclosed_groundwater', fields_served: 'A1, A2', notes: 'Behind the barn' },
    });
  });

  it('needs only a name; the rest is left empty, as null', () => {
    expect(ok({ name: 'Canal' })).toEqual({ ok: true, errors: {}, value: { name: 'Canal', source_type: null, fields_served: null, notes: null } });
    expect(ok({ name: 'Canal', source_type: '', fields_served: '   ', notes: '' }).value).toEqual({ name: 'Canal', source_type: null, fields_served: null, notes: null });
  });

  it('refuses an empty name, or one that is only spaces or invisible characters', () => {
    for (const name of ['', '   ', undefined, null, '​​']) expect(ok({ name }).errors.name, String(name)).toBe('required');
  });

  it('allows a name of 60 characters, counting characters and not bytes, and refuses more', () => {
    expect(ok({ name: 'x'.repeat(60) }).ok).toBe(true);
    expect(ok({ name: '北'.repeat(60) }).ok).toBe(true);
    expect(ok({ name: 'x'.repeat(61) }).errors.name).toBe('too_long');
  });

  it('knows the kinds of source the assessment form knows', () => {
    expect(WATER_SOURCE_TYPES).toEqual(['enclosed_groundwater', 'open_groundwater', 'surface', 'canal', 'public', 'other']);
    for (const source_type of WATER_SOURCE_TYPES) expect(ok({ name: 'x', source_type }).ok, source_type).toBe(true);
    expect(ok({ name: 'x', source_type: 'lake' }).errors.source_type).toBe('invalid');
  });

  it('refuses fields or notes that are too long', () => {
    expect(ok({ name: 'x', fields_served: 'f'.repeat(1000) }).ok).toBe(true);
    expect(ok({ name: 'x', fields_served: 'f'.repeat(1001) }).errors.fields_served).toBe('too_long');
    expect(ok({ name: 'x', notes: 'n'.repeat(1000) }).ok).toBe(true);
    expect(ok({ name: 'x', notes: 'n'.repeat(1001) }).errors.notes).toBe('too_long');
  });

  it('says what is wrong with each box at once, and gives no value', () => {
    const result = ok({ name: '', source_type: 'lake', notes: 'n'.repeat(2000) });
    expect(result).toEqual({ ok: false, errors: { name: 'required', source_type: 'invalid', notes: 'too_long' }, value: null });
  });

  it('copes with nothing at all', () => {
    expect(ok(undefined).errors.name).toBe('required');
    expect(ok({}).ok).toBe(false);
  });

  it('only lets an owner or a manager change the list', () => {
    expect(canManageWaterSources('owner')).toBe(true);
    expect(canManageWaterSources('manager')).toBe(true);
    expect(canManageWaterSources('crew')).toBe(false);
    expect(canManageWaterSources(null)).toBe(false);
  });
});
