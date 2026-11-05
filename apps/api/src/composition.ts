import type { Deps } from '@noor/core';
import { getAdminAuth } from './adapters/firebase/auth';
import { FirebaseAuthVerifier } from './adapters/firebase/auth-verifier';
import { getAdminFirestore } from './adapters/firebase/firestore';
import {
  FirestoreCommunityRepo,
  FirestoreMembershipRepo,
} from './adapters/firebase/community-repo';
import { FirestoreInviteRepo } from './adapters/firebase/invite-repo';
import { FirestoreSeasonRepo } from './adapters/firebase/season-repo';
import { FirestoreUserRepo } from './adapters/firebase/user-repo';
import { SystemClock } from './adapters/system/clock';
import { UlidIdGenerator } from './adapters/system/ulid-id-generator';
import { loadConfig, type Config } from './config';

/** Everything the HTTP app needs, built once per process. */
export interface AppRoot {
  config: Config;
  deps: Deps;
  version: string;
}

/**
 * The only place that chooses adapters. Validates config first, so an invalid
 * environment throws ConfigError before any adapter is built (fail fast at cold start).
 */
export function createComposition(
  env: Record<string, string | undefined>,
  opts: { version: string },
): AppRoot {
  const config = loadConfig(env);
  const clock = new SystemClock();
  const db = getAdminFirestore();
  const deps: Deps = {
    auth: new FirebaseAuthVerifier(getAdminAuth()),
    clock,
    ids: new UlidIdGenerator(clock),
    users: new FirestoreUserRepo(db),
    communities: new FirestoreCommunityRepo(db),
    memberships: new FirestoreMembershipRepo(db),
    invites: new FirestoreInviteRepo(db),
    seasons: new FirestoreSeasonRepo(db),
  };
  return { config, deps, version: opts.version };
}
