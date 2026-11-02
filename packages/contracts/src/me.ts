import { z } from 'zod';

/** Our ULID format (mirrors core's ULID_PATTERN; contracts does not import core). */
export const Ulid = z.string().regex(/^[0-7][0-9A-HJKMNP-TV-Z]{25}$/);

/** 2–32 code points, matching core's `normaliseDisplayName` (zod `.min/.max` count UTF-16 units). */
const DisplayName = z.string().refine((s) => {
  const length = Array.from(s).length;
  return length >= 2 && length <= 32;
});

/** Locales a member can choose (mirrors core's `SUPPORTED_LOCALES`). */
export const SUPPORTED_LOCALES = ['en', 'sv', 'ar', 'am', 'so'] as const;
export const Locale = z.enum(SUPPORTED_LOCALES);
export type Locale = z.infer<typeof Locale>;

const TZ_MAX = 64;
const TZ_PATTERN = /^[A-Za-z][A-Za-z0-9_+-]*(?:\/[A-Za-z0-9_+-]+){0,2}$/;

function resolveTimeZone(tz: string): string | null {
  if (tz.length > TZ_MAX || !TZ_PATTERN.test(tz)) return null;
  try {
    return new Intl.DateTimeFormat('en-US', { timeZone: tz }).resolvedOptions().timeZone;
  } catch {
    return null;
  }
}

/**
 * An IANA zone name the runtime knows, returned in canonical casing. Rejects offsets
 * such as `+01:00` (mirrors core's `canonicalTimeZone`).
 */
export const TimeZoneName = z
  .string()
  .max(TZ_MAX)
  .refine((tz) => resolveTimeZone(tz) !== null)
  .transform((tz) => resolveTimeZone(tz) as string);

const NAME_MIN = 2;
const NAME_MAX = 32;
const NAME_PATTERN = /^\p{L}[\p{L}\p{M}]*(?: \p{L}[\p{L}\p{M}]*)*$/u;

/**
 * A name a member types: NFC, trimmed, inner whitespace collapsed, then Unicode letters
 * and marks in space-separated words, 2–32 code points. Emoji, digits, punctuation,
 * controls and ZWJ are rejected, never stripped (mirrors core's `normaliseProfileName`).
 */
export const ProfileDisplayName = z
  .string()
  .transform((s) => s.normalize('NFC').trim().replace(/\s+/gu, ' '))
  .pipe(
    z.string().refine((s) => {
      const length = Array.from(s).length;
      return length >= NAME_MIN && length <= NAME_MAX && NAME_PATTERN.test(s);
    }),
  );

/** Body of `PATCH /v1/me`. Strict: `userId`, `role`, `tenantId` etc. are rejected, not ignored. */
export const UpdateMeRequest = z
  .strictObject({
    displayName: ProfileDisplayName.optional(),
    locale: Locale.optional(),
    timezone: TimeZoneName.optional(),
  })
  .refine((b) => Object.keys(b).length > 0, 'empty patch');
/** The parsed (normalised) patch. */
export type UpdateMeRequest = z.infer<typeof UpdateMeRequest>;
/** What a client sends. */
export type UpdateMeRequestInput = z.input<typeof UpdateMeRequest>;

/** Body of `GET /v1/me` and `PATCH /v1/me`. Strict, so a leaked `uid`, `subject` or `email` fails validation. */
export const MeResponse = z.strictObject({
  userId: Ulid,
  // Lax on purpose: names stored from Google tokens (T010) may hold emoji.
  displayName: DisplayName.nullable(),
  locale: Locale.nullable(),
  timezone: z
    .string()
    .max(TZ_MAX)
    .refine((tz) => resolveTimeZone(tz) !== null)
    .nullable(),
});
export type MeResponse = z.infer<typeof MeResponse>;
