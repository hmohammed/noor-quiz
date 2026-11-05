import type { UserId } from '../users/user';

/** Lowest rank first. `requireMember` is the only gate that uses this order. */
export const ROLES = ['member', 'scholar-reviewer', 'editor', 'admin', 'owner'] as const;
export type Role = (typeof ROLES)[number];

const ROLE_SET: ReadonlySet<string> = new Set(ROLES);

export function isRole(s: unknown): s is Role {
  return typeof s === 'string' && ROLE_SET.has(s);
}

/**
 * True when `role` is a known role whose rank is at least `min`. An unrecognised
 * stored role fails the gate (`false`); it is not treated as a pass.
 */
export function roleAtLeast(role: string, min: Role): boolean {
  const rank = ROLES.indexOf(role as Role);
  if (rank < 0) return false;
  return rank >= ROLES.indexOf(min);
}

function rank(role: Role): number {
  return ROLES.indexOf(role);
}

export interface RoleSubject {
  userId: UserId;
  role: Role;
}

/**
 * Whether `actor` may set `target` to `newRole`. Same user: only an equal or lower
 * role. An owner may set any role on someone else. An admin may set any role except
 * `owner` on someone below admin. Does not throw, and does not read a clock or a repo.
 * The last-owner rule is not decided here.
 */
export function canChangeRole(actor: RoleSubject, target: RoleSubject, newRole: Role): boolean {
  if (actor.userId === target.userId) return rank(newRole) <= rank(target.role);
  if (actor.role === 'owner') return true;
  if (actor.role === 'admin') return rank(target.role) < rank('admin') && newRole !== 'owner';
  return false;
}

/**
 * Whether `actor` may remove `target`. Self-remove is false. An owner may remove
 * anyone else. An admin may remove someone below admin. The last owner is not this
 * function's job.
 */
export function canRemoveMember(actor: RoleSubject, target: RoleSubject): boolean {
  if (actor.userId === target.userId) return false;
  if (actor.role === 'owner') return true;
  return actor.role === 'admin' && rank(target.role) < rank('admin');
}
