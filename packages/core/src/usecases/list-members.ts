import type { MembershipRepo, UserRepo } from '../ports/repos';
import { asTenantId } from '../communities/community';
import { ROLES, roleAtLeast, type Role } from '../communities/role';
import { DomainError } from '../errors';
import { asUserId, type UserId } from '../users/user';

const ALLOWED_KEYS = new Set(['tenantId', 'userId']);

/** One row of an admin's member list. No email, locale, or stored timestamps besides `createdAt`. */
export interface MemberSummary {
  userId: UserId;
  displayName: string | null;
  role: Role;
  createdAt: string;
}

/**
 * Members of one community, for an admin or owner. The actor's role is read again
 * from `memberships`. Sorted by role rank descending, then display name (UTF-16,
 * nulls last), then `userId`.
 */
export async function listMembers(
  deps: { memberships: MembershipRepo; users: UserRepo },
  input: { tenantId: string; userId: string },
): Promise<MemberSummary[]> {
  if (typeof input !== 'object' || input === null) {
    throw new DomainError('VALIDATION', { reason: 'invalid-input' });
  }
  for (const key of Object.keys(input)) {
    if (!ALLOWED_KEYS.has(key)) throw new DomainError('VALIDATION', { reason: 'forbidden-field' });
  }
  const tenantId = asTenantId(input.tenantId);
  const userId = asUserId(input.userId);
  const actor = await deps.memberships.get(tenantId, userId);
  if (!actor || !roleAtLeast(actor.role, 'admin')) {
    throw new DomainError('FORBIDDEN', { reason: 'not-an-admin' });
  }
  const memberships = await deps.memberships.listByTenant(tenantId);
  const items = await Promise.all(
    memberships.map(async (membership) => {
      const user = await deps.users.getById(membership.userId);
      const item: MemberSummary = {
        userId: membership.userId,
        displayName: user ? user.displayName : null,
        role: membership.role,
        createdAt: membership.createdAt,
      };
      return item;
    }),
  );
  items.sort(compareMembers);
  return items;
}

function compareMembers(a: MemberSummary, b: MemberSummary): number {
  const byRole = ROLES.indexOf(b.role) - ROLES.indexOf(a.role);
  if (byRole !== 0) return byRole;
  if (a.displayName === null && b.displayName !== null) return 1;
  if (a.displayName !== null && b.displayName === null) return -1;
  if (a.displayName !== null && b.displayName !== null && a.displayName !== b.displayName) {
    return a.displayName < b.displayName ? -1 : 1;
  }
  if (a.userId !== b.userId) return a.userId < b.userId ? -1 : 1;
  return 0;
}
