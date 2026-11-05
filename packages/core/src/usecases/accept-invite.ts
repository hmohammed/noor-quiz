import type { Clock } from '../ports/clock';
import type { CommunityRepo, InviteRepo } from '../ports/repos';
import { toIso } from '../time/instant';
import { asUserId } from '../users/user';
import type { Community, Membership } from '../communities/community';
import { asInviteToken } from '../communities/invite';
import { DomainError } from '../errors';

/**
 * Joins the community named by the invite, as `member`. No tenant id and no role are
 * taken from the caller: the tenant comes from the invite document, and a new
 * membership is always `member`. Someone who already has a membership gets that
 * membership back and does not consume a use, even after the link has expired or
 * filled. One clock read, passed into `InviteRepo.accept` as `now`.
 */
export async function acceptInvite(
  deps: { clock: Clock; invites: InviteRepo; communities: CommunityRepo },
  input: { token: string; userId: string },
): Promise<{ community: Community; membership: Membership; created: boolean }> {
  const token = asInviteToken(input.token);
  const userId = asUserId(input.userId);
  const invite = await deps.invites.getByToken(token);
  if (!invite) throw new DomainError('NOT_FOUND', { reason: 'invite-missing' });
  const community = await deps.communities.getById(invite.tenantId);
  if (!community) throw new DomainError('NOT_FOUND', { reason: 'community-missing' });
  const now = toIso(deps.clock.now());
  const { membership, created } = await deps.invites.accept({ token, userId, now });
  if (community.tenantId !== membership.tenantId) {
    throw new DomainError('INTERNAL', { reason: 'tenant-mismatch' });
  }
  return { community, membership, created };
}
