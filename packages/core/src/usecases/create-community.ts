import type { Clock } from '../ports/clock';
import type { IdGenerator } from '../ports/id-generator';
import type { CommunityRepo } from '../ports/repos';
import { toIso } from '../time/instant';
import { canonicalTimeZone } from '../users/profile';
import { asUserId } from '../users/user';
import {
  asTenantId,
  COMMUNITY_SCHEMA_VERSION,
  MEMBERSHIP_SCHEMA_VERSION,
  membershipId,
  type Community,
  type Membership,
} from '../communities/community';
import { normaliseCommunityName } from '../communities/name';
import { baseSlug } from '../communities/slug';
import { DomainError } from '../errors';

/**
 * Creates a community and an owner membership for the signed-in user. `tenantId`,
 * `createdBy`, `role` and `slug` come from here and the repository, never from the
 * caller. The only caller fields used are `userId`, `name` and `timezone`.
 */
export async function createCommunity(
  deps: { clock: Clock; ids: IdGenerator; communities: CommunityRepo },
  input: { userId: string; name: string; timezone: string },
): Promise<{ community: Community; membership: Membership }> {
  const userId = asUserId(input.userId);
  const name = normaliseCommunityName(input.name);
  if (name === null) throw new DomainError('VALIDATION', { reason: 'invalid-community-name' });
  const timezone = canonicalTimeZone(input.timezone);
  if (timezone === null) throw new DomainError('VALIDATION', { reason: 'invalid-timezone' });

  const tenantId = asTenantId(deps.ids.newId());
  // One clock read for the community, the membership and (inside the repo) the slug doc.
  const at = toIso(deps.clock.now());
  return deps.communities.createWithOwner({
    community: {
      id: tenantId,
      tenantId,
      name,
      timezone,
      createdBy: userId,
      createdAt: at,
      updatedAt: at,
      schemaVersion: COMMUNITY_SCHEMA_VERSION,
    },
    baseSlug: baseSlug(name),
    membership: {
      id: membershipId(userId, tenantId),
      tenantId,
      userId,
      role: 'owner',
      createdAt: at,
      updatedAt: at,
      schemaVersion: MEMBERSHIP_SCHEMA_VERSION,
    },
  });
}
