import { describe, expect, it } from 'vitest';
import { DomainError } from '../errors';
import { addDuration, durationToMs, instantFromIso, instantFromMs, toIso } from './instant';

describe('instantFromIso / toIso', () => {
  it.each(['2026-01-01T00:00:00.000Z', '2026-03-29T01:00:00.000Z', '1999-12-31T23:59:59.999Z'])(
    'round-trips %s',
    (iso) => {
      expect(toIso(instantFromIso(iso))).toBe(iso);
    },
  );

  it('accepts a Z string without milliseconds', () => {
    expect(toIso(instantFromIso('2026-01-15T22:59:59Z'))).toBe('2026-01-15T22:59:59.000Z');
  });

  it('gives epoch milliseconds', () => {
    expect(instantFromIso('1970-01-01T00:00:01Z')).toBe(1000);
  });

  it.each([
    '2026-01-01T00:00:00',
    '2026-01-01T00:00:00+01:00',
    '2026-01-01',
    'not a date',
    '2026-13-01T00:00:00Z',
    '2026-02-30T00:00:00Z',
    '',
  ])('rejects %j with DomainError VALIDATION', (iso) => {
    expect(() => instantFromIso(iso)).toThrow(DomainError);
    try {
      instantFromIso(iso);
    } catch (e) {
      expect((e as DomainError).code).toBe('VALIDATION');
    }
  });
});

describe('instantFromMs', () => {
  it('rejects non-finite values', () => {
    expect(() => instantFromMs(Number.NaN)).toThrow(DomainError);
    expect(() => instantFromMs(Number.POSITIVE_INFINITY)).toThrow(DomainError);
  });
});

describe('durationToMs / addDuration', () => {
  it('treats a number as milliseconds', () => {
    expect(durationToMs(1500)).toBe(1500);
  });

  it('sums every unit, a day being a fixed 86 400 000 ms', () => {
    expect(durationToMs({ days: 1, hours: 1, minutes: 1, seconds: 1, ms: 1 })).toBe(
      86_400_000 + 3_600_000 + 60_000 + 1_000 + 1,
    );
    expect(durationToMs({})).toBe(0);
  });

  it('adds a duration to an instant', () => {
    const start = instantFromIso('2026-01-01T00:00:00Z');
    expect(toIso(addDuration(start, { days: 1 }))).toBe('2026-01-02T00:00:00.000Z');
  });
});
