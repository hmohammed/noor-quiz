import type { Deps } from '@noor/core';
import { FakeAuthVerifier } from './fake-auth-verifier';
import { FakeClock } from './fake-clock';
import { FakeIdGenerator } from './fake-id-generator';
import { InMemoryUserRepo } from './in-memory-user-repo';

/** Core `Deps` wired with fakes, typed so tests can drive them (e.g. `deps.clock.advance()`). */
export type TestDeps = Deps & {
  auth: FakeAuthVerifier;
  clock: FakeClock;
  ids: FakeIdGenerator;
  users: InMemoryUserRepo;
};

/** Fresh fakes for every port. Pass `overrides` to share or pre-configure a fake. */
export function makeTestDeps(overrides: Partial<TestDeps> = {}): TestDeps {
  return {
    auth: overrides.auth ?? new FakeAuthVerifier(),
    clock: overrides.clock ?? new FakeClock(),
    ids: overrides.ids ?? new FakeIdGenerator(),
    users: overrides.users ?? new InMemoryUserRepo(),
  };
}
