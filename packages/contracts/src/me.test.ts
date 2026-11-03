import { describe, expect, it } from 'vitest';
import { AcceptConsentRequest, MeResponse, SUPPORTED_LOCALES, UpdateMeRequest } from './me';

const ULID = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
const GEEZ_32 = 'ሀ'.repeat(32);
const EMOJI_32 = '😀'.repeat(32);

// Copy of packages/testkit/src/profile-cases.ts (contracts cannot depend on testkit).
// apps/api/src/profile-parity.test.ts runs the testkit table through both packages.
const VALID_NAMES: Array<[string, string, string]> = [
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
const INVALID_NAMES: Array<[string, string]> = [
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
const VALID_TIMEZONES = [
  'Europe/Stockholm',
  'Africa/Addis_Ababa',
  'Asia/Riyadh',
  'America/Argentina/Buenos_Aires',
  'Etc/GMT+3',
  'UTC',
  'europe/stockholm',
];
const INVALID_TIMEZONES: unknown[] = [
  '',
  'Mars/Olympus',
  '+01:00',
  'Europe/Stockholm ',
  '../etc',
  'A'.repeat(65),
  42,
];
const INVALID_LOCALES: unknown[] = ['fr', 'EN', 'en-US', '', null];

const CONSENT = { currentVersion: '2026-11-01', acceptedVersion: null, required: true };

const me = (overrides: Record<string, unknown> = {}) => ({
  userId: ULID,
  displayName: null,
  locale: null,
  timezone: null,
  consent: CONSENT,
  ...overrides,
});

describe('MeResponse', () => {
  it.each([
    ['null', null],
    ['Latin with a diacritic', 'Åsa'],
    ['Arabic', 'حسن'],
    ["Ge'ez", 'ሀሰን'],
    ["32 Ge'ez code points", GEEZ_32],
    ['32 emoji (64 UTF-16 units)', EMOJI_32],
  ])('accepts a ULID with displayName %s', (_label, displayName) => {
    expect(MeResponse.parse(me({ displayName }))).toEqual(me({ displayName }));
  });

  it('counts 32 emoji as 64 UTF-16 units, so the cap is in code points', () => {
    expect(EMOJI_32.length).toBe(64);
  });

  it.each(SUPPORTED_LOCALES)('accepts locale %s', (locale) => {
    expect(MeResponse.parse(me({ locale })).locale).toBe(locale);
  });

  it('accepts a valid timezone', () => {
    expect(MeResponse.parse(me({ timezone: 'Europe/Stockholm' })).timezone).toBe(
      'Europe/Stockholm',
    );
  });

  it.each([
    ['a non-ULID userId', me({ userId: 'uid-alice' })],
    ['a lowercase ULID', me({ userId: ULID.toLowerCase() })],
    ['a 1-code-point name', me({ displayName: 'A' })],
    ['a 1-emoji name', me({ displayName: '😀' })],
    ['a 33-code-point name', me({ displayName: 'ሀ'.repeat(33) })],
    ['a missing displayName', { userId: ULID, locale: null, timezone: null, consent: CONSENT }],
    ['a missing locale', { userId: ULID, displayName: null, timezone: null, consent: CONSENT }],
    ['a missing timezone', { userId: ULID, displayName: null, locale: null, consent: CONSENT }],
    ['a missing consent', { userId: ULID, displayName: null, locale: null, timezone: null }],
    ['an acceptedAt inside consent', me({ consent: { ...CONSENT, acceptedAt: '2026-01-01' } })],
    ['a non-boolean required', me({ consent: { ...CONSENT, required: 'yes' } })],
    [
      'a missing acceptedVersion',
      me({ consent: { currentVersion: '2026-11-01', required: true } }),
    ],
    ['an unsupported locale', me({ locale: 'fr' })],
    ['an unknown timezone', me({ timezone: 'Mars/Olympus' })],
  ])('rejects %s', (_label, body) => {
    expect(MeResponse.safeParse(body).success).toBe(false);
  });

  it.each([
    ['null', null],
    ['the current version', '2026-11-01'],
  ])('accepts acceptedVersion %s', (_label, acceptedVersion) => {
    const body = me({
      consent: { currentVersion: '2026-11-01', acceptedVersion, required: false },
    });
    expect(MeResponse.parse(body)).toEqual(body);
  });

  it.each([
    ['uid', me({ uid: 'x' })],
    ['subject', me({ subject: 'x' })],
    ['email', me({ email: 'a@example.com' })],
  ])('throws on an extra %s key (strict)', (_label, body) => {
    expect(() => MeResponse.parse(body)).toThrow();
  });
});

describe('AcceptConsentRequest', () => {
  it.each([
    ['a 1-char version', 'a'],
    ['a 32-char version', 'v'.repeat(32)],
  ])('accepts %s', (_label, version) => {
    expect(AcceptConsentRequest.parse({ version })).toEqual({ version });
  });

  it.each([
    ['an empty version', { version: '' }],
    ['a 33-char version', { version: 'v'.repeat(33) }],
    ['a number', { version: 42 }],
    ['a missing version', {}],
    ['an acceptedAt key', { version: 'a', acceptedAt: '2020-01-01T00:00:00.000Z' }],
    ['a userId key', { version: 'a', userId: ULID }],
  ])('rejects %s', (_label, body) => {
    expect(AcceptConsentRequest.safeParse(body).success).toBe(false);
  });
});

describe('UpdateMeRequest', () => {
  it.each(VALID_NAMES)('accepts displayName (%s) and normalises it', (_l, input, normalised) => {
    const parsed = UpdateMeRequest.parse({ displayName: input });
    expect(parsed).toEqual({ displayName: normalised });
    expect(parsed.displayName).toBe(parsed.displayName?.normalize('NFC'));
  });

  it.each(INVALID_NAMES)('rejects displayName (%s)', (_l, input) => {
    expect(UpdateMeRequest.safeParse({ displayName: input }).success).toBe(false);
  });

  it.each(VALID_TIMEZONES)('accepts timezone %j', (timezone) => {
    expect(UpdateMeRequest.safeParse({ timezone }).success).toBe(true);
  });

  it('canonicalises the timezone casing', () => {
    expect(UpdateMeRequest.parse({ timezone: 'europe/stockholm' })).toEqual({
      timezone: 'Europe/Stockholm',
    });
  });

  it.each(INVALID_TIMEZONES)('rejects timezone %j', (timezone) => {
    expect(UpdateMeRequest.safeParse({ timezone }).success).toBe(false);
  });

  it.each(SUPPORTED_LOCALES)('accepts locale %s', (locale) => {
    expect(UpdateMeRequest.parse({ locale })).toEqual({ locale });
  });

  it.each(INVALID_LOCALES)('rejects locale %j', (locale) => {
    expect(UpdateMeRequest.safeParse({ locale }).success).toBe(false);
  });

  it('accepts all three fields together', () => {
    expect(
      UpdateMeRequest.parse({ displayName: 'Åsa', locale: 'sv', timezone: 'Europe/Stockholm' }),
    ).toEqual({ displayName: 'Åsa', locale: 'sv', timezone: 'Europe/Stockholm' });
  });

  it.each([
    ['an empty patch', {}],
    ['an unknown key', { userId: ULID }],
    ['a role next to a valid name', { displayName: 'Åsa', role: 'admin' }],
    ['displayName null', { displayName: null }],
    ['an array', ['Åsa']],
    ['a string', 'Åsa'],
  ])('rejects %s', (_label, body) => {
    expect(UpdateMeRequest.safeParse(body).success).toBe(false);
  });
});
