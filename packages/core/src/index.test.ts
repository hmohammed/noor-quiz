import { describe, expect, it } from 'vitest';
import * as core from './index';
import { PACKAGE_NAME } from './index';

describe('@noor/core', () => {
  it('exports its package name', () => {
    expect(PACKAGE_NAME).toBe('@noor/core');
  });

  it.each([
    'isValidLocalDate',
    'parseLocalTime',
    'addDays',
    'daysBetween',
    'zonedInstant',
    'assertValidSeason',
    'questionWindow',
    'dayIndexAt',
    'seasonState',
    'isOpen',
    'suggestRamadan',
    'nextRamadanSuggestion',
    'isUlid',
    'asUserId',
    'identityId',
    'normaliseDisplayName',
    'getOrCreateUser',
    'normaliseProfileName',
    'canonicalTimeZone',
    'isProfileTimeZone',
    'isSupportedLocale',
    'updateProfile',
    'hasCurrentConsent',
    'isValidConsent',
    'acceptConsent',
    'deleteAccount',
  ])('exports %s', (name) => {
    expect(typeof (core as Record<string, unknown>)[name]).toBe('function');
  });

  it('exports the user constants', () => {
    expect(core.ULID_PATTERN).toBeInstanceOf(RegExp);
    expect(core.SUBJECT_PATTERN).toBeInstanceOf(RegExp);
    expect(core.USER_SCHEMA_VERSION).toBe(1);
  });
});
