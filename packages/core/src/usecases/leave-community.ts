import type { MembershipRepo } from '../ports/repos';
import { asTenantId } from '../communities/community';
import { DomainError } from '../errors';
import { asUserId } from '../users/user';

const ALLOWED_KEYS = new Set(['tenantId', 'userId']);

/**
 * The caller leaves one community. Any member may leave. The sole owner hits the
 * repo invariant (`CONFLICT`, `reason: 'last-owner'`) and the membership stays.
 */
export async function leaveCommunity(
  deps: { memberships: MembershipRepo },
  input: { tenantId: string; userId: string },
): Promise<void> {
  if (typeof input !== 'object' || input === null) {
    throw new DomainError('VALIDATION', { reason: 'invalid-input' });
  }
  for (const key of Object.keys(input)) {
    if (!ALLOWED_KEYS.has(key)) throw new DomainError('VALIDATION', { reason: 'forbidden-field' });
  }
  const tenantId = asTenantId(input.tenantId);
  const userId = asUserId(input.userId);
  const membership = await deps.memberships.get(tenantId, userId);
  if (!membership) throw new DomainError('FORBIDDEN', { reason: 'not-a-member' });
  await deps.memberships.remove(tenantId, userId);
}
