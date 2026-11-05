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
  type UserId,
} from '@noor/core';
import { makeTestDeps, type TestDeps } from '@noor/testkit';
import { listMembers } from './list-members';

const AT = '2024-05-06T07:08:09.123Z';
const T1 = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
const T2 = '01ARZ3NDEKTSV4RRFFQ69G5FAW';
const U_ZOE = '01ARZ3NDEKTSV4RRFFQ69G5FB0';
const U_OWNER = '01ARZ3NDEKTSV4RRFFQ69G5FB1';
const U_BOB = '01ARZ3NDEKTSV4RRFFQ69G5FB2';
const U_bob = '01ARZ3NDEKTSV4RRFFQ69G5FB3';
const U_ASA = '01ARZ3NDEKTSV4RRFFQ69G5FBA';
const U_NULL = '01ARZ3NDEKTSV4RRFFQ69G5FB4';
const U_MISSING = '01ARZ3NDEKTSV4RRFFQ69G5FB5';
const U_ADMIN = '01ARZ3NDEKTSV4RRFFQ69G5FB6';
const U_SCHOLAR = '01ARZ3NDEKTSV4RRFFQ69G5FB7';
const U_ANN_1 = '01ARZ3NDEKTSV4RRFFQ69G5FB8';
const U_ANN_2 = '01ARZ3NDEKTSV4RRFFQ69G5FB9';
const U_OTHER = '01ARZ3NDEKTSV4RRFFQ69G5FBB';

async function putUser(deps: TestDeps, id: string, displayName: string | null) {
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
      email: 'hidden@example.com',
      emailVerified: true,
      createdAt: AT,
      schemaVersion: USER_SCHEMA_VERSION,
    },
  );
}

async function seed(deps: TestDeps, userId: string, tenantId: string, role: Role) {
  const user = asUserId(userId);
  const tenant = asTenantId(tenantId);
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

async function populated() {
  const deps = makeTestDeps();
  await putUser(deps, U_ZOE, 'Zoe');
  await putUser(deps, U_BOB, 'Bob');
  await putUser(deps, U_bob, 'bob');
  await putUser(deps, U_ASA, 'Äsa');
  await putUser(deps, U_NULL, null);
  await putUser(deps, U_ADMIN, 'Ann');
  await putUser(deps, U_SCHOLAR, 'Ann');
  await putUser(deps, U_ANN_1, 'Ann');
  await putUser(deps, U_ANN_2, 'Ann');
  await putUser(deps, U_OTHER, 'Other Tenant');
  await seed(deps, U_OWNER, T1, 'owner');
  await seed(deps, U_ADMIN, T1, 'admin');
  await seed(deps, U_BOB, T1, 'editor');
  await seed(deps, U_bob, T1, 'editor');
  await seed(deps, U_ASA, T1, 'editor');
  await seed(deps, U_NULL, T1, 'editor');
  await seed(deps, U_MISSING, T1, 'editor');
  await seed(deps, U_SCHOLAR, T1, 'scholar-reviewer');
  await seed(deps, U_ANN_1, T1, 'member');
  await seed(deps, U_ANN_2, T1, 'member');
  await seed(deps, U_ZOE, T1, 'member');
  await seed(deps, U_ZOE, T2, 'owner');
  await seed(deps, U_OTHER, T2, 'member');
  return deps;
}

describe('listMembers', () => {
  it('lists only that tenant, sorted by role then name then userId, without private fields', async () => {
    const deps = await populated();

    const result = await listMembers(deps, { tenantId: T1, userId: U_ADMIN });

    expect(result).toEqual([
      { userId: U_OWNER, displayName: null, role: 'owner', createdAt: AT },
      { userId: U_ADMIN, displayName: 'Ann', role: 'admin', createdAt: AT },
      { userId: U_BOB, displayName: 'Bob', role: 'editor', createdAt: AT },
      { userId: U_bob, displayName: 'bob', role: 'editor', createdAt: AT },
      { userId: U_ASA, displayName: 'Äsa', role: 'editor', createdAt: AT },
      { userId: U_NULL, displayName: null, role: 'editor', createdAt: AT },
      { userId: U_MISSING, displayName: null, role: 'editor', createdAt: AT },
      { userId: U_SCHOLAR, displayName: 'Ann', role: 'scholar-reviewer', createdAt: AT },
      { userId: U_ANN_1, displayName: 'Ann', role: 'member', createdAt: AT },
      { userId: U_ANN_2, displayName: 'Ann', role: 'member', createdAt: AT },
      { userId: U_ZOE, displayName: 'Zoe', role: 'member', createdAt: AT },
    ]);
    expect(result.map((item) => item.userId)).not.toContain(U_OTHER as UserId);
    for (const item of result) {
      expect(Object.keys(item).sort()).toEqual(['createdAt', 'displayName', 'role', 'userId']);
      expect(JSON.stringify(item)).not.toContain('example.com');
      expect(JSON.stringify(item)).not.toContain('locale');
      expect(JSON.stringify(item)).not.toContain('timezone');
      expect(JSON.stringify(item)).not.toContain('consent');
      expect(JSON.stringify(item)).not.toContain('updatedAt');
      expect(JSON.stringify(item)).not.toContain('schemaVersion');
    }
  });

  it('lets an owner list the same tenant', async () => {
    const deps = await populated();
    const result = await listMembers(deps, { tenantId: T1, userId: U_OWNER });
    expect(result).toHaveLength(11);
  });

  it.each(['member', 'editor', 'scholar-reviewer'] as const)(
    'rejects a %s with FORBIDDEN',
    async (role) => {
      const deps = await populated();
      const actor = role === 'member' ? U_ZOE : role === 'editor' ? U_BOB : U_SCHOLAR;
      const err = await listMembers(deps, { tenantId: T1, userId: actor }).then(
        () => expect.fail('expected FORBIDDEN'),
        (e: unknown) => e,
      );
      expect(err).toBeInstanceOf(DomainError);
      expect((err as DomainError).code).toBe('FORBIDDEN');
      expect((err as DomainError).details).toEqual({ reason: 'not-an-admin' });
    },
  );

  it('rejects a missing membership and a forbidden field', async () => {
    const deps = makeTestDeps();
    const missing = await listMembers(deps, { tenantId: T1, userId: U_ADMIN }).then(
      () => null,
      (e: unknown) => e,
    );
    expect(missing).toBeInstanceOf(DomainError);
    expect((missing as DomainError).code).toBe('FORBIDDEN');

    const extra = await listMembers(deps, {
      tenantId: T1,
      userId: U_ADMIN,
      role: 'owner',
    } as never).then(
      () => null,
      (e: unknown) => e,
    );
    expect((extra as DomainError).code).toBe('VALIDATION');
    expect((extra as DomainError).details).toEqual({ reason: 'forbidden-field' });

    const bad = await listMembers(deps, null as never).then(
      () => null,
      (e: unknown) => e,
    );
    expect((bad as DomainError).details).toEqual({ reason: 'invalid-input' });
  });
});
