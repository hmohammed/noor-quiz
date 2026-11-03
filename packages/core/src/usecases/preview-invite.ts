import type { Clock } from '../ports/clock';
import type { CommunityRepo, InviteRepo } from '../ports/repos';
import { asInviteToken, inviteUnusable } from '../communities/invite';
import { DomainError } from '../errors';

/**
 * Public preview of a live invite: the community name and nothing else. No user id.
 * An unknown token is `NOT_FOUND`. An expired or used-up token is `GONE` and the name
 * is not returned. One clock read, and only after the invite is found.
 */
export async function previewInvite(
  deps: { clock: Clock; invites: InviteRepo; communities: CommunityRepo },
  input: { token: string },
): Promise<{ name: string }> {
  const token = asInviteToken(input.token);
  const invite = await deps.invites.getByToken(token);
  if (!invite) throw new DomainError('NOT_FOUND', { reason: 'invite-missing' });
  if (inviteUnusable(invite, deps.clock.now())) {
    throw new DomainError('GONE', { reason: 'invite-unusable' });
  }
  const community = await deps.communities.getById(invite.tenantId);
  if (!community) throw new DomainError('NOT_FOUND', { reason: 'community-missing' });
  return { name: community.name };
}
