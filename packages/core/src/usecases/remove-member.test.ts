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
import { removeMember } from './remove-member';

const AT = '2024-05-06T07:08:09.123Z';
const T1 = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
const T2 = '01ARZ3NDEKTSV4RRFFQ69G5FAW';
const OWNER = '01ARZ3NDEKTSV4RRFFQ69G5FB0';
const ADMIN = '01ARZ3NDEKTSV4RRFFQ69G5FB1';
const PEER = '01ARZ3NDEKTSV4RRFFQ69G5FB2';
const EDITOR = '01ARZ3NDEKTSV4RRFFQ69G5FB3';
const MISSING = '01ARZ3NDEKTSV4RRFFQ69G5FB4';

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

async function rejection(p: Promise<unknown>) {
  const err = await p.then(
    () => expect.fail('expected a DomainError'),
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(DomainError);
  return err as DomainError;
}

describe('removeMember', () => {
  it('lets an owner remove an editor and keeps that user in another tenant', async () => {
    const deps = makeTestDeps();
    await seed(deps, OWNER, T1, 'owner');
    await seed(deps, EDITOR, T1, 'editor');
    await seed(deps, EDITOR, T2, 'member');

    await removeMember(deps, { tenantId: T1, actorUserId: OWNER, targetUserId: EDITOR });

    expect(await deps.memberships.get(asTenantId(T1), asUserId(EDITOR))).toBeNull();
    expect((await deps.memberships.get(asTenantId(T2), asUserId(EDITOR)))?.role).toBe('member');
    expect((await deps.memberships.get(asTenantId(T1), asUserId(OWNER)))?.role).toBe('owner');
  });

  it('rejects an owner removing themselves and keeps the membership', async () => {
    const deps = makeTestDeps();
    await seed(deps, OWNER, T1, 'owner');

    const err = await rejection(
      removeMember(deps, { tenantId: T1, actorUserId: OWNER, targetUserId: OWNER }),
    );

    expect(err.code).toBe('FORBIDDEN');
    expect(err.details).toEqual({ reason: 'remove-denied' });
    expect((await deps.memberships.get(asTenantId(T1), asUserId(OWNER)))?.role).toBe('owner');
  });

  it('rejects an admin removing an owner or another admin, and allows removing an editor', async () => {
    const deps = makeTestDeps();
    await seed(deps, OWNER, T1, 'owner');
    await seed(deps, ADMIN, T1, 'admin');
    await seed(deps, PEER, T1, 'admin');
    await seed(deps, EDITOR, T1, 'editor');

    const owner = await rejection(
      removeMember(deps, { tenantId: T1, actorUserId: ADMIN, targetUserId: OWNER }),
    );
    const peer = await rejection(
      removeMember(deps, { tenantId: T1, actorUserId: ADMIN, targetUserId: PEER }),
    );
    expect(owner.code).toBe('FORBIDDEN');
    expect(peer.code).toBe('FORBIDDEN');
    expect((await deps.memberships.get(asTenantId(T1), asUserId(OWNER)))?.role).toBe('owner');
    expect((await deps.memberships.get(asTenantId(T1), asUserId(PEER)))?.role).toBe('admin');

    await removeMember(deps, { tenantId: T1, actorUserId: ADMIN, targetUserId: EDITOR });
    expect(await deps.memberships.get(asTenantId(T1), asUserId(EDITOR))).toBeNull();
  });

  it('rejects a missing target with NOT_FOUND', async () => {
    const deps = makeTestDeps();
    await seed(deps, OWNER, T1, 'owner');

    const err = await rejection(
      removeMember(deps, { tenantId: T1, actorUserId: OWNER, targetUserId: MISSING }),
    );

    expect(err.code).toBe('NOT_FOUND');
  });
});
