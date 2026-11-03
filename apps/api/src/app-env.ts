import type { Deps, IdentityKey, Locale, Role, TenantId, TimeZone, UserId } from '@noor/core';

/** The signed-in user as routes see it: our id and profile only, never provider data. */
export interface RequestUser {
  id: UserId;
  displayName: string | null;
  locale: Locale | null;
  timezone: TimeZone | null;
  /** The privacy terms version the user accepted, or null. Never `acceptedAt`. */
  consentVersion: string | null;
}

/** The caller's membership in the path tenant. Set only by `requireMember`. */
export interface RequestMembership {
  tenantId: TenantId;
  userId: UserId;
  role: Role;
}

/**
 * Hono variables. `deps` is set for every request. `user` is set only after
 * `requireUser()`. `identity` is set only after `requireIdentity()`. `membership`
 * is set only after `requireMember`.
 */
export interface AppEnv {
  Variables: {
    deps: Deps;
    user: RequestUser;
    identity: IdentityKey;
    membership: RequestMembership;
  };
}
