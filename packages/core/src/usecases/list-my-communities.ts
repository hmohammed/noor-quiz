import type { CommunityRepo, MembershipRepo } from '../ports/repos';
import { asUserId } from '../users/user';
import type { Community } from '../communities/community';
import type { Role } from '../communities/role';

export interface MyCommunity {
  community: Community;
  role: Role;
}

/**
 * Communities the user has a membership for, each carrying that membership's role.
 * A membership whose community doc is missing is omitted. Sorted by `createdAt`
 * ascending, then `tenantId` ascending. The repository list is already limited to
 * this server-resolved user.
 */
export async function listMyCommunities(
  deps: { communities: CommunityRepo; memberships: MembershipRepo },
  input: { userId: string },
): Promise<MyCommunity[]> {
  const userId = asUserId(input.userId);
  const memberships = await deps.memberships.listByUser(userId);
  const found = await deps.communities.getByIds(memberships.map((m) => m.tenantId));
  const byId = new Map(found.map((community) => [community.id, community]));
  const items: MyCommunity[] = [];
  for (const membership of memberships) {
    const community = byId.get(membership.tenantId);
    if (!community) continue;
    items.push({ community, role: membership.role });
  }
  items.sort((a, b) => {
    if (a.community.createdAt !== b.community.createdAt) {
      return a.community.createdAt < b.community.createdAt ? -1 : 1;
    }
    if (a.community.tenantId !== b.community.tenantId) {
      return a.community.tenantId < b.community.tenantId ? -1 : 1;
    }
    return 0;
  });
  return items;
}
