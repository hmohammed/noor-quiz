import { describe, expect, it } from 'vitest';
import { CommunityResponse, CreateCommunityRequest, MyCommunitiesResponse } from './community';

const ULID = '01ARZ3NDEKTSV4RRFFQ69G5FAV';

const summary = (overrides: Record<string, unknown> = {}) => ({
  tenantId: ULID,
  name: 'Masjid Al-Noor',
  slug: 'masjid-al-noor',
  timezone: 'Europe/Stockholm',
  role: 'owner',
  createdAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

describe('CreateCommunityRequest', () => {
  it.each([
    ['Masjid Al-Noor', 'Masjid Al-Noor'],
    ['مسجد النور', 'مسجد النور'],
    ['Masjid 99', 'Masjid 99'],
    ['  Masjid   Al-Noor  ', 'Masjid Al-Noor'],
  ])('accepts name %j and normalises it', (input, normalised) => {
    expect(CreateCommunityRequest.parse({ name: input, timezone: 'Europe/Stockholm' })).toEqual({
      name: normalised,
      timezone: 'Europe/Stockholm',
    });
  });

  it('canonicalises the timezone', () => {
    expect(
      CreateCommunityRequest.parse({ name: 'Masjid Al-Noor', timezone: 'europe/stockholm' }),
    ).toEqual({
      name: 'Masjid Al-Noor',
      timezone: 'Europe/Stockholm',
    });
  });

  it.each([
    ['a one-character name', { name: 'A', timezone: 'Europe/Stockholm' }],
    ['a leading digit', { name: '123 Mosque', timezone: 'Europe/Stockholm' }],
    ['markup', { name: '<b>', timezone: 'Europe/Stockholm' }],
    ['an emoji', { name: 'Masjid 😀', timezone: 'Europe/Stockholm' }],
    ['a bad timezone', { name: 'Masjid Al-Noor', timezone: 'Mars/Olympus' }],
    ['an offset', { name: 'Masjid Al-Noor', timezone: '+01:00' }],
    ['a missing name', { timezone: 'Europe/Stockholm' }],
    ['a missing timezone', { name: 'Masjid Al-Noor' }],
    ['a role key', { name: 'Masjid Al-Noor', timezone: 'Europe/Stockholm', role: 'owner' }],
    ['a tenantId key', { name: 'Masjid Al-Noor', timezone: 'Europe/Stockholm', tenantId: ULID }],
    ['a slug key', { name: 'Masjid Al-Noor', timezone: 'Europe/Stockholm', slug: 'masjid' }],
    ['a createdBy key', { name: 'Masjid Al-Noor', timezone: 'Europe/Stockholm', createdBy: ULID }],
  ])('rejects %s', (_label, body) => {
    expect(CreateCommunityRequest.safeParse(body).success).toBe(false);
  });
});

describe('CommunityResponse', () => {
  it('accepts a summary', () => {
    expect(CommunityResponse.parse(summary())).toEqual(summary());
  });

  it.each([
    ['createdBy', summary({ createdBy: ULID })],
    ['email', summary({ email: 'a@example.com' })],
    ['a Firebase uid', summary({ uid: 'uid-alice' })],
    ['schemaVersion', summary({ schemaVersion: 1 })],
    ['an updatedAt', summary({ updatedAt: '2026-01-01T00:00:00.000Z' })],
    ['a bad slug', summary({ slug: 'Masjid' })],
    ['a bad role', summary({ role: 'superuser' })],
  ])('rejects an extra or invalid %s', (_label, body) => {
    expect(CommunityResponse.safeParse(body).success).toBe(false);
  });
});

describe('MyCommunitiesResponse', () => {
  it('accepts an empty list and a list of summaries', () => {
    expect(MyCommunitiesResponse.parse({ communities: [] })).toEqual({ communities: [] });
    expect(MyCommunitiesResponse.parse({ communities: [summary()] })).toEqual({
      communities: [summary()],
    });
  });

  it('rejects a slug-reservation field and a missing communities key', () => {
    expect(MyCommunitiesResponse.safeParse({ communities: [], communitySlugs: [] }).success).toBe(
      false,
    );
    expect(MyCommunitiesResponse.safeParse({}).success).toBe(false);
  });
});
