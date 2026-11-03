import { isValidTimeZone, type TimeZone } from '../time/zoned';

/** Locales a member can choose. Mirrored by `SUPPORTED_LOCALES` in `@noor/contracts`. */
export const SUPPORTED_LOCALES = ['en', 'sv', 'ar', 'am', 'so'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

const LOCALE_SET: ReadonlySet<unknown> = new Set(SUPPORTED_LOCALES);

export function isSupportedLocale(s: unknown): s is Locale {
  return LOCALE_SET.has(s);
}

const NAME_MIN = 2;
const NAME_MAX = 32;
/** Space-separated words of Unicode letters, each word starting with a letter. */
const NAME_PATTERN = /^\p{L}[\p{L}\p{M}]*(?: \p{L}[\p{L}\p{M}]*)*$/u;

/**
 * A name a member types: NFC, trim, collapse whitespace runs to one space, then it must
 * be letters and marks in words, 2–32 code points. Returns null instead of stripping
 * emoji, digits, punctuation, controls or ZWJ.
 */
export function normaliseProfileName(s: string): string | null {
  if (typeof s !== 'string') return null;
  const name = s.normalize('NFC').trim().replace(/\s+/gu, ' ');
  const length = Array.from(name).length;
  if (length < NAME_MIN || length > NAME_MAX) return null;
  return NAME_PATTERN.test(name) ? name : null;
}

const TZ_MAX = 64;
/** IANA-style names only, so offsets such as `+01:00` are rejected. */
const TZ_PATTERN = /^[A-Za-z][A-Za-z0-9_+-]*(?:\/[A-Za-z0-9_+-]+){0,2}$/;

/** The runtime's canonical spelling of an IANA zone name, or null when it is not one. */
export function canonicalTimeZone(s: unknown): TimeZone | null {
  if (typeof s !== 'string' || s.length > TZ_MAX || !TZ_PATTERN.test(s)) return null;
  if (!isValidTimeZone(s)) return null;
  return new Intl.DateTimeFormat('en-US', { timeZone: s }).resolvedOptions().timeZone;
}

export function isProfileTimeZone(s: unknown): s is TimeZone {
  return canonicalTimeZone(s) !== null;
}

/** The profile fields a member may change. At least one key must be present. */
export type ProfilePatch = { displayName?: string; locale?: Locale; timezone?: TimeZone };
