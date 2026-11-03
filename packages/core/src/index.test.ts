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
    'asInviteToken',
    'inviteUnusable',
    'validateNewInvite',
    'createInvite',
    'previewInvite',
    'acceptInvite',
    'createSeason',
    'listSeasons',
    'updateSeason',
    'suggestRamadanStart',
    'asSeasonId',
    'seasonRules',
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
    expect(core.INVITE_SCHEMA_VERSION).toBe(1);
    expect(core.INVITE_DEFAULT_EXPIRES_IN_DAYS).toBe(7);
    expect(core.INVITE_MIN_EXPIRES_IN_DAYS).toBe(1);
    expect(core.INVITE_MAX_EXPIRES_IN_DAYS).toBe(30);
    expect(core.INVITE_DEFAULT_MAX_USES).toBe(25);
    expect(core.INVITE_MIN_MAX_USES).toBe(1);
    expect(core.INVITE_MAX_MAX_USES).toBe(100);
  });

  it('exports the season constants', () => {
    expect(core.SEASON_KINDS).toEqual(['ramadan', 'dhul_hijjah', 'muharram', 'weekly', 'custom']);
    expect(core.SEASON_SCHEMA_VERSION).toBe(1);
  });
});
