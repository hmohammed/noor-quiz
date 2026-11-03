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
