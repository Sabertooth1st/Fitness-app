import type { LocalDate, Weekday } from './types';

const DAY_MS = 86_400_000;

/**
 * Local calendar date of an instant in an IANA timezone. Uses Intl so DST
 * transitions are handled by the platform's tz database, not by offsets.
 */
export function toLocalDate(instant: Date, timeZone: string): LocalDate {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function parse(date: LocalDate): number {
  const [y, m, d] = date.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

function format(ms: number): LocalDate {
  return new Date(ms).toISOString().slice(0, 10);
}

export function addDays(date: LocalDate, days: number): LocalDate {
  return format(parse(date) + days * DAY_MS);
}

/** Whole calendar days from a to b (b - a). */
export function daysBetween(a: LocalDate, b: LocalDate): number {
  return Math.round((parse(b) - parse(a)) / DAY_MS);
}

export function weekdayOf(date: LocalDate): Weekday {
  const js = new Date(parse(date)).getUTCDay(); // 0 = Sunday
  return (js === 0 ? 7 : js) as Weekday;
}

/** Monday of the ISO week containing the date. */
export function weekStart(date: LocalDate): LocalDate {
  return addDays(date, 1 - weekdayOf(date));
}

export function isWithin(date: LocalDate, from: LocalDate, until: LocalDate | null): boolean {
  return date >= from && (until === null || date <= until);
}

export function compareDates(a: LocalDate, b: LocalDate): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
