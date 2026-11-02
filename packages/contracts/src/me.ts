import { z } from 'zod';

/** Our ULID format (mirrors core's ULID_PATTERN; contracts does not import core). */
export const Ulid = z.string().regex(/^[0-7][0-9A-HJKMNP-TV-Z]{25}$/);

/** 2–32 code points, matching core's `normaliseDisplayName` (zod `.min/.max` count UTF-16 units). */
const DisplayName = z.string().refine((s) => {
  const length = Array.from(s).length;
  return length >= 2 && length <= 32;
});

/** Body of `GET /v1/me`. Strict, so a leaked `uid`, `subject` or `email` fails validation. */
export const MeResponse = z.strictObject({
  userId: Ulid,
  displayName: DisplayName.nullable(),
});
export type MeResponse = z.infer<typeof MeResponse>;
