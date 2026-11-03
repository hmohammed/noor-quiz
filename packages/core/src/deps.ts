import type { AuthVerifier } from './ports/auth-verifier';
import type { Clock } from './ports/clock';
import type { IdGenerator } from './ports/id-generator';
import type {
  CommunityRepo,
  InviteRepo,
  MembershipRepo,
  SeasonRepo,
  UserRepo,
} from './ports/repos';

/**
 * Ports available to use cases. Routes get real adapters from
 * apps/api/src/composition.ts; tests get fakes from `makeTestDeps()` in testkit.
 */
export interface Deps {
  auth: AuthVerifier;
  clock: Clock;
  ids: IdGenerator;
  users: UserRepo;
  communities: CommunityRepo;
  memberships: MembershipRepo;
  invites: InviteRepo;
  seasons: SeasonRepo;
}
