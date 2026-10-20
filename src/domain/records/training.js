import { addDays, daysBetween, recordDay } from './dates.js';

/**
 * Who needs training again. Training records name the people trained (one text box, written however the
 * trainer writes) and the topic; people are due again a year after their latest training on a topic. The list is
 * worked out from the approved records every time, so it can never be out of step with them.
 */

/** Workers are trained when hired and at least once a year. */
export const TRAINING_INTERVAL_DAYS = 365;
/** How many days before the due date a person shows as due soon. */
export const DUE_SOON_DAYS = 30;

const BULLET = /^\s*(?:[-*•·]|\d+[.)])\s+/;

/** Spacing, capital letters and accent forms do not make two spellings of a name different people. */
const keyOf = (text) => text.normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim();
const tidy = (text) => text.normalize('NFC').replace(/\s+/g, ' ').trim();

/**
 * The people named in a box of text: one to a line, or separated by commas or semicolons.
 * @param {unknown} text
 * @returns {string[]} each person once, in the order named, as first written
 */
export function splitPeople(text) {
  if (typeof text !== 'string') return [];
  const seen = new Set();
  const people = [];
  for (const line of text.split(/\r?\n/)) {
    for (const piece of line.replace(BULLET, '').split(/[,;]/)) {
      const name = tidy(piece.replace(BULLET, ''));
      if (name === '' || seen.has(keyOf(name))) continue;
      seen.add(keyOf(name));
      people.push(name);
    }
  }
  return people;
}

const STANDING_ORDER = { overdue: 0, due_soon: 1, current: 2 };

/**
 * One row for each person and topic: their latest training and when they are due again, most urgent first. A
 * person and a topic are spelled as the first record that names them spells them. Training dated in the future has not
 * happened yet, so it does not count.
 *
 * @param {object[]} records
 * @param {{ today: string, intervalDays?: number, dueSoonDays?: number }} options `today` is a YYYY-MM-DD date
 * @returns {Array<{ person: string, topic: string, lastTrained: string, dueDate: string, daysLeft: number, status: 'overdue' | 'due_soon' | 'current', recordIds: string[] }>}
 */
export function trainingDueList(records, { today, intervalDays = TRAINING_INTERVAL_DAYS, dueSoonDays = DUE_SOON_DAYS }) {
  const latest = new Map();
  for (const record of records) {
    if (record.kind !== 'training' || record.status !== 'approved') continue;
    const topic = typeof record.payload?.topic === 'string' ? tidy(record.payload.topic) : '';
    const day = recordDay(record);
    if (topic === '' || day === '' || day > today) continue;
    for (const person of splitPeople(record.payload.attendees)) {
      const key = `${keyOf(person)}|${keyOf(topic)}`;
      const entry = latest.get(key);
      if (!entry) latest.set(key, { person, topic, lastTrained: day, recordIds: [record.id] });
      else {
        entry.recordIds.push(record.id);
        if (day > entry.lastTrained) entry.lastTrained = day;
      }
    }
  }

  return [...latest.values()]
    .map((entry) => {
      const dueDate = addDays(entry.lastTrained, intervalDays);
      const daysLeft = daysBetween(today, dueDate);
      const status = daysLeft < 0 ? 'overdue' : daysLeft <= dueSoonDays ? 'due_soon' : 'current';
      return { ...entry, dueDate, daysLeft, status };
    })
    .sort((a, b) => STANDING_ORDER[a.status] - STANDING_ORDER[b.status] || a.daysLeft - b.daysLeft || a.person.localeCompare(b.person) || a.topic.localeCompare(b.topic));
}

/** How many rows stand each way. @param {Array<{ status: string }>} rows */
export function trainingCounts(rows) {
  const counts = { overdue: 0, due_soon: 0, current: 0 };
  for (const row of rows) counts[row.status] += 1;
  return counts;
}
