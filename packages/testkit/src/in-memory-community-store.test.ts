import { describe, expect, it } from 'vitest';
import { asTenantId, asUserId, membershipId } from '@noor/core';
import { runCommunityStoreContract } from './contracts/community-store.contract';
import { createInMemoryCommunityStore } from './in-memory-community-store';

runCommunityStoreContract('InMemoryCommunityStore', async () => {
  const store = createInMemoryCommunityStore();
  return {
    communities: store.communities,
    memberships: store.memberships,
    counts: async () => store.communities.counts(),
    readSlug: async (slug) => store.communities.storedSlug(slug),
    seedMembership: (membership) => store.memberships.seed(membership),
  };
});

describe('InMemoryCommunityStore', () => {
  it('returns copies, so changing a result does not change the stored community', async () => {
    const store = createInMemoryCommunityStore();
    const tenant = asTenantId('01ARZ3NDEKTSV4RRFFQ69G5FAV');
    const user = asUserId('01ARZ3NDEKTSV4RRFFQ69G5FAW');
    const at = '2024-05-06T07:08:09.123Z';
    const created = await store.communities.createWithOwner({
      community: {
        id: tenant,
        tenantId: tenant,
        name: 'Masjid Al-Noor',
        timezone: 'Europe/Stockholm',
        createdBy: user,
        createdAt: at,
        updatedAt: at,
        schemaVersion: 1,
      },
      baseSlug: 'masjid-al-noor',
      membership: {
        id: membershipId(user, tenant),
        tenantId: tenant,
        userId: user,
        role: 'owner',
        createdAt: at,
        updatedAt: at,
        schemaVersion: 1,
      },
    });

    created.community.name = 'Mallory';
    created.membership.role = 'member';
    expect((await store.communities.getById(created.community.tenantId))?.name).toBe(
      'Masjid Al-Noor',
    );
    expect((await store.memberships.get(created.community.tenantId, user))?.role).toBe('owner');
  });
});
