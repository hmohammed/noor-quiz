import { describe, expect, it } from 'vitest';
import {
  asTenantId,
  asUserId,
  CURRENT_CONSENT_VERSION,
  membershipId,
  MEMBERSHIP_SCHEMA_VERSION,
  type UserId,
  type VerifiedIdentity,
} from '@noor/core';
import {
  CommunityResponse,
  ErrorResponse,
  MeResponse,
  MyCommunitiesResponse,
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
  const post = (authorization: string | undefined, body: unknown, raw = false) =>
    app.request('/v1/communities', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(authorization === undefined ? {} : { authorization }),
      },
      body: raw ? (body as string) : JSON.stringify(body),
    });
  const list = (authorization?: string) =>
    app.request(
      '/v1/me/communities',
      authorization === undefined ? {} : { headers: { authorization } },
    );
  const deleteMe = (authorization: string) =>
    app.request('/v1/me', { method: 'DELETE', headers: { authorization } });
  return { app, deps, post, list, deleteMe };
}

async function expectCode(res: Response, status: number, code: string) {
  expect(res.status).toBe(status);
  expect(ErrorResponse.parse(await res.json()).error.code).toBe(code);
}

/**
 * Signs a user in (creating them) and accepts the current consent unless `consent` is
 * false. Returns the bearer header and the stored user id.
 */
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

describe('POST /v1/communities', () => {
  it('returns 201 with role owner, and a second call with the same name ends in -2', async () => {
    const { deps, post } = setup();
    const { authorization } = await signedIn(deps);

    const firstRes = await post(authorization, MASJID);
    expect(firstRes.status).toBe(201);
    const first = CommunityResponse.parse(await firstRes.json());
    expect(first.role).toBe('owner');
    expect(first.name).toBe('Masjid Al-Noor');
    expect(first.slug).toBe('masjid-al-noor');
    expect(first.timezone).toBe('Europe/Stockholm');

    const secondRes = await post(authorization, {
      name: '  Masjid   Al-Noor ',
      timezone: 'europe/stockholm',
    });
    expect(secondRes.status).toBe(201);
    const second = CommunityResponse.parse(await secondRes.json());
    expect(second.role).toBe('owner');
    expect(second.slug).toBe('masjid-al-noor-2');
    expect(second.tenantId).not.toBe(first.tenantId);
  });

  it.each([
    ['a role key', { ...MASJID, role: 'owner' }],
    ['a tenantId key', { ...MASJID, tenantId: '01ARZ3NDEKTSV4RRFFQ69G5FAV' }],
    ['a slug key', { ...MASJID, slug: 'masjid' }],
    ['a createdBy key', { ...MASJID, createdBy: '01ARZ3NDEKTSV4RRFFQ69G5FAV' }],
    ['a one-character name', { name: 'A', timezone: 'Europe/Stockholm' }],
    ['an emoji name', { name: 'Masjid 😀', timezone: 'Europe/Stockholm' }],
    ['a name that starts with a digit', { name: '123 Mosque', timezone: 'Europe/Stockholm' }],
    ['a bad timezone', { name: 'Masjid Al-Noor', timezone: 'Mars/Olympus' }],
    ['an offset timezone', { name: 'Masjid Al-Noor', timezone: '+01:00' }],
  ])('returns 400 VALIDATION for %s', async (_label, body) => {
    const { deps, post } = setup();
    const { authorization } = await signedIn(deps);
    await expectCode(await post(authorization, body), 400, 'VALIDATION');
  });

  it('returns 400 VALIDATION for invalid JSON', async () => {
    const { deps, post } = setup();
    const { authorization } = await signedIn(deps);
    await expectCode(await post(authorization, '{', true), 400, 'VALIDATION');
  });

  it('returns 400 VALIDATION for a body over 4096 bytes', async () => {
    const { deps, post } = setup();
    const { authorization } = await signedIn(deps);
    const body = JSON.stringify({ name: 'A'.repeat(5000), timezone: 'Europe/Stockholm' });
    expect(Buffer.byteLength(body)).toBeGreaterThan(4096);
    await expectCode(await post(authorization, body, true), 400, 'VALIDATION');
  });

  it('returns 401 UNAUTHENTICATED without a token', async () => {
    const { post } = setup();
    await expectCode(await post(undefined, MASJID), 401, 'UNAUTHENTICATED');
  });

  it('returns 403 CONSENT_REQUIRED when consent is missing', async () => {
    const { deps, post } = setup();
    const { authorization } = await signedIn(deps, {}, { consent: false });
    await expectCode(await post(authorization, MASJID), 403, 'CONSENT_REQUIRED');
  });

  it('returns 403 CONSENT_REQUIRED when consent is stale', async () => {
    const { deps, post } = setup();
    const { authorization, userId } = await signedIn(deps);
    await deps.users.recordConsent(
      userId,
      { version: '2000-01-01', acceptedAt: '2020-01-01T00:00:00.000Z' },
      '2020-01-01T00:00:00.000Z',
    );
    await expectCode(await post(authorization, MASJID), 403, 'CONSENT_REQUIRED');
  });
});

describe('GET /v1/me/communities', () => {
  it('returns only the caller’s communities, an empty list for someone else, and no private fields', async () => {
    const { deps, post, list } = setup();
    const alice = await signedIn(deps, { subject: 'uid-alice', email: 'alice@example.com' });
    const bob = await signedIn(deps, { subject: 'uid-bob', email: 'bob@example.com', name: 'Bob' });
    const cara = await signedIn(deps, {
      subject: 'uid-cara',
      email: 'cara@example.com',
      name: 'Cara',
    });

    const created = CommunityResponse.parse(await (await post(alice.authorization, MASJID)).json());
    await post(bob.authorization, { name: 'School Noor', timezone: 'Africa/Addis_Ababa' });

    const aliceRes = await list(alice.authorization);
    expect(aliceRes.status).toBe(200);
    const aliceText = await aliceRes.text();
    const aliceBody = MyCommunitiesResponse.parse(JSON.parse(aliceText));
    expect(aliceBody.communities).toHaveLength(1);
    expect(aliceBody.communities[0]).toMatchObject({
      tenantId: created.tenantId,
      name: 'Masjid Al-Noor',
      role: 'owner',
    });
    expect(aliceText).not.toContain('createdBy');
    expect(aliceText).not.toContain('schemaVersion');
    expect(aliceText).not.toContain('updatedAt');
    expect(aliceText).not.toContain('uid-alice');
    expect(aliceText).not.toContain('alice@example.com');
    expect(aliceText).not.toContain('communitySlugs');

    const bobBody = MyCommunitiesResponse.parse(await (await list(bob.authorization)).json());
    expect(bobBody.communities.map((c) => c.name)).toEqual(['School Noor']);
    expect(bobBody.communities.some((c) => c.tenantId === created.tenantId)).toBe(false);

    const caraBody = MyCommunitiesResponse.parse(await (await list(cara.authorization)).json());
    expect(caraBody.communities).toEqual([]);
  });

  it('returns 401 UNAUTHENTICATED without a token', async () => {
    const { list } = setup();
    await expectCode(await list(), 401, 'UNAUTHENTICATED');
  });

  it('returns 403 CONSENT_REQUIRED without consent', async () => {
    const { deps, list } = setup();
    const { authorization } = await signedIn(deps, {}, { consent: false });
    await expectCode(await list(authorization), 403, 'CONSENT_REQUIRED');
  });
});

describe('DELETE /v1/me removes memberships and leaves the community', () => {
  it('gives the same identity a new user id and an empty community list, and keeps the other member', async () => {
    const { deps, post, list, deleteMe } = setup();
    const alice = await signedIn(deps, { subject: 'uid-alice' });
    const bob = await signedIn(deps, { subject: 'uid-bob', name: 'Bob', email: 'bob@example.com' });
    const created = CommunityResponse.parse(await (await post(alice.authorization, MASJID)).json());
    const tenantId = asTenantId(created.tenantId);
    await deps.memberships.seed({
      id: membershipId(bob.userId, tenantId),
      tenantId,
      userId: bob.userId,
      role: 'member',
      createdAt: created.createdAt,
      updatedAt: created.createdAt,
      schemaVersion: MEMBERSHIP_SCHEMA_VERSION,
    });
    const bobBefore = await deps.memberships.get(tenantId, bob.userId);

    const deleted = await deleteMe(alice.authorization);
    expect(deleted.status).toBe(204);

    const me = await createApp({ deps, version: 'test-1' }).request('/v1/me', {
      headers: { authorization: alice.authorization },
    });
    const again = MeResponse.parse(await me.json());
    expect(again.userId).not.toBe(alice.userId);

    // The new account has not accepted consent yet. Accept it, then the list is empty.
    const accepted = await createApp({ deps, version: 'test-1' }).request('/v1/me/consent', {
      method: 'POST',
      headers: { authorization: alice.authorization, 'content-type': 'application/json' },
      body: JSON.stringify({ version: CURRENT_CONSENT_VERSION }),
    });
    expect(accepted.status).toBe(200);

    const mine = MyCommunitiesResponse.parse(await (await list(alice.authorization)).json());
    expect(mine.communities).toEqual([]);
    expect(await deps.communities.getById(tenantId)).toMatchObject({
      name: 'Masjid Al-Noor',
      slug: created.slug,
    });
    expect(deps.communities.storedSlug(created.slug)).toMatchObject({
      tenantId,
      slug: created.slug,
    });
    expect(await deps.memberships.get(tenantId, asUserId(alice.userId))).toBeNull();
    expect(await deps.memberships.get(tenantId, bob.userId)).toEqual(bobBefore);
  });
});
