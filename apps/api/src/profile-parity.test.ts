import { describe, expect, it } from 'vitest';
import {
  canonicalTimeZone,
  isSupportedLocale,
  normaliseProfileName,
  SUPPORTED_LOCALES as CORE_LOCALES,
} from '@noor/core';
import { SUPPORTED_LOCALES as CONTRACT_LOCALES, UpdateMeRequest } from '@noor/contracts';
import {
  CANONICAL_TIMEZONES,
  INVALID_LOCALES,
  INVALID_PROFILE_NAMES,
  INVALID_TIMEZONES,
  VALID_LOCALES,
  VALID_PROFILE_NAMES,
  VALID_TIMEZONES,
} from '@noor/testkit';

// Core and contracts each implement the profile rules (contracts does not import core).
// One shared table through both keeps them from drifting.
describe('profile rules: core and contracts agree', () => {
  it('have the same supported locales', () => {
    expect([...CORE_LOCALES]).toEqual([...CONTRACT_LOCALES]);
    expect([...CORE_LOCALES]).toEqual([...VALID_LOCALES]);
  });

  it.each(VALID_PROFILE_NAMES)('accept name (%s) with the same output', (_l, input, normalised) => {
    expect(normaliseProfileName(input)).toBe(normalised);
    expect(UpdateMeRequest.parse({ displayName: input }).displayName).toBe(normalised);
  });

  it.each(INVALID_PROFILE_NAMES)('reject name (%s)', (_l, input) => {
    expect(normaliseProfileName(input)).toBeNull();
    expect(UpdateMeRequest.safeParse({ displayName: input }).success).toBe(false);
  });

  it.each(VALID_TIMEZONES)('accept timezone %j with the same canonical form', (tz) => {
    const core = canonicalTimeZone(tz);
    expect(core).not.toBeNull();
    expect(UpdateMeRequest.parse({ timezone: tz }).timezone).toBe(core);
  });

  it.each(CANONICAL_TIMEZONES)('canonicalise %j to %j', (tz, canonical) => {
    expect(canonicalTimeZone(tz)).toBe(canonical);
    expect(UpdateMeRequest.parse({ timezone: tz }).timezone).toBe(canonical);
  });

  it.each(INVALID_TIMEZONES)('reject timezone %j', (tz) => {
    expect(canonicalTimeZone(tz)).toBeNull();
    expect(UpdateMeRequest.safeParse({ timezone: tz }).success).toBe(false);
  });

  it.each(VALID_LOCALES)('accept locale %s', (locale) => {
    expect(isSupportedLocale(locale)).toBe(true);
    expect(UpdateMeRequest.safeParse({ locale }).success).toBe(true);
  });

  it.each(INVALID_LOCALES)('reject locale %j', (locale) => {
    expect(isSupportedLocale(locale)).toBe(false);
    expect(UpdateMeRequest.safeParse({ locale }).success).toBe(false);
  });
});
