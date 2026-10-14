import { describe, expect, it } from 'vitest';
import { DomainError, instantFromIso, localDate, toIso } from '@noor/core';
import { FakeClock } from './fake-clock';

const STOCKHOLM = 'Europe/Stockholm';
const ADDIS = 'Africa/Addis_Ababa';

/** Local date at `iso`, then local date one second later. */
function acrossOneSecond(iso: string, tz: string): [string, string] {
  const clock = new FakeClock().set(iso);
  const before = localDate(clock.now(), tz);
  clock.advance({ seconds: 1 });
  return [before, localDate(clock.now(), tz)];
}

describe('FakeClock across local midnight', () => {
  it('Stockholm in winter (UTC+1)', () => {
    expect(acrossOneSecond('2026-01-15T22:59:59.000Z', STOCKHOLM)).toEqual([
      '2026-01-15',
      '2026-01-16',
    ]);
  });

  it('Stockholm in summer (UTC+2)', () => {
    expect(acrossOneSecond('2026-07-15T21:59:59.000Z', STOCKHOLM)).toEqual([
      '2026-07-15',
      '2026-07-16',
    ]);
  });

  it.each([
    ['midnight into spring-forward day', '2026-03-28T22:59:59Z', '2026-03-28', '2026-03-29'],
    ['midnight after spring-forward day', '2026-03-29T21:59:59Z', '2026-03-29', '2026-03-30'],
    ['midnight into fall-back day', '2026-10-24T21:59:59Z', '2026-10-24', '2026-10-25'],
    ['midnight after fall-back day', '2026-10-25T22:59:59Z', '2026-10-25', '2026-10-26'],
  ])('Stockholm DST: %s', (_label, iso, before, after) => {
    expect(acrossOneSecond(iso, STOCKHOLM)).toEqual([before, after]);
  });

  it('Addis Ababa (UTC+3, no DST)', () => {
    expect(acrossOneSecond('2026-03-01T20:59:59Z', ADDIS)).toEqual(['2026-03-01', '2026-03-02']);
  });

  it('Addis Ababa is already on the next day while UTC is not', () => {
    const clock = new FakeClock('2026-03-01T23:30:00Z');
    expect(toIso(clock.now()).slice(0, 10)).toBe('2026-03-01');
    expect(localDate(clock.now(), ADDIS)).toBe('2026-03-02');
  });

  it('Addis Ababa gives Gregorian ASCII dates across Ethiopian New Year eve', () => {
    const clock = new FakeClock('2026-09-10T21:00:00Z');
    const eve = localDate(clock.now(), ADDIS);
    clock.advance({ days: 1 });
    const next = localDate(clock.now(), ADDIS);
    for (const d of [eve, next]) expect(d).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect([eve, next]).toEqual(['2026-09-11', '2026-09-12']);
  });
});

describe('FakeClock API', () => {
  it('starts at the fixed constant 2026-01-01T00:00:00.000Z', () => {
    expect(toIso(FakeClock.DEFAULT_START)).toBe('2026-01-01T00:00:00.000Z');
    expect(new FakeClock().now()).toBe(FakeClock.DEFAULT_START);
  });

  it('set() accepts an Instant or an ISO-Z string', () => {
    const clock = new FakeClock();
    clock.set(instantFromIso('2026-05-05T05:05:05Z'));
    expect(toIso(clock.now())).toBe('2026-05-05T05:05:05.000Z');
    clock.set('2026-06-06T06:06:06.006Z');
    expect(toIso(clock.now())).toBe('2026-06-06T06:06:06.006Z');
  });

  it('advance() accepts milliseconds or a duration object', () => {
    const clock = new FakeClock();
    clock.advance(250);
    expect(toIso(clock.now())).toBe('2026-01-01T00:00:00.250Z');
    clock.advance({ days: 1, hours: 2, minutes: 3, seconds: 4, ms: 5 });
    expect(toIso(clock.now())).toBe('2026-01-02T02:03:04.255Z');
  });

  it.each([[-1], [{ seconds: -1 }], [{ days: 1, hours: -25 }]])(
    'advance(%j) with a negative duration throws',
    (d) => {
      const clock = new FakeClock();
      expect(() => clock.advance(d)).toThrow();
      expect(clock.now()).toBe(FakeClock.DEFAULT_START);
    },
  );

  it.each(['2026-01-01T00:00:00', '2026-01-01T01:00:00+01:00', '2026-01-01'])(
    'set(%j) without a Z suffix throws',
    (iso) => {
      const clock = new FakeClock();
      expect(() => clock.set(iso)).toThrow(DomainError);
      expect(clock.now()).toBe(FakeClock.DEFAULT_START);
    },
  );
});
