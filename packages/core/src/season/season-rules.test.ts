import { describe, expect, it } from 'vitest';
import { DomainError } from '../errors';
import { instantFromIso, toIso, type Instant } from '../time/instant';
import {
  assertValidSeason,
  dayIndexAt,
  isOpen,
  questionWindow,
  seasonState,
  type Season,
  type SeasonState,
} from './season-rules';

const at = instantFromIso;

const stockholm: Season = {
  startDate: '2026-02-18',
  lengthDays: 30,
  timezone: 'Europe/Stockholm',
  opensAtLocal: '04:00',
  closesAtLocal: '20:00',
};
const riyadh: Season = {
  startDate: '2026-02-18',
  lengthDays: 30,
  timezone: 'Asia/Riyadh',
  opensAtLocal: '18:00',
  closesAtLocal: '01:00',
};
const addis: Season = {
  startDate: '2026-02-18',
  lengthDays: 30,
  timezone: 'Africa/Addis_Ababa',
  opensAtLocal: '00:00',
  closesAtLocal: '00:00',
};
const toronto: Season = {
  startDate: '2026-02-18',
  lengthDays: 30,
  timezone: 'America/Toronto',
  opensAtLocal: '05:00',
  closesAtLocal: '01:00',
};
const stockholmGap: Season = {
  startDate: '2026-03-27',
  lengthDays: 5,
  timezone: 'Europe/Stockholm',
  opensAtLocal: '02:30',
  closesAtLocal: '01:00',
};
const stockholmFallBack: Season = {
  startDate: '2026-10-24',
  lengthDays: 3,
  timezone: 'Europe/Stockholm',
  opensAtLocal: '02:30',
  closesAtLocal: '23:00',
};
const oneDay: Season = { ...stockholm, lengthDays: 1 };
// Chile falls back at midnight: after 2026-04-04 23:59:59 −03 the clock reads 23:00 −04,
// so 4 April is 25 hours long and the local date reads 4 April twice.
const santiagoMidnightFallBack: Season = {
  startDate: '2026-04-03',
  lengthDays: 4,
  timezone: 'America/Santiago',
  opensAtLocal: '00:00',
  closesAtLocal: '00:00',
};

const tableSeasons: [string, Season][] = [
  ['Stockholm', stockholm],
  ['Riyadh close after midnight', riyadh],
  ['Addis Ababa 24 hours', addis],
  ['Toronto DST', toronto],
  ['Stockholm spring gap', stockholmGap],
  ['Stockholm fall-back', stockholmFallBack],
  ['one day', oneDay],
  ['Santiago midnight fall-back', santiagoMidnightFallBack],
];

function domainErrorOf(call: () => unknown): DomainError {
  try {
    call();
  } catch (e) {
    if (e instanceof DomainError) return e;
    throw e;
  }
  throw new Error('expected a DomainError');
}

describe('assertValidSeason', () => {
  it('accepts a valid season', () => {
    for (const [, s] of tableSeasons) expect(() => assertValidSeason(s)).not.toThrow();
  });

  it.each<[string, Partial<Season>, string]>([
    ['startDate 2026-02-30', { startDate: '2026-02-30' }, 'invalid-start-date'],
    ['startDate 2026-2-18', { startDate: '2026-2-18' }, 'invalid-start-date'],
    ['lengthDays 0', { lengthDays: 0 }, 'invalid-length'],
    ['lengthDays -1', { lengthDays: -1 }, 'invalid-length'],
    ['lengthDays 1.5', { lengthDays: 1.5 }, 'invalid-length'],
    ['lengthDays 367', { lengthDays: 367 }, 'invalid-length'],
    ['lengthDays NaN', { lengthDays: Number.NaN }, 'invalid-length'],
    ['unknown timezone', { timezone: 'Europe/Nowhere' }, 'unknown-timezone'],
    ['empty timezone', { timezone: '' }, 'unknown-timezone'],
    ['opensAtLocal 4:00', { opensAtLocal: '4:00' }, 'invalid-local-time'],
    ['opensAtLocal 24:00', { opensAtLocal: '24:00' }, 'invalid-local-time'],
    ['closesAtLocal 20:00:00', { closesAtLocal: '20:00:00' }, 'invalid-local-time'],
    ['closesAtLocal empty', { closesAtLocal: '' }, 'invalid-local-time'],
  ])('rejects %s', (_label, patch, reason) => {
    const e = domainErrorOf(() => assertValidSeason({ ...stockholm, ...patch }));
    expect(e.code).toBe('VALIDATION');
    expect(e.details).toEqual({ reason });
  });

  it('accepts lengthDays 366', () => {
    expect(() => assertValidSeason({ ...stockholm, lengthDays: 366 })).not.toThrow();
  });
});

describe('every public season function rejects an invalid season', () => {
  const bad: Season = { ...stockholm, timezone: 'Mars/Olympus_Mons' };
  const now = at('2026-02-18T12:00:00Z');
  it.each<[string, () => unknown]>([
    ['questionWindow', () => questionWindow(bad, 1)],
    ['dayIndexAt', () => dayIndexAt(bad, now)],
    ['seasonState', () => seasonState(bad, now)],
    ['isOpen', () => isOpen(bad, 1, now)],
  ])('%s', (_label, call) => {
    expect(domainErrorOf(call).code).toBe('VALIDATION');
  });
});

describe('questionWindow', () => {
  it.each<[string, Season, number, string, string, string]>([
    ['Stockholm day 1', stockholm, 1, '2026-02-18', '2026-02-18T03:00:00Z', '2026-02-18T19:00:00Z'],
    [
      'Stockholm day 30',
      stockholm,
      30,
      '2026-03-19',
      '2026-03-19T03:00:00Z',
      '2026-03-19T19:00:00Z',
    ],
    ['Riyadh day 1', riyadh, 1, '2026-02-18', '2026-02-18T15:00:00Z', '2026-02-18T22:00:00Z'],
    ['Riyadh day 30', riyadh, 30, '2026-03-19', '2026-03-19T15:00:00Z', '2026-03-19T22:00:00Z'],
    ['Addis day 1', addis, 1, '2026-02-18', '2026-02-17T21:00:00Z', '2026-02-18T21:00:00Z'],
    ['Addis day 2', addis, 2, '2026-02-19', '2026-02-18T21:00:00Z', '2026-02-19T21:00:00Z'],
    ['Toronto day 18', toronto, 18, '2026-03-07', '2026-03-07T10:00:00Z', '2026-03-08T06:00:00Z'],
    ['Toronto day 19', toronto, 19, '2026-03-08', '2026-03-08T09:00:00Z', '2026-03-09T05:00:00Z'],
    [
      'Stockholm gap day 2',
      stockholmGap,
      2,
      '2026-03-28',
      '2026-03-28T01:30:00Z',
      '2026-03-29T00:00:00Z',
    ],
    [
      'Stockholm gap day 3',
      stockholmGap,
      3,
      '2026-03-29',
      '2026-03-29T01:30:00Z',
      '2026-03-29T23:00:00Z',
    ],
    [
      'Stockholm fall-back day 2',
      stockholmFallBack,
      2,
      '2026-10-25',
      '2026-10-25T00:30:00Z',
      '2026-10-25T22:00:00Z',
    ],
  ])('%s', (_label, season, dayIndex, date, opensAt, closesAt) => {
    expect(questionWindow(season, dayIndex)).toEqual({
      dayIndex,
      date,
      opensAt: at(opensAt),
      closesAt: at(closesAt),
    });
  });

  it.each([0, 31, 1.5, -1, Number.NaN])('rejects dayIndex %j as day-out-of-range', (d) => {
    const e = domainErrorOf(() => questionWindow(stockholm, d));
    expect(e.code).toBe('VALIDATION');
    expect(e.details).toEqual({ reason: 'day-out-of-range' });
  });

  it.each(tableSeasons)('%s: windows are non-empty and never overlap', (_label, season) => {
    for (let d = 1; d <= season.lengthDays; d++) {
      const w = questionWindow(season, d);
      expect(w.opensAt).toBeLessThan(w.closesAt);
      if (d < season.lengthDays) {
        expect(w.closesAt).toBeLessThanOrEqual(questionWindow(season, d + 1).opensAt);
      }
    }
  });
});

type Expect = 'upcoming' | 'ended' | { day: number; open: boolean };

function check(season: Season, iso: string, expected: Expect): void {
  const now = at(iso);
  const state = seasonState(season, now);
  const day = dayIndexAt(season, now);
  if (expected === 'upcoming' || expected === 'ended') {
    expect(state).toEqual<SeasonState>({ phase: expected });
    expect(day).toBeNull();
    return;
  }
  expect(state).toEqual<SeasonState>({
    phase: 'active',
    dayIndex: expected.day,
    open: expected.open,
  });
  expect(day).toBe(expected.day);
  expect(isOpen(season, expected.day, now)).toBe(expected.open);
}

const open = (day: number): Expect => ({ day, open: true });
const closed = (day: number): Expect => ({ day, open: false });

describe('day index and state at boundaries', () => {
  it.each<[string, Season, string, Expect]>([
    ['Stockholm', stockholm, '2026-02-18T02:59:00Z', 'upcoming'],
    ['Stockholm', stockholm, '2026-02-18T03:00:00Z', open(1)],
    ['Stockholm', stockholm, '2026-02-18T03:01:00Z', open(1)],
    ['Stockholm', stockholm, '2026-02-18T18:59:00Z', open(1)],
    ['Stockholm', stockholm, '2026-02-18T19:00:00Z', closed(1)],
    ['Stockholm', stockholm, '2026-02-19T02:59:00Z', closed(1)],
    ['Stockholm', stockholm, '2026-02-19T03:00:00Z', open(2)],
    ['Stockholm', stockholm, '2026-03-19T18:59:00Z', open(30)],
    ['Stockholm', stockholm, '2026-03-19T19:00:00Z', 'ended'],
    ['Stockholm', stockholm, '2026-03-19T19:01:00Z', 'ended'],
    ['Riyadh', riyadh, '2026-02-18T14:59:00Z', 'upcoming'],
    ['Riyadh', riyadh, '2026-02-18T21:59:00Z', open(1)],
    ['Riyadh', riyadh, '2026-02-18T22:00:00Z', closed(1)],
    ['Riyadh', riyadh, '2026-03-19T21:59:00Z', open(30)],
    ['Riyadh', riyadh, '2026-03-19T22:00:00Z', 'ended'],
    ['Addis Ababa', addis, '2026-02-17T20:59:00Z', 'upcoming'],
    ['Addis Ababa', addis, '2026-02-17T21:00:00Z', open(1)],
    ['Addis Ababa', addis, '2026-02-18T20:59:00Z', open(1)],
    ['Addis Ababa', addis, '2026-02-18T21:00:00Z', open(2)],
    ['Addis Ababa', addis, '2026-03-19T20:59:00Z', open(30)],
    ['Addis Ababa', addis, '2026-03-19T21:00:00Z', 'ended'],
    ['Toronto', toronto, '2026-03-08T05:59:00Z', open(18)],
    ['Toronto', toronto, '2026-03-08T06:00:00Z', closed(18)],
    ['Toronto', toronto, '2026-03-08T08:59:00Z', closed(18)],
    ['Toronto', toronto, '2026-03-08T09:00:00Z', open(19)],
    ['Stockholm gap', stockholmGap, '2026-03-29T01:29:00Z', closed(2)],
    ['Stockholm gap', stockholmGap, '2026-03-29T01:30:00Z', open(3)],
    ['one day', oneDay, '2026-02-18T02:59:00Z', 'upcoming'],
    ['one day', oneDay, '2026-02-18T03:00:00Z', open(1)],
    ['one day', oneDay, '2026-02-18T18:59:00Z', open(1)],
    ['one day', oneDay, '2026-02-18T19:00:00Z', 'ended'],
    ['Santiago', santiagoMidnightFallBack, '2026-04-05T02:59:00Z', open(2)],
    [
      'Santiago (repeated 23:30 on 4 April)',
      santiagoMidnightFallBack,
      '2026-04-05T03:30:00Z',
      open(2),
    ],
    ['Santiago', santiagoMidnightFallBack, '2026-04-05T03:59:00Z', open(2)],
    ['Santiago', santiagoMidnightFallBack, '2026-04-05T04:00:00Z', open(3)],
  ])('%s at %s', (_label, season, iso, expected) => {
    check(season, iso, expected);
  });
});

describe('day index never exceeds lengthDays', () => {
  const MINUTE = 60_000;
  const HALF_HOUR = 30 * MINUTE;
  const DAY = 86_400_000;

  function sweepInstants(season: Season): Instant[] {
    const first = questionWindow(season, 1).opensAt;
    const last = questionWindow(season, season.lengthDays).closesAt;
    const points = new Set<number>();
    for (let t = first - DAY; t <= last + DAY; t += HALF_HOUR) points.add(t);
    for (let d = 1; d <= season.lengthDays; d++) {
      const w = questionWindow(season, d);
      for (const edge of [w.opensAt, w.closesAt]) {
        for (const delta of [-MINUTE, 0, MINUTE]) points.add(edge + delta);
      }
    }
    return [...points].sort((a, b) => a - b) as Instant[];
  }

  it.each(tableSeasons)('%s', (_label, season) => {
    let previous = 0;
    for (const now of sweepInstants(season)) {
      const day = dayIndexAt(season, now);
      const state = seasonState(season, now);
      if (day === null) {
        expect(state.phase === 'upcoming' || state.phase === 'ended', toIso(now)).toBe(true);
        if (state.phase === 'ended') previous = season.lengthDays;
        continue;
      }
      expect(Number.isInteger(day), toIso(now)).toBe(true);
      expect(day, toIso(now)).toBeGreaterThanOrEqual(Math.max(1, previous));
      expect(day, toIso(now)).toBeLessThanOrEqual(season.lengthDays);
      expect(state, toIso(now)).toEqual({
        phase: 'active',
        dayIndex: day,
        open: isOpen(season, day, now),
      });
      previous = day;
    }
  });
});

describe('isOpen never trusts an arbitrary day', () => {
  const now = at('2026-02-18T12:00:00Z');

  it.each([0, 31, Number.NaN, 1.5, -1, Number.POSITIVE_INFINITY])(
    'is false for dayIndex %j',
    (d) => {
      expect(isOpen(stockholm, d, now)).toBe(false);
    },
  );

  it('is true only for the day in effect', () => {
    for (let d = 1; d <= stockholm.lengthDays; d++) {
      expect(isOpen(stockholm, d, now)).toBe(d === 1);
    }
    const later = at('2026-03-01T12:00:00Z');
    const inEffect = dayIndexAt(stockholm, later);
    expect(inEffect).toBe(12);
    for (let d = 1; d <= stockholm.lengthDays; d++) {
      expect(isOpen(stockholm, d, later)).toBe(d === inEffect);
    }
  });
});
