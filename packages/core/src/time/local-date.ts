import { DomainError } from '../errors';
import type { LocalDate } from './zoned';

/** Local wall-clock time of day, `HH:mm`, 00:00–23:59, ASCII digits. */
export type LocalTime = string;

const MS_PER_DAY = 86_400_000;
// `\d` matches ASCII digits only, so Arabic-Indic or other digit systems are rejected.
const LOCAL_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const LOCAL_TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;

function utcMidnight(year: number, month: number, day: number): number {
  const d = new Date(0);
  // setUTCFullYear, unlike Date.UTC, does not map years 0–99 to 1900–1999.
  d.setUTCFullYear(year, month - 1, day);
  return d.getTime();
}

function epochDay(date: LocalDate): number | undefined {
  if (typeof date !== 'string') return undefined;
  const m = LOCAL_DATE.exec(date);
  if (!m) return undefined;
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const ms = utcMidnight(year, month, day);
  // Reject calendar overflow such as 2026-02-30 rolling over to 2026-03-02.
  if (formatEpochDay(ms / MS_PER_DAY) !== date) return undefined;
  return ms / MS_PER_DAY;
}

function formatEpochDay(day: number): LocalDate {
  const d = new Date(day * MS_PER_DAY);
  const y = String(d.getUTCFullYear()).padStart(4, '0');
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function requireEpochDay(date: LocalDate): number {
  const day = epochDay(date);
  if (day === undefined) throw new DomainError('VALIDATION', { reason: 'invalid-local-date' });
  return day;
}

/** True for a strict `YYYY-MM-DD` string that names a real Gregorian date. */
export function isValidLocalDate(s: string): boolean {
  return epochDay(s) !== undefined;
}

/** Parses `HH:mm` (00:00–23:59). Throws `DomainError('VALIDATION')` otherwise. */
export function parseLocalTime(s: string): { hour: number; minute: number } {
  const m = typeof s === 'string' ? LOCAL_TIME.exec(s) : null;
  if (!m) throw new DomainError('VALIDATION', { reason: 'invalid-local-time' });
  return { hour: Number(m[1]), minute: Number(m[2]) };
}

/** The local date `n` calendar days after `date` (before, when `n` is negative). */
export function addDays(date: LocalDate, n: number): LocalDate {
  if (!Number.isInteger(n)) throw new DomainError('VALIDATION', { reason: 'invalid-day-count' });
  return formatEpochDay(requireEpochDay(date) + n);
}

/** Calendar days from `from` to `to` (`to − from`). */
export function daysBetween(from: LocalDate, to: LocalDate): number {
  return requireEpochDay(to) - requireEpochDay(from);
}
