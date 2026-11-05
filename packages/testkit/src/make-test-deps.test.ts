import { describe, expect, expectTypeOf, it } from 'vitest';
import { createCommunity, type Deps } from '@noor/core';
import { FakeAuthVerifier } from './fake-auth-verifier';
import { FakeClock } from './fake-clock';
import { FakeIdGenerator } from './fake-id-generator';
import {
  createInMemoryCommunityStore,
  InMemoryCommunityRepo,
  InMemoryInviteRepo,
  InMemoryMembershipRepo,
} from './in-memory-community-store';
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
    expect(asDeps.auth).toBe(deps.auth);
  });

  it('returns a FakeAuthVerifier, a FakeIdGenerator and an InMemoryUserRepo', () => {
    const deps = makeTestDeps();
    expect(deps.auth).toBeInstanceOf(FakeAuthVerifier);
    expect(deps.ids).toBeInstanceOf(FakeIdGenerator);
    expect(deps.users).toBeInstanceOf(InMemoryUserRepo);
    expect(deps.communities).toBeInstanceOf(InMemoryCommunityRepo);
    expect(deps.memberships).toBeInstanceOf(InMemoryMembershipRepo);
    expect(deps.invites).toBeInstanceOf(InMemoryInviteRepo);
  });

  it('shares one community store between the default repos', async () => {
    const deps = makeTestDeps();
    const userId = deps.ids.newId();
    const { membership } = await createCommunity(deps, {
      userId,
      name: 'Masjid Al-Noor',
      timezone: 'UTC',
    });
    expect(await deps.memberships.get(membership.tenantId, membership.userId)).toMatchObject({
      role: 'owner',
      userId: membership.userId,
    });
  });

  it('returns fresh fakes on every call', () => {
    const a = makeTestDeps();
    const b = makeTestDeps();
    expect(a.auth).not.toBe(b.auth);
    expect(a.clock).not.toBe(b.clock);
    expect(a.ids).not.toBe(b.ids);
    expect(a.users).not.toBe(b.users);
    expect(a.communities).not.toBe(b.communities);
    expect(a.memberships).not.toBe(b.memberships);
    expect(a.invites).not.toBe(b.invites);
  });

  it('uses overriding fakes', () => {
    const auth = new FakeAuthVerifier();
    const clock = new FakeClock('2026-03-01T00:00:00Z');
    const ids = new FakeIdGenerator();
    const users = new InMemoryUserRepo();
    const deps = makeTestDeps({ auth, clock, ids, users });
    expect(deps.auth).toBe(auth);
    expect(deps.clock).toBe(clock);
    expect(deps.ids).toBe(ids);
    expect(deps.users).toBe(users);
  });

  it('replaces only the community repo that was overridden', async () => {
    const store = createInMemoryCommunityStore();
    const deps = makeTestDeps({ communities: store.communities });
    expect(deps.communities).toBe(store.communities);
    expect(deps.memberships).not.toBe(store.memberships);

    const { membership } = await createCommunity(deps, {
      userId: deps.ids.newId(),
      name: 'Masjid Al-Noor',
      timezone: 'UTC',
    });
    expect(await store.memberships.get(membership.tenantId, membership.userId)).not.toBeNull();
    expect(await deps.memberships.listByUser(membership.userId)).toEqual([]);
  });
});
