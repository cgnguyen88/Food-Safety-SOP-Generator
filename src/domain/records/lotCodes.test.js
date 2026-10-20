import { describe, it, expect } from 'vitest';
import { DEFAULT_LOT_FORMAT, LOT_FORMAT_MAX, validateLotFormat, generateLotCode, fillLotCode } from './lotCodes.js';

const input = (extra = {}) => ({ format: DEFAULT_LOT_FORMAT, farmCode: 'GVF', crop: 'Lettuce', field: 'A1', date: '2026-07-03', existingCodes: [], ...extra });

describe('validateLotFormat', () => {
  it('accepts the usual format and lists its parts', () => {
    expect(validateLotFormat('{FARM}-{CROP}-{YYYYMMDD}-{FIELD}')).toEqual({ ok: true, errors: [], tokens: ['FARM', 'CROP', 'YYYYMMDD', 'FIELD'] });
  });

  it('accepts every date style, and a daily number instead of a date', () => {
    for (const format of ['{FARM}{YYMMDD}', '{FARM}-{YYYY}{JULIAN}', '{CROP}-{SEQ}', '{FARM}-{YYYYMMDD}-{SEQ}']) {
      expect(validateLotFormat(format).ok, format).toBe(true);
    }
  });

  it('refuses a format with nothing that tells one day from another', () => {
    expect(validateLotFormat('{FARM}-{CROP}')).toMatchObject({ ok: false, errors: ['no_date'] });
    expect(validateLotFormat('{FARM}-{FIELD}-{YYYY}').errors).toEqual(['no_date']);
  });

  it('refuses blank, over-long, unknown and unsafe formats', () => {
    expect(validateLotFormat('').errors).toEqual(['empty']);
    expect(validateLotFormat('   ').errors).toEqual(['empty']);
    expect(validateLotFormat(undefined).errors).toEqual(['empty']);
    expect(validateLotFormat(`{YYYYMMDD}${'-'.repeat(LOT_FORMAT_MAX)}`).errors).toContain('too_long');
    expect(validateLotFormat('{FARM}-{YYYYMMDD}-{COLOR}').errors).toContain('unknown_token');
    expect(validateLotFormat('{YYYYMMDD} / A').errors).toContain('bad_characters');
    expect(validateLotFormat('{YYYYMMDD}<b>').errors).toContain('bad_characters');
    expect(validateLotFormat('{YYYYMMDD}-{').errors).toContain('bad_characters');
  });
});

describe('lot code limits', () => {
  it('accepts a format of exactly 40 characters and refuses 41', () => {
    const forty = `{YYYYMMDD}${'-'.repeat(30)}`;
    expect(forty).toHaveLength(40);
    expect(validateLotFormat(forty).ok).toBe(true);
    expect(validateLotFormat(`${forty}-`).errors).toContain('too_long');
    expect(LOT_FORMAT_MAX).toBe(40);
  });

  it('keeps a farm code to 8 letters, a crop to 12 and a field to 14', () => {
    const code = generateLotCode(input({ farmCode: 'ABCDEFGHIJ', crop: 'abcdefghijklmnop', field: 'abcdefghijklmnopqrs' })).code;
    expect(code).toBe('ABCDEFGH-ABCDEFGHIJKL-20260703-ABCDEFGHIJKLMN');
  });

  it('makes a farm code of the farm’s name with digits kept in it', () => {
    expect(generateLotCode(input({ farmCode: '', farmName: 'Farm 9 Acres' })).code).toBe('F9A-LETTUCE-20260703-A1');
    expect(generateLotCode(input({ farmCode: '', farmName: 'Farm 0 Acres' })).code).toBe('F0A-LETTUCE-20260703-A1');
  });

  it('does not use the first letters when the farm has one word', () => {
    expect(generateLotCode(input({ farmCode: '', farmName: 'Sunnyside' })).code).toBe('SUNNYSIDE-LETTUCE-20260703-A1'.replace('SUNNYSIDE', 'SUNNYSID'));
  });

  it('does not number the first use of a code, but numbers the second as 2 and the third as 3', () => {
    expect(generateLotCode(input()).code).toBe('GVF-LETTUCE-20260703-A1');
    expect(generateLotCode(input({ existingCodes: ['GVF-LETTUCE-20260703-A1'] })).code).toBe('GVF-LETTUCE-20260703-A1-2');
    expect(generateLotCode(input({ existingCodes: ['GVF-LETTUCE-20260703-A1', 'GVF-LETTUCE-20260703-A1-2'] })).code).toBe('GVF-LETTUCE-20260703-A1-3');
  });

  it('numbers a {SEQ} code from 01 and skips taken numbers', () => {
    expect(generateLotCode(input({ format: '{YYYYMMDD}-{SEQ}' })).code).toBe('20260703-01');
    expect(generateLotCode(input({ format: '{YYYYMMDD}-{SEQ}', existingCodes: ['20260703-01', '20260703-02'] })).code).toBe('20260703-03');
  });

  it('refuses a format that has only a day-of-year part, or only a year, as the date', () => {
    expect(validateLotFormat('{FARM}-{JULIAN}').ok).toBe(true);
    expect(validateLotFormat('{FARM}-{YYYY}').errors).toEqual(['no_date']);
    expect(validateLotFormat('{FARM}-{SEQ}').ok).toBe(true);
  });

  it('lists a missing farm even when the format also has a date', () => {
    expect(generateLotCode(input({ farmCode: '', farmName: '' }))).toEqual({ ok: false, reason: 'missing', missing: ['FARM'] });
    expect(generateLotCode(input({ format: '{FARM}-{YYYYMMDD}', farmCode: '', farmName: '', date: '' })).missing).toEqual(['FARM', 'YYYYMMDD']);
  });

  it('flags an unknown part even next to known ones', () => {
    expect(validateLotFormat('{FARM}{NOPE}{YYYYMMDD}').errors).toEqual(['unknown_token']);
    expect(validateLotFormat('{FARM}{YYYYMMDD}').errors).toEqual([]);
  });
});

describe('generateLotCode', () => {
  it('fills the format from the farm, the crop, the date and the field', () => {
    expect(generateLotCode(input())).toEqual({ ok: true, code: 'GVF-LETTUCE-20260703-A1' });
  });

  it('writes every date style', () => {
    const code = (format) => generateLotCode(input({ format })).code;
    expect(code('{YYMMDD}')).toBe('260703');
    expect(code('{YYYY}')).toBe(undefined); // no date token: refused
    expect(code('{YYYY}-{JULIAN}')).toBe('2026-26184');
    expect(code('{FARM}{YYYYMMDD}')).toBe('GVF20260703');
  });

  it('tidies the crop and field so a code is letters and numbers only', () => {
    expect(generateLotCode(input({ crop: 'Bok choy (baby)', field: 'North 40' })).code).toBe('GVF-BOKCHOYBABY-20260703-NORTH40');
    expect(generateLotCode(input({ crop: 'Jalapeño', field: 'Bloque ñ-2' })).code).toBe('GVF-JALAPENO-20260703-BLOQUEN2');
  });

  it('keeps long names to a length that fits on a label', () => {
    const { code } = generateLotCode(input({ crop: 'Extraordinarily long crop name', field: 'The far north-east corner of the farm' }));
    expect(code).toBe('GVF-EXTRAORDINAR-20260703-THEFARNORTHEAS');
  });

  it('keeps two fields that differ only at the end apart (North Field 1 and 2)', () => {
    const one = generateLotCode(input({ field: 'North Field 1' })).code;
    const two = generateLotCode(input({ field: 'North Field 2' })).code;
    expect(one).toBe('GVF-LETTUCE-20260703-NORTHFIELD1');
    expect(two).toBe('GVF-LETTUCE-20260703-NORTHFIELD2');
  });

  it('uses the first letters of the farm name when the farm has no code', () => {
    expect(generateLotCode(input({ farmCode: '', farmName: 'Green Valley Farm' })).code).toBe('GVF-LETTUCE-20260703-A1');
    expect(generateLotCode(input({ farmCode: undefined, farmName: 'Sunny' })).code).toBe('SUNNY-LETTUCE-20260703-A1');
  });

  it('says what is missing rather than leaving a gap in the code', () => {
    expect(generateLotCode(input({ crop: ' ' }))).toEqual({ ok: false, reason: 'missing', missing: ['CROP'] });
    expect(generateLotCode(input({ crop: '', field: '' }))).toEqual({ ok: false, reason: 'missing', missing: ['CROP', 'FIELD'] });
    expect(generateLotCode(input({ farmCode: '', farmName: '' }))).toEqual({ ok: false, reason: 'missing', missing: ['FARM'] });
    expect(generateLotCode(input({ date: '' }))).toEqual({ ok: false, reason: 'missing', missing: ['YYYYMMDD'] });
    expect(generateLotCode(input({ date: '2026-02-30' }))).toEqual({ ok: false, reason: 'missing', missing: ['YYYYMMDD'] });
  });

  it('does not need a field when the format leaves it out', () => {
    expect(generateLotCode(input({ format: '{FARM}-{YYYYMMDD}', field: '' })).code).toBe('GVF-20260703');
  });

  it('refuses a format that is not allowed', () => {
    expect(generateLotCode(input({ format: '{FARM}-{COLOR}-{YYYYMMDD}' }))).toEqual({ ok: false, reason: 'invalid_format' });
    expect(generateLotCode(input({ format: '' }))).toEqual({ ok: false, reason: 'invalid_format' });
  });

  it('adds a number to a code that has been used, however it was written', () => {
    expect(generateLotCode(input({ existingCodes: ['gvf-lettuce-20260703-a1'] })).code).toBe('GVF-LETTUCE-20260703-A1-2');
    expect(generateLotCode(input({ existingCodes: ['GVF-LETTUCE-20260703-A1', 'GVF-LETTUCE-20260703-A1-2'] })).code).toBe('GVF-LETTUCE-20260703-A1-3');
  });

  it('ignores blanks and things that are not text among the codes already used', () => {
    expect(generateLotCode(input({ existingCodes: ['', null, undefined, 5, '  '] })).code).toBe('GVF-LETTUCE-20260703-A1');
  });

  it('counts a day’s lots with {SEQ}, as two digits', () => {
    const format = '{FARM}-{YYYYMMDD}-{SEQ}';
    expect(generateLotCode(input({ format })).code).toBe('GVF-20260703-01');
    expect(generateLotCode(input({ format, existingCodes: ['GVF-20260703-01'] })).code).toBe('GVF-20260703-02');
    expect(generateLotCode(input({ format, existingCodes: ['GVF-20260703-01', 'GVF-20260703-03'] })).code).toBe('GVF-20260703-02');
    expect(generateLotCode(input({ format, existingCodes: ['GVF-20260702-01'] })).code).toBe('GVF-20260703-01');
  });

  it('does not change the list it is given', () => {
    const existing = ['GVF-LETTUCE-20260703-A1'];
    generateLotCode(input({ existingCodes: existing }));
    expect(existing).toEqual(['GVF-LETTUCE-20260703-A1']);
  });
});

describe('fillLotCode', () => {
  it('writes the code into a harvest’s values from the harvest itself', () => {
    expect(fillLotCode({ crop: 'Kale', field: 'B2' }, '2026-07-03', { format: DEFAULT_LOT_FORMAT, farmCode: 'GVF', existingCodes: [] })).toEqual({ ok: true, code: 'GVF-KALE-20260703-B2' });
  });

  it('says what is missing when the harvest is not filled in yet', () => {
    expect(fillLotCode({ crop: 'Kale' }, '2026-07-03', { format: DEFAULT_LOT_FORMAT, farmCode: 'GVF', existingCodes: [] })).toEqual({ ok: false, reason: 'missing', missing: ['FIELD'] });
  });
});
