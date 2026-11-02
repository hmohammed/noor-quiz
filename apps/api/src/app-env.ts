import type { Deps, UserId } from '@noor/core';

/** The signed-in user as routes see it: our id and display name only, never provider data. */
export interface RequestUser {
  id: UserId;
  displayName: string | null;
}

/** Hono variables. `deps` is set for every request; `user` only after `requireUser()`. */
export interface AppEnv {
  Variables: { deps: Deps; user: RequestUser };
}
