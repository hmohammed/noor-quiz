import { describe, expect, expectTypeOf, it } from 'vitest';
import type { Deps } from '@noor/core';
import { FakeClock } from './fake-clock';
import { makeTestDeps } from './make-test-deps';

describe('makeTestDeps', () => {
  it('returns a FakeClock at the default start and satisfies core Deps', () => {
    const deps = makeTestDeps();
    expect(deps.clock).toBeInstanceOf(FakeClock);
    expect(deps.clock.now()).toBe(FakeClock.DEFAULT_START);
    expectTypeOf(deps).toMatchTypeOf<Deps>();
    const asDeps: Deps = deps;
    expect(asDeps.clock).toBe(deps.clock);
  });

  it('returns fresh fakes on every call', () => {
    expect(makeTestDeps().clock).not.toBe(makeTestDeps().clock);
  });

  it('uses an overriding clock', () => {
    const clock = new FakeClock('2026-03-01T00:00:00Z');
    expect(makeTestDeps({ clock }).clock).toBe(clock);
  });
});
