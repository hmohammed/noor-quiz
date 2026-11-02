import { describe, expect, it } from 'vitest';
import { isUlid, type Identity, type User, type VerifiedIdentity } from '@noor/core';
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
  return { app, deps, getMe };
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
    expect(body).toEqual({ userId: stored?.id, displayName: 'Alice' });
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

  it('returns exactly userId and displayName even if the repo returns extra keys', async () => {
    const { deps, getMe } = setup(makeTestDeps({ users: new LeakyUserRepo() }));
    const token = deps.auth.issue(identity());

    const res = await getMe(`Bearer ${token}`);
    const text = await res.text();

    expect(res.status).toBe(200);
    expect(Object.keys(JSON.parse(text)).sort()).toEqual(['displayName', 'userId']);
    expect(text).not.toContain(SENTINEL_SUBJECT);
    expect(text).not.toContain(SENTINEL_EMAIL);
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
