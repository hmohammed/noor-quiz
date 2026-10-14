import { DomainError } from '../errors';
import type { Instant } from './instant';

/** IANA timezone name, e.g. `Europe/Stockholm`. */
export type TimeZone = string;

/** Gregorian local calendar date, `YYYY-MM-DD`, ASCII digits. */
export type LocalDate = string;

export interface LocalDateTime {
  date: LocalDate;
  hour: number;
  minute: number;
  second: number;
}

// One formatter per zone. Calendar and numbering system are pinned so a zone whose
// locale default is another calendar (e.g. Ethiopic) still yields Gregorian ASCII.
const formatters = new Map<TimeZone, Intl.DateTimeFormat>();

function formatterFor(tz: TimeZone): Intl.DateTimeFormat | undefined {
  const cached = formatters.get(tz);
  if (cached) return cached;
  if (typeof tz !== 'string' || tz.length === 0) return undefined;
  let fmt: Intl.DateTimeFormat;
  try {
    fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      calendar: 'gregory',
      numberingSystem: 'latn',
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return undefined;
  }
  formatters.set(tz, fmt);
  return fmt;
}

/** True when the runtime knows `tz` as a timezone. */
export function isValidTimeZone(tz: string): boolean {
  return formatterFor(tz) !== undefined;
}

/** Local wall-clock date and time of `i` in `tz`. Throws `DomainError('VALIDATION')` for an unknown zone. */
export function localDateTime(i: Instant, tz: TimeZone): LocalDateTime {
  const fmt = formatterFor(tz);
  if (!fmt) throw new DomainError('VALIDATION', { reason: 'unknown-timezone' });
  const parts: Partial<Record<Intl.DateTimeFormatPartTypes, string>> = {};
  for (const p of fmt.formatToParts(i)) parts[p.type] = p.value;
  const year = Number(parts.year);
  const date = `${String(year).padStart(4, '0')}-${parts.month}-${parts.day}`;
  return {
    date,
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

/** Local calendar date (`YYYY-MM-DD`) of `i` in `tz`. Throws `DomainError('VALIDATION')` for an unknown zone. */
export function localDate(i: Instant, tz: TimeZone): LocalDate {
  return localDateTime(i, tz).date;
}
