import { describe, expect, it } from 'vitest';
import {
  asTenantId,
  CURRENT_CONSENT_VERSION,
  MEMBERSHIP_SCHEMA_VERSION,
  membershipId,
  type Role,
  type UserId,
  type VerifiedIdentity,
} from '@noor/core';
import {
  CommunityResponse,
  ErrorResponse,
  MemberView,
  MembersResponse,
  MeResponse,
} from '@noor/contracts';
import { makeTestDeps, type TestDeps } from '@noor/testkit';
import { createApp } from '../app';

const UNKNOWN = '01ARZ3NDEKTSV4RRFFQ69G5FB9';
const NEXT = '2026-08-01T00:00:00.000Z';

function identity(overrides: Partial<VerifiedIdentity> = {}): VerifiedIdentity {
  return {
    provider: 'firebase',
    subject: 'uid-alice',
    email: 'alice@example.com',
    emailVerified: true,
    name: 'Alice',
    ...overrides,
  };
}

function setup(deps: TestDeps = makeTestDeps()) {
  const app = createApp({ deps, version: 'test-1' });
  const list = (authorization: string | undefined, tenantId: string) =>
    app.request(`/v1/t/${tenantId}/members`, {
      headers: authorization === undefined ? {} : { authorization },
    });
  const change = (
    authorization: string | undefined,
    tenantId: string,
    userId: string,
    body: unknown,
  ) =>
    app.request(`/v1/t/${tenantId}/members/${userId}`, {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        ...(authorization === undefined ? {} : { authorization }),
      },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    });
  const remove = (authorization: string | undefined, tenantId: string, userId: string) =>
    app.request(`/v1/t/${tenantId}/members/${userId}`, {
      method: 'DELETE',
      headers: authorization === undefined ? {} : { authorization },
    });
  const leave = (authorization: string | undefined, tenantId: string, body: unknown = {}) =>
    app.request(`/v1/t/${tenantId}/leave`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(authorization === undefined ? {} : { authorization }),
      },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    });
  const createCommunity = (authorization: string, body: unknown) =>
    app.request('/v1/communities', {
      method: 'POST',
      headers: { authorization, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  const myCommunities = (authorization: string) =>
    app.request('/v1/me/communities', { headers: { authorization } });
  return { app, deps, list, change, remove, leave, createCommunity, myCommunities };
}

async function expectCode(res: Response, status: number, code: string) {
  expect(res.status).toBe(status);
  const body = ErrorResponse.parse(await res.json());
  expect(body.error.code).toBe(code);
  return body;
}

async function signedIn(
  deps: TestDeps,
  overrides: Partial<VerifiedIdentity> = {},
  { consent = true }: { consent?: boolean } = {},
) {
  const token = deps.auth.issue(identity(overrides));
  const authorization = `Bearer ${token}`;
  const app = createApp({ deps, version: 'test-1' });
  const res = await app.request('/v1/me', { headers: { authorization } });
  const { userId } = MeResponse.parse(await res.json());
  if (consent) {
    const accepted = await app.request('/v1/me/consent', {
      method: 'POST',
      headers: { authorization, 'content-type': 'application/json' },
      body: JSON.stringify({ version: CURRENT_CONSENT_VERSION }),
    });
    expect(accepted.status).toBe(200);
  }
  return { authorization, userId: userId as UserId };
}

const MASJID = { name: 'Masjid Al-Noor', timezone: 'Europe/Stockholm' };

async function ownedCommunity(deps: TestDeps, who: { authorization: string }) {
  const { createCommunity } = setup(deps);
  const res = await createCommunity(who.authorization, MASJID);
  expect(res.status).toBe(201);
  return CommunityResponse.parse(await res.json());
}

async function seedRole(deps: TestDeps, userId: UserId, tenantId: string, role: Role, at: string) {
  const tenant = asTenantId(tenantId);
  await deps.memberships.seed({
    id: membershipId(userId, tenant),
    tenantId: tenant,
    userId,
    role,
    createdAt: at,
    updatedAt: at,
    schemaVersion: MEMBERSHIP_SCHEMA_VERSION,
  });
}

describe('GET /v1/t/:tenantId/members', () => {
  it.each(['admin', 'owner'] as const)(
    'returns 200 and a contract-valid body for an %s',
    async (role) => {
      const { deps, list } = setup();
      const owner = await signedIn(deps, {
        subject: 'uid-owner',
        email: 'owner@example.com',
        name: 'Ada Owner',
      });
      const community = await ownedCommunity(deps, owner);
      const actor =
        role === 'owner'
          ? owner
          : await signedIn(deps, {
              subject: 'uid-admin',
              email: 'admin@example.com',
              name: 'Admin Ann',
            });
      if (role === 'admin') {
        await seedRole(deps, actor.userId, community.tenantId, 'admin', community.createdAt);
      }

      const res = await list(actor.authorization, community.tenantId);
      expect(res.status).toBe(200);
      const body = MembersResponse.parse(await res.json());
      expect(body.members.map((member) => member.userId)).toContain(actor.userId);
      expect(body.members.map((member) => member.userId)).toContain(owner.userId);
    },
  );

  it('returns 401 UNAUTHENTICATED without a token', async () => {
    const { list } = setup();
    await expectCode(await list(undefined, '01ARZ3NDEKTSV4RRFFQ69G5FAV'), 401, 'UNAUTHENTICATED');
  });

  it('returns 403 CONSENT_REQUIRED before consent', async () => {
    const { deps, list } = setup();
    const owner = await signedIn(deps, {}, { consent: false });
    await expectCode(
      await list(owner.authorization, '01ARZ3NDEKTSV4RRFFQ69G5FAV'),
      403,
      'CONSENT_REQUIRED',
    );
  });

  it.each(['member', 'editor', 'scholar-reviewer'] as const)(
    'returns 403 FORBIDDEN for a %s of this tenant',
    async (role) => {
      const { deps, list } = setup();
      const owner = await signedIn(deps, { subject: 'uid-owner', email: 'owner@example.com' });
      const person = await signedIn(deps, {
        subject: `uid-${role}`,
        email: `${role}@example.com`,
        name: 'Hidden Name',
      });
      const community = await ownedCommunity(deps, owner);
      await seedRole(deps, person.userId, community.tenantId, role, community.createdAt);

      const res = await list(person.authorization, community.tenantId);
      const body = await expectCode(res, 403, 'FORBIDDEN');
      expect(JSON.stringify(body)).not.toContain('Hidden Name');
      expect(body).not.toHaveProperty('members');
    },
  );

  it('returns 403 FORBIDDEN for an admin of another tenant and leaks no member fields', async () => {
    const { deps, list } = setup();
    const ownerA = await signedIn(deps, {
      subject: 'uid-a',
      email: 'a@example.com',
      name: 'Hidden Name',
    });
    const ownerB = await signedIn(deps, {
      subject: 'uid-b',
      email: 'b@example.com',
      name: 'Other Owner',
    });
    const adminA = await signedIn(deps, {
      subject: 'uid-admin',
      email: 'admin@example.com',
      name: 'Admin',
    });
    const communityA = await ownedCommunity(deps, ownerA);
    const communityB = await ownedCommunity(deps, ownerB);
    await seedRole(deps, adminA.userId, communityA.tenantId, 'admin', communityA.createdAt);

    const res = await list(adminA.authorization, communityB.tenantId);
    const text = await res.text();
    expect(res.status).toBe(403);
    const body = ErrorResponse.parse(JSON.parse(text));
    expect(body.error.code).toBe('FORBIDDEN');
    expect(text).not.toContain('Hidden Name');
    expect(text).not.toContain('members');
    expect(text).not.toContain('displayName');
  });

  it('returns 400 VALIDATION for a non-ULID tenant id', async () => {
    const { deps, list } = setup();
    const owner = await signedIn(deps);
    await expectCode(await list(owner.authorization, 'not-a-ulid'), 400, 'VALIDATION');
  });
});

describe('PATCH /v1/t/:tenantId/members/:userId', () => {
  it('lets an owner change an editor to scholar-reviewer and stores the clock time', async () => {
    const { deps, change } = setup();
    const owner = await signedIn(deps, {
      subject: 'uid-owner',
      email: 'owner@example.com',
      name: 'Ada',
    });
    const editor = await signedIn(deps, {
      subject: 'uid-editor',
      email: 'editor@example.com',
      name: 'Bea',
    });
    const community = await ownedCommunity(deps, owner);
    await seedRole(deps, editor.userId, community.tenantId, 'editor', community.createdAt);
    const seen: string[] = [];
    const original = deps.memberships.updateRole.bind(deps.memberships);
    deps.memberships.updateRole = async (tenantId, userId, role, updatedAt) => {
      seen.push(tenantId);
      return original(tenantId, userId, role, updatedAt);
    };
    deps.clock.set(NEXT);

    const res = await change(owner.authorization, community.tenantId, editor.userId, {
      role: 'scholar-reviewer',
    });
    expect(res.status).toBe(200);
    const text = await res.text();
    const body = MemberView.parse(JSON.parse(text));
    expect(body.role).toBe('scholar-reviewer');
    expect(body.displayName).toBe('Bea');
    expect(body.createdAt).toBe(community.createdAt);
    expect(text).not.toContain('updatedAt');
    expect(text).not.toContain('editor@example.com');
    const stored = await deps.memberships.get(asTenantId(community.tenantId), editor.userId);
    expect(stored?.role).toBe('scholar-reviewer');
    expect(stored?.updatedAt).toBe(NEXT);
    expect(stored?.createdAt).toBe(community.createdAt);
    expect(seen).toEqual([community.tenantId]);
  });

  it('returns 403 when an admin raises their own role to owner, and the role stays admin', async () => {
    const { deps, change } = setup();
    const owner = await signedIn(deps, { subject: 'uid-owner', email: 'owner@example.com' });
    const admin = await signedIn(deps, {
      subject: 'uid-admin',
      email: 'admin@example.com',
      name: 'Admin',
    });
    const community = await ownedCommunity(deps, owner);
    await seedRole(deps, admin.userId, community.tenantId, 'admin', community.createdAt);

    await expectCode(
      await change(admin.authorization, community.tenantId, admin.userId, { role: 'owner' }),
      403,
      'FORBIDDEN',
    );
    expect((await deps.memberships.get(asTenantId(community.tenantId), admin.userId))?.role).toBe(
      'admin',
    );
  });

  it('returns 403 when an admin assigns owner, and 200 when an owner does', async () => {
    const { deps, change } = setup();
    const owner = await signedIn(deps, {
      subject: 'uid-owner',
      email: 'owner@example.com',
      name: 'Ada',
    });
    const admin = await signedIn(deps, {
      subject: 'uid-admin',
      email: 'admin@example.com',
      name: 'Admin',
    });
    const member = await signedIn(deps, {
      subject: 'uid-member',
      email: 'member@example.com',
      name: 'Member',
    });
    const community = await ownedCommunity(deps, owner);
    await seedRole(deps, admin.userId, community.tenantId, 'admin', community.createdAt);
    await seedRole(deps, member.userId, community.tenantId, 'member', community.createdAt);

    await expectCode(
      await change(admin.authorization, community.tenantId, member.userId, { role: 'owner' }),
      403,
      'FORBIDDEN',
    );
    expect((await deps.memberships.get(asTenantId(community.tenantId), member.userId))?.role).toBe(
      'member',
    );

    const res = await change(owner.authorization, community.tenantId, member.userId, {
      role: 'owner',
    });
    expect(res.status).toBe(200);
    expect(MemberView.parse(await res.json()).role).toBe('owner');
  });

  it('returns 403 when an admin assigns admin to another admin', async () => {
    const { deps, change } = setup();
    const owner = await signedIn(deps, { subject: 'uid-owner', email: 'owner@example.com' });
    const admin = await signedIn(deps, { subject: 'uid-admin', email: 'admin@example.com' });
    const peer = await signedIn(deps, {
      subject: 'uid-peer',
      email: 'peer@example.com',
      name: 'Peer',
    });
    const community = await ownedCommunity(deps, owner);
    await seedRole(deps, admin.userId, community.tenantId, 'admin', community.createdAt);
    await seedRole(deps, peer.userId, community.tenantId, 'admin', community.createdAt);

    await expectCode(
      await change(admin.authorization, community.tenantId, peer.userId, { role: 'admin' }),
      403,
      'FORBIDDEN',
    );
    expect((await deps.memberships.get(asTenantId(community.tenantId), peer.userId))?.role).toBe(
      'admin',
    );
  });

  it('returns 401 without a token and 403 CONSENT_REQUIRED before consent', async () => {
    const { deps, change } = setup();
    await expectCode(
      await change(undefined, '01ARZ3NDEKTSV4RRFFQ69G5FAV', UNKNOWN, { role: 'member' }),
      401,
      'UNAUTHENTICATED',
    );
    const owner = await signedIn(deps, {}, { consent: false });
    await expectCode(
      await change(owner.authorization, '01ARZ3NDEKTSV4RRFFQ69G5FAV', UNKNOWN, { role: 'member' }),
      403,
      'CONSENT_REQUIRED',
    );
  });

  it.each(['member', 'editor', 'scholar-reviewer'] as const)(
    'returns 403 FORBIDDEN for a %s',
    async (role) => {
      const { deps, change } = setup();
      const owner = await signedIn(deps, { subject: 'uid-owner', email: 'owner@example.com' });
      const person = await signedIn(deps, { subject: `uid-${role}`, email: `${role}@example.com` });
      const community = await ownedCommunity(deps, owner);
      await seedRole(deps, person.userId, community.tenantId, role, community.createdAt);
      await expectCode(
        await change(person.authorization, community.tenantId, owner.userId, { role: 'member' }),
        403,
        'FORBIDDEN',
      );
    },
  );

  it('returns 403 for an admin of another tenant and leaves the target unchanged', async () => {
    const { deps, change } = setup();
    const ownerA = await signedIn(deps, { subject: 'uid-a', email: 'a@example.com' });
    const ownerB = await signedIn(deps, { subject: 'uid-b', email: 'b@example.com', name: 'Bee' });
    const adminA = await signedIn(deps, { subject: 'uid-admin', email: 'admin@example.com' });
    const communityA = await ownedCommunity(deps, ownerA);
    const communityB = await ownedCommunity(deps, ownerB);
    await seedRole(deps, adminA.userId, communityA.tenantId, 'admin', communityA.createdAt);
    const before = await deps.memberships.get(asTenantId(communityB.tenantId), ownerB.userId);

    await expectCode(
      await change(adminA.authorization, communityB.tenantId, ownerB.userId, { role: 'member' }),
      403,
      'FORBIDDEN',
    );
    expect(await deps.memberships.get(asTenantId(communityB.tenantId), ownerB.userId)).toEqual(
      before,
    );
  });

  it('returns 400 for a bad user id, bad JSON, an unknown role, and strict-object failures', async () => {
    const { deps, change } = setup();
    const owner = await signedIn(deps);
    const community = await ownedCommunity(deps, owner);
    await expectCode(
      await change(owner.authorization, community.tenantId, 'not-a-ulid', { role: 'member' }),
      400,
      'VALIDATION',
    );
    await expectCode(
      await change(owner.authorization, community.tenantId, owner.userId, 'not-json'),
      400,
      'VALIDATION',
    );
    await expectCode(
      await change(owner.authorization, community.tenantId, owner.userId, { role: 'superuser' }),
      400,
      'VALIDATION',
    );
    for (const body of [
      { userId: owner.userId },
      { tenantId: community.tenantId },
      { role: 'member', extra: true },
    ]) {
      await expectCode(
        await change(owner.authorization, community.tenantId, owner.userId, body),
        400,
        'VALIDATION',
      );
    }
  });

  it('returns 404 NOT_FOUND when the target has no membership in this tenant', async () => {
    const { deps, change } = setup();
    const owner = await signedIn(deps);
    const community = await ownedCommunity(deps, owner);
    await expectCode(
      await change(owner.authorization, community.tenantId, UNKNOWN, { role: 'member' }),
      404,
      'NOT_FOUND',
    );
  });

  it('returns 409 CONFLICT when the sole owner demotes themselves, and the role stays owner', async () => {
    const { deps, change } = setup();
    const owner = await signedIn(deps, {
      subject: 'uid-owner',
      email: 'owner@example.com',
      name: 'Ada',
    });
    const community = await ownedCommunity(deps, owner);

    await expectCode(
      await change(owner.authorization, community.tenantId, owner.userId, { role: 'member' }),
      409,
      'CONFLICT',
    );
    expect((await deps.memberships.get(asTenantId(community.tenantId), owner.userId))?.role).toBe(
      'owner',
    );
  });
});

describe('DELETE /v1/t/:tenantId/members/:userId', () => {
  it('lets an owner remove a member and returns an empty 204', async () => {
    const { deps, remove } = setup();
    const owner = await signedIn(deps, { subject: 'uid-owner', email: 'owner@example.com' });
    const member = await signedIn(deps, {
      subject: 'uid-member',
      email: 'member@example.com',
      name: 'Member',
    });
    const community = await ownedCommunity(deps, owner);
    await seedRole(deps, member.userId, community.tenantId, 'member', community.createdAt);

    const res = await remove(owner.authorization, community.tenantId, member.userId);
    expect(res.status).toBe(204);
    expect(await res.text()).toBe('');
    expect(await deps.memberships.get(asTenantId(community.tenantId), member.userId)).toBeNull();
  });

  it('returns 401 without a token and 403 CONSENT_REQUIRED before consent', async () => {
    const { deps, remove } = setup();
    await expectCode(
      await remove(undefined, '01ARZ3NDEKTSV4RRFFQ69G5FAV', UNKNOWN),
      401,
      'UNAUTHENTICATED',
    );
    const owner = await signedIn(deps, {}, { consent: false });
    await expectCode(
      await remove(owner.authorization, '01ARZ3NDEKTSV4RRFFQ69G5FAV', UNKNOWN),
      403,
      'CONSENT_REQUIRED',
    );
  });

  it.each(['member', 'editor', 'scholar-reviewer'] as const)(
    'returns 403 FORBIDDEN for a %s',
    async (role) => {
      const { deps, remove } = setup();
      const owner = await signedIn(deps, { subject: 'uid-owner', email: 'owner@example.com' });
      const person = await signedIn(deps, { subject: `uid-${role}`, email: `${role}@example.com` });
      const community = await ownedCommunity(deps, owner);
      await seedRole(deps, person.userId, community.tenantId, role, community.createdAt);
      await expectCode(
        await remove(person.authorization, community.tenantId, owner.userId),
        403,
        'FORBIDDEN',
      );
    },
  );

  it('returns 403 for the wrong tenant and leaves the target unchanged', async () => {
    const { deps, remove } = setup();
    const ownerA = await signedIn(deps, { subject: 'uid-a', email: 'a@example.com' });
    const ownerB = await signedIn(deps, { subject: 'uid-b', email: 'b@example.com' });
    const memberB = await signedIn(deps, {
      subject: 'uid-mb',
      email: 'mb@example.com',
      name: 'Member B',
    });
    const adminA = await signedIn(deps, { subject: 'uid-admin', email: 'admin@example.com' });
    const communityA = await ownedCommunity(deps, ownerA);
    const communityB = await ownedCommunity(deps, ownerB);
    await seedRole(deps, adminA.userId, communityA.tenantId, 'admin', communityA.createdAt);
    await seedRole(deps, memberB.userId, communityB.tenantId, 'member', communityB.createdAt);

    await expectCode(
      await remove(adminA.authorization, communityB.tenantId, memberB.userId),
      403,
      'FORBIDDEN',
    );
    expect(
      (await deps.memberships.get(asTenantId(communityB.tenantId), memberB.userId))?.role,
    ).toBe('member');
  });

  it('returns 404 for an unknown member, 400 for a non-ULID, and 403 when the target is the actor', async () => {
    const { deps, remove } = setup();
    const owner = await signedIn(deps);
    const community = await ownedCommunity(deps, owner);

    await expectCode(
      await remove(owner.authorization, community.tenantId, UNKNOWN),
      404,
      'NOT_FOUND',
    );
    await expectCode(
      await remove(owner.authorization, community.tenantId, 'not-a-ulid'),
      400,
      'VALIDATION',
    );
    await expectCode(
      await remove(owner.authorization, community.tenantId, owner.userId),
      403,
      'FORBIDDEN',
    );
    expect((await deps.memberships.get(asTenantId(community.tenantId), owner.userId))?.role).toBe(
      'owner',
    );
  });

  it('drops a removed member on the next request and reads a demotion again', async () => {
    const { deps, list, remove, leave, change, myCommunities } = setup();
    const owner = await signedIn(deps, {
      subject: 'uid-owner',
      email: 'owner@example.com',
      name: 'Ada',
    });
    const member = await signedIn(deps, {
      subject: 'uid-member',
      email: 'member@example.com',
      name: 'Member',
    });
    const admin = await signedIn(deps, {
      subject: 'uid-admin',
      email: 'admin@example.com',
      name: 'Admin',
    });
    const community = await ownedCommunity(deps, owner);
    await seedRole(deps, member.userId, community.tenantId, 'member', community.createdAt);
    await seedRole(deps, admin.userId, community.tenantId, 'admin', community.createdAt);

    const removed = await remove(owner.authorization, community.tenantId, member.userId);
    expect(removed.status).toBe(204);
    await expectCode(await leave(member.authorization, community.tenantId), 403, 'FORBIDDEN');
    await expectCode(await list(member.authorization, community.tenantId), 403, 'FORBIDDEN');
    expect(await deps.memberships.get(asTenantId(community.tenantId), member.userId)).toBeNull();
    const mine = await myCommunities(member.authorization);
    expect(mine.status).toBe(200);
    const listed = (await mine.json()) as { communities: { tenantId: string }[] };
    expect(listed.communities.map((item) => item.tenantId)).not.toContain(community.tenantId);

    const demoted = await change(owner.authorization, community.tenantId, admin.userId, {
      role: 'member',
    });
    expect(demoted.status).toBe(200);
    await expectCode(await list(admin.authorization, community.tenantId), 403, 'FORBIDDEN');
    const left = await leave(admin.authorization, community.tenantId);
    expect(left.status).toBe(204);
    expect(await left.text()).toBe('');
  });
});

describe('POST /v1/t/:tenantId/leave', () => {
  it('lets a member leave with an empty object and deletes that membership', async () => {
    const { deps, leave } = setup();
    const owner = await signedIn(deps, { subject: 'uid-owner', email: 'owner@example.com' });
    const member = await signedIn(deps, {
      subject: 'uid-member',
      email: 'member@example.com',
      name: 'Member',
    });
    const community = await ownedCommunity(deps, owner);
    await seedRole(deps, member.userId, community.tenantId, 'member', community.createdAt);

    const res = await leave(member.authorization, community.tenantId, {});
    expect(res.status).toBe(204);
    expect(await res.text()).toBe('');
    expect(await deps.memberships.get(asTenantId(community.tenantId), member.userId)).toBeNull();
    expect((await deps.memberships.get(asTenantId(community.tenantId), owner.userId))?.role).toBe(
      'owner',
    );
  });

  it('returns 401 without a token and 403 CONSENT_REQUIRED before consent', async () => {
    const { deps, leave } = setup();
    await expectCode(await leave(undefined, '01ARZ3NDEKTSV4RRFFQ69G5FAV'), 401, 'UNAUTHENTICATED');
    const owner = await signedIn(deps, {}, { consent: false });
    await expectCode(
      await leave(owner.authorization, '01ARZ3NDEKTSV4RRFFQ69G5FAV'),
      403,
      'CONSENT_REQUIRED',
    );
  });

  it('returns 403 for a user who is not a member', async () => {
    const { deps, leave } = setup();
    const owner = await signedIn(deps, { subject: 'uid-owner', email: 'owner@example.com' });
    const stranger = await signedIn(deps, {
      subject: 'uid-stranger',
      email: 'stranger@example.com',
    });
    const community = await ownedCommunity(deps, owner);
    await expectCode(await leave(stranger.authorization, community.tenantId), 403, 'FORBIDDEN');
    expect((await deps.memberships.get(asTenantId(community.tenantId), owner.userId))?.role).toBe(
      'owner',
    );
  });

  it('returns 403 for a member of another tenant and keeps this tenant’s membership', async () => {
    const { deps, leave } = setup();
    const ownerA = await signedIn(deps, { subject: 'uid-a', email: 'a@example.com' });
    const ownerB = await signedIn(deps, { subject: 'uid-b', email: 'b@example.com' });
    const memberA = await signedIn(deps, {
      subject: 'uid-ma',
      email: 'ma@example.com',
      name: 'Member A',
    });
    const communityA = await ownedCommunity(deps, ownerA);
    const communityB = await ownedCommunity(deps, ownerB);
    await seedRole(deps, memberA.userId, communityA.tenantId, 'member', communityA.createdAt);

    await expectCode(await leave(memberA.authorization, communityB.tenantId), 403, 'FORBIDDEN');
    expect(
      (await deps.memberships.get(asTenantId(communityA.tenantId), memberA.userId))?.role,
    ).toBe('member');
    expect((await deps.memberships.get(asTenantId(communityB.tenantId), ownerB.userId))?.role).toBe(
      'owner',
    );
  });

  it('returns 400 when the body is not a strict empty object', async () => {
    const { deps, leave } = setup();
    const owner = await signedIn(deps);
    const community = await ownedCommunity(deps, owner);
    await expectCode(
      await leave(owner.authorization, community.tenantId, { role: 'member' }),
      400,
      'VALIDATION',
    );
  });

  it('returns 409 for the sole owner, then 204 once a second owner exists, and the next list is 403', async () => {
    const { deps, leave, list } = setup();
    const owner = await signedIn(deps, {
      subject: 'uid-owner',
      email: 'owner@example.com',
      name: 'Ada',
    });
    const second = await signedIn(deps, {
      subject: 'uid-second',
      email: 'second@example.com',
      name: 'Second',
    });
    const community = await ownedCommunity(deps, owner);

    await expectCode(await leave(owner.authorization, community.tenantId), 409, 'CONFLICT');
    expect((await deps.memberships.get(asTenantId(community.tenantId), owner.userId))?.role).toBe(
      'owner',
    );

    await seedRole(deps, second.userId, community.tenantId, 'owner', community.createdAt);
    const res = await leave(owner.authorization, community.tenantId);
    expect(res.status).toBe(204);
    await expectCode(await list(owner.authorization, community.tenantId), 403, 'FORBIDDEN');
    expect(await deps.memberships.get(asTenantId(community.tenantId), owner.userId)).toBeNull();
    expect((await deps.memberships.get(asTenantId(community.tenantId), second.userId))?.role).toBe(
      'owner',
    );
  });
});
