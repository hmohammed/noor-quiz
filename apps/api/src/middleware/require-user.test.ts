import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { CURRENT_CONSENT_VERSION, type UserId } from '@noor/core';
import { makeTestDeps } from '@noor/testkit';
import type { AppEnv } from '../app-env';
import { installErrorHandling } from '../errors';
import { requireUser } from './require-user';

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
