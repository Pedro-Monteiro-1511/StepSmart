import { DateTime } from 'luxon';

/** Calendar date key (YYYY-MM-DD) for `date`, evaluated in the user's own timezone. */
export function localDateKey(date: Date, timezone: string): string {
  return DateTime.fromJSDate(date, { zone: 'utc' }).setZone(timezone).toFormat('yyyy-LL-dd');
}

/** UTC instants for the start/end of a local calendar day, so day resets happen per-user-timezone. */
export function localDayBoundsUtc(dateKey: string, timezone: string): { start: Date; end: Date } {
  const start = DateTime.fromFormat(dateKey, 'yyyy-LL-dd', { zone: timezone }).startOf('day');
  return { start: start.toUTC().toJSDate(), end: start.plus({ days: 1 }).toUTC().toJSDate() };
}

/** Absolute UTC instant for e.g. "12:00" local time on `dateKey` in `timezone`. */
export function localTimeOfDayUtc(dateKey: string, timezone: string, hhmm: string): Date {
  const [hour, minute] = hhmm.split(':').map(Number);
  const dt = DateTime.fromFormat(dateKey, 'yyyy-LL-dd', { zone: timezone }).set({
    hour,
    minute,
    second: 0,
    millisecond: 0,
  });
  return dt.toUTC().toJSDate();
}

/** `dateKey` (YYYY-MM-DD) as midnight-UTC Date, matching Prisma's `@db.Date` columns. */
export function dateKeyToDateColumn(dateKey: string): Date {
  return new Date(`${dateKey}T00:00:00.000Z`);
}

/** Leaderboard period keys (daily/weekly/monthly), evaluated in the user's own timezone. */
export function periodKeys(date: Date, timezone: string): { daily: string; weekly: string; monthly: string } {
  const dt = DateTime.fromJSDate(date, { zone: 'utc' }).setZone(timezone);
  return {
    daily: dt.toFormat('yyyy-LL-dd'),
    weekly: `${dt.weekYear}-W${String(dt.weekNumber).padStart(2, '0')}`,
    monthly: dt.toFormat('yyyy-LL'),
  };
}

/** Global leaderboard windows use a single UTC clock so every player shares the same reset boundary. */
export function utcWeekBounds(date: Date): { start: Date; end: Date } {
  const start = DateTime.fromJSDate(date, { zone: 'utc' }).startOf('week');
  return { start: start.toJSDate(), end: start.plus({ weeks: 1 }).toJSDate() };
}

export function utcMonthBounds(date: Date): { start: Date; end: Date } {
  const start = DateTime.fromJSDate(date, { zone: 'utc' }).startOf('month');
  return { start: start.toJSDate(), end: start.plus({ months: 1 }).toJSDate() };
}
