import type { Deps } from '@noor/core';
import { FakeAuthVerifier } from './fake-auth-verifier';
import { FakeClock } from './fake-clock';
import { FakeIdGenerator } from './fake-id-generator';
import { createInMemoryCommunityStore } from './in-memory-community-store';
import type {
  InMemoryCommunityRepo,
  InMemoryInviteRepo,
  InMemoryMembershipRepo,
} from './in-memory-community-store';
import { InMemoryUserRepo } from './in-memory-user-repo';
import { InMemorySeasonRepo } from './in-memory-season-repo';

/** Core `Deps` wired with fakes, typed so tests can drive them (e.g. `deps.clock.advance()`). */
export type TestDeps = Deps & {
  auth: FakeAuthVerifier;
  clock: FakeClock;
  ids: FakeIdGenerator;
  users: InMemoryUserRepo;
  communities: InMemoryCommunityRepo;
  memberships: InMemoryMembershipRepo;
  invites: InMemoryInviteRepo;
  seasons: InMemorySeasonRepo;
};

/**
 * Fresh fakes for every port. Pass `overrides` to share or pre-configure a fake.
 * The default `communities`, `memberships` and `invites` share one store. An override
 * replaces that object only; pass the repos from one `createInMemoryCommunityStore()`
 * when they must agree. `seasons` is its own store and is never the community store.
 */
export function makeTestDeps(overrides: Partial<TestDeps> = {}): TestDeps {
  const store = createInMemoryCommunityStore();
  return {
    auth: overrides.auth ?? new FakeAuthVerifier(),
    clock: overrides.clock ?? new FakeClock(),
    ids: overrides.ids ?? new FakeIdGenerator(),
    users: overrides.users ?? new InMemoryUserRepo(),
    communities: overrides.communities ?? store.communities,
    memberships: overrides.memberships ?? store.memberships,
    invites: overrides.invites ?? store.invites,
    seasons: overrides.seasons ?? new InMemorySeasonRepo(),
  };
}
