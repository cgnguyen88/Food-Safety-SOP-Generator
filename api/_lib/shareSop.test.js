import { describe, it, expect } from 'vitest';
import { SOP_DATA } from '../../src/data/sop-data.js';
import { parseShareToken, findSop, cleanSignerName, sharedSopView, signOffRow } from './shareSop.js';

const SOP = SOP_DATA[0];
const FIELD = SOP.sections.flatMap((s) => s.fields)[0];
const TOKEN = 'a'.repeat(64);

describe('parseShareToken', () => {
  it('accepts 64 lowercase hex characters', () => {
    expect(parseShareToken(TOKEN)).toBe(TOKEN);
    expect(parseShareToken('0123456789abcdef'.repeat(4))).toBe('0123456789abcdef'.repeat(4));
  });

  it.each([['too short', 'a'.repeat(63)], ['too long', 'a'.repeat(65)], ['capitals', 'A'.repeat(64)], ['not hex', 'g'.repeat(64)], ['with spaces', `${'a'.repeat(63)} `], ['empty', ''], ['a number', 5], ['null', null], ['an object', { toString: () => TOKEN }], ['an array', [TOKEN]]])('refuses %s', (_label, value) => {
    expect(parseShareToken(value)).toBeNull();
  });
});

describe('findSop', () => {
  it('finds a SOP by its number, and nothing for anything else', () => {
    expect(findSop(1)).toBe(SOP_DATA[0]);
    for (const id of [0, 999, '1', 1.5, null, undefined, {}]) expect(findSop(id), String(id)).toBeNull();
  });
});

describe('cleanSignerName', () => {
  it('keeps a name on one line with tidy spacing', () => {
    expect(cleanSignerName('  Maria   José  López ')).toBe('Maria José López');
    expect(cleanSignerName('Ana\nDiaz')).toBe('Ana Diaz');
  });

  it('takes out invisible and control characters', () => {
    expect(cleanSignerName('Ana\u200b Diaz\u202e')).toBe('Ana Diaz');
    expect(cleanSignerName('A\u0000na')).toBe('A na');
  });

  it.each([['blank', '   '], ['one letter', 'A'], ['too long', 'x'.repeat(81)], ['markup', '<script>alert(1)</script>'], ['angle brackets', 'Ana <b>'], ['a number', 5], ['undefined', undefined], ['an object', { name: 'Ana' }]])('refuses %s', (_label, value) => {
    expect(cleanSignerName(value)).toBeNull();
  });

  it('makes a comma or semicolon a space, so one signature is never two people in the training list', () => {
    expect(cleanSignerName('Lopez, Maria')).toBe('Lopez Maria');
    expect(cleanSignerName('Maria Lopez, Juan Perez; Ana Ruiz')).toBe('Maria Lopez Juan Perez Ana Ruiz');
  });

  it('takes out every kind of invisible character, so a name cannot be disguised or blank', () => {
    const hidden = [0x2066, 0x2067, 0x2069, 0x061c, 0x3164, 0x115f, 0x2800, 0x206a, 0xfff9, 0xe0041, 0x200d].map((code) => String.fromCodePoint(code));
    for (const char of hidden) expect(cleanSignerName(`Ana${char}Diaz`), char.codePointAt(0).toString(16)).toBe('Ana Diaz');
    expect(cleanSignerName(String.fromCodePoint(0x3164).repeat(3))).toBeNull();
    expect(cleanSignerName(`${String.fromCodePoint(0x2800)}${String.fromCodePoint(0x2800)}`)).toBeNull();
  });

  it('needs at least two letters, not just two characters', () => {
    expect(cleanSignerName('12')).toBeNull();
    expect(cleanSignerName('- -')).toBeNull();
    expect(cleanSignerName('A 1')).toBeNull();
    expect(cleanSignerName('Li')).toBe('Li');
    expect(cleanSignerName('李明')).toBe('李明');
  });

  it('accepts exactly the limits', () => {
    expect(cleanSignerName('Al')).toBe('Al');
    expect(cleanSignerName('x'.repeat(80))).toHaveLength(80);
  });
});

describe('sharedSopView', () => {
  it('gives the SOP’s saved answers and the farm’s name', () => {
    const view = sharedSopView({ sop: SOP, form: { [FIELD.id]: 'Green Valley Farm' }, farmProfile: { farm_name: 'Green Valley Farm', owner_name: 'Pat', phone: '555' } });
    expect(view).toEqual({ sopId: 1, farmName: 'Green Valley Farm', values: { [FIELD.id]: 'Green Valley Farm' } });
  });

  it('leaves out anything the SOP does not have, so nothing else saved can be reached from a link', () => {
    const view = sharedSopView({ sop: SOP, form: { [FIELD.id]: 'x', secret_note: 'private', __proto__x: 'y' }, farmProfile: { farm_name: 'F', email: 'a@b.c', address: '1 Road' } });
    expect(Object.keys(view.values)).toEqual([FIELD.id]);
    expect(JSON.stringify(view)).not.toMatch(/private|a@b\.c|1 Road/);
  });

  it('keeps lists of text, drops other kinds of value and blanks', () => {
    const listField = SOP.sections.flatMap((s) => s.fields).find((f) => f.type === 'checkbox' || f.checkboxOptions) ?? FIELD;
    const view = sharedSopView({ sop: SOP, form: { [listField.id]: ['a', 2, '', ' b '], [FIELD.id]: '   ' }, farmProfile: null });
    expect(view.values[listField.id]).toEqual(['a', 'b']);
    expect(view.values[FIELD.id]).toBeUndefined();
  });

  it('cuts very long answers, and lists, to what a page can use', () => {
    const view = sharedSopView({ sop: SOP, form: { [FIELD.id]: 'x'.repeat(10_000) }, farmProfile: { farm_name: 'n'.repeat(500) } });
    expect(view.values[FIELD.id]).toHaveLength(4000);
    expect(view.farmName).toHaveLength(120);
  });

  it('copes with a missing form or profile', () => {
    expect(sharedSopView({ sop: SOP, form: undefined, farmProfile: undefined })).toEqual({ sopId: 1, farmName: '', values: {} });
    expect(sharedSopView({ sop: SOP, form: [1, 2], farmProfile: 'x' })).toEqual({ sopId: 1, farmName: '', values: {} });
  });
});

describe('signOffRow', () => {
  const share = { id: 'share-1', farm_id: 'farm-1' };
  const make = (extra = {}) => signOffRow({ share, sop: SOP, name: 'Maria Lopez', today: '2026-10-20', lang: 'en', ...extra });

  it('makes a training record waiting for review, from the link, with nobody signed in', () => {
    const { ok, row } = make();
    expect(ok).toBe(true);
    expect(row).toMatchObject({
      farm_id: 'farm-1', kind: 'training', status: 'pending_review', record_date: '2026-10-20', source: 'web_upload', missing_fields: [],
      payload: { topic: SOP.title, sop: SOP.ref, attendees: 'Maria Lopez', language: 'en' },
    });
    expect(row.created_by).toBeUndefined();
    expect(row.fingerprint).toContain('training|2026-10-20');
  });

  it('records the language the worker read it in', () => {
    expect(make({ lang: 'es' }).row.payload.language).toBe('es');
    expect(make({ lang: 'fr' }).row.payload.language).toBe('en');
  });

  it('gives the same dedupe key for the same person on the same day, however the name is written', () => {
    expect(make().row.source_ref).toBe(make({ name: 'Maria Lopez' }).row.source_ref);
    expect(make({ name: 'MARIA LOPEZ' }).row.source_ref).toBe(make().row.source_ref);
    expect(make({ name: 'Maria Lopez' }).row.source_ref).not.toBe(make({ today: '2026-10-21' }).row.source_ref);
    expect(make({ name: 'Jose Ruiz' }).row.source_ref).not.toBe(make().row.source_ref);
    expect(make().row.source_ref).not.toBe(make({ share: { id: 'share-2', farm_id: 'farm-1' } }).row.source_ref);
  });

  it('is refused for a date that is not a date', () => {
    expect(make({ today: 'soon' })).toEqual({ ok: false });
  });
});
