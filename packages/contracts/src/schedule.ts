import { z } from 'zod';
import { Ulid } from './me';

/** UTC ISO-8601 timestamp ending in `Z`, as `toIso` writes it. */
const UtcIso = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/);

/**
 * Body of `PUT /v1/t/:tenantId/seasons/:seasonId/schedule/:dayIndex`. Strict: only the
 * question id. Day index comes from the path.
 */
export const ScheduleQuestionRequest = z.strictObject({
  questionId: Ulid,
});
export type ScheduleQuestionRequest = z.infer<typeof ScheduleQuestionRequest>;
export type ScheduleQuestionRequestInput = z.input<typeof ScheduleQuestionRequest>;

/**
 * One day → question mapping. `id` is `{seasonId}_{dayIndex}`. Strict so
 * `schemaVersion` never leaves the server.
 */
export const ScheduleEntry = z.strictObject({
  id: z.string().min(1),
  tenantId: Ulid,
  seasonId: Ulid,
  questionId: Ulid,
  dayIndex: z.number().int().min(1).max(366),
  scheduledBy: Ulid,
  scheduledAt: UtcIso,
});
export type ScheduleEntry = z.infer<typeof ScheduleEntry>;
