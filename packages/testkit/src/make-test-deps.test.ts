import { describe, expect, expectTypeOf, it } from 'vitest';
import type { Deps } from '@noor/core';
import { FakeClock } from './fake-clock';
import { FakeIdGenerator } from './fake-id-generator';
import { InMemoryUserRepo } from './in-memory-user-repo';
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

  it('returns a FakeIdGenerator and an InMemoryUserRepo', () => {
    const deps = makeTestDeps();
    expect(deps.ids).toBeInstanceOf(FakeIdGenerator);
    expect(deps.users).toBeInstanceOf(InMemoryUserRepo);
  });

  it('returns fresh fakes on every call', () => {
    const a = makeTestDeps();
    const b = makeTestDeps();
    expect(a.clock).not.toBe(b.clock);
    expect(a.ids).not.toBe(b.ids);
    expect(a.users).not.toBe(b.users);
  });

  it('uses overriding fakes', () => {
    const clock = new FakeClock('2026-03-01T00:00:00Z');
    const ids = new FakeIdGenerator();
    const users = new InMemoryUserRepo();
    const deps = makeTestDeps({ clock, ids, users });
    expect(deps.clock).toBe(clock);
    expect(deps.ids).toBe(ids);
    expect(deps.users).toBe(users);
  });
});
