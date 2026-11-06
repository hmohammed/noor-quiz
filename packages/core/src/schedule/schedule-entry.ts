import type { TenantId } from '../communities/community';
import { DomainError } from '../errors';
import type { QuestionId } from '../questions/question';
import type { SeasonId } from '../season/community-season';
import { ULID_PATTERN, type UserId } from '../users/user';

export const SCHEDULE_SCHEMA_VERSION = 1 as const;

/**
 * Document id for `schedule/{seasonId}_{dayIndex}`. ULID has no `_`, so the last
 * underscore splits season id from day index unambiguously.
 */
export function scheduleEntryId(seasonId: SeasonId, dayIndex: number): string {
  if (typeof seasonId !== 'string' || !ULID_PATTERN.test(seasonId)) {
    throw new DomainError('VALIDATION', { reason: 'invalid-season-id' });
  }
  if (!Number.isInteger(dayIndex) || dayIndex < 1 || dayIndex > 366) {
    throw new DomainError('VALIDATION', { reason: 'invalid-day-index' });
  }
  return `${seasonId}_${dayIndex}`;
}

/**
 * `schedule/{seasonId}_{dayIndex}`. One question per day in a season. Timestamps are
 * UTC ISO strings the caller passes; adapters do not read a clock.
 */
export interface ScheduleEntry {
  id: string;
  tenantId: TenantId;
  seasonId: SeasonId;
  dayIndex: number;
  questionId: QuestionId;
  scheduledBy: UserId;
  scheduledAt: string;
  schemaVersion: typeof SCHEDULE_SCHEMA_VERSION;
}

/** A new object, so a caller cannot change the stored entry through a returned one. */
export function copyScheduleEntry(entry: ScheduleEntry): ScheduleEntry {
  return {
    id: entry.id,
    tenantId: entry.tenantId,
    seasonId: entry.seasonId,
    dayIndex: entry.dayIndex,
    questionId: entry.questionId,
    scheduledBy: entry.scheduledBy,
    scheduledAt: entry.scheduledAt,
    schemaVersion: entry.schemaVersion,
  };
}
