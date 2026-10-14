import { DomainError } from '../errors';

/** A point in absolute time: epoch milliseconds, UTC. Timezone-agnostic. */
export type Instant = number & { readonly __brand: 'Instant' };

/**
 * A length of absolute time. A day is a fixed 86 400 000 ms; "next local day" is
 * computed with `localDate`, never by adding days to a local value.
 */
export type Duration =
  number | { days?: number; hours?: number; minutes?: number; seconds?: number; ms?: number };

const MS_PER_SECOND = 1_000;
const MS_PER_MINUTE = 60 * MS_PER_SECOND;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;
const MS_PER_DAY = 24 * MS_PER_HOUR;

/** Strict ISO-8601 UTC timestamp: date, time, optional fraction, literal `Z`. */
const ISO_Z = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,9})?)?Z$/;

/** Brands an epoch-ms number as an Instant. Rejects non-finite values. */
export function instantFromMs(ms: number): Instant {
  if (!Number.isFinite(ms)) throw new DomainError('VALIDATION', { reason: 'instant-not-finite' });
  return ms as Instant;
}

/**
 * Parses an ISO-8601 string that ends in `Z`. Offset-less or offset strings are
 * rejected so the result never depends on the host timezone.
 */
export function instantFromIso(iso: string): Instant {
  if (!ISO_Z.test(iso)) throw new DomainError('VALIDATION', { reason: 'instant-not-utc-iso' });
  const ms = Date.parse(iso);
  // Reject calendar overflow (e.g. Feb 30) that some engines silently roll over.
  const head = iso.slice(0, Math.min(19, iso.length - 1));
  if (Number.isNaN(ms) || !new Date(ms).toISOString().startsWith(head)) {
    throw new DomainError('VALIDATION', { reason: 'instant-invalid' });
  }
  return ms as Instant;
}

/** ISO-8601 UTC string, e.g. `2026-01-01T00:00:00.000Z`. */
export function toIso(i: Instant): string {
  return new Date(i).toISOString();
}

/** Converts a Duration to milliseconds. */
export function durationToMs(d: Duration): number {
  if (typeof d === 'number') return d;
  return (
    (d.days ?? 0) * MS_PER_DAY +
    (d.hours ?? 0) * MS_PER_HOUR +
    (d.minutes ?? 0) * MS_PER_MINUTE +
    (d.seconds ?? 0) * MS_PER_SECOND +
    (d.ms ?? 0)
  );
}

/** Adds an absolute duration to an instant. */
export function addDuration(i: Instant, d: Duration): Instant {
  return instantFromMs(i + durationToMs(d));
}
