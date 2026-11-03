import { describe, expect, it } from 'vitest';
import {
  asSeasonId,
  asTenantId,
  isDomainError,
  SEASON_SCHEMA_VERSION,
  type CommunitySeason,
  type DomainErrorCode,
  type SeasonId,
  type SeasonRepo,
  type TenantId,
  type UserId,
} from '@noor/core';

export interface SeasonRepoHarness {
  seasons: SeasonRepo;
  count(): Promise<number>;
}

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const AT = '2024-05-06T07:08:09.123Z';
const LATER = '2024-06-01T00:00:00.000Z';

function ulid(n: number): string {
  let rest = n;
  let body = '';
  for (let i = 0; i < 25; i++) {
    body = ALPHABET[rest % 32]! + body;
    rest = Math.floor(rest / 32);
  }
  return `0${body}`;
}

const TENANT_A = ulid(1) as TenantId;
const TENANT_B = ulid(2) as TenantId;
const USER_A = ulid(3) as UserId;
const USER_B = ulid(4) as UserId;

function season(
  id: number,
  tenantId: TenantId,
  overrides: Partial<CommunitySeason> = {},
): CommunitySeason {
  return {
    id: ulid(id) as SeasonId,
    tenantId,
    name: 'Ramadan 1448',
    kind: 'ramadan',
    startDate: '2035-01-01',
    lengthDays: 30,
    timezone: 'Europe/Stockholm',
    opensAtLocal: '08:00',
    closesAtLocal: '21:00',
    createdBy: USER_A,
    createdAt: AT,
    updatedAt: AT,
    schemaVersion: SEASON_SCHEMA_VERSION,
    ...overrides,
  };
}

async function expectDomainError(p: Promise<unknown>, code: DomainErrorCode): Promise<void> {
  const err = await p.then(
    () => expect.fail(`expected DomainError(${code})`),
    (e: unknown) => e,
  );
  expect(isDomainError(err)).toBe(true);
  expect((err as { code: string }).code).toBe(code);
}

/**
 * Behaviour every season repository must have. Runs against the in-memory repo and
 * against the Firestore repo on the emulator. `makeImpl` must return an empty repo.
 */
export function runSeasonRepoContract(
  name: string,
  makeImpl: () => Promise<SeasonRepoHarness>,
): void {
  describe(`season repo contract: ${name}`, () => {
    it('creates a season and get reads it back only for that tenant', async () => {
      const { seasons, count } = await makeImpl();
      const created = await seasons.create(season(10, TENANT_A));

      expect(created).toEqual(season(10, TENANT_A));
      expect(await seasons.get(TENANT_A, created.id)).toEqual(created);
      expect(await seasons.get(TENANT_B, created.id)).toBeNull();
      expect(await count()).toBe(1);
    });

    it('lists only the requested tenant', async () => {
      const { seasons } = await makeImpl();
      const first = await seasons.create(season(10, TENANT_A, { name: 'First' }));
      const second = await seasons.create(season(11, TENANT_A, { name: 'Second' }));
      const other = await seasons.create(season(12, TENANT_B, { name: 'Other' }));

      const listed = await seasons.list(TENANT_A);
      expect(listed).toHaveLength(2);
      expect(listed.map((item) => item.id).sort()).toEqual([first.id, second.id].sort());
      expect(listed.every((item) => item.tenantId === TENANT_A)).toBe(true);
      expect(await seasons.list(TENANT_B)).toEqual([other]);
      expect(await seasons.list(ulid(99) as TenantId)).toEqual([]);
    });

    it('updates mutable fields and keeps id, tenantId, createdBy, createdAt and schemaVersion', async () => {
      const { seasons } = await makeImpl();
      const created = await seasons.create(season(10, TENANT_A));
      const next: CommunitySeason = {
        ...created,
        name: 'Dhul Hijjah',
        kind: 'dhul_hijjah',
        startDate: '2035-06-01',
        lengthDays: 10,
        timezone: 'Africa/Addis_Ababa',
        opensAtLocal: '05:00',
        closesAtLocal: '22:00',
        updatedAt: LATER,
      };

      const updated = await seasons.update(next);

      expect(updated).toEqual(next);
      expect(updated.id).toBe(created.id);
      expect(updated.tenantId).toBe(created.tenantId);
      expect(updated.createdBy).toBe(created.createdBy);
      expect(updated.createdAt).toBe(created.createdAt);
      expect(updated.schemaVersion).toBe(created.schemaVersion);
      expect(await seasons.get(TENANT_A, created.id)).toEqual(updated);
    });

    it('rejects a second create of the same id with CONFLICT and writes nothing', async () => {
      const { seasons, count } = await makeImpl();
      const created = await seasons.create(season(10, TENANT_A));
      await expectDomainError(
        seasons.create(season(10, TENANT_B, { name: 'Taken', createdBy: USER_B })),
        'CONFLICT',
      );
      expect(await count()).toBe(1);
      expect(await seasons.get(TENANT_A, created.id)).toEqual(created);
      expect(await seasons.get(TENANT_B, created.id)).toBeNull();
    });

    it('rejects a non-ULID id, a non-ULID tenantId and a bad schemaVersion with VALIDATION and writes nothing', async () => {
      const { seasons, count } = await makeImpl();
      await expectDomainError(
        seasons.create(season(10, TENANT_A, { id: 'nope' as SeasonId })),
        'VALIDATION',
      );
      await expectDomainError(
        seasons.create(season(10, TENANT_A, { tenantId: 'nope' as TenantId })),
        'VALIDATION',
      );
      await expectDomainError(
        seasons.create(season(10, TENANT_A, { schemaVersion: 2 as 1 })),
        'VALIDATION',
      );
      expect(await count()).toBe(0);
    });

    it('rejects an update that changes createdBy, createdAt or schemaVersion with VALIDATION and writes nothing', async () => {
      const { seasons } = await makeImpl();
      const created = await seasons.create(season(10, TENANT_A));

      await expectDomainError(seasons.update({ ...created, createdBy: USER_B }), 'VALIDATION');
      await expectDomainError(seasons.update({ ...created, createdAt: LATER }), 'VALIDATION');
      await expectDomainError(seasons.update({ ...created, schemaVersion: 2 as 1 }), 'VALIDATION');
      expect(await seasons.get(TENANT_A, created.id)).toEqual(created);
    });

    it('rejects a missing id and a tenant mismatch with NOT_FOUND and writes nothing', async () => {
      const { seasons, count } = await makeImpl();
      const created = await seasons.create(season(10, TENANT_A));

      await expectDomainError(
        seasons.update({ ...created, id: asSeasonId(ulid(80)) }),
        'NOT_FOUND',
      );
      await expectDomainError(
        seasons.update({ ...created, tenantId: asTenantId(ulid(81)) }),
        'NOT_FOUND',
      );
      expect(await count()).toBe(1);
      expect(await seasons.get(TENANT_A, created.id)).toEqual(created);
    });

    it('returns copies, so a caller cannot change the stored season', async () => {
      const { seasons } = await makeImpl();
      const created = await seasons.create(season(10, TENANT_A));
      created.name = 'Changed';
      expect((await seasons.get(TENANT_A, created.id))?.name).toBe('Ramadan 1448');
    });
  });
}
