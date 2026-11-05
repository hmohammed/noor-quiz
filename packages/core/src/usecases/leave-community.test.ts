import { describe, expect, it } from 'vitest';
import {
  asTenantId,
  asUserId,
  DomainError,
  MEMBERSHIP_SCHEMA_VERSION,
  membershipId,
  type Role,
} from '@noor/core';
import { makeTestDeps, type TestDeps } from '@noor/testkit';
import { leaveCommunity } from './leave-community';

const AT = '2024-05-06T07:08:09.123Z';
const T1 = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
const OWNER = '01ARZ3NDEKTSV4RRFFQ69G5FB0';
const OTHER = '01ARZ3NDEKTSV4RRFFQ69G5FB1';
const MEMBER = '01ARZ3NDEKTSV4RRFFQ69G5FB2';

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

describe('leaveCommunity', () => {
  it('rejects the sole owner and keeps the membership', async () => {
    const deps = makeTestDeps();
    await seed(deps, OWNER, 'owner');

    const err = await leaveCommunity(deps, { tenantId: T1, userId: OWNER }).then(
      () => expect.fail('expected CONFLICT'),
      (e: unknown) => e,
    );

    expect(err).toBeInstanceOf(DomainError);
    expect((err as DomainError).code).toBe('CONFLICT');
    expect((err as DomainError).details).toEqual({ reason: 'last-owner' });
    expect((await deps.memberships.get(asTenantId(T1), asUserId(OWNER)))?.role).toBe('owner');
  });

  it('deletes only the leaving owner when a second owner remains', async () => {
    const deps = makeTestDeps();
    await seed(deps, OWNER, 'owner');
    await seed(deps, OTHER, 'owner');

    await leaveCommunity(deps, { tenantId: T1, userId: OWNER });

    expect(await deps.memberships.get(asTenantId(T1), asUserId(OWNER))).toBeNull();
    expect((await deps.memberships.get(asTenantId(T1), asUserId(OTHER)))?.role).toBe('owner');
  });

  it('lets a member leave', async () => {
    const deps = makeTestDeps();
    await seed(deps, OWNER, 'owner');
    await seed(deps, MEMBER, 'member');

    await leaveCommunity(deps, { tenantId: T1, userId: MEMBER });

    expect(await deps.memberships.get(asTenantId(T1), asUserId(MEMBER))).toBeNull();
    expect(await deps.memberships.get(asTenantId(T1), asUserId(OWNER))).not.toBeNull();
  });

  it('rejects someone who is not a member', async () => {
    const deps = makeTestDeps();
    const err = await leaveCommunity(deps, { tenantId: T1, userId: MEMBER }).then(
      () => expect.fail('expected FORBIDDEN'),
      (e: unknown) => e,
    );
    expect((err as DomainError).code).toBe('FORBIDDEN');
    expect((err as DomainError).details).toEqual({ reason: 'not-a-member' });
  });
});
