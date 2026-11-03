import { describe, expect, it } from 'vitest';
import {
  canonicalTimeZone,
  isProfileTimeZone,
  isSupportedLocale,
  normaliseProfileName,
  SUPPORTED_LOCALES,
} from './profile';

// Same cases as packages/testkit/src/profile-cases.ts (core cannot import testkit).
const GEEZ_32 = 'ሀ'.repeat(32);

describe('normaliseProfileName', () => {
  it.each([
    ['Amharic', 'ሀሰን', 'ሀሰን'],
    ['Arabic', 'حسن', 'حسن'],
    ['Swedish', 'Åsa', 'Åsa'],
    ['Swedish written decomposed', 'A\u030Asa', 'Åsa'],
    ['Arabic with harakat', 'حَسَن', 'حَسَن'],
    ['two words', 'Anna Lena', 'Anna Lena'],
    ['surrounding spaces', '  Åsa  ', 'Åsa'],
    ['inner whitespace runs', 'Anna   Lena', 'Anna Lena'],
    ["exactly 32 Ge'ez code points", GEEZ_32, GEEZ_32],
  ])('accepts %s', (_label, input, expected) => {
    const result = normaliseProfileName(input);
    expect(result).toBe(expected);
    expect(result).toBe(result?.normalize('NFC'));
  });

  it.each([
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
  ])('rejects %s', (_label, input) => {
    expect(normaliseProfileName(input)).toBeNull();
  });

  it('rejects a non-string', () => {
    expect(normaliseProfileName(42 as unknown as string)).toBeNull();
  });
});

describe('canonicalTimeZone / isProfileTimeZone', () => {
  it.each([
    'Europe/Stockholm',
    'Africa/Addis_Ababa',
    'Asia/Riyadh',
    'America/Argentina/Buenos_Aires',
    'Etc/GMT+3',
    'UTC',
  ])('accepts %s', (tz) => {
    expect(isProfileTimeZone(tz)).toBe(true);
    expect(canonicalTimeZone(tz)).toEqual(expect.any(String));
  });

  it('canonicalises europe/stockholm to Europe/Stockholm', () => {
    expect(canonicalTimeZone('europe/stockholm')).toBe('Europe/Stockholm');
  });

  it.each(['', 'Mars/Olympus', '+01:00', 'Europe/Stockholm ', '../etc', 'A'.repeat(65), 42, null])(
    'rejects %j',
    (tz) => {
      expect(isProfileTimeZone(tz)).toBe(false);
      expect(canonicalTimeZone(tz)).toBeNull();
    },
  );
});

describe('isSupportedLocale', () => {
  it.each(SUPPORTED_LOCALES)('accepts %s', (locale) => {
    expect(isSupportedLocale(locale)).toBe(true);
  });

  it.each(['fr', 'EN', 'en-US', '', null])('rejects %j', (locale) => {
    expect(isSupportedLocale(locale)).toBe(false);
  });
});
