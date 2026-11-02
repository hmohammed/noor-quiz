import { describe, expect, it } from 'vitest';
import { DomainError } from '../errors';
import { instantFromIso } from './instant';
import { isValidTimeZone, localDate, localDateTime, zonedInstant } from './zoned';

const at = instantFromIso;

describe('isValidTimeZone', () => {
  it.each(['Europe/Stockholm', 'Africa/Addis_Ababa', 'UTC', 'Asia/Riyadh'])('accepts %s', (tz) => {
    expect(isValidTimeZone(tz)).toBe(true);
  });

  it.each(['Mars/Olympus_Mons', 'Europe/Nowhere', '', 'not a zone'])('rejects %j', (tz) => {
    expect(isValidTimeZone(tz)).toBe(false);
  });
});

describe('localDate / localDateTime', () => {
  it('gives the local wall-clock date and time', () => {
    expect(localDateTime(at('2026-01-15T22:59:59Z'), 'Europe/Stockholm')).toEqual({
      date: '2026-01-15',
      hour: 23,
      minute: 59,
      second: 59,
    });
  });

  it('uses hour 0, not 24, at local midnight', () => {
    expect(localDateTime(at('2026-01-15T23:00:00Z'), 'Europe/Stockholm')).toEqual({
      date: '2026-01-16',
      hour: 0,
      minute: 0,
      second: 0,
    });
  });

  it('is Gregorian with ASCII digits in a zone whose locale uses another calendar', () => {
    expect(localDate(at('2026-09-11T00:00:00Z'), 'Africa/Addis_Ababa')).toBe('2026-09-11');
    expect(localDate(at('2026-03-20T12:00:00Z'), 'Asia/Riyadh')).toBe('2026-03-20');
  });

  it.each([
    ['localDate', () => localDate(at('2026-01-01T00:00:00Z'), 'Mars/Olympus_Mons')],
    ['localDateTime', () => localDateTime(at('2026-01-01T00:00:00Z'), 'Europe/Nowhere')],
  ])('%s rejects an unknown zone with DomainError VALIDATION', (_label, call) => {
    expect(call).toThrow(DomainError);
    try {
      call();
    } catch (e) {
      expect((e as DomainError).code).toBe('VALIDATION');
    }
  });
});

describe('zonedInstant', () => {
  it.each([
    ['2026-02-18', '04:00', 'Europe/Stockholm', '2026-02-18T03:00:00Z'],
    ['2026-02-18', '00:00', 'Africa/Addis_Ababa', '2026-02-17T21:00:00Z'],
    ['2026-02-18', '18:00', 'Asia/Riyadh', '2026-02-18T15:00:00Z'],
    ['2026-02-18', '05:00', 'America/Toronto', '2026-02-18T10:00:00Z'],
    ['2026-07-01', '12:00', 'UTC', '2026-07-01T12:00:00Z'],
  ])('%s %s in %s is %s', (date, time, tz, expected) => {
    expect(zonedInstant(date, time, tz)).toBe(at(expected));
  });

  it.each([
    ['2026-03-29', '02:30', 'Europe/Stockholm', '2026-03-29T01:30:00Z'],
    ['2026-03-08', '02:30', 'America/Toronto', '2026-03-08T07:30:00Z'],
  ])('moves %s %s in %s (spring-forward gap) forward to %s', (date, time, tz, expected) => {
    expect(zonedInstant(date, time, tz)).toBe(at(expected));
  });

  it.each([
    ['2026-10-25', '02:30', 'Europe/Stockholm', '2026-10-25T00:30:00Z'],
    ['2026-11-01', '01:30', 'America/Toronto', '2026-11-01T05:30:00Z'],
  ])(
    'takes the earlier instant for %s %s in %s (fall-back overlap): %s',
    (date, time, tz, expected) => {
      expect(zonedInstant(date, time, tz)).toBe(at(expected));
    },
  );

  it.each([
    ['unknown zone', '2026-02-18', '04:00', 'Mars/Olympus_Mons', 'unknown-timezone'],
    ['invalid date', '2026-02-30', '04:00', 'Europe/Stockholm', 'invalid-local-date'],
    ['invalid time', '2026-02-18', '24:00', 'Europe/Stockholm', 'invalid-local-time'],
  ])('rejects an %s with DomainError VALIDATION', (_label, date, time, tz, reason) => {
    let error: unknown;
    try {
      zonedInstant(date, time, tz);
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(DomainError);
    expect((error as DomainError).code).toBe('VALIDATION');
    expect((error as DomainError).details).toEqual({ reason });
  });

  it('round-trips through localDateTime', () => {
    const i = zonedInstant('2026-03-08', '05:00', 'America/Toronto');
    expect(localDateTime(i, 'America/Toronto')).toEqual({
      date: '2026-03-08',
      hour: 5,
      minute: 0,
      second: 0,
    });
  });
});
