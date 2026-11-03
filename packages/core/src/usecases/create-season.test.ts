import { describe, expect, it } from 'vitest';
import { DomainError } from '../errors';
import type { Clock } from '../ports/clock';
import type { IdGenerator } from '../ports/id-generator';
import { nextRamadanSuggestion } from '../season/hijri';
import { instantFromIso, type Instant } from '../time/instant';
import { createSeason } from './create-season';
import { MemorySeasonRepo } from './memory-season-repo';

const TENANT = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
const USER = '01ARZ3NDEKTSV4RRFFQ69G5FAW';
const SEASON_ID = '01ARZ3NDEKTSV4RRFFQ69G5FB0';
const AT = '2026-01-15T12:00:00.000Z';

const INPUT = {
  tenantId: TENANT,
  userId: USER,
  name: 'Ramadan 1448',
  kind: 'ramadan',
  startDate: '2035-01-01',
  lengthDays: 29,
  timezone: 'Europe/Stockholm',
  opensAtLocal: '08:00',
  closesAtLocal: '21:00',
};

function clockAt(iso: string): Clock & { now(): Instant } {
  const now = instantFromIso(iso);
  return { now: () => now };
}

function ids(values: string[]): IdGenerator {
  let index = 0;
  return {
    newId() {
      const id = values[index];
      index += 1;
      if (id === undefined) throw new Error('no more ids');
      return id;
    },
  };
}

function setup(start = AT) {
  const seasons = new MemorySeasonRepo();
  const clock = clockAt(start);
  return {
    seasons,
    clock,
    run: (input: typeof INPUT = INPUT) =>
      createSeason({ clock, ids: ids([SEASON_ID]), seasons }, input),
  };
}

async function expectValidation(run: Promise<unknown>, seasons: MemorySeasonRepo): Promise<void> {
  const error = await run.then(
    () => expect.fail('expected VALIDATION'),
    (caught: unknown) => caught,
  );
  expect(error).toBeInstanceOf(DomainError);
  expect((error as DomainError).code).toBe('VALIDATION');
  expect(seasons.all()).toEqual([]);
}

describe('createSeason', () => {
  it('stores the submitted start and length when they differ from the Ramadan suggestion, and writes one document', async () => {
    const { seasons, clock, run } = setup();
    const suggestion = nextRamadanSuggestion(clock.now(), 'Europe/Stockholm');
    expect(suggestion.startDate).not.toBe(INPUT.startDate);
    expect(suggestion.lengthDays).not.toBe(INPUT.lengthDays);

    const { season } = await run();

    expect(season.startDate).toBe('2035-01-01');
    expect(season.lengthDays).toBe(29);
    expect(season.timezone).toBe('Europe/Stockholm');
    expect(seasons.all()).toEqual([season]);
    expect(season.createdAt).toBe(AT);
    expect(season.updatedAt).toBe(AT);
    expect(season.createdBy).toBe(USER);
    expect(season.tenantId).toBe(TENANT);
    expect(season.schemaVersion).toBe(1);
  });

  it('canonicalises the timezone and collapses the name', async () => {
    const { seasons, run } = setup();
    const { season } = await run({
      ...INPUT,
      name: '  Ramadan   1448 ',
      timezone: 'europe/stockholm',
    });
    expect(season.name).toBe('Ramadan 1448');
    expect(season.timezone).toBe('Europe/Stockholm');
    expect(seasons.all()).toHaveLength(1);
  });

  it.each([
    ['an invalid start date', { startDate: '2026-02-30' }],
    ['length 0', { lengthDays: 0 }],
    ['length -1', { lengthDays: -1 }],
    ['length 1.5', { lengthDays: 1.5 }],
    ['length 367', { lengthDays: 367 }],
    ['an unknown timezone', { timezone: 'Mars/Olympus' }],
    ['an offset timezone', { timezone: '+01:00' }],
    ['a short open time', { opensAtLocal: '4:00' }],
    ['a close of 24:00', { closesAtLocal: '24:00' }],
  ])('throws VALIDATION for %s and writes nothing', async (_label, patch) => {
    const { seasons, run } = setup();
    await expectValidation(run({ ...INPUT, ...patch }), seasons);
  });

  it('accepts Ramadan 1448 and a trimmed Arabic name', async () => {
    const arabic = setup();
    const { season } = await arabic.run({ ...INPUT, name: '  رمضان كريم  ' });
    expect(season.name).toBe('رمضان كريم');
    expect(arabic.seasons.all()).toHaveLength(1);

    const latin = setup();
    expect((await latin.run({ ...INPUT, name: 'Ramadan 1448' })).season.name).toBe('Ramadan 1448');
  });

  it('throws VALIDATION for a name normaliseCommunityName rejects and writes nothing', async () => {
    const { seasons, run } = setup();
    await expectValidation(run({ ...INPUT, name: '😀' }), seasons);
    await expectValidation(run({ ...INPUT, name: 'A' }), seasons);
  });
});
