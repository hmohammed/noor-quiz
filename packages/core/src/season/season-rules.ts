import { DomainError } from '../errors';
import type { Instant } from '../time/instant';
import {
  addDays,
  daysBetween,
  isValidLocalDate,
  parseLocalTime,
  type LocalTime,
} from '../time/local-date';
import {
  isValidTimeZone,
  localDate,
  zonedInstant,
  type LocalDate,
  type TimeZone,
} from '../time/zoned';

const MAX_LENGTH_DAYS = 366;

export interface Season {
  /** Admin-confirmed local date of day 1. */
  startDate: LocalDate;
  /** Integer, 1..366. */
  lengthDays: number;
  /** IANA zone the local dates and times are read in. */
  timezone: TimeZone;
  opensAtLocal: LocalTime;
  /** At or before `opensAtLocal` means the window closes on the next local date. */
  closesAtLocal: LocalTime;
}

export interface QuestionWindow {
  dayIndex: number;
  date: LocalDate;
  opensAt: Instant;
  closesAt: Instant;
}

export type SeasonState =
  { phase: 'upcoming' } | { phase: 'active'; dayIndex: number; open: boolean } | { phase: 'ended' };

function invalid(reason: string): DomainError {
  return new DomainError('VALIDATION', { reason });
}

/** Throws `DomainError('VALIDATION', { reason })` unless `season` is well formed. */
export function assertValidSeason(season: Season): void {
  if (!isValidLocalDate(season.startDate)) throw invalid('invalid-start-date');
  const n = season.lengthDays;
  if (!Number.isInteger(n) || n < 1 || n > MAX_LENGTH_DAYS) throw invalid('invalid-length');
  if (!isValidTimeZone(season.timezone)) throw invalid('unknown-timezone');
  parseLocalTime(season.opensAtLocal);
  parseLocalTime(season.closesAtLocal);
}

function isDayInRange(season: Season, dayIndex: number): boolean {
  return Number.isInteger(dayIndex) && dayIndex >= 1 && dayIndex <= season.lengthDays;
}

// Assumes a validated season and an in-range day.
function opensAtOf(season: Season, dayIndex: number): Instant {
  return zonedInstant(
    addDays(season.startDate, dayIndex - 1),
    season.opensAtLocal,
    season.timezone,
  );
}

// Assumes a validated season and an in-range day.
function windowOf(season: Season, dayIndex: number): QuestionWindow {
  const date = addDays(season.startDate, dayIndex - 1);
  // `HH:mm` strings compare in time order.
  const closeDate = season.closesAtLocal > season.opensAtLocal ? date : addDays(date, 1);
  return {
    dayIndex,
    date,
    opensAt: zonedInstant(date, season.opensAtLocal, season.timezone),
    closesAt: zonedInstant(closeDate, season.closesAtLocal, season.timezone),
  };
}

/**
 * When day `dayIndex` (1-based) has its question open: `[opensAt, closesAt)`.
 * Throws `DomainError('VALIDATION', { reason: 'day-out-of-range' })` for a day outside `1..lengthDays`.
 */
export function questionWindow(season: Season, dayIndex: number): QuestionWindow {
  assertValidSeason(season);
  if (!isDayInRange(season, dayIndex)) throw invalid('day-out-of-range');
  return windowOf(season, dayIndex);
}

// Assumes a validated season. A day lasts from its open until the next day's open;
// the last day lasts until its close.
function dayInEffect(season: Season, now: Instant): number | null {
  if (now < opensAtOf(season, 1)) return null;
  if (now >= windowOf(season, season.lengthDays).closesAt) return null;
  const hasOpened = (d: number): boolean => opensAtOf(season, d) <= now;
  // Start at the day of today's local date, then step to the last day that has
  // opened. Opens are strictly increasing, so this is exact from any start.
  const today = daysBetween(season.startDate, localDate(now, season.timezone)) + 1;
  let d = Math.min(Math.max(today, 1), season.lengthDays);
  while (d > 1 && !hasOpened(d)) d--;
  while (d < season.lengthDays && hasOpened(d + 1)) d++;
  return d;
}

/** The season day in effect at `now`, or `null` before day 1 opens and from the last close on. */
export function dayIndexAt(season: Season, now: Instant): number | null {
  assertValidSeason(season);
  return dayInEffect(season, now);
}

/**
 * Whether day `dayIndex`'s question accepts answers at `now`. Any out-of-range or
 * non-integer `dayIndex` is closed, so a client-supplied day can never open anything.
 */
export function isOpen(season: Season, dayIndex: number, now: Instant): boolean {
  assertValidSeason(season);
  if (!isDayInRange(season, dayIndex)) return false;
  const w = windowOf(season, dayIndex);
  return w.opensAt <= now && now < w.closesAt;
}

export function seasonState(season: Season, now: Instant): SeasonState {
  assertValidSeason(season);
  if (now < opensAtOf(season, 1)) return { phase: 'upcoming' };
  const dayIndex = dayInEffect(season, now);
  if (dayIndex === null) return { phase: 'ended' };
  return { phase: 'active', dayIndex, open: isOpen(season, dayIndex, now) };
}
