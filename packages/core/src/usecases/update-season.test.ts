import { describe, expect, it } from 'vitest';
import { asTenantId } from '../communities/community';
import { DomainError } from '../errors';
import type { Clock } from '../ports/clock';
import type { IdGenerator } from '../ports/id-generator';
import { seasonRules } from '../season/community-season';
import { questionWindow, seasonState } from '../season/season-rules';
import { instantFromIso, instantFromMs, toIso, type Instant } from '../time/instant';
import { createSeason } from './create-season';
import { MemorySeasonRepo } from './memory-season-repo';
import { updateSeason } from './update-season';

const TENANT = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
const OTHER = '01ARZ3NDEKTSV4RRFFQ69G5FAW';
const USER = '01ARZ3NDEKTSV4RRFFQ69G5FB0';
const IDS = [
  '01ARZ3NDEKTSV4RRFFQ69G5FB1',
  '01ARZ3NDEKTSV4RRFFQ69G5FB2',
  '01ARZ3NDEKTSV4RRFFQ69G5FB3',
  '01ARZ3NDEKTSV4RRFFQ69G5FB4',
];

const RULES = {
  name: 'Ramadan 1448',
  kind: 'ramadan',
  startDate: '2026-02-18',
  lengthDays: 30,
  timezone: 'Europe/Stockholm',
  opensAtLocal: '04:00',
  closesAtLocal: '20:00',
};

function mutableClock(start: string): {
  clock: Clock;
  set(at: Instant | string): void;
  at(): Instant;
  reads(): number;
} {
  let current = instantFromIso(start);
  let reads = 0;
  return {
    clock: {
      now: () => {
        reads += 1;
        return current;
      },
    },
    set(at: Instant | string) {
      current = typeof at === 'string' ? instantFromIso(at) : at;
    },
    at: () => current,
    reads: () => reads,
  };
}

function ids(): IdGenerator {
  let index = 0;
  return {
    newId() {
      const id = IDS[index];
      index += 1;
      if (id === undefined) throw new Error('no more ids');
      return id;
    },
  };
}

async function expectCode(run: Promise<unknown>, code: string): Promise<DomainError> {
  const error = await run.then(
    () => expect.fail(`expected ${code}`),
    (caught: unknown) => caught,
  );
  expect(error).toBeInstanceOf(DomainError);
  expect((error as DomainError).code).toBe(code);
  return error as DomainError;
}

describe('updateSeason', () => {
  it('changes start and length before day 1 opens and keeps identity fields, with updatedAt from the clock', async () => {
    const seasons = new MemorySeasonRepo();
    const time = mutableClock('2026-01-15T12:00:00.000Z');
    const deps = { clock: time.clock, ids: ids(), seasons };
    const created = await createSeason(deps, { ...RULES, tenantId: TENANT, userId: USER });
    time.set('2026-02-01T00:00:00.000Z');

    const { season } = await updateSeason(deps, {
      tenantId: TENANT,
      seasonId: created.season.id,
      patch: { startDate: '2026-03-01', lengthDays: 10 },
    });

    expect(season.startDate).toBe('2026-03-01');
    expect(season.lengthDays).toBe(10);
    expect(season.id).toBe(created.season.id);
    expect(season.tenantId).toBe(created.season.tenantId);
    expect(season.createdBy).toBe(created.season.createdBy);
    expect(season.createdAt).toBe(created.season.createdAt);
    expect(season.schemaVersion).toBe(created.season.schemaVersion);
    expect(season.updatedAt).toBe('2026-02-01T00:00:00.000Z');
    expect(season.updatedAt).toBe(toIso(time.at()));
    expect(seasons.all()).toEqual([season]);
  });

  it('rejects a new start date or length once the season has started and leaves the document unchanged', async () => {
    const seasons = new MemorySeasonRepo();
    const time = mutableClock('2026-01-15T12:00:00.000Z');
    const deps = { clock: time.clock, ids: ids(), seasons };
    const created = await createSeason(deps, { ...RULES, tenantId: TENANT, userId: USER });
    const opens = questionWindow(seasonRules(created.season), 1).opensAt;
    time.set(opens);
    const before = seasons.all();

    const startError = await expectCode(
      updateSeason(deps, {
        tenantId: TENANT,
        seasonId: created.season.id,
        patch: { startDate: '2026-03-01' },
      }),
      'CLOSED',
    );
    expect(startError.details).toEqual({ reason: 'season-started' });
    expect(seasons.all()).toEqual(before);

    const lengthError = await expectCode(
      updateSeason(deps, {
        tenantId: TENANT,
        seasonId: created.season.id,
        patch: { lengthDays: 10 },
      }),
      'CLOSED',
    );
    expect(lengthError.details).toEqual({ reason: 'season-started' });
    expect(seasons.all()).toEqual(before);
  });

  it.each([
    ['name', { name: 'Ramadan 1449' }],
    ['kind', { kind: 'custom' }],
    ['timezone', { timezone: 'Africa/Addis_Ababa' }],
    ['opensAtLocal', { opensAtLocal: '05:00' }],
  ])('rejects a new %s once started and writes nothing', async (_label, patch) => {
    const seasons = new MemorySeasonRepo();
    const time = mutableClock('2026-01-15T12:00:00.000Z');
    const deps = { clock: time.clock, ids: ids(), seasons };
    const created = await createSeason(deps, { ...RULES, tenantId: TENANT, userId: USER });
    time.set(questionWindow(seasonRules(created.season), 1).opensAt);
    const before = seasons.all();

    const error = await expectCode(
      updateSeason(deps, { tenantId: TENANT, seasonId: created.season.id, patch }),
      'CLOSED',
    );
    expect(error.details).toEqual({ reason: 'season-started' });
    expect(seasons.all()).toEqual(before);
  });

  it('saves a new close after the start, and the next state uses that close', async () => {
    const seasons = new MemorySeasonRepo();
    const time = mutableClock('2026-01-15T12:00:00.000Z');
    const deps = { clock: time.clock, ids: ids(), seasons };
    const created = await createSeason(deps, {
      ...RULES,
      tenantId: TENANT,
      userId: USER,
      lengthDays: 1,
    });
    time.set('2026-02-18T12:00:00.000Z');
    expect(seasonState(seasonRules(created.season), time.at()).phase).toBe('active');

    const readsBefore = time.reads();
    const saved = await updateSeason(deps, {
      tenantId: TENANT,
      seasonId: created.season.id,
      patch: { closesAtLocal: '10:00' },
    });
    expect(time.reads() - readsBefore).toBe(1);
    expect(saved.season.startDate).toBe(created.season.startDate);
    expect(saved.season.lengthDays).toBe(1);
    expect(saved.season.closesAtLocal).toBe('10:00');
    expect(saved.state).toEqual({ phase: 'ended' });
    expect(saved.state).toEqual(seasonState(seasonRules(saved.season), time.at()));
    expect(seasons.all()).toEqual([saved.season]);
  });

  it('rejects a locked field together with a new close and does not write the close', async () => {
    const seasons = new MemorySeasonRepo();
    const time = mutableClock('2026-01-15T12:00:00.000Z');
    const deps = { clock: time.clock, ids: ids(), seasons };
    const created = await createSeason(deps, { ...RULES, tenantId: TENANT, userId: USER });
    time.set(questionWindow(seasonRules(created.season), 1).opensAt);
    const before = seasons.all();

    await expectCode(
      updateSeason(deps, {
        tenantId: TENANT,
        seasonId: created.season.id,
        patch: { startDate: '2026-03-01', closesAtLocal: '22:00' },
      }),
      'CLOSED',
    );
    expect(seasons.all()).toEqual(before);
    expect(seasons.all()[0]?.closesAtLocal).toBe('20:00');
  });

  it('still saves a new start one minute before day 1 opens, and rejects it at the open instant', async () => {
    const early = new MemorySeasonRepo();
    const earlyTime = mutableClock('2026-01-15T12:00:00.000Z');
    const earlyDeps = { clock: earlyTime.clock, ids: ids(), seasons: early };
    const earlySeason = await createSeason(earlyDeps, { ...RULES, tenantId: TENANT, userId: USER });
    const opens = questionWindow(seasonRules(earlySeason.season), 1).opensAt;
    earlyTime.set(instantFromMs(opens - 60_000));

    const saved = await updateSeason(earlyDeps, {
      tenantId: TENANT,
      seasonId: earlySeason.season.id,
      patch: { startDate: '2026-03-01' },
    });
    expect(saved.season.startDate).toBe('2026-03-01');

    const late = new MemorySeasonRepo();
    const lateTime = mutableClock('2026-01-15T12:00:00.000Z');
    const lateDeps = { clock: lateTime.clock, ids: ids(), seasons: late };
    const lateSeason = await createSeason(lateDeps, { ...RULES, tenantId: TENANT, userId: USER });
    const lateOpens = questionWindow(seasonRules(lateSeason.season), 1).opensAt;
    lateTime.set(lateOpens);
    const before = late.all();

    await expectCode(
      updateSeason(lateDeps, {
        tenantId: TENANT,
        seasonId: lateSeason.season.id,
        patch: { startDate: '2026-03-01' },
      }),
      'CLOSED',
    );
    expect(late.all()).toEqual(before);
  });

  it('throws NOT_FOUND for an unknown id and for another tenant, and leaves every document unchanged', async () => {
    const seasons = new MemorySeasonRepo();
    const time = mutableClock('2026-01-15T12:00:00.000Z');
    const deps = { clock: time.clock, ids: ids(), seasons };
    const mine = await createSeason(deps, { ...RULES, tenantId: TENANT, userId: USER });
    const theirs = await createSeason(deps, { ...RULES, tenantId: OTHER, userId: USER });
    const before = seasons.all();

    await expectCode(
      updateSeason(deps, {
        tenantId: TENANT,
        seasonId: '01ARZ3NDEKTSV4RRFFQ69G5FB9',
        patch: { name: 'Missing' },
      }),
      'NOT_FOUND',
    );
    await expectCode(
      updateSeason(deps, {
        tenantId: TENANT,
        seasonId: theirs.season.id,
        patch: { name: 'Stolen' },
      }),
      'NOT_FOUND',
    );
    expect(seasons.all()).toEqual(before);
    expect(await seasons.get(asTenantId(OTHER), theirs.season.id)).toEqual(theirs.season);
    expect(await seasons.get(asTenantId(TENANT), mine.season.id)).toEqual(mine.season);
  });

  it('throws VALIDATION for a non-ULID season id and writes nothing', async () => {
    const seasons = new MemorySeasonRepo();
    const time = mutableClock('2026-01-15T12:00:00.000Z');
    const deps = { clock: time.clock, ids: ids(), seasons };
    await createSeason(deps, { ...RULES, tenantId: TENANT, userId: USER });
    const before = seasons.all();
    await expectCode(
      updateSeason(deps, { tenantId: TENANT, seasonId: 'not-a-season', patch: { name: 'Nope' } }),
      'VALIDATION',
    );
    expect(seasons.all()).toEqual(before);
  });
});
