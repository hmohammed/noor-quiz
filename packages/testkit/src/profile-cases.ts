/**
 * The shared accept/reject table for profile fields. Core and contracts each implement
 * the rules (contracts does not import core); the API parity test runs this table
 * through both so they cannot drift.
 */

const GEEZ_32 = 'ሀ'.repeat(32);

/** `[label, input, normalised]`: accepted names and the value they normalise to. */
export const VALID_PROFILE_NAMES: ReadonlyArray<readonly [string, string, string]> = [
  ['Amharic', 'ሀሰን', 'ሀሰን'],
  ['Arabic', 'حسن', 'حسن'],
  ['Swedish', 'Åsa', 'Åsa'],
  ['Swedish written decomposed', 'A\u030Asa', 'Åsa'],
  ['Arabic with harakat', 'حَسَن', 'حَسَن'],
  ['two words', 'Anna Lena', 'Anna Lena'],
  ['surrounding spaces', '  Åsa  ', 'Åsa'],
  ['inner whitespace runs', 'Anna   Lena', 'Anna Lena'],
  ["exactly 32 Ge'ez code points", GEEZ_32, GEEZ_32],
];

/** `[label, input]`: names that must be rejected. */
export const INVALID_PROFILE_NAMES: ReadonlyArray<readonly [string, string]> = [
  ['empty', ''],
  ['spaces only', '   '],
  ['one letter', 'A'],
  ['one emoji', '😀'],
  ['emoji only', '😀😀😀'],
  ['a name with an emoji', 'Åsa 😀'],
  ['33 code points', 'ሀ'.repeat(33)],
  ['a digit', 'Åsa1'],
  ['markup', '<b>'],
  ['a NUL control', 'a\u0000b'],
  ['a leading ZWJ', '\u200Dab'],
  ['marks only', '\u0301\u0301'],
];

/** Accepted IANA zones. Their canonical form is whatever the runtime's `Intl` reports. */
export const VALID_TIMEZONES: readonly string[] = [
  'Europe/Stockholm',
  'Africa/Addis_Ababa',
  'Asia/Riyadh',
  'America/Argentina/Buenos_Aires',
  'Etc/GMT+3',
  'UTC',
  'europe/stockholm',
];

/** `[input, canonical]`: zones whose canonical form is pinned. */
export const CANONICAL_TIMEZONES: ReadonlyArray<readonly [string, string]> = [
  ['europe/stockholm', 'Europe/Stockholm'],
  ['Europe/Stockholm', 'Europe/Stockholm'],
  ['Africa/Addis_Ababa', 'Africa/Addis_Ababa'],
];

/** Zones that must be rejected. */
export const INVALID_TIMEZONES: readonly unknown[] = [
  '',
  'Mars/Olympus',
  '+01:00',
  'Europe/Stockholm ',
  '../etc',
  'A'.repeat(65),
  42,
];

export const VALID_LOCALES = ['en', 'sv', 'ar', 'am', 'so'] as const;

export const INVALID_LOCALES: readonly unknown[] = ['fr', 'EN', 'en-US', '', null];
