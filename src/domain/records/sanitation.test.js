import { describe, it, expect } from 'vitest';
import { findSanitizerLabel, resolveSanitizerLabel, labelRange, checkSanitizerConcentration, applySanitationCheck } from './sanitation.js';

const label = (product, min, max, extra = {}) => ({
  id: `label-${product}`,
  kind: 'sanitizer_label',
  status: 'approved',
  record_date: '2026-03-01',
  payload: { product, ppm_min: min, ppm_max: max },
  ...extra,
});

const LABELS = [label('Peracetic Acid 15%', 100, 200), label('Chlorine bleach', 50, 200)];

describe('findSanitizerLabel', () => {
  it('finds the label by product name, ignoring capitals, spacing and punctuation', () => {
    expect(findSanitizerLabel('  peracetic   ACID 15 % ', LABELS)?.id).toBe('label-Peracetic Acid 15%');
  });

  it('finds nothing for a blank name or a product with no label', () => {
    expect(findSanitizerLabel('', LABELS)).toBeNull();
    expect(findSanitizerLabel(undefined, LABELS)).toBeNull();
    expect(findSanitizerLabel('Vinegar', LABELS)).toBeNull();
  });

  it('accepts a shorter name when it fits only one label', () => {
    expect(findSanitizerLabel('bleach', LABELS)?.payload.product).toBe('Chlorine bleach');
    expect(findSanitizerLabel('acid', LABELS)?.payload.product).toBe('Peracetic Acid 15%');
  });

  it('does not guess when a short name fits more than one label', () => {
    const labels = [label('Sanitizer A', 100, 200), label('Sanitizer B', 10, 20)];
    expect(findSanitizerLabel('sanitizer', labels)).toBeNull();
  });

  it('prefers an exact name over a name that merely contains it', () => {
    const labels = [label('Chlorine', 50, 100), label('Chlorine bleach', 50, 200)];
    expect(findSanitizerLabel('chlorine', labels)?.payload.ppm_max).toBe(100);
  });

  it('uses the newest label when the same product has more than one', () => {
    const labels = [label('Chlorine bleach', 50, 200, { record_date: '2025-01-01' }), label('Chlorine bleach', 25, 100, { record_date: '2026-06-01' })];
    expect(findSanitizerLabel('Chlorine bleach', labels)?.payload.ppm_max).toBe(100);
  });

  it('ignores labels that are not approved, not sanitizer labels, or have no product', () => {
    const labels = [label('Pending', 1, 2, { status: 'pending_review' }), label('Voided', 1, 2, { status: 'voided' }), label('Wrong kind', 1, 2, { kind: 'note' }), label('', 1, 2)];
    expect(findSanitizerLabel('pending', labels)).toBeNull();
    expect(findSanitizerLabel('voided', labels)).toBeNull();
    expect(findSanitizerLabel('wrong kind', labels)).toBeNull();
  });
});

describe('findSanitizerLabel: uses, dates and short names', () => {
  const use = (product, approved_use, min, max, extra = {}) => ({ ...label(product, min, max, extra), payload: { product, approved_use, ppm_min: min, ppm_max: max } });

  it('does not guess when one product has labels for different uses with different ranges', () => {
    const labels = [use('ChlorBlast', 'produce_wash', 50, 100, { record_date: '2026-06-01' }), use('ChlorBlast', 'food_contact', 100, 200, { record_date: '2026-03-01' })];
    expect(resolveSanitizerLabel('ChlorBlast', labels)).toEqual({ label: null, ambiguous: true });
    expect(checkSanitizerConcentration({ ppm: 60, sanitizer: 'ChlorBlast' }, labels)).toEqual(expect.objectContaining({ result: null, reason: 'ambiguous_label' }));
  });

  it('is not confused by two uses that agree on the range', () => {
    const labels = [use('ChlorBlast', 'produce_wash', 100, 200), use('ChlorBlast', 'food_contact', 100, 200, { record_date: '2026-04-01' })];
    expect(resolveSanitizerLabel('ChlorBlast', labels).ambiguous).toBe(false);
    expect(findSanitizerLabel('ChlorBlast', labels)).not.toBeNull();
  });

  it('lets a newer label for the same use replace an older one', () => {
    const labels = [use('ChlorBlast', 'food_contact', 100, 200, { record_date: '2025-03-01' }), use('ChlorBlast', 'food_contact', 50, 100, { record_date: '2026-03-01' })];
    expect(findSanitizerLabel('ChlorBlast', labels).payload.ppm_max).toBe(100);
  });

  it('uses the label that was in force on the day of the log, not one written after it', () => {
    const labels = [label('Chlorine bleach', 50, 200, { record_date: '2025-01-01' }), label('Chlorine bleach', 25, 100, { record_date: '2026-06-01' })];
    expect(findSanitizerLabel('Chlorine bleach', labels, '2026-05-31').payload.ppm_max).toBe(200);
    expect(findSanitizerLabel('Chlorine bleach', labels, '2026-06-01').payload.ppm_max).toBe(100);
    expect(checkSanitizerConcentration({ ppm: 150, sanitizer: 'Chlorine bleach', date: '2026-05-31' }, labels).result).toBe('pass');
    expect(checkSanitizerConcentration({ ppm: 150, sanitizer: 'Chlorine bleach', date: '2026-06-02' }, labels).result).toBe('fail');
  });

  it('uses the newest label when every label is newer than the log', () => {
    const labels = [label('Wash', 10, 20, { record_date: '2027-01-01' })];
    expect(findSanitizerLabel('Wash', labels, '2026-01-01').payload.ppm_max).toBe(20);
  });

  it('does not take a very short product name for part of a longer one in a log', () => {
    expect(findSanitizerLabel('Bleach Alpha', [label('A', 1, 2)])).toBeNull();
    expect(findSanitizerLabel('Bleach Alpha', [label('Al', 1, 2)])).toBeNull();
  });
});

describe('sanitizer names and readings at their limits', () => {
  it('matches a three-letter name inside a longer product, but not a two-letter one', () => {
    expect(findSanitizerLabel('ble', [label('Chlorine bleach', 50, 200)])?.payload.product).toBe('Chlorine bleach');
    expect(findSanitizerLabel('bl', [label('Chlorine bleach', 50, 200)])).toBeNull();
  });

  it('matches a product name of three letters within a longer name in the log, but not one of two', () => {
    expect(findSanitizerLabel('Bleach Alpha Bleach', [label('Ble', 1, 2)])?.payload.product).toBe('Ble');
    expect(findSanitizerLabel('Alpha Bleach', [label('Al', 1, 2)])).toBeNull();
  });

  it('tells apart names that differ only by a number', () => {
    const labels = [label('Sanitizer 9', 50, 100), label('Sanitizer 5', 10, 20)];
    expect(findSanitizerLabel('Sanitizer 9', labels)?.payload.ppm_max).toBe(100);
    expect(findSanitizerLabel('Sanitizer 5', labels)?.payload.ppm_max).toBe(20);
  });

  it('counts a reading of zero as a reading (too low), not as no reading', () => {
    expect(checkSanitizerConcentration({ ppm: 0, sanitizer: 'Peracetic Acid 15%' }, LABELS)).toMatchObject({ result: 'fail', reason: 'too_low' });
    expect(checkSanitizerConcentration({ ppm: '0', sanitizer: 'Peracetic Acid 15%' }, LABELS).result).toBe('fail');
  });

  it('is not a reading when the number is infinite or the text is only spaces', () => {
    expect(checkSanitizerConcentration({ ppm: Infinity, sanitizer: 'Peracetic Acid 15%' }, LABELS).reason).toBe('no_reading');
    expect(checkSanitizerConcentration({ ppm: '   ', sanitizer: 'Peracetic Acid 15%' }, LABELS).reason).toBe('no_reading');
    expect(checkSanitizerConcentration({ ppm: NaN, sanitizer: 'Peracetic Acid 15%' }, LABELS).reason).toBe('no_reading');
  });

  it('allows a label whose minimum and maximum are the same number', () => {
    expect(labelRange(label('x', 100, 100))).toEqual({ min: 100, max: 100 });
    expect(checkSanitizerConcentration({ ppm: 100, sanitizer: 'Exact' }, [label('Exact', 100, 100)]).result).toBe('pass');
    expect(checkSanitizerConcentration({ ppm: 101, sanitizer: 'Exact' }, [label('Exact', 100, 100)]).result).toBe('fail');
  });

  it('uses the newest label when the log has an empty date', () => {
    const labels = [label('Wash', 10, 20, { record_date: '2025-01-01' }), label('Wash', 30, 40, { record_date: '2026-01-01' })];
    expect(findSanitizerLabel('Wash', labels, '')?.payload.ppm_max).toBe(40);
    expect(findSanitizerLabel('Wash', labels, undefined)?.payload.ppm_max).toBe(40);
  });

  it('keeps labels with no date in the list, for any log date', () => {
    expect(findSanitizerLabel('Wash', [{ ...label('Wash', 10, 20), record_date: null }], '2026-01-01')?.payload.ppm_max).toBe(20);
  });
});

describe('labelRange', () => {
  it('reads a minimum and a maximum', () => {
    expect(labelRange(label('x', 100, 200))).toEqual({ min: 100, max: 200 });
  });

  it('reads numbers kept as text', () => {
    expect(labelRange(label('x', '100', '200,5'))).toEqual({ min: 100, max: 200.5 });
  });

  it('allows a label that gives only one end', () => {
    expect(labelRange(label('x', 50, undefined))).toEqual({ min: 50, max: null });
    expect(labelRange(label('x', undefined, 200))).toEqual({ min: null, max: 200 });
  });

  it('is empty when the label gives no range, or an impossible one', () => {
    expect(labelRange(label('x', undefined, undefined))).toBeNull();
    expect(labelRange(label('x', 300, 100))).toBeNull();
    expect(labelRange(label('x', -5, 100))).toBeNull();
    expect(labelRange(null)).toBeNull();
  });
});

describe('checkSanitizerConcentration', () => {
  const check = (ppm, sanitizer = 'Peracetic Acid 15%') => checkSanitizerConcentration({ ppm, sanitizer }, LABELS);

  it('passes a reading inside the label range, including both ends', () => {
    expect(check(150)).toMatchObject({ result: 'pass', min: 100, max: 200 });
    expect(check(100).result).toBe('pass');
    expect(check(200).result).toBe('pass');
  });

  it('fails a reading that is too low or too high, and says which', () => {
    expect(check(99.9)).toMatchObject({ result: 'fail', reason: 'too_low', min: 100, max: 200 });
    expect(check(200.1)).toMatchObject({ result: 'fail', reason: 'too_high' });
  });

  it('reads the reading typed as text', () => {
    expect(check('150').result).toBe('pass');
    expect(check('99,9').result).toBe('fail');
  });

  it('checks one end when the label gives only one', () => {
    const labels = [label('Wash', 50, undefined)];
    expect(checkSanitizerConcentration({ ppm: 500, sanitizer: 'Wash' }, labels).result).toBe('pass');
    expect(checkSanitizerConcentration({ ppm: 49, sanitizer: 'Wash' }, labels)).toMatchObject({ result: 'fail', reason: 'too_low' });
  });

  it('gives no result without a reading', () => {
    expect(check('')).toEqual(expect.objectContaining({ result: null, reason: 'no_reading' }));
    expect(check(undefined).result).toBeNull();
    expect(check('abc').result).toBeNull();
    expect(check(-3).result).toBeNull();
  });

  it('gives no result when there is no label for the sanitizer, so nothing is called a pass by guesswork', () => {
    expect(check(150, 'Vinegar')).toEqual(expect.objectContaining({ result: null, reason: 'no_label' }));
    expect(check(150, '')).toEqual(expect.objectContaining({ result: null, reason: 'no_label' }));
  });

  it('gives no result when the label has no usable range', () => {
    const labels = [label('Mystery', undefined, undefined)];
    expect(checkSanitizerConcentration({ ppm: 100, sanitizer: 'Mystery' }, labels)).toEqual(expect.objectContaining({ result: null, reason: 'no_range' }));
  });

  it('returns the label it used', () => {
    expect(check(150).label.id).toBe('label-Peracetic Acid 15%');
  });
});

describe('applySanitationCheck: the day of the log', () => {
  it('uses the label in force on that day', () => {
    const labels = [label('Chlorine bleach', 50, 200, { record_date: '2025-01-01' }), label('Chlorine bleach', 25, 100, { record_date: '2026-06-01' })];
    const payload = { method: 'clean_sanitize', sanitizer: 'Chlorine bleach', ppm: 150 };
    expect(applySanitationCheck(payload, labels, '2026-01-01').check_result).toBe('pass');
    expect(applySanitationCheck(payload, labels, '2026-07-01').check_result).toBe('fail');
  });
});

describe('applySanitationCheck', () => {
  it('writes the result of the check into the payload and leaves the rest alone', () => {
    const payload = { item: 'Bins', method: 'clean_sanitize', sanitizer: 'Chlorine bleach', ppm: 300, check_result: 'pass' };
    expect(applySanitationCheck(payload, LABELS)).toEqual({ ...payload, check_result: 'fail' });
  });

  it('does not change the payload it was given', () => {
    const payload = { sanitizer: 'Chlorine bleach', ppm: 100 };
    const copy = { ...payload };
    applySanitationCheck(payload, LABELS);
    expect(payload).toEqual(copy);
  });

  it('keeps what the person chose when the label cannot decide', () => {
    expect(applySanitationCheck({ sanitizer: 'Vinegar', ppm: 5, check_result: 'not_tested' }, LABELS).check_result).toBe('not_tested');
    expect(applySanitationCheck({ sanitizer: 'Vinegar', ppm: 5 }, LABELS)).not.toHaveProperty('check_result');
  });

  it('does not call a cleaning-only step a pass or a fail', () => {
    const payload = { method: 'clean_only', sanitizer: 'Chlorine bleach', ppm: 500, check_result: 'pass' };
    expect(applySanitationCheck(payload, LABELS)).toEqual(payload);
  });
});
