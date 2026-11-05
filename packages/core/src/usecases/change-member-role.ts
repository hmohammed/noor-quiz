import type { Clock } from '../ports/clock';
import type { MembershipRepo, UserRepo } from '../ports/repos';
import { asTenantId, type Membership } from '../communities/community';
import { canChangeRole, isRole, roleAtLeast } from '../communities/role';
import { DomainError } from '../errors';
import { toIso } from '../time/instant';
import { asUserId } from '../users/user';
import type { MemberSummary } from './list-members';

const ALLOWED_KEYS = new Set(['tenantId', 'actorUserId', 'targetUserId', 'role']);

async function memberSummary(users: UserRepo, membership: Membership): Promise<MemberSummary> {
  const user = await users.getById(membership.userId);
  return {
    userId: membership.userId,
    displayName: user ? user.displayName : null,
    role: membership.role,
    createdAt: membership.createdAt,
  };
}

/**
 * Changes one member's role. The actor is loaded again; `canChangeRole` decides.
 * An unchanged role that is allowed is returned without a write. A `CONFLICT` from
 * the repo (the last owner) propagates. One clock read, and only when writing.
 */
export async function changeMemberRole(
  deps: { clock: Clock; memberships: MembershipRepo; users: UserRepo },
  input: { tenantId: string; actorUserId: string; targetUserId: string; role: string },
): Promise<MemberSummary> {
  if (typeof input !== 'object' || input === null) {
    throw new DomainError('VALIDATION', { reason: 'invalid-input' });
  }
  for (const key of Object.keys(input)) {
    if (!ALLOWED_KEYS.has(key)) throw new DomainError('VALIDATION', { reason: 'forbidden-field' });
  }
  if (!isRole(input.role)) throw new DomainError('VALIDATION', { reason: 'invalid-role' });
  const tenantId = asTenantId(input.tenantId);
  const actorUserId = asUserId(input.actorUserId);
  const targetUserId = asUserId(input.targetUserId);
  const actor = await deps.memberships.get(tenantId, actorUserId);
  if (!actor || !roleAtLeast(actor.role, 'admin')) {
    throw new DomainError('FORBIDDEN', { reason: 'not-an-admin' });
  }
  const target = await deps.memberships.get(tenantId, targetUserId);
  if (!target) throw new DomainError('NOT_FOUND', { reason: 'membership-missing' });
  if (
    !canChangeRole(
      { userId: actor.userId, role: actor.role },
      { userId: target.userId, role: target.role },
      input.role,
    )
  ) {
    throw new DomainError('FORBIDDEN', { reason: 'role-change-denied' });
  }
  if (input.role === target.role) return memberSummary(deps.users, target);
  const updated = await deps.memberships.updateRole(
    tenantId,
    targetUserId,
    input.role,
    toIso(deps.clock.now()),
  );
  return memberSummary(deps.users, updated);
}
