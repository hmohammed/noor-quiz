import { describe, expect, it } from 'vitest';
import {
  asSeasonId,
  asTenantId,
  CURRENT_CONSENT_VERSION,
  membershipId,
  MEMBERSHIP_SCHEMA_VERSION,
  questionWindow,
  type Role,
  type UserId,
  type VerifiedIdentity,
} from '@noor/core';
import {
  CommunityResponse,
  ErrorResponse,
  MeResponse,
  RamadanSuggestionResponse,
  SeasonListResponse,
  SeasonView,
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

const SEASON = {
  name: 'Ramadan 1448',
  kind: 'ramadan',
  startDate: '2035-01-01',
  lengthDays: 30,
  timezone: 'Europe/Stockholm',
  opensAtLocal: '08:00',
  closesAtLocal: '21:00',
};

const OPEN_SEASON = {
  ...SEASON,
  startDate: '2026-02-18',
  opensAtLocal: '04:00',
  closesAtLocal: '20:00',
};

function setup(deps: TestDeps = makeTestDeps()) {
  const app = createApp({ deps, version: 'test-1' });
  const send = (method: string, path: string, authorization?: string, body?: unknown) =>
    app.request(path, {
      method,
      headers: {
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
        ...(authorization === undefined ? {} : { authorization }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  return { app, deps, send };
}

async function expectCode(res: Response, status: number, code: string) {
  expect(res.status).toBe(status);
  expect(ErrorResponse.parse(await res.json()).error.code).toBe(code);
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

async function createCommunity(deps: TestDeps, authorization: string, name = 'Masjid Al-Noor') {
  const app = createApp({ deps, version: 'test-1' });
  const res = await app.request('/v1/communities', {
    method: 'POST',
    headers: { authorization, 'content-type': 'application/json' },
    body: JSON.stringify({ name, timezone: 'Europe/Stockholm' }),
  });
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

describe('POST /v1/t/:tenantId/seasons', () => {
  it('returns 201 for an owner and GET lists that season with its state', async () => {
    const { deps, send } = setup();
    const owner = await signedIn(deps);
    const community = await createCommunity(deps, owner.authorization);

    const createdRes = await send(
      'POST',
      `/v1/t/${community.tenantId}/seasons`,
      owner.authorization,
      SEASON,
    );
    expect(createdRes.status).toBe(201);
    const createdText = await createdRes.text();
    const created = SeasonView.parse(JSON.parse(createdText));
    expect(created).toMatchObject({
      ...SEASON,
      state: { phase: 'upcoming' },
      tenantId: community.tenantId,
    });
    expect(createdText).not.toContain('createdBy');
    expect(createdText).not.toContain('schemaVersion');

    const listedRes = await send('GET', `/v1/t/${community.tenantId}/seasons`, owner.authorization);
    expect(listedRes.status).toBe(200);
    const listed = SeasonListResponse.parse(await listedRes.json());
    expect(listed.seasons).toEqual([created]);
  });

  it.each(['editor', 'member', 'scholar-reviewer'] as const)(
    'returns 403 FORBIDDEN for a %s',
    async (role) => {
      const { deps, send } = setup();
      const owner = await signedIn(deps);
      const other = await signedIn(deps, {
        subject: `uid-${role}`,
        email: `${role}@example.com`,
        name: 'Other',
      });
      const community = await createCommunity(deps, owner.authorization);
      await seedRole(deps, other.userId, community.tenantId, role, community.createdAt);
      await expectCode(
        await send('POST', `/v1/t/${community.tenantId}/seasons`, other.authorization, SEASON),
        403,
        'FORBIDDEN',
      );
    },
  );

  it('returns 401 UNAUTHENTICATED without a token', async () => {
    const { deps, send } = setup();
    const owner = await signedIn(deps);
    const community = await createCommunity(deps, owner.authorization);
    await expectCode(
      await send('POST', `/v1/t/${community.tenantId}/seasons`, undefined, SEASON),
      401,
      'UNAUTHENTICATED',
    );
  });

  it('returns 403 FORBIDDEN for an admin of another tenant', async () => {
    const { deps, send } = setup();
    const alice = await signedIn(deps);
    const bob = await signedIn(deps, { subject: 'uid-bob', email: 'bob@example.com', name: 'Bob' });
    const aliceCommunity = await createCommunity(deps, alice.authorization);
    await createCommunity(deps, bob.authorization, 'Bob School');
    await expectCode(
      await send('POST', `/v1/t/${aliceCommunity.tenantId}/seasons`, bob.authorization, SEASON),
      403,
      'FORBIDDEN',
    );
  });

  it('returns 403 CONSENT_REQUIRED when consent is missing', async () => {
    const { deps, send } = setup();
    const owner = await signedIn(deps);
    const community = await createCommunity(deps, owner.authorization);
    await deps.users.recordConsent(
      owner.userId,
      { version: '2000-01-01', acceptedAt: '2020-01-01T00:00:00.000Z' },
      '2020-01-01T00:00:00.000Z',
    );
    await expectCode(
      await send('POST', `/v1/t/${community.tenantId}/seasons`, owner.authorization, SEASON),
      403,
      'CONSENT_REQUIRED',
    );
  });

  it.each([
    ['an invalid date', { ...SEASON, startDate: '2026-02-30' }],
    ['a non-integer length', { ...SEASON, lengthDays: 1.5 }],
    ['a bad local time', { ...SEASON, opensAtLocal: '4:00' }],
    ['a tenantId key', { ...SEASON, tenantId: '01ARZ3NDEKTSV4RRFFQ69G5FAV' }],
    ['a role key', { ...SEASON, role: 'owner' }],
    ['a hijriYear key', { ...SEASON, hijriYear: 1448 }],
  ])('returns 400 VALIDATION for %s', async (_label, body) => {
    const { deps, send } = setup();
    const owner = await signedIn(deps);
    const community = await createCommunity(deps, owner.authorization);
    await expectCode(
      await send('POST', `/v1/t/${community.tenantId}/seasons`, owner.authorization, body),
      400,
      'VALIDATION',
    );
  });
});

describe('PATCH /v1/t/:tenantId/seasons/:seasonId', () => {
  it('returns 200 with the new start date and length before day 1 opens', async () => {
    const { deps, send } = setup();
    const owner = await signedIn(deps);
    const community = await createCommunity(deps, owner.authorization);
    const created = SeasonView.parse(
      await (
        await send('POST', `/v1/t/${community.tenantId}/seasons`, owner.authorization, SEASON)
      ).json(),
    );

    const res = await send(
      'PATCH',
      `/v1/t/${community.tenantId}/seasons/${created.id}`,
      owner.authorization,
      { startDate: '2035-02-01', lengthDays: 10 },
    );
    expect(res.status).toBe(200);
    const patched = SeasonView.parse(await res.json());
    expect(patched.startDate).toBe('2035-02-01');
    expect(patched.lengthDays).toBe(10);
    expect(patched.id).toBe(created.id);
  });

  it('returns 409 CLOSED when startDate changes after the season has started', async () => {
    const { deps, send } = setup();
    const owner = await signedIn(deps);
    const community = await createCommunity(deps, owner.authorization);
    const created = SeasonView.parse(
      await (
        await send('POST', `/v1/t/${community.tenantId}/seasons`, owner.authorization, OPEN_SEASON)
      ).json(),
    );
    deps.clock.set(
      questionWindow(
        {
          startDate: OPEN_SEASON.startDate,
          lengthDays: OPEN_SEASON.lengthDays,
          timezone: OPEN_SEASON.timezone,
          opensAtLocal: OPEN_SEASON.opensAtLocal,
          closesAtLocal: OPEN_SEASON.closesAtLocal,
        },
        1,
      ).opensAt,
    );

    await expectCode(
      await send(
        'PATCH',
        `/v1/t/${community.tenantId}/seasons/${created.id}`,
        owner.authorization,
        {
          startDate: '2035-01-01',
        },
      ),
      409,
      'CLOSED',
    );
    expect(
      (await deps.seasons.get(asTenantId(community.tenantId), asSeasonId(created.id)))?.startDate,
    ).toBe('2026-02-18');
  });

  it('returns 409 CLOSED when lengthDays changes after the season has started', async () => {
    const { deps, send } = setup();
    const owner = await signedIn(deps);
    const community = await createCommunity(deps, owner.authorization);
    const created = SeasonView.parse(
      await (
        await send('POST', `/v1/t/${community.tenantId}/seasons`, owner.authorization, OPEN_SEASON)
      ).json(),
    );
    deps.clock.set('2026-02-18T03:00:00.000Z');

    await expectCode(
      await send(
        'PATCH',
        `/v1/t/${community.tenantId}/seasons/${created.id}`,
        owner.authorization,
        {
          lengthDays: 10,
        },
      ),
      409,
      'CLOSED',
    );
    expect(
      (await deps.seasons.get(asTenantId(community.tenantId), asSeasonId(created.id)))?.lengthDays,
    ).toBe(30);
  });

  it('returns 200 when closesAtLocal changes after the season has started', async () => {
    const { deps, send } = setup();
    const owner = await signedIn(deps);
    const community = await createCommunity(deps, owner.authorization);
    const created = SeasonView.parse(
      await (
        await send('POST', `/v1/t/${community.tenantId}/seasons`, owner.authorization, OPEN_SEASON)
      ).json(),
    );
    deps.clock.set('2026-02-18T03:00:00.000Z');

    const res = await send(
      'PATCH',
      `/v1/t/${community.tenantId}/seasons/${created.id}`,
      owner.authorization,
      { closesAtLocal: '22:00' },
    );
    expect(res.status).toBe(200);
    const patched = SeasonView.parse(await res.json());
    expect(patched.closesAtLocal).toBe('22:00');
    expect(patched.startDate).toBe(OPEN_SEASON.startDate);
    expect(patched.lengthDays).toBe(OPEN_SEASON.lengthDays);
  });

  it.each(['editor', 'member'] as const)('returns 403 FORBIDDEN for a %s', async (role) => {
    const { deps, send } = setup();
    const owner = await signedIn(deps);
    const other = await signedIn(deps, {
      subject: `uid-${role}`,
      email: `${role}@example.com`,
      name: 'Other',
    });
    const community = await createCommunity(deps, owner.authorization);
    await seedRole(deps, other.userId, community.tenantId, role, community.createdAt);
    const created = SeasonView.parse(
      await (
        await send('POST', `/v1/t/${community.tenantId}/seasons`, owner.authorization, SEASON)
      ).json(),
    );
    await expectCode(
      await send(
        'PATCH',
        `/v1/t/${community.tenantId}/seasons/${created.id}`,
        other.authorization,
        {
          name: 'Nope',
        },
      ),
      403,
      'FORBIDDEN',
    );
  });

  it('returns 401 UNAUTHENTICATED without a token', async () => {
    const { deps, send } = setup();
    const owner = await signedIn(deps);
    const community = await createCommunity(deps, owner.authorization);
    const created = SeasonView.parse(
      await (
        await send('POST', `/v1/t/${community.tenantId}/seasons`, owner.authorization, SEASON)
      ).json(),
    );
    await expectCode(
      await send('PATCH', `/v1/t/${community.tenantId}/seasons/${created.id}`, undefined, {
        name: 'Nope',
      }),
      401,
      'UNAUTHENTICATED',
    );
  });

  it('returns 403 FORBIDDEN for an admin of another tenant', async () => {
    const { deps, send } = setup();
    const alice = await signedIn(deps);
    const bob = await signedIn(deps, { subject: 'uid-bob', email: 'bob@example.com', name: 'Bob' });
    const aliceCommunity = await createCommunity(deps, alice.authorization);
    await createCommunity(deps, bob.authorization, 'Bob School');
    const created = SeasonView.parse(
      await (
        await send('POST', `/v1/t/${aliceCommunity.tenantId}/seasons`, alice.authorization, SEASON)
      ).json(),
    );
    await expectCode(
      await send(
        'PATCH',
        `/v1/t/${aliceCommunity.tenantId}/seasons/${created.id}`,
        bob.authorization,
        { name: 'Stolen' },
      ),
      403,
      'FORBIDDEN',
    );
  });

  it('returns 404 NOT_FOUND for a season id that belongs to another tenant', async () => {
    const { deps, send } = setup();
    const alice = await signedIn(deps);
    const bob = await signedIn(deps, { subject: 'uid-bob', email: 'bob@example.com', name: 'Bob' });
    const aliceCommunity = await createCommunity(deps, alice.authorization);
    const bobCommunity = await createCommunity(deps, bob.authorization, 'Bob School');
    const created = SeasonView.parse(
      await (
        await send('POST', `/v1/t/${aliceCommunity.tenantId}/seasons`, alice.authorization, SEASON)
      ).json(),
    );
    const before = await deps.seasons.get(
      asTenantId(aliceCommunity.tenantId),
      asSeasonId(created.id),
    );

    await expectCode(
      await send(
        'PATCH',
        `/v1/t/${bobCommunity.tenantId}/seasons/${created.id}`,
        bob.authorization,
        {
          name: 'Stolen',
        },
      ),
      404,
      'NOT_FOUND',
    );
    expect(
      await deps.seasons.get(asTenantId(aliceCommunity.tenantId), asSeasonId(created.id)),
    ).toEqual(before);
  });
});

describe('GET /v1/t/:tenantId/seasons', () => {
  it('returns 200 for a member, including an empty list', async () => {
    const { deps, send } = setup();
    const owner = await signedIn(deps);
    const member = await signedIn(deps, {
      subject: 'uid-member',
      email: 'm@example.com',
      name: 'Mina',
    });
    const community = await createCommunity(deps, owner.authorization);
    await seedRole(deps, member.userId, community.tenantId, 'member', community.createdAt);

    const empty = await send('GET', `/v1/t/${community.tenantId}/seasons`, member.authorization);
    expect(empty.status).toBe(200);
    expect(SeasonListResponse.parse(await empty.json())).toEqual({ seasons: [] });
  });

  it('returns 401 UNAUTHENTICATED without a token', async () => {
    const { deps, send } = setup();
    const owner = await signedIn(deps);
    const community = await createCommunity(deps, owner.authorization);
    await expectCode(
      await send('GET', `/v1/t/${community.tenantId}/seasons`),
      401,
      'UNAUTHENTICATED',
    );
  });

  it('returns 403 FORBIDDEN for a member of another tenant', async () => {
    const { deps, send } = setup();
    const alice = await signedIn(deps);
    const bob = await signedIn(deps, { subject: 'uid-bob', email: 'bob@example.com', name: 'Bob' });
    const aliceCommunity = await createCommunity(deps, alice.authorization);
    await createCommunity(deps, bob.authorization, 'Bob School');
    await expectCode(
      await send('GET', `/v1/t/${aliceCommunity.tenantId}/seasons`, bob.authorization),
      403,
      'FORBIDDEN',
    );
  });
});

describe('GET /v1/t/:tenantId/seasons/ramadan-suggestion', () => {
  it('returns an advisory suggestion and does not create a season; a later POST keeps the submitted dates', async () => {
    const { deps, send } = setup();
    const admin = await signedIn(deps, {
      subject: 'uid-admin',
      email: 'admin@example.com',
      name: 'Ada',
    });
    const owner = await signedIn(deps);
    const community = await createCommunity(deps, owner.authorization);
    await seedRole(deps, admin.userId, community.tenantId, 'admin', community.createdAt);
    const path = `/v1/t/${community.tenantId}/seasons/ramadan-suggestion?timezone=Europe%2FStockholm`;

    const res = await send('GET', path, admin.authorization);
    expect(res.status).toBe(200);
    const suggestion = RamadanSuggestionResponse.parse(await res.json());
    expect(suggestion.advisory).toBe(true);
    expect(await deps.seasons.list(asTenantId(community.tenantId))).toEqual([]);

    const submitted = { ...SEASON, startDate: '2035-01-01', lengthDays: 29 };
    expect(submitted.startDate).not.toBe(suggestion.startDate);
    const created = await send(
      'POST',
      `/v1/t/${community.tenantId}/seasons`,
      admin.authorization,
      submitted,
    );
    expect(created.status).toBe(201);
    const listed = SeasonListResponse.parse(
      await (await send('GET', `/v1/t/${community.tenantId}/seasons`, admin.authorization)).json(),
    );
    expect(listed.seasons.map((season) => season.startDate)).toEqual(['2035-01-01']);
    expect(listed.seasons.map((season) => season.lengthDays)).toEqual([29]);
  });

  it.each(['editor', 'member'] as const)('returns 403 FORBIDDEN for a %s', async (role) => {
    const { deps, send } = setup();
    const owner = await signedIn(deps);
    const other = await signedIn(deps, {
      subject: `uid-${role}`,
      email: `${role}@example.com`,
      name: 'Other',
    });
    const community = await createCommunity(deps, owner.authorization);
    await seedRole(deps, other.userId, community.tenantId, role, community.createdAt);
    await expectCode(
      await send(
        'GET',
        `/v1/t/${community.tenantId}/seasons/ramadan-suggestion?timezone=Europe%2FStockholm`,
        other.authorization,
      ),
      403,
      'FORBIDDEN',
    );
  });

  it('returns 401 UNAUTHENTICATED without a token', async () => {
    const { deps, send } = setup();
    const owner = await signedIn(deps);
    const community = await createCommunity(deps, owner.authorization);
    await expectCode(
      await send(
        'GET',
        `/v1/t/${community.tenantId}/seasons/ramadan-suggestion?timezone=Europe%2FStockholm`,
      ),
      401,
      'UNAUTHENTICATED',
    );
  });

  it('returns 403 FORBIDDEN for an admin of another tenant', async () => {
    const { deps, send } = setup();
    const alice = await signedIn(deps);
    const bob = await signedIn(deps, { subject: 'uid-bob', email: 'bob@example.com', name: 'Bob' });
    const aliceCommunity = await createCommunity(deps, alice.authorization);
    await createCommunity(deps, bob.authorization, 'Bob School');
    await expectCode(
      await send(
        'GET',
        `/v1/t/${aliceCommunity.tenantId}/seasons/ramadan-suggestion?timezone=Europe%2FStockholm`,
        bob.authorization,
      ),
      403,
      'FORBIDDEN',
    );
  });

  it.each([
    ['missing', ''],
    ['not an IANA zone', '?timezone=Mars%2FOlympus'],
    ['an offset', '?timezone=%2B01%3A00'],
  ])('returns 400 VALIDATION when timezone is %s', async (_label, query) => {
    const { deps, send } = setup();
    const owner = await signedIn(deps);
    const community = await createCommunity(deps, owner.authorization);
    await expectCode(
      await send(
        'GET',
        `/v1/t/${community.tenantId}/seasons/ramadan-suggestion${query}`,
        owner.authorization,
      ),
      400,
      'VALIDATION',
    );
  });
});
