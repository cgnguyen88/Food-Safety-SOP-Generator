import { describe, it, expect } from 'vitest';
import { recordDay, addDays, addYears, daysBetween } from './dates.js';

describe('recordDay', () => {
  it('is the date of the record', () => {
    expect(recordDay({ record_date: '2026-06-10', created_at: '2026-07-01T00:00:00Z' })).toBe('2026-06-10');
  });

  it('is the day the record was entered when it has no date', () => {
    expect(recordDay({ record_date: null, created_at: '2026-07-01T08:30:00Z' })).toBe('2026-07-01');
    expect(recordDay({ created_at: '2026-07-01T08:30:00Z' })).toBe('2026-07-01');
  });

  it('is empty when neither is known, or neither makes sense', () => {
    expect(recordDay({})).toBe('');
    expect(recordDay({ record_date: 'soon', created_at: 'later' })).toBe('');
    expect(recordDay(null)).toBe('');
  });
});

describe('addDays', () => {
  it('adds days across months and years', () => {
    expect(addDays('2026-01-30', 3)).toBe('2026-02-02');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('counts a leap day', () => {
    expect(addDays('2027-03-01', -1)).toBe('2027-02-28');
    expect(addDays('2028-03-01', -1)).toBe('2028-02-29');
    expect(addDays('2026-03-15', 365)).toBe('2027-03-15');
    expect(addDays('2027-03-15', 365)).toBe('2028-03-14');
  });

  it('can go back', () => {
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
});

describe('daysBetween', () => {
  it('counts the days from one date to another, negative when it is earlier', () => {
    expect(daysBetween('2026-06-10', '2026-06-12')).toBe(2);
    expect(daysBetween('2026-06-12', '2026-06-10')).toBe(-2);
    expect(daysBetween('2026-06-10', '2026-06-10')).toBe(0);
  });

  it('is not thrown off by a clock change or a month end', () => {
    expect(daysBetween('2026-03-01', '2026-04-01')).toBe(31);
    expect(daysBetween('2026-11-01', '2026-11-02')).toBe(1);
  });
});

describe('addYears', () => {
  it('is the same day of the same month, some years on', () => {
    expect(addYears('2026-03-15', 1)).toBe('2027-03-15');
    expect(addYears('2026-12-31', 1)).toBe('2027-12-31');
    expect(addYears('2026-03-15', -1)).toBe('2025-03-15');
  });

  it('puts a leap day on the last day of February when the year has none', () => {
    expect(addYears('2028-02-29', 1)).toBe('2029-02-28');
    expect(addYears('2028-02-29', 4)).toBe('2032-02-29');
  });
});
