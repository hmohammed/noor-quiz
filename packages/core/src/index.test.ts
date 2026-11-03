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
    'asTenantId',
    'membershipId',
    'isRole',
    'roleAtLeast',
    'normaliseCommunityName',
    'isBaseSlug',
    'baseSlug',
    'slugCandidates',
    'chooseSlug',
    'validateCreateWithOwner',
    'createCommunity',
    'listMyCommunities',
  ])('exports %s', (name) => {
    expect(typeof (core as Record<string, unknown>)[name]).toBe('function');
  });

  it('exports the user constants', () => {
    expect(core.ULID_PATTERN).toBeInstanceOf(RegExp);
    expect(core.SUBJECT_PATTERN).toBeInstanceOf(RegExp);
    expect(core.USER_SCHEMA_VERSION).toBe(1);
  });

  it('exports the community constants', () => {
    expect(core.ROLES).toEqual(['member', 'scholar-reviewer', 'editor', 'admin', 'owner']);
    expect(core.COMMUNITY_SCHEMA_VERSION).toBe(1);
    expect(core.MEMBERSHIP_SCHEMA_VERSION).toBe(1);
    expect(core.COMMUNITY_SLUG_SCHEMA_VERSION).toBe(1);
  });
});
