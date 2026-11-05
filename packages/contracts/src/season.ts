import { z } from 'zod';
import { CommunityName } from './community';
import { TimeZoneName, Ulid } from './me';

/**
 * Kind is a label. It does not set `lengthDays`. Keep this list in the same order as
 * core's `SEASON_KINDS` (contracts does not import core).
 */
export const SEASON_KINDS = ['ramadan', 'dhul_hijjah', 'muharram', 'weekly', 'custom'] as const;
export const SeasonKind = z.enum(SEASON_KINDS);
export type SeasonKind = z.infer<typeof SeasonKind>;

const LOCAL_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const LOCAL_TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** Strict real `YYYY-MM-DD`: ASCII digits, and the UTC calendar does not roll the day over. */
function isRealLocalDate(value: string): boolean {
  const match = LOCAL_DATE.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const utc = new Date(Date.UTC(year, month - 1, day));
  return (
    utc.getUTCFullYear() === year && utc.getUTCMonth() === month - 1 && utc.getUTCDate() === day
  );
}

/** ASCII `YYYY-MM-DD` that names a real Gregorian date. Rejects `2026-02-30` and `2026-2-18`. */
export const LocalDateString = z.string().regex(LOCAL_DATE).refine(isRealLocalDate);
export type LocalDateString = z.infer<typeof LocalDateString>;

/** ASCII `HH:mm` from `00:00` through `23:59`. */
export const LocalTimeString = z.string().regex(LOCAL_TIME);
export type LocalTimeString = z.infer<typeof LocalTimeString>;

/** Integer length in days, 1..366. */
export const LengthDays = z.number().int().min(1).max(366);
export type LengthDays = z.infer<typeof LengthDays>;

/** UTC ISO-8601 timestamp ending in `Z`, as `toIso` writes it. */
const UtcIso = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/);

/**
 * Body of `POST /v1/t/:tenantId/seasons`. Strict: `tenantId`, `role`, `hijriYear`,
 * `state` and `createdBy` are rejected. `00:00` / `00:00` is a valid window.
 */
export const CreateSeasonRequest = z.strictObject({
  name: CommunityName,
  kind: SeasonKind,
  startDate: LocalDateString,
  lengthDays: LengthDays,
  timezone: TimeZoneName,
  opensAtLocal: LocalTimeString,
  closesAtLocal: LocalTimeString,
});
export type CreateSeasonRequest = z.infer<typeof CreateSeasonRequest>;
export type CreateSeasonRequestInput = z.input<typeof CreateSeasonRequest>;

/** Body of `PATCH /v1/t/:tenantId/seasons/:seasonId`. At least one field, no extras. */
export const UpdateSeasonRequest = z
  .strictObject({
    name: CommunityName.optional(),
    kind: SeasonKind.optional(),
    startDate: LocalDateString.optional(),
    lengthDays: LengthDays.optional(),
    timezone: TimeZoneName.optional(),
    opensAtLocal: LocalTimeString.optional(),
    closesAtLocal: LocalTimeString.optional(),
  })
  .refine((body) => Object.keys(body).length > 0, 'empty patch');
export type UpdateSeasonRequest = z.infer<typeof UpdateSeasonRequest>;
export type UpdateSeasonRequestInput = z.input<typeof UpdateSeasonRequest>;

/** Query of `GET /v1/t/:tenantId/seasons/ramadan-suggestion`. */
export const SuggestRamadanQuery = z.strictObject({
  timezone: TimeZoneName,
});
export type SuggestRamadanQuery = z.infer<typeof SuggestRamadanQuery>;

/** Computed on read. Not stored. */
export const SeasonStateView = z.discriminatedUnion('phase', [
  z.strictObject({ phase: z.literal('upcoming') }),
  z.strictObject({
    phase: z.literal('active'),
    dayIndex: z.number().int().min(1).max(366),
    open: z.boolean(),
  }),
  z.strictObject({ phase: z.literal('ended') }),
]);
export type SeasonStateView = z.infer<typeof SeasonStateView>;

/**
 * One season as a member sees it. Strict, so `createdBy` and `schemaVersion` fail
 * validation and never leave the server.
 */
export const SeasonView = z.strictObject({
  id: Ulid,
  tenantId: Ulid,
  name: CommunityName,
  kind: SeasonKind,
  startDate: LocalDateString,
  lengthDays: LengthDays,
  timezone: TimeZoneName,
  opensAtLocal: LocalTimeString,
  closesAtLocal: LocalTimeString,
  state: SeasonStateView,
  createdAt: UtcIso,
  updatedAt: UtcIso,
});
export type SeasonView = z.infer<typeof SeasonView>;

/** Body of `GET /v1/t/:tenantId/seasons`. */
export const SeasonListResponse = z.strictObject({
  seasons: z.array(SeasonView),
});
export type SeasonListResponse = z.infer<typeof SeasonListResponse>;

/** Body of the Ramadan suggestion. `advisory` is always true: the admin confirms the dates. */
export const RamadanSuggestionResponse = z.strictObject({
  hijriYear: z.number().int(),
  startDate: LocalDateString,
  lengthDays: z.union([z.literal(29), z.literal(30)]),
  advisory: z.literal(true),
});
export type RamadanSuggestionResponse = z.infer<typeof RamadanSuggestionResponse>;
