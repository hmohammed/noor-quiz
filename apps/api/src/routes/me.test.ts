import { describe, expect, it } from 'vitest';
import {
  DomainError,
  isUlid,
  type Identity,
  type ProfilePatch,
  type User,
  type UserId,
  type VerifiedIdentity,
} from '@noor/core';
import { ErrorResponse, HealthResponse, MeResponse } from '@noor/contracts';
import { InMemoryUserRepo, makeTestDeps, type TestDeps } from '@noor/testkit';
import { createApp } from '../app';

const SENTINEL_SUBJECT = 'SENTINELuid0123456789abcdef';
const SENTINEL_EMAIL = 'sentinel@leak.test';

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
  const getMe = (authorization?: string) =>
    app.request('/v1/me', authorization === undefined ? {} : { headers: { authorization } });
  const patchMe = (authorization: string | undefined, body: unknown, raw = false) =>
    app.request('/v1/me', {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        ...(authorization === undefined ? {} : { authorization }),
      },
      body: raw ? (body as string) : JSON.stringify(body),
    });
  return { app, deps, getMe, patchMe };
}

async function expect400(res: Response): Promise<void> {
  expect(res.status).toBe(400);
  expect(ErrorResponse.parse(await res.json()).error.code).toBe('VALIDATION');
}

/** Signs a user in once (creating them) and returns their bearer header and stored user. */
async function signedIn(deps: TestDeps, overrides: Partial<VerifiedIdentity> = {}) {
  const token = deps.auth.issue(identity(overrides));
  const authorization = `Bearer ${token}`;
  const app = createApp({ deps, version: 'test-1' });
  const res = await app.request('/v1/me', { headers: { authorization } });
  const { userId } = MeResponse.parse(await res.json());
  const stored = (await deps.users.getById(userId as UserId))!;
  return { authorization, userId, stored };
}

async function expect401(res: Response): Promise<string> {
  expect(res.status).toBe(401);
  expect(res.headers.get('content-type')).toContain('application/json');
  const text = await res.text();
  expect(ErrorResponse.parse(JSON.parse(text)).error.code).toBe('UNAUTHENTICATED');
  return text;
}

/** Leaks provider data on every returned user, to prove the route never spreads a user. */
class LeakyUserRepo extends InMemoryUserRepo {
  override async getByIdentity(...args: Parameters<InMemoryUserRepo['getByIdentity']>) {
    const user = await super.getByIdentity(...args);
    return user ? this.#leak(user) : null;
  }

  override async createWithIdentity(user: User, linked: Identity) {
    return this.#leak(await super.createWithIdentity(user, linked));
  }

  override async updateProfile(userId: UserId, patch: ProfilePatch, updatedAt: string) {
    return this.#leak(await super.updateProfile(userId, patch, updatedAt));
  }

  #leak(user: User): User {
    return { ...user, subject: SENTINEL_SUBJECT, email: SENTINEL_EMAIL } as User;
  }
}

describe('GET /v1/me', () => {
  it('returns 200 with our userId and the normalised displayName for a valid token', async () => {
    const { deps, getMe } = setup();
    const token = deps.auth.issue(identity({ name: '  Alice\u0007 ' }));

    const res = await getMe(`Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/json');
    const body = MeResponse.parse(await res.json());
    expect(isUlid(body.userId)).toBe(true);
    const stored = await deps.users.getByIdentity({ provider: 'firebase', subject: 'uid-alice' });
    expect(body).toEqual({ userId: stored?.id, displayName: 'Alice', locale: null, timezone: null });
  });

  it('returns the same userId for repeated and concurrent requests of one identity', async () => {
    const { deps, getMe } = setup();
    const token = deps.auth.issue(identity());

    const first = MeResponse.parse(await (await getMe(`Bearer ${token}`)).json());
    const again = MeResponse.parse(await (await getMe(`Bearer ${token}`)).json());
    const concurrent = await Promise.all(
      Array.from({ length: 5 }, async () =>
        MeResponse.parse(await (await getMe(`Bearer ${token}`)).json()),
      ),
    );

    const ids = new Set([first, again, ...concurrent].map((b) => b.userId));
    expect(ids.size).toBe(1);
    expect(deps.users.counts()).toEqual({ users: 1, identities: 1 });
  });

  it.each([
    ['null', null],
    ['1 char', 'A'],
  ])('returns displayName null when the token name is %s', async (_label, name) => {
    const { deps, getMe } = setup();
    const token = deps.auth.issue(identity({ name }));

    const res = await getMe(`Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(MeResponse.parse(await res.json()).displayName).toBeNull();
  });

  it.each(['bearer', 'BEARER'])('accepts the scheme %s (case-insensitive)', async (scheme) => {
    const { deps, getMe } = setup();
    const token = deps.auth.issue(identity());

    const res = await getMe(`${scheme} ${token}`);

    expect(res.status).toBe(200);
    MeResponse.parse(await res.json());
  });

  describe('401 for a missing or malformed Authorization header, without verifying', () => {
    const headerCases: [string, string | undefined][] = [
      ['no Authorization header', undefined],
      ['a Basic scheme', 'Basic abc'],
      ['Bearer with no token', 'Bearer'],
      ['Bearer with an empty token', 'Bearer '],
      ['two tokens', 'Bearer a b'],
      ['no space after Bearer', 'Bearertoken'],
      ['a token longer than 4096 chars', `Bearer ${'a'.repeat(4097)}`],
    ];

    it.each(headerCases)('%s', async (_label, header) => {
      const { deps, getMe } = setup();
      deps.auth.issue(identity());

      await expect401(await getMe(header));

      expect(deps.auth.verifyCalls).toBe(0);
      expect(deps.users.counts()).toEqual({ users: 0, identities: 0 });
    });
  });

  it('accepts a token of exactly 4096 chars as far as the verifier', async () => {
    const { deps, getMe } = setup();

    await expect401(await getMe(`Bearer ${'a'.repeat(4096)}`));

    expect(deps.auth.verifyCalls).toBe(1);
  });

  it('returns 401 for an unknown token and creates no user', async () => {
    const { deps, getMe } = setup();

    await expect401(await getMe('Bearer fake-token-999'));

    expect(deps.auth.verifyCalls).toBe(1);
    expect(deps.users.counts()).toEqual({ users: 0, identities: 0 });
  });

  it('returns 401 for a token the verifier rejects and creates no user', async () => {
    const { deps, getMe } = setup();
    const token = deps.auth.issue(identity());
    deps.auth.reject(token);

    await expect401(await getMe(`Bearer ${token}`));

    expect(deps.auth.verifyCalls).toBe(1);
    expect(deps.users.counts()).toEqual({ users: 0, identities: 0 });
  });

  it('returns 401 when the verified subject is not a safe identity subject', async () => {
    const { deps, getMe } = setup();
    const token = deps.auth.issue(identity({ subject: 'a/b' }));

    await expect401(await getMe(`Bearer ${token}`));

    expect(deps.users.counts()).toEqual({ users: 0, identities: 0 });
  });

  it('never puts the provider uid or email in a 200 or 401 body', async () => {
    const { deps, getMe } = setup();
    const token = deps.auth.issue(
      identity({ subject: SENTINEL_SUBJECT, email: SENTINEL_EMAIL, name: 'Sentinel' }),
    );

    const ok = await getMe(`Bearer ${token}`);
    const okText = await ok.text();
    expect(ok.status).toBe(200);
    expect(okText).not.toContain(SENTINEL_SUBJECT);
    expect(okText).not.toContain(SENTINEL_EMAIL);

    deps.auth.reject(token);
    const deniedText = await expect401(await getMe(`Bearer ${token}`));
    expect(deniedText).not.toContain(SENTINEL_SUBJECT);
    expect(deniedText).not.toContain(token);
  });

  it('GET and PATCH return exactly userId, displayName, locale, timezone even if the repo leaks keys', async () => {
    const { deps, getMe, patchMe } = setup(makeTestDeps({ users: new LeakyUserRepo() }));
    const token = deps.auth.issue(identity());

    const res = await getMe(`Bearer ${token}`);
    const patched = await patchMe(`Bearer ${token}`, { displayName: 'Åsa' });

    for (const r of [res, patched]) {
      const text = await r.text();
      expect(r.status).toBe(200);
      expect(Object.keys(JSON.parse(text)).sort()).toEqual([
        'displayName',
        'locale',
        'timezone',
        'userId',
      ]);
      expect(text).not.toContain(SENTINEL_SUBJECT);
      expect(text).not.toContain(SENTINEL_EMAIL);
    }
  });

  it('returns 404 for POST /v1/me', async () => {
    const { deps, app } = setup();
    const token = deps.auth.issue(identity());

    const res = await app.request('/v1/me', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.status).toBe(404);
  });

  it('does not make requireUser global: GET /v1/health with no token still returns 200', async () => {
    const { app, deps } = setup();

    const res = await app.request('/v1/health');

    expect(res.status).toBe(200);
    HealthResponse.parse(await res.json());
    expect(deps.auth.verifyCalls).toBe(0);
  });
});

describe('PATCH /v1/me', () => {
  it.each(['ሀሰን', 'حسن', 'Åsa'])(
    'returns 200 with displayName %s and a later GET returns it',
    async (displayName) => {
      const { deps, getMe, patchMe } = setup();
      const { authorization, userId } = await signedIn(deps);

      const res = await patchMe(authorization, { displayName });

      expect(res.status).toBe(200);
      expect(MeResponse.parse(await res.json())).toEqual({
        userId,
        displayName,
        locale: null,
        timezone: null,
      });
      expect(MeResponse.parse(await (await getMe(authorization)).json()).displayName).toBe(
        displayName,
      );
    },
  );

  it('takes updatedAt from the clock', async () => {
    const { deps, patchMe } = setup();
    const { authorization, userId } = await signedIn(deps);
    deps.clock.advance({ hours: 2 });

    await patchMe(authorization, { locale: 'sv' });

    expect((await deps.users.getById(userId as UserId))?.updatedAt).toBe(
      '2026-01-01T02:00:00.000Z',
    );
  });

  it('sets locale and timezone together', async () => {
    const { deps, patchMe } = setup();
    const { authorization } = await signedIn(deps);

    const res = await patchMe(authorization, { locale: 'am', timezone: 'Africa/Addis_Ababa' });

    expect(res.status).toBe(200);
    expect(MeResponse.parse(await res.json())).toMatchObject({
      displayName: 'Alice',
      locale: 'am',
      timezone: 'Africa/Addis_Ababa',
    });
  });

  it('stores and returns a timezone in canonical casing', async () => {
    const { deps, patchMe } = setup();
    const { authorization, userId } = await signedIn(deps);

    const res = await patchMe(authorization, { timezone: 'europe/stockholm' });

    expect(MeResponse.parse(await res.json()).timezone).toBe('Europe/Stockholm');
    expect((await deps.users.getById(userId as UserId))?.timezone).toBe('Europe/Stockholm');
  });

  describe('400 VALIDATION and nothing written', () => {
    const cases: [string, unknown, boolean?][] = [
      ['an empty name', { displayName: '' }],
      ['an emoji-only name', { displayName: '😀😀' }],
      ['a 33-code-point name', { displayName: 'ሀ'.repeat(33) }],
      ['timezone Mars/Olympus', { timezone: 'Mars/Olympus' }],
      ['timezone +01:00', { timezone: '+01:00' }],
      ['locale fr', { locale: 'fr' }],
      ['a non-JSON body', '{not json', true],
      ['a JSON array', ['Åsa']],
      ['an empty patch', {}],
      ['a userId key', { userId: '01ARZ3NDEKTSV4RRFFQ69G5FAW' }],
      ['a role next to a valid name', { displayName: 'Åsa', role: 'admin' }],
      ['displayName null', { displayName: null }],
      ['a body over 4 KB', { displayName: 'Åsa', pad: 'x'.repeat(5000) }],
    ];

    it.each(cases)('%s', async (_label, body, raw) => {
      const { deps, patchMe } = setup();
      const { authorization, userId, stored } = await signedIn(deps);
      deps.clock.advance({ hours: 1 });

      await expect400(await patchMe(authorization, body, raw ?? false));

      expect(await deps.users.getById(userId as UserId)).toStrictEqual(stored);
    });

    it('a body over 4 KB is rejected before the token is verified', async () => {
      const { deps, patchMe } = setup();
      const { authorization } = await signedIn(deps);
      const before = deps.auth.verifyCalls;

      await expect400(await patchMe(authorization, { pad: 'x'.repeat(5000) }));

      expect(deps.auth.verifyCalls).toBe(before);
    });
  });

  describe('401 UNAUTHENTICATED and nothing created or changed', () => {
    it.each([
      ['no Authorization header', undefined],
      ['a Basic scheme', 'Basic abc'],
    ])('%s', async (_label, header) => {
      const { deps, patchMe } = setup();

      await expect401(await patchMe(header, { displayName: 'Åsa' }));

      expect(deps.auth.verifyCalls).toBe(0);
      expect(deps.users.counts()).toEqual({ users: 0, identities: 0 });
    });

    it('a token the verifier rejects', async () => {
      const { deps, patchMe } = setup();
      const { authorization, userId, stored } = await signedIn(deps);
      deps.auth.reject(authorization.slice('Bearer '.length));

      await expect401(await patchMe(authorization, { displayName: 'Åsa' }));

      expect(await deps.users.getById(userId as UserId)).toStrictEqual(stored);
      expect(deps.users.counts()).toEqual({ users: 1, identities: 1 });
    });
  });

  it("user A's token changes only user A; user B is unchanged", async () => {
    const { deps, patchMe } = setup();
    const a = await signedIn(deps, { subject: 'uid-alice', name: 'Alice' });
    const b = await signedIn(deps, { subject: 'uid-bob', name: 'Bob' });

    const res = await patchMe(a.authorization, { displayName: 'Åsa', locale: 'sv' });

    expect(res.status).toBe(200);
    expect(MeResponse.parse(await res.json()).userId).toBe(a.userId);
    expect((await deps.users.getById(a.userId as UserId))?.displayName).toBe('Åsa');
    expect(JSON.stringify(await deps.users.getById(b.userId as UserId))).toBe(
      JSON.stringify(b.stored),
    );
  });

  it('returns 404 when the user vanished between auth and update', async () => {
    class VanishingRepo extends InMemoryUserRepo {
      override async updateProfile(): Promise<User> {
        throw new DomainError('NOT_FOUND', { reason: 'gone' });
      }
    }
    const { deps, patchMe } = setup(makeTestDeps({ users: new VanishingRepo() }));
    const token = deps.auth.issue(identity());

    const res = await patchMe(`Bearer ${token}`, { displayName: 'Åsa' });

    expect(res.status).toBe(404);
    expect(ErrorResponse.parse(await res.json()).error.code).toBe('NOT_FOUND');
  });
});
