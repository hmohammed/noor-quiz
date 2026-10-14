import type { Deps } from '@noor/core';
import { FakeClock } from './fake-clock';

/** Core `Deps` wired with fakes, typed so tests can drive them (e.g. `deps.clock.advance()`). */
export type TestDeps = Deps & { clock: FakeClock };

/** Fresh fakes for every port. Pass `overrides` to share or pre-configure a fake. */
export function makeTestDeps(overrides: Partial<TestDeps> = {}): TestDeps {
  return {
    clock: overrides.clock ?? new FakeClock(),
  };
}
