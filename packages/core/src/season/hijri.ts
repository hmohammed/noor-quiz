import { DomainError } from '../errors';
import type { Instant } from '../time/instant';
import { addDays, daysBetween } from '../time/local-date';
import { localDate, type LocalDate, type TimeZone } from '../time/zoned';

/**
 * An Umm al-Qura suggestion for a Ramadan season. Advisory only: moon sighting
 * decides, so an admin confirms or changes `startDate` and `lengthDays`.
 */
export interface RamadanSuggestion {
  hijriYear: number;
  startDate: LocalDate;
  lengthDays: 29 | 30;
}

const MIN_HIJRI_YEAR = 1400;
const MAX_HIJRI_YEAR = 1500;
const RAMADAN = 9;
const MEAN_LUNAR_MONTH_DAYS = 29.530588853;
/** 1 Muharram 1 AH (16 July 622 Julian), proleptic Gregorian. */
const HIJRI_EPOCH: LocalDate = '0622-07-19';
/** Covers the drift between the mean-month estimate and Umm al-Qura. */
const SEARCH_RADIUS_DAYS = 15;

interface HijriDate {
  year: number;
  month: number;
  day: number;
}

let umalqura: Intl.DateTimeFormat | undefined;

function umalquraFormatter(): Intl.DateTimeFormat {
  if (umalqura) return umalqura;
  const fmt = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura-nu-latn', {
    timeZone: 'UTC',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  });
  if (fmt.resolvedOptions().calendar !== 'islamic-umalqura') {
    throw new DomainError('INTERNAL', { reason: 'umalqura-unsupported' });
  }
  umalqura = fmt;
  return fmt;
}

function hijriOf(date: LocalDate): HijriDate {
  const ms = daysBetween('1970-01-01', date) * 86_400_000;
  const parts = umalquraFormatter().formatToParts(ms);
  const part = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((p) => p.type === type)?.value);
  return { year: part('year'), month: part('month'), day: part('day') };
}

/** Umm al-Qura 1 Ramadan of `hijriYear` and the month's length. */
export function suggestRamadan(hijriYear: number): RamadanSuggestion {
  if (!Number.isInteger(hijriYear) || hijriYear < MIN_HIJRI_YEAR || hijriYear > MAX_HIJRI_YEAR) {
    throw new DomainError('VALIDATION', { reason: 'invalid-hijri-year' });
  }
  const monthsSinceEpoch = (hijriYear - 1) * 12 + (RAMADAN - 1);
  const estimate = addDays(HIJRI_EPOCH, Math.round(monthsSinceEpoch * MEAN_LUNAR_MONTH_DAYS));
  for (let offset = -SEARCH_RADIUS_DAYS; offset <= SEARCH_RADIUS_DAYS; offset++) {
    const date = addDays(estimate, offset);
    const h = hijriOf(date);
    if (h.year === hijriYear && h.month === RAMADAN && h.day === 1) {
      const lengthDays = hijriOf(addDays(date, 29)).month === RAMADAN ? 30 : 29;
      return { hijriYear, startDate: date, lengthDays };
    }
  }
  throw new DomainError('INTERNAL', { reason: 'umalqura-ramadan-not-found' });
}

/** The first Ramadan whose start is on or after today's local date in `timezone`. */
export function nextRamadanSuggestion(now: Instant, timezone: TimeZone): RamadanSuggestion {
  const today = localDate(now, timezone);
  const current = suggestRamadan(hijriOf(today).year);
  return current.startDate >= today ? current : suggestRamadan(current.hijriYear + 1);
}
