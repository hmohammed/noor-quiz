import { asTenantId, type TenantId } from '../communities/community';
import { DomainError } from '../errors';
import type { ScheduleRepo } from '../ports/repos';
import { asQuestionId } from '../questions/question';
import {
  copyScheduleEntry,
  SCHEDULE_SCHEMA_VERSION,
  scheduleEntryId,
  type ScheduleEntry,
} from '../schedule/schedule-entry';
import { asSeasonId, type SeasonId } from '../season/community-season';
import { asUserId } from '../users/user';

/**
 * In-memory `ScheduleRepo` for use-case tests. Core cannot import testkit (testkit
 * depends on core). The shared fake that routes use lives in `@noor/testkit`.
 */
export class MemoryScheduleRepo implements ScheduleRepo {
  readonly #items = new Map<string, ScheduleEntry>();

  all(): ScheduleEntry[] {
    return [...this.#items.values()].map((entry) => copyScheduleEntry(entry));
  }

  async get(
    tenantId: TenantId,
    seasonId: SeasonId,
    dayIndex: number,
  ): Promise<ScheduleEntry | null> {
    const tid = asTenantId(tenantId);
    const sid = asSeasonId(seasonId);
    const entry = this.#items.get(scheduleEntryId(sid, dayIndex));
    if (!entry || entry.tenantId !== tid) return null;
    return copyScheduleEntry(entry);
  }

  async listBySeason(tenantId: TenantId, seasonId: SeasonId): Promise<ScheduleEntry[]> {
    const tid = asTenantId(tenantId);
    const sid = asSeasonId(seasonId);
    const found: ScheduleEntry[] = [];
    for (const entry of this.#items.values()) {
      if (entry.tenantId === tid && entry.seasonId === sid) {
        found.push(copyScheduleEntry(entry));
      }
    }
    return found;
  }

  async put(entry: ScheduleEntry): Promise<ScheduleEntry> {
    if (entry.schemaVersion !== SCHEDULE_SCHEMA_VERSION) {
      throw new DomainError('VALIDATION', { reason: 'invalid-schema-version' });
    }
    const expectedId = scheduleEntryId(asSeasonId(entry.seasonId), entry.dayIndex);
    if (entry.id !== expectedId) {
      throw new DomainError('VALIDATION', { reason: 'invalid-schedule-id' });
    }
    const stored = copyScheduleEntry({
      ...entry,
      id: expectedId,
      tenantId: asTenantId(entry.tenantId),
      seasonId: asSeasonId(entry.seasonId),
      questionId: asQuestionId(entry.questionId),
      scheduledBy: asUserId(entry.scheduledBy),
    });
    this.#items.set(stored.id, stored);
    return copyScheduleEntry(stored);
  }
}
