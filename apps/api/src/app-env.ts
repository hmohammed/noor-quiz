import type { Deps, IdentityKey, Locale, TimeZone, UserId } from '@noor/core';

/** The signed-in user as routes see it: our id and profile only, never provider data. */
export interface RequestUser {
  id: UserId;
  displayName: string | null;
  locale: Locale | null;
  timezone: TimeZone | null;
  /** The privacy terms version the user accepted, or null. Never `acceptedAt`. */
  consentVersion: string | null;
}

/**
 * Hono variables. `deps` is set for every request. `user` is set only after
 * `requireUser()`. `identity` is set only after `requireIdentity()`.
 */
export interface AppEnv {
  Variables: { deps: Deps; user: RequestUser; identity: IdentityKey };
}
