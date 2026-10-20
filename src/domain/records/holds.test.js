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

  it('does not hold a field when it is not known whether the crop was reached (the reviewer decides)', () => {
    expect(computeFieldHolds([flood('A2', 'unknown')])).toEqual([]);
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

  it('on the same day, the action lifts the event only when it was recorded after it', () => {
    const after = [flood('A2'), clearing('A2', { created_at: '2026-06-10T16:00:00Z' })];
    const before = [flood('A2'), clearing('A2', { created_at: '2026-06-10T06:00:00Z' })];
    expect(computeFieldHolds(after)).toEqual([]);
    expect(computeFieldHolds(before)).toHaveLength(1);
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

describe('holdFor', () => {
  const holds = computeFieldHolds([flood('A2')]);

  it('finds the hold on a field however the field is spelled', () => {
    expect(holdFor(holds, ' a2 ')?.name).toBe('A2');
  });

  it('is null for a field that is not on hold, or for no field', () => {
    expect(holdFor(holds, 'B1')).toBeNull();
    expect(holdFor(holds, '')).toBeNull();
    expect(holdFor(holds, undefined)).toBeNull();
  });
});
