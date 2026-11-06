import {
  asQuestionId,
  asSeasonId,
  asTenantId,
  asUserId,
  copyScheduleEntry,
  DomainError,
  SCHEDULE_SCHEMA_VERSION,
  scheduleEntryId,
  type ScheduleEntry,
  type ScheduleRepo,
  type SeasonId,
  type TenantId,
} from '@noor/core';

function storedEntry(entry: ScheduleEntry): ScheduleEntry {
  return copyScheduleEntry({
    ...entry,
    id: scheduleEntryId(asSeasonId(entry.seasonId), entry.dayIndex),
    tenantId: asTenantId(entry.tenantId),
    seasonId: asSeasonId(entry.seasonId),
    questionId: asQuestionId(entry.questionId),
    scheduledBy: asUserId(entry.scheduledBy),
  });
}

function assertSchemaVersion(entry: ScheduleEntry): void {
  if (entry.schemaVersion !== SCHEDULE_SCHEMA_VERSION) {
    throw new DomainError('VALIDATION', { reason: 'invalid-schema-version' });
  }
}

/**
 * In-memory `schedule`. `put` upserts by id. Returns copies, never stored objects.
 */
export class InMemoryScheduleRepo implements ScheduleRepo {
  readonly #byId = new Map<string, ScheduleEntry>();

  /** Test-only. Not part of `ScheduleRepo`. */
  count(): number {
    return this.#byId.size;
  }

  async get(
    tenantId: TenantId,
    seasonId: SeasonId,
    dayIndex: number,
  ): Promise<ScheduleEntry | null> {
    const tid = asTenantId(tenantId);
    const sid = asSeasonId(seasonId);
    const entry = this.#byId.get(scheduleEntryId(sid, dayIndex));
    if (!entry || entry.tenantId !== tid) return null;
    return copyScheduleEntry(entry);
  }

  async listBySeason(tenantId: TenantId, seasonId: SeasonId): Promise<ScheduleEntry[]> {
    const tid = asTenantId(tenantId);
    const sid = asSeasonId(seasonId);
    const found: ScheduleEntry[] = [];
    for (const entry of this.#byId.values()) {
      if (entry.tenantId === tid && entry.seasonId === sid) {
        found.push(copyScheduleEntry(entry));
      }
    }
    return found;
  }

  async put(entry: ScheduleEntry): Promise<ScheduleEntry> {
    assertSchemaVersion(entry);
    const expectedId = scheduleEntryId(asSeasonId(entry.seasonId), entry.dayIndex);
    if (entry.id !== expectedId) {
      throw new DomainError('VALIDATION', { reason: 'invalid-schedule-id' });
    }
    const stored = storedEntry(entry);
    this.#byId.set(stored.id, stored);
    return copyScheduleEntry(stored);
  }
}
