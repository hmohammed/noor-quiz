import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { CURRENT_CONSENT_VERSION, type UserId } from '@noor/core';
import { ErrorResponse } from '@noor/contracts';
import { makeTestDeps } from '@noor/testkit';
import type { AppEnv } from '../app-env';
import { installErrorHandling } from '../errors';
import { requireConsent } from './require-consent';
import { requireUser } from './require-user';

const AT = '2026-01-01T00:00:00.000Z';

/** A test-only app with `requireUser(), requireConsent()` and a handler that counts calls. */
function echoApp() {
  const deps = makeTestDeps();
  const app = new Hono<AppEnv>();
  installErrorHandling(app);
  let handled = 0;
  app.use('*', async (c, next) => {
    c.set('deps', deps);
    await next();
  });
  app.get('/__test/protected', requireUser(), requireConsent(), (c) => {
    handled += 1;
    return c.json({ id: c.var.user.id });
  });
  return { app, deps, handled: () => handled };
}

async function signedIn(deps: ReturnType<typeof makeTestDeps>, app: Hono<AppEnv>) {
  const token = deps.auth.issue({
    provider: 'firebase',
    subject: 'uid-alice',
    email: 'alice@example.com',
    emailVerified: true,
    name: 'Alice',
  });
  const headers = { authorization: `Bearer ${token}` };
  // The first call creates the user (and is refused for lack of consent).
  await app.request('/__test/protected', { headers });
  const user = await deps.users.getByIdentity({ provider: 'firebase', subject: 'uid-alice' });
  return { headers, userId: user!.id as UserId };
}

async function expect403(res: Response): Promise<void> {
  expect(res.status).toBe(403);
  expect(ErrorResponse.parse(await res.json()).error.code).toBe('CONSENT_REQUIRED');
}

describe('requireConsent', () => {
  it('refuses a new user with 403 CONSENT_REQUIRED and never calls the handler', async () => {
    const { app, deps, handled } = echoApp();
    const { headers } = await signedIn(deps, app);

    await expect403(await app.request('/__test/protected', { headers }));

    expect(handled()).toBe(0);
  });

  it('refuses a user who accepted an older version', async () => {
    const { app, deps, handled } = echoApp();
    const { headers, userId } = await signedIn(deps, app);
    await deps.users.recordConsent(userId, { version: '2000-01-01', acceptedAt: AT }, AT);

    await expect403(await app.request('/__test/protected', { headers }));

    expect(handled()).toBe(0);
  });

  it('lets a user who accepted the current version through', async () => {
    const { app, deps, handled } = echoApp();
    const { headers, userId } = await signedIn(deps, app);
    await deps.users.recordConsent(
      userId,
      { version: CURRENT_CONSENT_VERSION, acceptedAt: AT },
      AT,
    );

    const res = await app.request('/__test/protected', { headers });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: userId });
    expect(handled()).toBe(1);
  });

  it('still gives 401 without a token, so requireUser runs first', async () => {
    const { app, handled } = echoApp();

    const res = await app.request('/__test/protected');

    expect(res.status).toBe(401);
    expect(ErrorResponse.parse(await res.json()).error.code).toBe('UNAUTHENTICATED');
    expect(handled()).toBe(0);
  });
});
