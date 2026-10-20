const PLAIN_DATE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;

const toUtc = (iso) => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));

/** The day a record is about: its date, or the day it was entered when it has none; '' when neither is known. */
export function recordDay(record) {
  if (typeof record?.record_date === 'string' && PLAIN_DATE.test(record.record_date)) return record.record_date;
  const entered = typeof record?.created_at === 'string' ? record.created_at.slice(0, 10) : '';
  return PLAIN_DATE.test(entered) ? entered : '';
}

/** A date some days later (earlier when negative). @param {string} isoDate YYYY-MM-DD @param {number} days */
export function addDays(isoDate, days) {
  return new Date(toUtc(isoDate) + days * DAY_MS).toISOString().slice(0, 10);
}

/** The number of days from one date to another, negative when the second is earlier. @param {string} from @param {string} to */
export function daysBetween(from, to) {
  return Math.round((toUtc(to) - toUtc(from)) / DAY_MS);
}
