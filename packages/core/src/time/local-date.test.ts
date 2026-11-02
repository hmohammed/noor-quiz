import { describe, expect, it } from 'vitest';
import { DomainError } from '../errors';
import { addDays, daysBetween, isValidLocalDate, parseLocalTime } from './local-date';

describe('addDays', () => {
  it.each([
    ['2026-02-28', 1, '2026-03-01'],
    ['2028-02-28', 1, '2028-02-29'],
    ['2026-12-31', 1, '2027-01-01'],
    ['2026-03-01', -1, '2026-02-28'],
    ['2026-02-18', 29, '2026-03-19'],
    ['2026-02-18', 0, '2026-02-18'],
  ])('addDays(%s, %i) = %s', (date, n, expected) => {
    expect(addDays(date, n)).toBe(expected);
  });

  it.each([
    ['2026-02-30', 1],
    ['2026-02-18', 1.5],
    ['2026-02-18', Number.NaN],
  ])('rejects addDays(%j, %j) with VALIDATION', (date, n) => {
    expect(() => addDays(date, n)).toThrow(DomainError);
  });
});

describe('daysBetween', () => {
  it.each([
    ['2026-02-18', '2026-03-19', 29],
    ['2026-02-18', '2026-02-18', 0],
    ['2026-03-19', '2026-02-18', -29],
    ['2026-12-31', '2027-01-01', 1],
    ['2028-02-28', '2028-03-01', 2],
  ])('daysBetween(%s, %s) = %i', (from, to, expected) => {
    expect(daysBetween(from, to)).toBe(expected);
  });

  it('rejects an invalid date with VALIDATION', () => {
    expect(() => daysBetween('2026-02-30', '2026-03-01')).toThrow(DomainError);
  });
});

describe('isValidLocalDate', () => {
  it.each(['2026-02-18', '2028-02-29', '2026-12-31', '0001-01-01'])('accepts %s', (s) => {
    expect(isValidLocalDate(s)).toBe(true);
  });

  it.each([
    '2026-02-30',
    '2026-02-29',
    '2026-13-01',
    '2026-00-10',
    '2026-2-18',
    '2026-02-18T00:00',
    '٢٠٢٦-٠٢-١٨',
    '',
  ])('rejects %j', (s) => {
    expect(isValidLocalDate(s)).toBe(false);
  });

  it('rejects a non-string', () => {
    expect(isValidLocalDate(20260218 as unknown as string)).toBe(false);
  });
});

describe('parseLocalTime', () => {
  it.each([
    ['00:00', 0, 0],
    ['01:00', 1, 0],
    ['23:59', 23, 59],
    ['04:30', 4, 30],
  ])('parses %s', (s, hour, minute) => {
    expect(parseLocalTime(s)).toEqual({ hour, minute });
  });

  it.each(['24:00', '1:00', '12:60', '12:00:00', '', '١٢:٠٠', ' 12:00'])(
    'rejects %j with DomainError VALIDATION',
    (s) => {
      let error: unknown;
      try {
        parseLocalTime(s);
      } catch (e) {
        error = e;
      }
      expect(error).toBeInstanceOf(DomainError);
      expect((error as DomainError).code).toBe('VALIDATION');
      expect((error as DomainError).details).toEqual({ reason: 'invalid-local-time' });
    },
  );
});
