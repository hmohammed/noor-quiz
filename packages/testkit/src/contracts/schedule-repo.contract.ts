import { describe, expect, it } from 'vitest';
import {
  asSeasonId,
  isDomainError,
  SCHEDULE_SCHEMA_VERSION,
  scheduleEntryId,
  type DomainErrorCode,
  type QuestionId,
  type ScheduleEntry,
  type ScheduleRepo,
  type SeasonId,
  type TenantId,
  type UserId,
} from '@noor/core';

export interface ScheduleRepoHarness {
  schedules: ScheduleRepo;
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
const SEASON_A = ulid(10) as SeasonId;
const SEASON_B = ulid(11) as SeasonId;
const QUESTION_A = ulid(20) as QuestionId;
const QUESTION_B = ulid(21) as QuestionId;
const USER_A = ulid(3) as UserId;

function entry(
  seasonId: SeasonId,
  dayIndex: number,
  tenantId: TenantId,
  overrides: Partial<ScheduleEntry> = {},
): ScheduleEntry {
  const id =
    dayIndex >= 1 && dayIndex <= 366
      ? scheduleEntryId(seasonId, dayIndex)
      : `${seasonId}_${dayIndex}`;
  return {
    id,
    tenantId,
    seasonId,
    dayIndex,
    questionId: QUESTION_A,
    scheduledBy: USER_A,
    scheduledAt: AT,
    schemaVersion: SCHEDULE_SCHEMA_VERSION,
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
 * Behaviour every schedule repository must have. Runs against the in-memory repo and
 * against the Firestore repo on the emulator. `makeImpl` must return an empty repo.
 */
export function runScheduleRepoContract(makeImpl: () => Promise<ScheduleRepoHarness>): void {
  describe('schedule repo contract', () => {
    it('puts an entry and get reads it back only for that tenant', async () => {
      const { schedules, count } = await makeImpl();
      const created = await schedules.put(entry(SEASON_A, 3, TENANT_A));

      expect(created).toEqual(entry(SEASON_A, 3, TENANT_A));
      expect(await schedules.get(TENANT_A, SEASON_A, 3)).toEqual(created);
      expect(await schedules.get(TENANT_B, SEASON_A, 3)).toBeNull();
      expect(await count()).toBe(1);
    });

    it('lists only the requested tenant and season', async () => {
      const { schedules } = await makeImpl();
      // Document ids are seasonId_dayIndex (globally unique season ULIDs), so each
      // tenant uses its own season ids — never the same seasonId under two tenants.
      const first = await schedules.put(entry(SEASON_A, 1, TENANT_A, { questionId: QUESTION_A }));
      const second = await schedules.put(entry(SEASON_A, 2, TENANT_A, { questionId: QUESTION_B }));
      await schedules.put(entry(SEASON_B, 1, TENANT_A, { questionId: QUESTION_A }));
      const otherSeason = asSeasonId(ulid(12));
      await schedules.put(entry(otherSeason, 1, TENANT_B, { questionId: QUESTION_B }));

      const listed = await schedules.listBySeason(TENANT_A, SEASON_A);
      expect(listed).toHaveLength(2);
      expect(listed.map((item) => item.id).sort()).toEqual([first.id, second.id].sort());
      expect(listed.every((item) => item.tenantId === TENANT_A && item.seasonId === SEASON_A)).toBe(
        true,
      );
      expect(await schedules.listBySeason(TENANT_A, SEASON_B)).toHaveLength(1);
      expect(await schedules.listBySeason(TENANT_B, otherSeason)).toHaveLength(1);
      expect(await schedules.listBySeason(TENANT_B, SEASON_A)).toEqual([]);
      expect(await schedules.listBySeason(TENANT_A, asSeasonId(ulid(99)))).toEqual([]);
    });

    it('overwrites the same season day on a second put', async () => {
      const { schedules, count } = await makeImpl();
      await schedules.put(entry(SEASON_A, 3, TENANT_A, { questionId: QUESTION_A }));
      const next = await schedules.put(
        entry(SEASON_A, 3, TENANT_A, { questionId: QUESTION_B, scheduledAt: LATER }),
      );
      expect(next.questionId).toBe(QUESTION_B);
      expect(next.scheduledAt).toBe(LATER);
      expect(await schedules.get(TENANT_A, SEASON_A, 3)).toEqual(next);
      expect(await count()).toBe(1);
    });

    it('rejects a bad schemaVersion, mismatched id, or invalid dayIndex with VALIDATION', async () => {
      const { schedules, count } = await makeImpl();
      await expectDomainError(
        schedules.put(entry(SEASON_A, 3, TENANT_A, { schemaVersion: 2 as 1 })),
        'VALIDATION',
      );
      await expectDomainError(
        schedules.put(entry(SEASON_A, 3, TENANT_A, { id: 'wrong-id' })),
        'VALIDATION',
      );
      await expectDomainError(schedules.put(entry(SEASON_A, 0, TENANT_A)), 'VALIDATION');
      expect(await count()).toBe(0);
    });

    it('returns copies, so a caller cannot change the stored entry', async () => {
      const { schedules } = await makeImpl();
      const created = await schedules.put(entry(SEASON_A, 3, TENANT_A));
      created.questionId = QUESTION_B;
      expect((await schedules.get(TENANT_A, SEASON_A, 3))?.questionId).toBe(QUESTION_A);
    });
  });
}
