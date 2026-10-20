import { describe, it, expect } from 'vitest';
import { splitPeople, trainingDueList, trainingCounts, TRAINING_INTERVAL_DAYS, DUE_SOON_DAYS } from './training.js';

let n = 0;
const training = (topic, attendees, date, extra = {}) => ({
  id: `t${(n += 1)}`,
  kind: 'training',
  status: 'approved',
  record_date: date,
  created_at: `${date ?? '2026-01-01'}T09:00:00Z`,
  payload: { topic, trainer: 'Ana', attendees },
  ...extra,
});

describe('splitPeople', () => {
  it('splits a list written one to a line, or with commas or semicolons', () => {
    expect(splitPeople('Maria Lopez\nJose Ruiz')).toEqual(['Maria Lopez', 'Jose Ruiz']);
    expect(splitPeople('Maria Lopez, Jose Ruiz; Ana Diaz')).toEqual(['Maria Lopez', 'Jose Ruiz', 'Ana Diaz']);
  });

  it('drops bullets and numbers at the start of a line, and blank entries', () => {
    expect(splitPeople('- Maria Lopez\n* Jose Ruiz\n1. Ana Diaz\n\n  ,')).toEqual(['Maria Lopez', 'Jose Ruiz', 'Ana Diaz']);
  });

  it('tidies the spacing and names a person once however the capital letters are written', () => {
    expect(splitPeople('  Maria   Lopez ,maria lopez')).toEqual(['Maria Lopez']);
  });

  it('is empty for nothing', () => {
    expect(splitPeople('')).toEqual([]);
    expect(splitPeople(undefined)).toEqual([]);
    expect(splitPeople(42)).toEqual([]);
  });
});

describe('trainingDueList', () => {
  const list = (records, options = {}) => trainingDueList(records, { today: '2026-10-19', ...options });

  it('makes a row for each person and topic, due a year after the last training', () => {
    const rows = list([training('Handwashing', 'Maria Lopez\nJose Ruiz', '2026-03-01')]);
    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.person === 'Maria Lopez')).toMatchObject({ topic: 'Handwashing', lastTrained: '2026-03-01', dueDate: '2027-03-01', status: 'current', daysLeft: 133 });
  });

  it('uses the newest training for a person and topic, however it is spelled', () => {
    const rows = list([training('Handwashing', 'Maria Lopez', '2025-01-10'), training(' handwashing ', 'maria lopez', '2026-06-01')]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ lastTrained: '2026-06-01', person: 'Maria Lopez', topic: 'Handwashing' });
    expect(rows[0].recordIds).toHaveLength(2);
  });

  it('calls a person overdue the day after the due date, and not before', () => {
    const due = (date) => list([training('Hygiene', 'Ana', date)], { today: '2026-10-19' })[0];
    expect(due('2025-10-19')).toMatchObject({ dueDate: '2026-10-19', daysLeft: 0, status: 'due_soon' });
    expect(due('2025-10-18')).toMatchObject({ daysLeft: -1, status: 'overdue' });
  });

  it('calls a person due soon within the warning window, and current beyond it', () => {
    const at = (days) => list([training('Hygiene', 'Ana', '2025-10-19')], { today: addDaysTo('2026-10-19', -days) })[0].status;
    expect(at(DUE_SOON_DAYS)).toBe('due_soon');
    expect(at(DUE_SOON_DAYS + 1)).toBe('current');
  });

  it('can use another interval and warning window', () => {
    const rows = list([training('Hygiene', 'Ana', '2026-09-01')], { intervalDays: 30, dueSoonDays: 5 });
    expect(rows[0]).toMatchObject({ dueDate: '2026-10-01', status: 'overdue' });
  });

  it('puts the most overdue first, then those due soon, then the rest', () => {
    const rows = list([
      training('A', 'Current Person', '2026-09-01'),
      training('B', 'Soon Person', '2025-11-01'),
      training('C', 'Late Person', '2025-06-01'),
      training('D', 'Later Person', '2025-09-01'),
    ]);
    expect(rows.map((r) => r.person)).toEqual(['Late Person', 'Later Person', 'Soon Person', 'Current Person']);
  });

  it('counts only approved training records with a topic and a day', () => {
    const rows = list([
      training('Hygiene', 'A', '2026-01-01', { status: 'pending_review' }),
      training('Hygiene', 'B', '2026-01-01', { status: 'voided' }),
      training('Hygiene', 'C', '2026-01-01', { kind: 'visitor' }),
      training('', 'D', '2026-01-01'),
      training('Hygiene', 'E', null, { created_at: undefined }),
      training('Hygiene', 'F', '2026-01-01'),
    ]);
    expect(rows.map((r) => r.person)).toEqual(['F']);
  });

  it('does not count training dated in the future, which has not happened yet and would hide a real overdue', () => {
    const rows = list([training('Hygiene', 'Ana', '2025-01-01'), training('Hygiene', 'Ana', '2027-12-01')]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ lastTrained: '2025-01-01', status: 'overdue' });
    expect(list([training('Hygiene', 'Ana', '2027-12-01')])).toEqual([]);
  });

  it('counts training dated today', () => {
    expect(list([training('Hygiene', 'Ana', '2026-10-19')])).toHaveLength(1);
  });

  it('is empty when nobody has been trained', () => {
    expect(list([])).toEqual([]);
  });

  it('does not change the records it is given', () => {
    const records = [training('Hygiene', 'Ana', '2026-01-01')];
    const copy = JSON.parse(JSON.stringify(records));
    list(records);
    expect(records).toEqual(copy);
  });

  it('uses a year as the usual interval', () => {
    expect(TRAINING_INTERVAL_DAYS).toBe(365);
  });
});

describe('trainingCounts', () => {
  it('counts the rows by how they stand', () => {
    const rows = [{ status: 'overdue' }, { status: 'overdue' }, { status: 'due_soon' }, { status: 'current' }];
    expect(trainingCounts(rows)).toEqual({ overdue: 2, due_soon: 1, current: 1 });
    expect(trainingCounts([])).toEqual({ overdue: 0, due_soon: 0, current: 0 });
  });
});

function addDaysTo(date, days) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
