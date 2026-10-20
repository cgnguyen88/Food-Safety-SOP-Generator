import { describe, it, expect } from 'vitest';
import { computeFieldHolds, holdFor } from './holds.js';

let n = 0;
const record = (kind, payload, extra = {}) => ({
  id: `r${(n += 1)}`,
  kind,
  status: 'approved',
  record_date: '2026-06-10',
  created_at: '2026-06-10T08:00:00Z',
  payload,
  ...extra,
});
const flood = (field, crop_contact = 'yes', extra = {}) => record('weather_event', { event_type: 'flood', field, crop_contact }, extra);
const animals = (field, evidence = 'yes', extra = {}) => record('wildlife_check', { field, evidence }, extra);
const clearing = (field, extra = {}, payload = {}) => record('corrective_action', { problem: 'p', action: 'a', field, clears_hold: 'yes', ...payload }, extra);

describe('computeFieldHolds: what puts a field on hold', () => {
  it('holds a field when a flood reached the crop', () => {
    const [hold] = computeFieldHolds([flood('A2')]);
    expect(hold).toMatchObject({ name: 'A2', since: '2026-06-10' });
    expect(hold.triggers).toEqual([expect.objectContaining({ kind: 'weather_event', reason: 'crop_contact', date: '2026-06-10' })]);
  });

  it('holds a field when signs of animals were found', () => {
    const [hold] = computeFieldHolds([animals('B1')]);
    expect(hold.triggers[0]).toMatchObject({ kind: 'wildlife_check', reason: 'animal_signs' });
  });

  it('does not hold a field for water that did not reach the crop, or a check with no signs', () => {
    expect(computeFieldHolds([flood('A2', 'no'), animals('B1', 'no')])).toEqual([]);
  });

  it('holds a field when it is not known whether the crop was reached: not knowing is not a reason to harvest', () => {
    const [hold] = computeFieldHolds([flood('A2', 'unknown')]);
    expect(hold.triggers[0]).toMatchObject({ kind: 'weather_event', reason: 'crop_contact_unknown' });
  });

  it('holds each field of a record that names several, and a corrective action clears each one it names', () => {
    const records = [flood('A1, A2; B3'), clearing('A1', { record_date: '2026-06-15' })];
    expect(computeFieldHolds(records).map((h) => h.name)).toEqual(['A2', 'B3']);
    expect(computeFieldHolds([flood('A1, A2'), clearing('a1,\nA2', { record_date: '2026-06-15' })])).toEqual([]);
  });

  it('does not make a field name out of blanks and separators', () => {
    expect(computeFieldHolds([flood(' , ;'), flood('\n')])).toEqual([]);
  });

  it('only counts approved records', () => {
    const records = ['draft', 'needs_info', 'pending_review', 'rejected', 'voided'].map((status) => flood('A2', 'yes', { status }));
    expect(computeFieldHolds(records)).toEqual([]);
  });

  it('ignores a record that names no field', () => {
    expect(computeFieldHolds([flood(''), flood(undefined), animals('   ')])).toEqual([]);
  });

  it('puts the same field on hold once, however many things happened there, and however it is spelled', () => {
    const holds = computeFieldHolds([flood('A2'), animals(' a2 ', 'yes', { record_date: '2026-06-12' })]);
    expect(holds).toHaveLength(1);
    expect(holds[0].triggers).toHaveLength(2);
    expect(holds[0].since).toBe('2026-06-10');
  });

  it('keeps separate fields apart, oldest hold first', () => {
    const holds = computeFieldHolds([animals('B1', 'yes', { record_date: '2026-07-01' }), flood('A2')]);
    expect(holds.map((h) => h.name)).toEqual(['A2', 'B1']);
  });
});

describe('computeFieldHolds: what lifts a hold', () => {
  it('lifts it when a later corrective action says it clears the hold', () => {
    expect(computeFieldHolds([flood('A2'), clearing('A2', { record_date: '2026-06-15' })])).toEqual([]);
  });

  it('does not lift it for a corrective action that does not clear holds', () => {
    const records = [flood('A2'), clearing('A2', { record_date: '2026-06-15' }, { clears_hold: 'no' })];
    expect(computeFieldHolds(records)).toHaveLength(1);
  });

  it('does not lift it for a corrective action on another field', () => {
    expect(computeFieldHolds([flood('A2'), clearing('B1', { record_date: '2026-06-15' })])).toHaveLength(1);
  });

  it('does not lift it for a corrective action that is not approved', () => {
    expect(computeFieldHolds([flood('A2'), clearing('A2', { record_date: '2026-06-15', status: 'pending_review' })])).toHaveLength(1);
  });

  it('does not lift it for a corrective action from before the event', () => {
    expect(computeFieldHolds([flood('A2'), clearing('A2', { record_date: '2026-06-01' })])).toHaveLength(1);
  });

  it('puts the field back on hold when something new happens after it was cleared', () => {
    const records = [flood('A2'), clearing('A2', { record_date: '2026-06-15' }), animals('A2', 'yes', { record_date: '2026-06-20' })];
    const [hold] = computeFieldHolds(records);
    expect(hold.since).toBe('2026-06-20');
    expect(hold.triggers).toHaveLength(1);
    expect(hold.triggers[0].kind).toBe('wildlife_check');
  });

  it('lifts every earlier event with one action, and leaves a later one', () => {
    const records = [flood('A2'), animals('A2', 'yes', { record_date: '2026-06-12' }), clearing('A2', { record_date: '2026-06-15' }), flood('A2', 'yes', { record_date: '2026-06-18' })];
    const [hold] = computeFieldHolds(records);
    expect(hold.triggers.map((t) => t.date)).toEqual(['2026-06-18']);
  });

  it('does not let an action clear an event that was recorded after the action, however it is dated', () => {
    const action = clearing('A2', { record_date: '2026-06-18', created_at: '2026-06-18T09:00:00Z' });
    const lateFlood = flood('A2', 'yes', { record_date: '2026-06-16', created_at: '2026-06-19T09:00:00Z' });
    expect(computeFieldHolds([lateFlood, action])).toHaveLength(1);
  });

  it('on the same day, the action lifts the event only when it was recorded after it', () => {
    const after = [flood('A2'), clearing('A2', { created_at: '2026-06-10T16:00:00Z' })];
    const before = [flood('A2'), clearing('A2', { created_at: '2026-06-10T06:00:00Z' })];
    expect(computeFieldHolds(after)).toEqual([]);
    expect(computeFieldHolds(before)).toHaveLength(1);
  });

  it('on the same day, an action recorded at the very same moment lifts the event', () => {
    const records = [flood('A2'), clearing('A2', { created_at: '2026-06-10T08:00:00Z' })];
    expect(computeFieldHolds(records)).toEqual([]);
  });

  it('on the same day, when only one of them has a recording time, the action is taken to come after', () => {
    expect(computeFieldHolds([flood('A2'), clearing('A2', { created_at: undefined })])).toEqual([]);
    expect(computeFieldHolds([flood('A2', 'yes', { created_at: undefined }), clearing('A2')])).toEqual([]);
  });

  it('on the same day with no recording times, the action lifts the event', () => {
    const records = [flood('A2', 'yes', { created_at: undefined }), clearing('A2', { created_at: undefined })];
    expect(computeFieldHolds(records)).toEqual([]);
  });

  it('cannot tell when an undated corrective action happened, so it lifts nothing', () => {
    expect(computeFieldHolds([flood('A2'), clearing('A2', { record_date: null, created_at: undefined })])).toHaveLength(1);
  });

  it('keeps a hold from an event with no date at all until something dated lifts it', () => {
    const undated = flood('A2', 'yes', { record_date: null, created_at: undefined });
    expect(computeFieldHolds([undated, clearing('A2', { record_date: '2026-06-15' })])).toHaveLength(1);
  });
});

describe('computeFieldHolds: what each hold says', () => {
  it('says what the weather event was and what the animal check found', () => {
    const [flooded] = computeFieldHolds([flood('A2')]);
    expect(flooded.triggers[0].detail).toBe('flood');
    const [animal] = computeFieldHolds([record('wildlife_check', { field: 'B1', evidence: 'yes', evidence_description: 'Deer tracks in the bed' })]);
    expect(animal.triggers[0].detail).toBe('Deer tracks in the bed');
    const [plain] = computeFieldHolds([animals('C1')]);
    expect(plain.triggers[0].detail).toBe('');
  });

  it('orders the holds by when they began (undated last, then by name), and each hold’s events by date', () => {
    const records = [
      animals('Zed', 'yes', { record_date: '2026-07-01' }),
      animals('Alpha', 'yes', { record_date: '2026-07-01' }),
      animals('Undated', 'yes', { record_date: null, created_at: undefined }),
      flood('Early', 'yes', { record_date: '2026-05-01' }),
    ];
    expect(computeFieldHolds(records).map((h) => h.name)).toEqual(['Early', 'Alpha', 'Zed', 'Undated']);
    const [hold] = computeFieldHolds([animals('A2', 'yes', { record_date: '2026-07-01' }), flood('A2'), animals('A2', 'yes', { record_date: null, created_at: undefined })]);
    expect(hold.triggers.map((t) => t.date)).toEqual(['2026-06-10', '2026-07-01', null]);
    expect(hold.since).toBe('2026-06-10');
  });

  it('has no start date when every event is undated', () => {
    const [hold] = computeFieldHolds([flood('A2', 'yes', { record_date: null, created_at: undefined })]);
    expect(hold.since).toBeNull();
  });
});

describe('holdFor', () => {
  const holds = computeFieldHolds([flood('A2')]);

  it('finds the hold on a field however the field is spelled', () => {
    expect(holdFor(holds, ' a2 ')?.name).toBe('A2');
  });

  it('finds the hold when a record names several fields and one of them is held', () => {
    expect(holdFor(holds, 'B1, A2')?.name).toBe('A2');
    expect(holdFor(holds, 'B1; C3')).toBeNull();
  });

  it('is null for a field that is not on hold, or for no field', () => {
    expect(holdFor(holds, 'B1')).toBeNull();
    expect(holdFor(holds, '')).toBeNull();
    expect(holdFor(holds, undefined)).toBeNull();
  });
});
