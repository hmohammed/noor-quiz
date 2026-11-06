import { asTenantId } from '../communities/community';
import { DomainError } from '../errors';
import type { Clock } from '../ports/clock';
import type { QuestionRepo, ScheduleRepo, SeasonRepo } from '../ports/repos';
import { asQuestionId } from '../questions/question';
import {
  copyScheduleEntry,
  SCHEDULE_SCHEMA_VERSION,
  scheduleEntryId,
  type ScheduleEntry,
} from '../schedule/schedule-entry';
import { asSeasonId } from '../season/community-season';
import { toIso } from '../time/instant';
import { asUserId } from '../users/user';

/**
 * Maps an approved question onto one season day. Replacing the same day overwrites.
 * The same question on another day of that season is CONFLICT. Non-approved questions
 * are CONFLICT. Day index must be an integer in `1..season.lengthDays`.
 */
export async function scheduleQuestion(
  deps: {
    clock: Clock;
    seasons: SeasonRepo;
    questions: QuestionRepo;
    schedules: ScheduleRepo;
  },
  input: {
    tenantId: string;
    seasonId: string;
    dayIndex: number;
    questionId: string;
    userId: string;
  },
): Promise<ScheduleEntry> {
  const tenantId = asTenantId(input.tenantId);
  const seasonId = asSeasonId(input.seasonId);
  const questionId = asQuestionId(input.questionId);
  const scheduledBy = asUserId(input.userId);

  if (!Number.isInteger(input.dayIndex)) {
    throw new DomainError('VALIDATION', { reason: 'invalid-day-index' });
  }

  const season = await deps.seasons.get(tenantId, seasonId);
  if (!season) throw new DomainError('NOT_FOUND', { reason: 'season-not-found' });

  if (input.dayIndex < 1 || input.dayIndex > season.lengthDays) {
    throw new DomainError('VALIDATION', { reason: 'invalid-day-index' });
  }

  const question = await deps.questions.get(tenantId, questionId);
  if (!question) throw new DomainError('NOT_FOUND', { reason: 'question-not-found' });
  if (question.reviewStatus !== 'approved') {
    throw new DomainError('CONFLICT', { reason: 'question-not-approved' });
  }

  const existing = await deps.schedules.listBySeason(tenantId, seasonId);
  const elsewhere = existing.find(
    (entry) => entry.questionId === questionId && entry.dayIndex !== input.dayIndex,
  );
  if (elsewhere) {
    throw new DomainError('CONFLICT', { reason: 'question-already-scheduled' });
  }

  const at = toIso(deps.clock.now());
  const entry: ScheduleEntry = {
    id: scheduleEntryId(seasonId, input.dayIndex),
    tenantId,
    seasonId,
    dayIndex: input.dayIndex,
    questionId,
    scheduledBy,
    scheduledAt: at,
    schemaVersion: SCHEDULE_SCHEMA_VERSION,
  };
  return copyScheduleEntry(await deps.schedules.put(entry));
}
