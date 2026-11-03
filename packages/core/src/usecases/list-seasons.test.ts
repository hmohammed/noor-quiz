import { describe, expect, it } from 'vitest';
import type { Clock } from '../ports/clock';
import type { IdGenerator } from '../ports/id-generator';
import { seasonRules } from '../season/community-season';
import { seasonState } from '../season/season-rules';
import { instantFromIso, toIso, type Instant } from '../time/instant';
import { createSeason } from './create-season';
import { listSeasons } from './list-seasons';
import { MemorySeasonRepo } from './memory-season-repo';

const TENANT_A = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
const TENANT_B = '01ARZ3NDEKTSV4RRFFQ69G5FAW';
const EMPTY = '01ARZ3NDEKTSV4RRFFQ69G5FB0';
const USER = '01ARZ3NDEKTSV4RRFFQ69G5FB1';
const IDS = [
  '01ARZ3NDEKTSV4RRFFQ69G5FB2',
  '01ARZ3NDEKTSV4RRFFQ69G5FB3',
  '01ARZ3NDEKTSV4RRFFQ69G5FB4',
  '01ARZ3NDEKTSV4RRFFQ69G5FB5',
];

function mutableClock(start: string): { clock: Clock; set(iso: string): void; at(): Instant } {
  let current = instantFromIso(start);
  return {
    clock: { now: () => current },
    set(iso: string) {
      current = instantFromIso(iso);
    },
    at: () => current,
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

const base = {
  userId: USER,
  name: 'Ramadan 1448',
  kind: 'ramadan',
  startDate: '2026-02-18',
  lengthDays: 30,
  timezone: 'Europe/Stockholm',
  opensAtLocal: '04:00',
  closesAtLocal: '20:00',
};

describe('listSeasons', () => {
  it('returns only that tenant, newest createdAt then id, with state from one clock read, and [] when empty', async () => {
    const seasons = new MemorySeasonRepo();
    const time = mutableClock('2026-01-01T00:00:00.000Z');
    const deps = { clock: time.clock, ids: ids(), seasons };
    let reads = 0;
    const clock: Clock = {
      now: () => {
        reads += 1;
        return time.at();
      },
    };

    const older = await createSeason(deps, { ...base, tenantId: TENANT_A, name: 'Older' });
    const sameInstant = await createSeason(deps, {
      ...base,
      tenantId: TENANT_A,
      name: 'Same instant',
    });
    expect(older.season.createdAt).toBe(sameInstant.season.createdAt);
    expect(sameInstant.season.id > older.season.id).toBe(true);

    time.set('2026-01-02T00:00:00.000Z');
    const newest = await createSeason(deps, { ...base, tenantId: TENANT_A, name: 'Newest' });
    await createSeason(deps, { ...base, tenantId: TENANT_B, name: 'Other tenant' });

    reads = 0;
    const listed = await listSeasons({ clock, seasons }, { tenantId: TENANT_A });

    expect(reads).toBe(1);
    expect(listed.map((item) => item.season.id)).toEqual([
      newest.season.id,
      sameInstant.season.id,
      older.season.id,
    ]);
    expect(listed.every((item) => item.season.tenantId === TENANT_A)).toBe(true);
    expect(listed.map((item) => item.season.name)).not.toContain('Other tenant');
    for (const item of listed) {
      expect(item.state).toEqual(seasonState(seasonRules(item.season), time.at()));
      expect(item.state).toEqual({ phase: 'upcoming' });
    }
    expect(newest.season.createdAt).toBe(toIso(instantFromIso('2026-01-02T00:00:00.000Z')));

    time.set('2026-06-01T00:00:00.000Z');
    const later = await listSeasons({ clock, seasons }, { tenantId: TENANT_A });
    expect(later[0]?.state).toEqual(seasonState(seasonRules(later[0]!.season), time.at()));
    expect(later[0]?.state.phase).not.toBe('upcoming');

    expect(await listSeasons({ clock, seasons }, { tenantId: EMPTY })).toEqual([]);
    expect(await listSeasons({ clock, seasons }, { tenantId: TENANT_B })).toHaveLength(1);
  });
});
