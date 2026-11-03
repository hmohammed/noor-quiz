import { z } from 'zod';
import { TimeZoneName, Ulid } from './me';

/** Lowest to highest. Mirrors core's `ROLES` (contracts does not import core). */
export const COMMUNITY_ROLES = ['member', 'scholar-reviewer', 'editor', 'admin', 'owner'] as const;
export const CommunityRole = z.enum(COMMUNITY_ROLES);
export type CommunityRole = z.infer<typeof CommunityRole>;

const NAME_MIN = 2;
const NAME_MAX = 48;
const STARTS_WITH_LETTER = /^\p{L}/u;
const NAME_BODY = /^[\p{L}\p{M}\p{N} '\u2019-]+$/u;
const ENDS_WITH_EDGE = /[-'\u2019]$/u;

/**
 * A community name: NFC, trimmed, inner whitespace collapsed, then Unicode letters,
 * marks, numbers, spaces, hyphens and apostrophes, 2–48 code points, starting with a
 * letter and not ending in a hyphen or apostrophe. Emoji and markup are rejected,
 * never stripped (mirrors core's `normaliseCommunityName`).
 */
export const CommunityName = z
  .string()
  .transform((s) => s.normalize('NFC').trim().replace(/\s+/gu, ' '))
  .pipe(
    z.string().refine((s) => {
      const length = Array.from(s).length;
      return (
        length >= NAME_MIN &&
        length <= NAME_MAX &&
        STARTS_WITH_LETTER.test(s) &&
        NAME_BODY.test(s) &&
        !ENDS_WITH_EDGE.test(s)
      );
    }),
  );

const SUMMARY_NAME_MAX = 48;
const SummaryName = z.string().refine((s) => {
  const length = Array.from(s).length;
  return length >= 1 && length <= SUMMARY_NAME_MAX;
});

/** Safe as a Firestore document id: lowercase, hyphen-separated, at most 60 characters. */
const Slug = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .max(60);

/** UTC ISO-8601 timestamp ending in `Z`, as `toIso` writes it. */
const UtcIso = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/);

/** Body of `POST /v1/communities`. Strict: `role`, `tenantId`, `slug` and `createdBy` are rejected. */
export const CreateCommunityRequest = z.strictObject({
  name: CommunityName,
  timezone: TimeZoneName,
});
/** The parsed (normalised) request. */
export type CreateCommunityRequest = z.infer<typeof CreateCommunityRequest>;
/** What a client sends. */
export type CreateCommunityRequestInput = z.input<typeof CreateCommunityRequest>;

/**
 * One community as a member sees it. Strict, so `createdBy`, `updatedAt`, `schemaVersion`,
 * an email or a Firebase uid fails validation.
 */
export const CommunitySummary = z.strictObject({
  tenantId: Ulid,
  name: SummaryName,
  slug: Slug,
  timezone: TimeZoneName,
  role: CommunityRole,
  createdAt: UtcIso,
});
export type CommunitySummary = z.infer<typeof CommunitySummary>;

/** Body of `POST /v1/communities` (201). */
export const CommunityResponse = CommunitySummary;
export type CommunityResponse = CommunitySummary;

/** Body of `GET /v1/me/communities`. */
export const MyCommunitiesResponse = z.strictObject({
  communities: z.array(CommunitySummary),
});
export type MyCommunitiesResponse = z.infer<typeof MyCommunitiesResponse>;
