import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
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

describe('requireUser', () => {
  it('sets c.var.user to exactly { id, displayName, locale, timezone }, with no email or subject', async () => {
    const { app, deps } = echoApp();
    const token = deps.auth.issue({
      provider: 'firebase',
      subject: 'uid-alice',
      email: 'alice@example.com',
      emailVerified: true,
      name: 'Alice',
    });

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
    });
  });

  it('does not call the handler without a valid token', async () => {
    const { app } = echoApp();

    const res = await app.request('/__test/user');

    expect(res.status).toBe(401);
  });
});
