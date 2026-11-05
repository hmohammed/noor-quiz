import { describe, expect, it } from 'vitest';
import {
  asTenantId,
  asUserId,
  CURRENT_CONSENT_VERSION,
  MEMBERSHIP_SCHEMA_VERSION,
  membershipId,
  type Role,
  type UserId,
  type VerifiedIdentity,
} from '@noor/core';
import {
  CommunityResponse,
  CreateInviteResponse,
  ErrorResponse,
  InvitePreviewResponse,
  MeResponse,
} from '@noor/contracts';
import { makeTestDeps, type TestDeps } from '@noor/testkit';
import { createApp } from '../app';

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
  const create = (authorization: string | undefined, tenantId: string, body: unknown) =>
    app.request(`/v1/t/${tenantId}/invites`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(authorization === undefined ? {} : { authorization }),
      },
      body: JSON.stringify(body),
    });
  const preview = (token: string, authorization?: string) =>
    app.request(`/v1/invites/${token}`, {
      headers: authorization === undefined ? {} : { authorization },
    });
  const accept = (authorization: string | undefined, token: string, body: unknown = {}) =>
    app.request(`/v1/invites/${token}/accept`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(authorization === undefined ? {} : { authorization }),
      },
      body: JSON.stringify(body),
    });
  const createCommunity = (authorization: string, body: unknown) =>
    app.request('/v1/communities', {
      method: 'POST',
      headers: { authorization, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  return { app, deps, create, preview, accept, createCommunity };
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

async function ownedCommunity(deps: TestDeps, who: { authorization: string; userId: UserId }) {
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

describe('POST /v1/t/:tenantId/invites', () => {
  it('returns 201 and a strict body with only token, expiresAt and maxUses', async () => {
    const { deps, create } = setup();
    const owner = await signedIn(deps);
    const community = await ownedCommunity(deps, owner);

    const res = await create(owner.authorization, community.tenantId, {});
    expect(res.status).toBe(201);
    const text = await res.text();
    const body = CreateInviteResponse.parse(JSON.parse(text));
    expect(body.maxUses).toBe(25);
    expect(body.token).toMatch(/^[0-7][0-9A-HJKMNP-TV-Z]{25}$/);
    expect(text).not.toContain('createdBy');
    expect(text).not.toContain('"uses"');
    expect(text).not.toContain('tenantId');
    expect(text).not.toContain('slug');
    expect(text).not.toContain('role');
    const stored = await deps.invites.getByToken(body.token);
    expect(stored).toMatchObject({
      id: body.token,
      tenantId: community.tenantId,
      createdBy: owner.userId,
      maxUses: 25,
      uses: 0,
    });
  });

  it('returns 401 UNAUTHENTICATED without a token', async () => {
    const { create } = setup();
    await expectCode(
      await create(undefined, '01ARZ3NDEKTSV4RRFFQ69G5FAV', {}),
      401,
      'UNAUTHENTICATED',
    );
  });

  it('returns 403 CONSENT_REQUIRED without the current consent', async () => {
    const { deps, create } = setup();
    const owner = await signedIn(deps, {}, { consent: false });
    await expectCode(
      await create(owner.authorization, '01ARZ3NDEKTSV4RRFFQ69G5FAV', {}),
      403,
      'CONSENT_REQUIRED',
    );
  });

  it.each(['member', 'editor'] as const)(
    'returns 403 FORBIDDEN for a %s of that tenant',
    async (role) => {
      const { deps, create } = setup();
      const owner = await signedIn(deps, { subject: 'uid-owner', email: 'owner@example.com' });
      const person = await signedIn(deps, {
        subject: `uid-${role}`,
        email: `${role}@example.com`,
        name: 'Member',
      });
      const community = await ownedCommunity(deps, owner);
      await seedRole(deps, person.userId, community.tenantId, role, community.createdAt);
      await expectCode(
        await create(person.authorization, community.tenantId, {}),
        403,
        'FORBIDDEN',
      );
      expect(deps.invites.count()).toBe(0);
    },
  );

  it('returns 403 FORBIDDEN for an admin of a different tenant and stores no invite', async () => {
    const { deps, create } = setup();
    const ownerA = await signedIn(deps, { subject: 'uid-a', email: 'a@example.com' });
    const ownerB = await signedIn(deps, { subject: 'uid-b', email: 'b@example.com', name: 'B' });
    const adminA = await signedIn(deps, {
      subject: 'uid-admin',
      email: 'admin@example.com',
      name: 'Admin',
    });
    const communityA = await ownedCommunity(deps, ownerA);
    const communityB = await ownedCommunity(deps, ownerB);
    await seedRole(deps, adminA.userId, communityA.tenantId, 'admin', communityA.createdAt);

    await expectCode(await create(adminA.authorization, communityB.tenantId, {}), 403, 'FORBIDDEN');
    expect(deps.invites.count()).toBe(0);
    expect(
      await deps.memberships.get(asTenantId(communityA.tenantId), adminA.userId),
    ).toMatchObject({
      role: 'admin',
    });
  });

  it.each([
    ['a role', { role: 'owner' }],
    ['an expiresAt', { expiresAt: '2026-04-01T00:00:00.000Z' }],
    ['maxUses 0', { maxUses: 0 }],
    ['an unknown key', { note: 'hello' }],
  ])('returns 400 VALIDATION for %s', async (_label, body) => {
    const { deps, create } = setup();
    const owner = await signedIn(deps);
    const community = await ownedCommunity(deps, owner);
    await expectCode(
      await create(owner.authorization, community.tenantId, body),
      400,
      'VALIDATION',
    );
    expect(deps.invites.count()).toBe(0);
  });

  it('returns 400 VALIDATION for a non-ULID tenant id', async () => {
    const { deps, create } = setup();
    const owner = await signedIn(deps);
    await expectCode(await create(owner.authorization, 'not-a-tenant', {}), 400, 'VALIDATION');
    expect(deps.invites.count()).toBe(0);
  });
});

describe('GET /v1/invites/:token', () => {
  it('returns exactly { name } with no Authorization and for a member of another tenant', async () => {
    const { deps, create, preview } = setup();
    const owner = await signedIn(deps, { subject: 'uid-owner', email: 'owner@example.com' });
    const other = await signedIn(deps, {
      subject: 'uid-other',
      email: 'other@example.com',
      name: 'Other',
    });
    const community = await ownedCommunity(deps, owner);
    await ownedCommunity(deps, other);
    const created = CreateInviteResponse.parse(
      await (await create(owner.authorization, community.tenantId, {})).json(),
    );

    const open = await preview(created.token);
    expect(open.status).toBe(200);
    const openText = await open.text();
    expect(InvitePreviewResponse.parse(JSON.parse(openText))).toEqual({ name: 'Masjid Al-Noor' });
    expect(openText).not.toContain('slug');
    expect(openText).not.toContain('tenantId');
    expect(openText).not.toContain(owner.userId);

    const member = await preview(created.token, other.authorization);
    expect(member.status).toBe(200);
    expect(InvitePreviewResponse.parse(await member.json())).toEqual({ name: 'Masjid Al-Noor' });
  });

  it('returns 404 NOT_FOUND for an unknown token and the body has no name', async () => {
    const { preview } = setup();
    const res = await preview('01ARZ3NDEKTSV4RRFFQ69G5FB2');
    const text = await res.text();
    expect(res.status).toBe(404);
    expect(ErrorResponse.parse(JSON.parse(text)).error.code).toBe('NOT_FOUND');
    expect(text).not.toContain('Masjid');
  });

  it('returns 410 GONE for an expired token and a used-up token, with no name', async () => {
    const { deps, create, preview, accept } = setup();
    const owner = await signedIn(deps, { subject: 'uid-owner', email: 'owner@example.com' });
    const joiner = await signedIn(deps, {
      subject: 'uid-join',
      email: 'join@example.com',
      name: 'Joiner',
    });
    const community = await ownedCommunity(deps, owner);

    const expired = CreateInviteResponse.parse(
      await (await create(owner.authorization, community.tenantId, {})).json(),
    );
    deps.clock.advance({ days: 7 });
    const expiredRes = await preview(expired.token);
    const expiredText = await expiredRes.text();
    expect(expiredRes.status).toBe(410);
    expect(ErrorResponse.parse(JSON.parse(expiredText)).error).toEqual({
      code: 'GONE',
      message: 'Gone',
    });
    expect(expiredText).not.toContain('Masjid');
    expect(expiredText).not.toContain('details');

    const used = CreateInviteResponse.parse(
      await (await create(owner.authorization, community.tenantId, { maxUses: 1 })).json(),
    );
    expect((await accept(joiner.authorization, used.token, {})).status).toBe(201);
    const usedRes = await preview(used.token);
    const usedText = await usedRes.text();
    expect(usedRes.status).toBe(410);
    expect(ErrorResponse.parse(JSON.parse(usedText)).error.code).toBe('GONE');
    expect(usedText).not.toContain('Masjid');
  });

  it('returns 400 VALIDATION for a malformed token', async () => {
    const { preview } = setup();
    await expectCode(await preview('not-a-token'), 400, 'VALIDATION');
  });
});

describe('POST /v1/invites/:token/accept', () => {
  it('returns 201 then 200 for the same user, one membership, and uses 1', async () => {
    const { deps, create, accept } = setup();
    const owner = await signedIn(deps, { subject: 'uid-owner', email: 'owner@example.com' });
    const joiner = await signedIn(deps, {
      subject: 'uid-join',
      email: 'join@example.com',
      name: 'Joiner',
    });
    const community = await ownedCommunity(deps, owner);
    const invite = CreateInviteResponse.parse(
      await (await create(owner.authorization, community.tenantId, { maxUses: 1 })).json(),
    );

    const first = await accept(joiner.authorization, invite.token, {});
    expect(first.status).toBe(201);
    const firstBody = CommunityResponse.parse(await first.json());
    expect(firstBody.role).toBe('member');
    expect(firstBody.tenantId).toBe(community.tenantId);
    expect(firstBody.name).toBe('Masjid Al-Noor');

    const second = await accept(joiner.authorization, invite.token, {});
    expect(second.status).toBe(200);
    expect(CommunityResponse.parse(await second.json())).toMatchObject({
      role: 'member',
      tenantId: community.tenantId,
      name: 'Masjid Al-Noor',
    });

    const memberships = await deps.memberships.listByUser(joiner.userId);
    expect(memberships).toHaveLength(1);
    expect(memberships[0]?.role).toBe('member');
    expect((await deps.invites.getByToken(invite.token))?.uses).toBe(1);
  });

  it('returns 410 GONE for a new user when the token is expired or used up', async () => {
    const { deps, create, accept } = setup();
    const owner = await signedIn(deps, { subject: 'uid-owner', email: 'owner@example.com' });
    const first = await signedIn(deps, {
      subject: 'uid-first',
      email: 'first@example.com',
      name: 'First',
    });
    const late = await signedIn(deps, {
      subject: 'uid-late',
      email: 'late@example.com',
      name: 'Late',
    });
    const community = await ownedCommunity(deps, owner);

    const expired = CreateInviteResponse.parse(
      await (await create(owner.authorization, community.tenantId, { expiresInDays: 1 })).json(),
    );
    deps.clock.advance({ days: 1 });
    const expiredRes = await accept(late.authorization, expired.token, {});
    const expiredText = await expiredRes.text();
    expect(expiredRes.status).toBe(410);
    expect(ErrorResponse.parse(JSON.parse(expiredText)).error.code).toBe('GONE');
    expect(await deps.memberships.get(asTenantId(community.tenantId), late.userId)).toBeNull();

    const used = CreateInviteResponse.parse(
      await (await create(owner.authorization, community.tenantId, { maxUses: 1 })).json(),
    );
    expect((await accept(first.authorization, used.token, {})).status).toBe(201);
    await expectCode(await accept(late.authorization, used.token, {}), 410, 'GONE');
    expect(await deps.memberships.listByUser(late.userId)).toEqual([]);
  });

  it('returns 401 UNAUTHENTICATED without a token', async () => {
    const { accept } = setup();
    await expectCode(
      await accept(undefined, '01ARZ3NDEKTSV4RRFFQ69G5FAV', {}),
      401,
      'UNAUTHENTICATED',
    );
  });

  it('returns 403 CONSENT_REQUIRED without current consent', async () => {
    const { deps, create, accept } = setup();
    const owner = await signedIn(deps, { subject: 'uid-owner', email: 'owner@example.com' });
    const joiner = await signedIn(
      deps,
      { subject: 'uid-join', email: 'join@example.com' },
      { consent: false },
    );
    const community = await ownedCommunity(deps, owner);
    const invite = CreateInviteResponse.parse(
      await (await create(owner.authorization, community.tenantId, {})).json(),
    );
    await expectCode(await accept(joiner.authorization, invite.token, {}), 403, 'CONSENT_REQUIRED');
    expect(await deps.memberships.get(asTenantId(community.tenantId), joiner.userId)).toBeNull();
  });

  it('adds member in B and leaves the A membership unchanged', async () => {
    const { deps, create, accept } = setup();
    const ownerA = await signedIn(deps, { subject: 'uid-a', email: 'a@example.com' });
    const ownerB = await signedIn(deps, { subject: 'uid-b', email: 'b@example.com', name: 'Bee' });
    const member = await signedIn(deps, { subject: 'uid-m', email: 'm@example.com', name: 'Em' });
    const communityA = await ownedCommunity(deps, ownerA);
    const communityB = CommunityResponse.parse(
      await (
        await setup(deps).createCommunity(ownerB.authorization, {
          name: 'School Noor',
          timezone: 'Africa/Addis_Ababa',
        })
      ).json(),
    );
    await seedRole(deps, member.userId, communityA.tenantId, 'member', communityA.createdAt);
    const before = await deps.memberships.get(asTenantId(communityA.tenantId), member.userId);
    const invite = CreateInviteResponse.parse(
      await (await create(ownerB.authorization, communityB.tenantId, {})).json(),
    );

    const res = await accept(member.authorization, invite.token, {});
    expect(res.status).toBe(201);
    expect(CommunityResponse.parse(await res.json())).toMatchObject({
      tenantId: communityB.tenantId,
      name: 'School Noor',
      role: 'member',
    });
    expect(await deps.memberships.get(asTenantId(communityA.tenantId), member.userId)).toEqual(
      before,
    );
    expect(
      await deps.memberships.get(asTenantId(communityB.tenantId), asUserId(member.userId)),
    ).toMatchObject({ role: 'member' });
    expect(
      await deps.memberships.get(asTenantId(communityA.tenantId), ownerA.userId),
    ).toMatchObject({
      role: 'owner',
    });
  });

  it('returns 400 VALIDATION for a role body and does not create a membership', async () => {
    const { deps, create, accept } = setup();
    const owner = await signedIn(deps, { subject: 'uid-owner', email: 'owner@example.com' });
    const joiner = await signedIn(deps, {
      subject: 'uid-join',
      email: 'join@example.com',
      name: 'Joiner',
    });
    const community = await ownedCommunity(deps, owner);
    const invite = CreateInviteResponse.parse(
      await (await create(owner.authorization, community.tenantId, {})).json(),
    );
    const before = deps.invites.count();
    await expectCode(
      await accept(joiner.authorization, invite.token, { role: 'owner' }),
      400,
      'VALIDATION',
    );
    expect(await deps.memberships.get(asTenantId(community.tenantId), joiner.userId)).toBeNull();
    expect((await deps.invites.getByToken(invite.token))?.uses).toBe(0);
    expect(deps.invites.count()).toBe(before);
  });
});
