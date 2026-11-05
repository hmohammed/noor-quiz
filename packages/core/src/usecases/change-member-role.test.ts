import { describe, expect, it } from 'vitest';
import {
  asTenantId,
  asUserId,
  DomainError,
  identityId,
  MEMBERSHIP_SCHEMA_VERSION,
  membershipId,
  USER_SCHEMA_VERSION,
  type Role,
} from '@noor/core';
import { makeTestDeps, type TestDeps } from '@noor/testkit';
import { changeMemberRole } from './change-member-role';

const AT = '2024-05-06T07:08:09.123Z';
const NEXT = '2026-07-01T00:00:00.000Z';
const T1 = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
const OWNER = '01ARZ3NDEKTSV4RRFFQ69G5FB0';
const OTHER = '01ARZ3NDEKTSV4RRFFQ69G5FB1';
const ADMIN = '01ARZ3NDEKTSV4RRFFQ69G5FB2';
const PEER = '01ARZ3NDEKTSV4RRFFQ69G5FB3';

async function putUser(deps: TestDeps, id: string, displayName: string) {
  const userId = asUserId(id);
  const subject = `sub-${id.slice(-4)}`;
  await deps.users.createWithIdentity(
    {
      id: userId,
      displayName,
      locale: null,
      timezone: null,
      consent: null,
      createdAt: AT,
      updatedAt: AT,
      schemaVersion: USER_SCHEMA_VERSION,
    },
    {
      id: identityId({ provider: 'firebase', subject }),
      provider: 'firebase',
      subject,
      userId,
      email: null,
      emailVerified: false,
      createdAt: AT,
      schemaVersion: USER_SCHEMA_VERSION,
    },
  );
}

async function seed(deps: TestDeps, userId: string, role: Role) {
  const user = asUserId(userId);
  const tenant = asTenantId(T1);
  await deps.memberships.seed({
    id: membershipId(user, tenant),
    tenantId: tenant,
    userId: user,
    role,
    createdAt: AT,
    updatedAt: AT,
    schemaVersion: MEMBERSHIP_SCHEMA_VERSION,
  });
}

async function rejection(p: Promise<unknown>) {
  const err = await p.then(
    () => expect.fail('expected a DomainError'),
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(DomainError);
  return err as DomainError;
}

describe('changeMemberRole', () => {
  it('rejects demoting the sole owner and leaves the membership unchanged', async () => {
    const deps = makeTestDeps();
    deps.clock.set(NEXT);
    await putUser(deps, OWNER, 'Ada');
    await seed(deps, OWNER, 'owner');
    const before = await deps.memberships.get(asTenantId(T1), asUserId(OWNER));

    const err = await rejection(
      changeMemberRole(deps, {
        tenantId: T1,
        actorUserId: OWNER,
        targetUserId: OWNER,
        role: 'admin',
      }),
    );

    expect(err.code).toBe('CONFLICT');
    expect(err.details).toEqual({ reason: 'last-owner' });
    expect(await deps.memberships.get(asTenantId(T1), asUserId(OWNER))).toEqual(before);
    expect(before?.role).toBe('owner');
    expect(before?.updatedAt).toBe(AT);
  });

  it('lets one of two owners demote the other, leaving exactly one owner', async () => {
    const deps = makeTestDeps();
    deps.clock.set(NEXT);
    await putUser(deps, OWNER, 'Ada');
    await putUser(deps, OTHER, 'Bea');
    await seed(deps, OWNER, 'owner');
    await seed(deps, OTHER, 'owner');

    const result = await changeMemberRole(deps, {
      tenantId: T1,
      actorUserId: OWNER,
      targetUserId: OTHER,
      role: 'admin',
    });

    expect(result).toEqual({
      userId: OTHER,
      displayName: 'Bea',
      role: 'admin',
      createdAt: AT,
    });
    const stored = await deps.memberships.get(asTenantId(T1), asUserId(OTHER));
    expect(stored?.role).toBe('admin');
    expect(stored?.updatedAt).toBe(NEXT);
    expect(stored?.createdAt).toBe(AT);
    const owners = (await deps.memberships.listByTenant(asTenantId(T1))).filter(
      (membership) => membership.role === 'owner',
    );
    expect(owners.map((membership) => membership.userId)).toEqual([asUserId(OWNER)]);
  });

  it('does not write when the allowed role is unchanged', async () => {
    const deps = makeTestDeps();
    deps.clock.set(NEXT);
    await putUser(deps, OWNER, 'Ada');
    await putUser(deps, OTHER, 'Bea');
    await seed(deps, OWNER, 'owner');
    await seed(deps, OTHER, 'editor');
    let writes = 0;
    const original = deps.memberships.updateRole.bind(deps.memberships);
    deps.memberships.updateRole = async (...args) => {
      writes += 1;
      return original(...args);
    };

    const result = await changeMemberRole(deps, {
      tenantId: T1,
      actorUserId: OWNER,
      targetUserId: OTHER,
      role: 'editor',
    });

    expect(writes).toBe(0);
    expect(result.role).toBe('editor');
    expect((await deps.memberships.get(asTenantId(T1), asUserId(OTHER)))?.updatedAt).toBe(AT);
  });

  it('rejects an admin assigning admin to another admin, even though the role is unchanged', async () => {
    const deps = makeTestDeps();
    await putUser(deps, ADMIN, 'Admin');
    await putUser(deps, PEER, 'Peer');
    await seed(deps, OWNER, 'owner');
    await seed(deps, ADMIN, 'admin');
    await seed(deps, PEER, 'admin');

    const err = await rejection(
      changeMemberRole(deps, {
        tenantId: T1,
        actorUserId: ADMIN,
        targetUserId: PEER,
        role: 'admin',
      }),
    );

    expect(err.code).toBe('FORBIDDEN');
    expect(err.details).toEqual({ reason: 'role-change-denied' });
    expect((await deps.memberships.get(asTenantId(T1), asUserId(PEER)))?.updatedAt).toBe(AT);
  });

  it('rejects a non-object and a forbidden field', async () => {
    const deps = makeTestDeps();
    const bad = await rejection(changeMemberRole(deps, null as never));
    expect(bad.details).toEqual({ reason: 'invalid-input' });
    const extra = await rejection(
      changeMemberRole(deps, {
        tenantId: T1,
        actorUserId: OWNER,
        targetUserId: OTHER,
        role: 'member',
        tenant: T1,
      } as never),
    );
    expect(extra.details).toEqual({ reason: 'forbidden-field' });
  });
});
