import { describe, expect, it } from 'vitest';
import { DomainError } from '../errors';
import { instantFromIso } from './instant';
import { isValidTimeZone, localDate, localDateTime } from './zoned';

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
