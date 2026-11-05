import type { CommunityRole } from '@noor/contracts';

/** Lowest rank first. Mirrors core `ROLES`. The web app does not import `@noor/core`. */
const ROLES = ['member', 'scholar-reviewer', 'editor', 'admin', 'owner'] as const;

function rank(role: CommunityRole): number {
  return ROLES.indexOf(role);
}

export interface MemberSubject {
  userId: string;
  role: CommunityRole;
}

/** Same rule as core `canChangeRole`. The API remains the authority. */
export function canChangeRole(
  actor: MemberSubject,
  target: MemberSubject,
  newRole: CommunityRole,
): boolean {
  if (actor.userId === target.userId) return rank(newRole) <= rank(target.role);
  if (actor.role === 'owner') return true;
  if (actor.role === 'admin') return rank(target.role) < rank('admin') && newRole !== 'owner';
  return false;
}

/** Same rule as core `canRemoveMember`. Self-remove is false. */
export function canRemoveMember(actor: MemberSubject, target: MemberSubject): boolean {
  if (actor.userId === target.userId) return false;
  if (actor.role === 'owner') return true;
  return actor.role === 'admin' && rank(target.role) < rank('admin');
}

/** Roles the actor may assign, lowest rank first. Empty when no change is allowed. */
export function assignableRoles(actor: MemberSubject, target: MemberSubject): CommunityRole[] {
  return ROLES.filter((role) => canChangeRole(actor, target, role));
}
