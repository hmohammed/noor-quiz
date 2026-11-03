import { describe, expect, it } from 'vitest';
import {
  CURRENT_CONSENT_VERSION,
  DomainError,
  isUlid,
  type Consent,
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
  const postConsent = (authorization: string | undefined, body: unknown, raw = false) =>
    app.request('/v1/me/consent', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(authorization === undefined ? {} : { authorization }),
      },
      body: raw ? (body as string) : JSON.stringify(body),
    });
  const deleteMe = (authorization?: string, body?: unknown) =>
    app.request('/v1/me', {
      method: 'DELETE',
      headers: {
        ...(authorization === undefined ? {} : { authorization }),
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  return { app, deps, getMe, patchMe, postConsent, deleteMe };
}

async function expect400(res: Response): Promise<void> {
  expect(res.status).toBe(400);
  expect(ErrorResponse.parse(await res.json()).error.code).toBe('VALIDATION');
}

async function expect403Consent(res: Response): Promise<void> {
  expect(res.status).toBe(403);
  expect(ErrorResponse.parse(await res.json()).error.code).toBe('CONSENT_REQUIRED');
}

const CONSENT_REQUIRED = {
  currentVersion: CURRENT_CONSENT_VERSION,
  acceptedVersion: null,
  required: true,
};
const CONSENT_GIVEN = {
  currentVersion: CURRENT_CONSENT_VERSION,
  acceptedVersion: CURRENT_CONSENT_VERSION,
  required: false,
};

/**
 * Signs a user in once (creating them), accepts the current consent through
 * `POST /v1/me/consent` unless `consent: false`, and returns their bearer header and
 * stored user.
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

/** Counts writes so a repeated DELETE can prove it created and deleted nothing. */
class SpyUserRepo extends InMemoryUserRepo {
  creates = 0;
  deletes = 0;

  override async createWithIdentity(user: User, linked: Identity) {
    this.creates += 1;
    return super.createWithIdentity(user, linked);
  }

  override async deleteUserAndIdentities(userId: UserId) {
    this.deletes += 1;
    return super.deleteUserAndIdentities(userId);
  }
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

  override async getById(userId: UserId) {
    const user = await super.getById(userId);
    return user ? this.#leak(user) : null;
  }

  override async recordConsent(userId: UserId, consent: Consent, updatedAt: string) {
    return this.#leak(await super.recordConsent(userId, consent, updatedAt));
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
    expect(body).toEqual({
      userId: stored?.id,
      displayName: 'Alice',
      locale: null,
      timezone: null,
      consent: CONSENT_REQUIRED,
    });
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

  it('GET, POST consent and PATCH return only the contract keys even if the repo leaks keys', async () => {
    const { deps, getMe, patchMe, postConsent } = setup(
      makeTestDeps({ users: new LeakyUserRepo() }),
    );
    const token = deps.auth.issue(identity());
    const authorization = `Bearer ${token}`;

    const res = await getMe(authorization);
    deps.clock.advance({ hours: 7, minutes: 13 });
    const accepted = await postConsent(authorization, { version: CURRENT_CONSENT_VERSION });
    const patched = await patchMe(authorization, { displayName: 'Åsa' });
    const { userId } = MeResponse.parse(await res.clone().json());
    const acceptedAt = '2026-01-01T07:13:00.000Z';
    expect((await deps.users.getById(userId as UserId))?.consent?.acceptedAt).toBe(acceptedAt);

    for (const r of [res, accepted, patched]) {
      const text = await r.text();
      expect(r.status).toBe(200);
      const body = JSON.parse(text) as { consent: Record<string, unknown> };
      expect(Object.keys(body).sort()).toEqual([
        'consent',
        'displayName',
        'locale',
        'timezone',
        'userId',
      ]);
      expect(Object.keys(body.consent).sort()).toEqual([
        'acceptedVersion',
        'currentVersion',
        'required',
      ]);
      expect(text).not.toContain('acceptedAt');
      expect(text).not.toContain(acceptedAt);
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
        consent: CONSENT_GIVEN,
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
    const { authorization } = await signedIn(deps);

    const res = await patchMe(authorization, { displayName: 'Åsa' });

    expect(res.status).toBe(404);
    expect(ErrorResponse.parse(await res.json()).error.code).toBe('NOT_FOUND');
  });

  describe('403 CONSENT_REQUIRED and nothing changed', () => {
    it('for a new user who has not accepted', async () => {
      const { deps, patchMe } = setup();
      const { authorization, userId, stored } = await signedIn(deps, {}, { consent: false });

      await expect403Consent(await patchMe(authorization, { displayName: 'Åsa' }));

      expect(await deps.users.getById(userId as UserId)).toStrictEqual(stored);
    });

    it('for a user who accepted an older version', async () => {
      const { deps, patchMe } = setup();
      const { authorization, userId } = await signedIn(deps, {}, { consent: false });
      const at = '2025-01-01T00:00:00.000Z';
      await deps.users.recordConsent(
        userId as UserId,
        { version: '2000-01-01', acceptedAt: at },
        at,
      );
      const stored = await deps.users.getById(userId as UserId);

      await expect403Consent(await patchMe(authorization, { displayName: 'Åsa' }));

      expect(await deps.users.getById(userId as UserId)).toStrictEqual(stored);
    });
  });

  it('returns 200 after POST /v1/me/consent for the same user', async () => {
    const { deps, patchMe, postConsent } = setup();
    const { authorization } = await signedIn(deps, {}, { consent: false });
    await expect403Consent(await patchMe(authorization, { displayName: 'Åsa' }));

    expect((await postConsent(authorization, { version: CURRENT_CONSENT_VERSION })).status).toBe(
      200,
    );
    const res = await patchMe(authorization, { displayName: 'Åsa' });

    expect(res.status).toBe(200);
    expect(MeResponse.parse(await res.json()).displayName).toBe('Åsa');
  });
});

describe('POST /v1/me/consent', () => {
  it('records the current version and a later GET reports required: false', async () => {
    const { deps, getMe, postConsent } = setup();
    const { authorization, userId } = await signedIn(deps, {}, { consent: false });
    deps.clock.advance({ hours: 3 });

    const res = await postConsent(authorization, { version: CURRENT_CONSENT_VERSION });

    expect(res.status).toBe(200);
    expect(MeResponse.parse(await res.json())).toEqual({
      userId,
      displayName: 'Alice',
      locale: null,
      timezone: null,
      consent: CONSENT_GIVEN,
    });
    expect(MeResponse.parse(await (await getMe(authorization)).json()).consent).toEqual(
      CONSENT_GIVEN,
    );
    expect((await deps.users.getById(userId as UserId))?.consent).toStrictEqual({
      version: CURRENT_CONSENT_VERSION,
      acceptedAt: '2026-01-01T03:00:00.000Z',
    });
  });

  it('a second accept returns 200 and keeps the first acceptedAt', async () => {
    const { deps, postConsent } = setup();
    const { authorization, userId } = await signedIn(deps, {}, { consent: false });
    await postConsent(authorization, { version: CURRENT_CONSENT_VERSION });
    deps.clock.advance({ hours: 1 });

    const res = await postConsent(authorization, { version: CURRENT_CONSENT_VERSION });

    expect(res.status).toBe(200);
    expect(MeResponse.parse(await res.json()).consent).toEqual(CONSENT_GIVEN);
    expect((await deps.users.getById(userId as UserId))?.consent?.acceptedAt).toBe(
      '2026-01-01T00:00:00.000Z',
    );
  });

  describe('401 UNAUTHENTICATED and nothing created or changed', () => {
    it('no Authorization header', async () => {
      const { deps, postConsent } = setup();

      await expect401(await postConsent(undefined, { version: CURRENT_CONSENT_VERSION }));

      expect(deps.auth.verifyCalls).toBe(0);
      expect(deps.users.counts()).toEqual({ users: 0, identities: 0 });
    });

    it('a token the verifier rejects', async () => {
      const { deps, postConsent } = setup();
      const { authorization, userId, stored } = await signedIn(deps, {}, { consent: false });
      deps.auth.reject(authorization.slice('Bearer '.length));

      await expect401(await postConsent(authorization, { version: CURRENT_CONSENT_VERSION }));

      expect(await deps.users.getById(userId as UserId)).toStrictEqual(stored);
      expect(deps.users.counts()).toEqual({ users: 1, identities: 1 });
    });
  });

  describe('400 VALIDATION and consent stays null', () => {
    const cases: [string, unknown, boolean?][] = [
      ['a non-JSON body', '{not json', true],
      ['a JSON array', [CURRENT_CONSENT_VERSION]],
      ['an empty object', {}],
      ['an empty version', { version: '' }],
      ['a 33-char version', { version: 'x'.repeat(33) }],
      ['a number version', { version: 42 }],
      [
        'an acceptedAt key',
        { version: CURRENT_CONSENT_VERSION, acceptedAt: '2020-01-01T00:00:00.000Z' },
      ],
      ['a userId key', { version: CURRENT_CONSENT_VERSION, userId: '01ARZ3NDEKTSV4RRFFQ69G5FAW' }],
    ];

    it.each(cases)('%s', async (_label, body, raw) => {
      const { deps, postConsent } = setup();
      const { authorization, userId, stored } = await signedIn(deps, {}, { consent: false });
      deps.clock.advance({ hours: 1 });

      await expect400(await postConsent(authorization, body, raw ?? false));

      const after = await deps.users.getById(userId as UserId);
      expect(after).toStrictEqual(stored);
      expect(after?.consent).toBeNull();
    });

    it('a body over 4 KB is rejected before the token is verified', async () => {
      const { deps, postConsent } = setup();
      const { authorization, userId } = await signedIn(deps, {}, { consent: false });
      const before = deps.auth.verifyCalls;

      await expect400(
        await postConsent(authorization, {
          version: CURRENT_CONSENT_VERSION,
          pad: 'x'.repeat(5000),
        }),
      );

      expect(deps.auth.verifyCalls).toBe(before);
      expect((await deps.users.getById(userId as UserId))?.consent).toBeNull();
    });
  });

  it('returns 409 CONFLICT for a well-formed version that is not current', async () => {
    const { deps, postConsent } = setup();
    const { authorization, userId } = await signedIn(deps, {}, { consent: false });

    const res = await postConsent(authorization, { version: '2000-01-01' });

    expect(res.status).toBe(409);
    expect(ErrorResponse.parse(await res.json()).error.code).toBe('CONFLICT');
    expect((await deps.users.getById(userId as UserId))?.consent).toBeNull();
  });

  it("user A's accept changes only user A; user B is unchanged", async () => {
    const { deps, postConsent } = setup();
    const a = await signedIn(deps, { subject: 'uid-alice', name: 'Alice' }, { consent: false });
    const b = await signedIn(deps, { subject: 'uid-bob', name: 'Bob' }, { consent: false });

    const res = await postConsent(a.authorization, { version: CURRENT_CONSENT_VERSION });

    expect(res.status).toBe(200);
    expect(MeResponse.parse(await res.json()).userId).toBe(a.userId);
    expect((await deps.users.getById(a.userId as UserId))?.consent?.version).toBe(
      CURRENT_CONSENT_VERSION,
    );
    expect(JSON.stringify(await deps.users.getById(b.userId as UserId))).toBe(
      JSON.stringify(b.stored),
    );
  });

  it.each(['GET', 'DELETE'])('returns 404 for %s /v1/me/consent', async (method) => {
    const { deps, app } = setup();
    const token = deps.auth.issue(identity());

    const res = await app.request('/v1/me/consent', {
      method,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.status).toBe(404);
  });
});

describe('DELETE /v1/me', () => {
  it('returns 204 and the same token starts over with a new user', async () => {
    const { deps, getMe, patchMe, deleteMe } = setup();
    const { authorization, userId } = await signedIn(deps);
    expect(
      (
        await patchMe(authorization, {
          displayName: 'Åsa',
          locale: 'sv',
          timezone: 'Europe/Stockholm',
        })
      ).status,
    ).toBe(200);

    const res = await deleteMe(authorization);

    expect(res.status).toBe(204);
    expect(await res.text()).toBe('');
    expect(deps.users.counts()).toEqual({ users: 0, identities: 0 });
    expect(await deps.users.getById(userId as UserId)).toBeNull();

    const again = await getMe(authorization);
    expect(again.status).toBe(200);
    const body = MeResponse.parse(await again.json());
    expect(body.userId).not.toBe(userId);
    expect(body).toEqual({
      userId: body.userId,
      displayName: 'Alice',
      locale: null,
      timezone: null,
      consent: CONSENT_REQUIRED,
    });
  });

  it('returns 204 twice, and the second call creates and deletes nothing', async () => {
    const spy = new SpyUserRepo();
    const deps = makeTestDeps({ users: spy });
    const { deleteMe } = setup(deps);
    const { authorization } = await signedIn(deps);

    const first = await deleteMe(authorization);
    expect(first.status).toBe(204);
    expect(await first.text()).toBe('');
    expect(deps.users.counts()).toEqual({ users: 0, identities: 0 });

    spy.creates = 0;
    spy.deletes = 0;
    const second = await deleteMe(authorization);

    expect(second.status).toBe(204);
    expect(await second.text()).toBe('');
    expect(deps.users.counts()).toEqual({ users: 0, identities: 0 });
    expect(spy.creates).toBe(0);
    expect(spy.deletes).toBe(0);
  });

  it('returns 204 for a token that was never used and creates nothing', async () => {
    const spy = new SpyUserRepo();
    const deps = makeTestDeps({ users: spy });
    const { deleteMe } = setup(deps);
    const token = deps.auth.issue(identity());

    const res = await deleteMe(`Bearer ${token}`);

    expect(res.status).toBe(204);
    expect(await res.text()).toBe('');
    expect(deps.users.counts()).toEqual({ users: 0, identities: 0 });
    expect(spy.creates).toBe(0);
    expect(spy.deletes).toBe(0);
  });

  it('deletes a user who has not accepted consent', async () => {
    const { deps, deleteMe } = setup();
    const { authorization, userId } = await signedIn(deps, {}, { consent: false });

    const res = await deleteMe(authorization);

    expect(res.status).toBe(204);
    expect(await deps.users.getById(userId as UserId)).toBeNull();
    expect(deps.users.counts()).toEqual({ users: 0, identities: 0 });
  });

  it('deletes a user whose consent is an older version', async () => {
    const { deps, deleteMe } = setup();
    const { authorization, userId } = await signedIn(deps, {}, { consent: false });
    const at = '2025-01-01T00:00:00.000Z';
    await deps.users.recordConsent(userId as UserId, { version: '2000-01-01', acceptedAt: at }, at);

    const res = await deleteMe(authorization);

    expect(res.status).toBe(204);
    expect(await deps.users.getById(userId as UserId)).toBeNull();
  });

  describe('401 UNAUTHENTICATED and the seeded user is unchanged', () => {
    const cases = [
      'no Authorization header',
      'a Basic scheme',
      'an unknown token',
      'a token the verifier rejects',
      'a verified subject a/b',
    ] as const;

    it.each(cases)('%s', async (kind) => {
      const { deps, deleteMe } = setup();
      const { authorization, userId, stored } = await signedIn(deps);
      const beforeVerify = deps.auth.verifyCalls;
      let header: string | undefined;
      if (kind === 'no Authorization header') header = undefined;
      else if (kind === 'a Basic scheme') header = 'Basic abc';
      else if (kind === 'an unknown token') header = 'Bearer fake-token-999';
      else if (kind === 'a token the verifier rejects') {
        deps.auth.reject(authorization.slice('Bearer '.length));
        header = authorization;
      } else {
        header = `Bearer ${deps.auth.issue(identity({ subject: 'a/b' }))}`;
      }

      await expect401(await deleteMe(header));

      if (kind === 'no Authorization header' || kind === 'a Basic scheme') {
        expect(deps.auth.verifyCalls).toBe(beforeVerify);
      }
      expect(await deps.users.getById(userId as UserId)).toStrictEqual(stored);
      expect(deps.users.counts()).toEqual({ users: 1, identities: 1 });
    });
  });

  it("user A's delete removes only user A; user B is unchanged", async () => {
    const { deps, getMe, deleteMe } = setup();
    const a = await signedIn(deps, { subject: 'uid-alice', name: 'Alice' });
    const b = await signedIn(deps, { subject: 'uid-bob', name: 'Bob' });

    const res = await deleteMe(a.authorization);

    expect(res.status).toBe(204);
    expect(await deps.users.getById(a.userId as UserId)).toBeNull();
    expect(JSON.stringify(await deps.users.getById(b.userId as UserId))).toBe(
      JSON.stringify(b.stored),
    );
    expect(MeResponse.parse(await (await getMe(b.authorization)).json()).userId).toBe(b.userId);
  });

  it('ignores a JSON body and still deletes only the caller', async () => {
    const { deps, deleteMe } = setup();
    const a = await signedIn(deps, { subject: 'uid-alice', name: 'Alice' });
    const b = await signedIn(deps, { subject: 'uid-bob', name: 'Bob' });

    const res = await deleteMe(a.authorization, { userId: b.userId });

    expect(res.status).toBe(204);
    expect(await res.text()).toBe('');
    expect(await deps.users.getById(a.userId as UserId)).toBeNull();
    expect(JSON.stringify(await deps.users.getById(b.userId as UserId))).toBe(
      JSON.stringify(b.stored),
    );
  });

  it('204 and 401 bodies never contain the provider subject or email', async () => {
    const { deps, getMe, deleteMe } = setup();
    const token = deps.auth.issue(
      identity({ subject: SENTINEL_SUBJECT, email: SENTINEL_EMAIL, name: 'Sentinel' }),
    );
    const authorization = `Bearer ${token}`;
    expect((await getMe(authorization)).status).toBe(200);

    const ok = await deleteMe(authorization);
    const okText = await ok.text();
    expect(ok.status).toBe(204);
    expect(okText).not.toContain(SENTINEL_SUBJECT);
    expect(okText).not.toContain(SENTINEL_EMAIL);

    deps.auth.reject(token);
    const deniedText = await expect401(await deleteMe(authorization));
    expect(deniedText).not.toContain(SENTINEL_SUBJECT);
    expect(deniedText).not.toContain(SENTINEL_EMAIL);
    expect(deniedText).not.toContain(token);
  });
});
