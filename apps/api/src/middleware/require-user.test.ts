import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { CURRENT_CONSENT_VERSION, type UserId } from '@noor/core';
import { makeTestDeps } from '@noor/testkit';
import type { AppEnv } from '../app-env';
import { installErrorHandling } from '../errors';
import { requireIdentity, requireUser } from './require-user';

/** A test-only app that echoes `c.var.user`, so we can see exactly what the middleware sets. */
function echoApp() {
  const deps = makeTestDeps();
  const app = new Hono<AppEnv>();
  installErrorHandling(app);
  app.use('*', async (c, next) => {
    c.set('deps', deps);
    await next();
  });
  app.get('/__test/user', requireUser(), (c) => c.json(c.var.user));
  app.get('/__test/identity', requireIdentity(), (c) => c.json(c.var.identity));
  return { app, deps };
}

function aliceToken(deps: ReturnType<typeof makeTestDeps>) {
  return deps.auth.issue({
    provider: 'firebase',
    subject: 'uid-alice',
    email: 'alice@example.com',
    emailVerified: true,
    name: 'Alice',
  });
}

describe('requireUser', () => {
  it('sets c.var.user to exactly { id, displayName, locale, timezone, consentVersion }, with no email or subject', async () => {
    const { app, deps } = echoApp();
    const token = aliceToken(deps);

    const res = await app.request('/__test/user', {
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.status).toBe(200);
    const stored = await deps.users.getByIdentity({ provider: 'firebase', subject: 'uid-alice' });
    expect(await res.json()).toStrictEqual({
      id: stored?.id,
      displayName: 'Alice',
      locale: null,
      timezone: null,
      consentVersion: null,
    });
  });

  it('sets consentVersion to the stored version and never acceptedAt', async () => {
    const { app, deps } = echoApp();
    const token = aliceToken(deps);
    const headers = { authorization: `Bearer ${token}` };
    await app.request('/__test/user', { headers });
    const stored = await deps.users.getByIdentity({ provider: 'firebase', subject: 'uid-alice' });
    const acceptedAt = '2026-01-01T00:00:00.000Z';
    await deps.users.recordConsent(
      stored!.id as UserId,
      { version: CURRENT_CONSENT_VERSION, acceptedAt },
      acceptedAt,
    );

    const res = await app.request('/__test/user', { headers });
    const text = await res.text();

    expect(JSON.parse(text)).toStrictEqual({
      id: stored?.id,
      displayName: 'Alice',
      locale: null,
      timezone: null,
      consentVersion: CURRENT_CONSENT_VERSION,
    });
    expect(text).not.toContain('acceptedAt');
    expect(text).not.toContain(acceptedAt);
  });

  it('does not call the handler without a valid token', async () => {
    const { app } = echoApp();

    const res = await app.request('/__test/user');

    expect(res.status).toBe(401);
  });
});

const headerCases: [string, string | undefined][] = [
  ['no Authorization header', undefined],
  ['a Basic scheme', 'Basic abc'],
  ['Bearer with no token', 'Bearer'],
  ['Bearer with an empty token', 'Bearer '],
  ['two tokens', 'Bearer a b'],
  ['no space after Bearer', 'Bearertoken'],
  ['a token longer than 4096 chars', `Bearer ${'a'.repeat(4097)}`],
];

async function callBoth(header: string | undefined) {
  const run = async (path: '/__test/user' | '/__test/identity') => {
    const { app, deps } = echoApp();
    const res = await app.request(
      path,
      header === undefined ? {} : { headers: { authorization: header } },
    );
    return { status: res.status, verifyCalls: deps.auth.verifyCalls, deps };
  };
  const user = await run('/__test/user');
  const identity = await run('/__test/identity');
  return { user, identity };
}

describe('requireIdentity', () => {
  it('sets c.var.identity to exactly { provider, subject } and never creates a user', async () => {
    const { app, deps } = echoApp();
    const token = aliceToken(deps);

    const res = await app.request('/__test/identity', {
      headers: { authorization: `Bearer ${token}` },
    });
    const text = await res.text();

    expect(res.status).toBe(200);
    expect(JSON.parse(text)).toStrictEqual({ provider: 'firebase', subject: 'uid-alice' });
    expect(text).not.toContain('alice@example.com');
    expect(text).not.toContain('emailVerified');
    expect(deps.users.counts()).toEqual({ users: 0, identities: 0 });
  });

  it.each(headerCases)(
    '%s: requireUser and requireIdentity return the same 401 without verifying',
    async (_label, header) => {
      const { user, identity } = await callBoth(header);

      expect({ status: user.status, verifyCalls: user.verifyCalls }).toEqual({
        status: 401,
        verifyCalls: 0,
      });
      expect({ status: identity.status, verifyCalls: identity.verifyCalls }).toEqual({
        status: user.status,
        verifyCalls: user.verifyCalls,
      });
      expect(identity.deps.users.counts()).toEqual({ users: 0, identities: 0 });
    },
  );

  it('a rejected token returns 401 with one verify call for both middlewares', async () => {
    const run = async (path: '/__test/user' | '/__test/identity') => {
      const { app, deps } = echoApp();
      const token = aliceToken(deps);
      deps.auth.reject(token);
      const res = await app.request(path, { headers: { authorization: `Bearer ${token}` } });
      return { status: res.status, verifyCalls: deps.auth.verifyCalls };
    };

    const user = await run('/__test/user');
    const identity = await run('/__test/identity');

    expect(user).toEqual({ status: 401, verifyCalls: 1 });
    expect(identity).toEqual(user);
  });
});
