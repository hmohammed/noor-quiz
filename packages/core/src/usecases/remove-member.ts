import type { MembershipRepo } from '../ports/repos';
import { asTenantId } from '../communities/community';
import { canRemoveMember, roleAtLeast } from '../communities/role';
import { DomainError } from '../errors';
import { asUserId } from '../users/user';

const ALLOWED_KEYS = new Set(['tenantId', 'actorUserId', 'targetUserId']);

/**
 * An admin removes someone else. Self-removal is `POST .../leave`. A `CONFLICT`
 * from the repo (the last owner) propagates. The actor's role is read again.
 */
export async function removeMember(
  deps: { memberships: MembershipRepo },
  input: { tenantId: string; actorUserId: string; targetUserId: string },
): Promise<void> {
  if (typeof input !== 'object' || input === null) {
    throw new DomainError('VALIDATION', { reason: 'invalid-input' });
  }
  for (const key of Object.keys(input)) {
    if (!ALLOWED_KEYS.has(key)) throw new DomainError('VALIDATION', { reason: 'forbidden-field' });
  }
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
    !canRemoveMember(
      { userId: actor.userId, role: actor.role },
      { userId: target.userId, role: target.role },
    )
  ) {
    throw new DomainError('FORBIDDEN', { reason: 'remove-denied' });
  }
  await deps.memberships.remove(tenantId, targetUserId);
}
