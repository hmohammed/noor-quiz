import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import {
  asTenantId,
  CURRENT_CONSENT_VERSION,
  MEMBERSHIP_SCHEMA_VERSION,
  membershipId,
  type Role,
  type UserId,
  type VerifiedIdentity,
} from '@noor/core';
import { ErrorResponse } from '@noor/contracts';
import { makeTestDeps, type TestDeps } from '@noor/testkit';
import type { AppEnv } from '../app-env';
import { createApp } from '../app';
import { installErrorHandling } from '../errors';
import { requireConsent } from './require-consent';
import { requireMember } from './require-member';
import { requireUser } from './require-user';

const AT = '2026-01-01T00:00:00.000Z';
const TENANT_A = asTenantId('01ARZ3NDEKTSV4RRFFQ69G5FAV');
const TENANT_B = asTenantId('01ARZ3NDEKTSV4RRFFQ69G5FAW');

const ALICE: VerifiedIdentity = {
  provider: 'firebase',
  subject: 'uid-alice',
  email: 'alice@example.com',
  emailVerified: true,
  name: 'Alice',
};

/** A test-only app. `GET /v1/t/:tenantId/__member` is not mounted in `createApp`. */
function memberApp(minRole: Role = 'member') {
  const deps = makeTestDeps();
  const app = new Hono<AppEnv>();
  installErrorHandling(app);
  let handled = 0;
  app.use('*', async (c, next) => {
    c.set('deps', deps);
    await next();
  });
  app.get(
    '/v1/t/:tenantId/__member',
    requireUser(),
    requireConsent(),
    requireMember(minRole),
    (c) => {
      handled += 1;
      return c.json(c.var.membership);
    },
  );
  return { app, deps, handled: () => handled };
}

async function signIn(deps: TestDeps, app: Hono<AppEnv>, identity: VerifiedIdentity = ALICE) {
  const token = deps.auth.issue(identity);
  const headers = { authorization: `Bearer ${token}` };
  await app.request(`/v1/t/${TENANT_A}/__member`, { headers });
  const user = await deps.users.getByIdentity({ provider: 'firebase', subject: identity.subject });
  return { headers, userId: user!.id as UserId };
}

async function accept(deps: TestDeps, userId: UserId) {
  await deps.users.recordConsent(userId, { version: CURRENT_CONSENT_VERSION, acceptedAt: AT }, AT);
}

async function seed(deps: TestDeps, userId: UserId, tenantId: typeof TENANT_A, role: Role) {
  await deps.memberships.seed({
    id: membershipId(userId, tenantId),
    tenantId,
    userId,
    role,
    createdAt: AT,
    updatedAt: AT,
    schemaVersion: MEMBERSHIP_SCHEMA_VERSION,
  });
}

describe('requireMember', () => {
  it('returns 401 without a token and does not call the handler', async () => {
    const { app, handled } = memberApp();
    const res = await app.request(`/v1/t/${TENANT_A}/__member`);
    expect(res.status).toBe(401);
    expect(ErrorResponse.parse(await res.json()).error.code).toBe('UNAUTHENTICATED');
    expect(handled()).toBe(0);
  });

  it('returns 403 CONSENT_REQUIRED without consent and does not call the handler', async () => {
    const { app, deps, handled } = memberApp();
    const { headers } = await signIn(deps, app);
    const res = await app.request(`/v1/t/${TENANT_A}/__member`, { headers });
    expect(res.status).toBe(403);
    expect(ErrorResponse.parse(await res.json()).error.code).toBe('CONSENT_REQUIRED');
    expect(handled()).toBe(0);
  });

  it('returns 403 FORBIDDEN for a non-member and does not call the handler', async () => {
    const { app, deps, handled } = memberApp();
    const { headers, userId } = await signIn(deps, app);
    await accept(deps, userId);
    const res = await app.request(`/v1/t/${TENANT_A}/__member`, { headers });
    expect(res.status).toBe(403);
    expect(ErrorResponse.parse(await res.json()).error.code).toBe('FORBIDDEN');
    expect(handled()).toBe(0);
  });

  it('returns 403 FORBIDDEN for a lower role and does not call the handler', async () => {
    const { app, deps, handled } = memberApp('admin');
    const { headers, userId } = await signIn(deps, app);
    await accept(deps, userId);
    await seed(deps, userId, TENANT_A, 'member');
    const res = await app.request(`/v1/t/${TENANT_A}/__member`, { headers });
    expect(res.status).toBe(403);
    expect(ErrorResponse.parse(await res.json()).error.code).toBe('FORBIDDEN');
    expect(handled()).toBe(0);
  });

  it('returns 403 FORBIDDEN for a tenant the user does not belong to', async () => {
    const { app, deps, handled } = memberApp();
    const { headers, userId } = await signIn(deps, app);
    await accept(deps, userId);
    await seed(deps, userId, TENANT_A, 'owner');
    const res = await app.request(`/v1/t/${TENANT_B}/__member`, { headers });
    expect(res.status).toBe(403);
    expect(ErrorResponse.parse(await res.json()).error.code).toBe('FORBIDDEN');
    expect(handled()).toBe(0);
  });

  it('returns 400 VALIDATION for a non-ULID tenant id and does not call the handler', async () => {
    const { app, deps, handled } = memberApp();
    const { headers, userId } = await signIn(deps, app);
    await accept(deps, userId);
    const res = await app.request('/v1/t/not-a-ulid/__member', { headers });
    expect(res.status).toBe(400);
    expect(ErrorResponse.parse(await res.json()).error.code).toBe('VALIDATION');
    expect(handled()).toBe(0);
  });

  it('returns the stored membership, not the minimum role, when the role is sufficient', async () => {
    const { app, deps, handled } = memberApp('member');
    const { headers, userId } = await signIn(deps, app);
    await accept(deps, userId);
    await seed(deps, userId, TENANT_A, 'editor');

    const res = await app.request(`/v1/t/${TENANT_A}/__member`, { headers });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ tenantId: TENANT_A, userId, role: 'editor' });
    expect(handled()).toBe(1);
  });

  it('does not treat a forged auth claim as a role', async () => {
    const { app, deps, handled } = memberApp('admin');
    const forged = { ...ALICE, role: 'owner', tenantId: TENANT_A } as VerifiedIdentity;
    const { headers, userId } = await signIn(deps, app, forged);
    await accept(deps, userId);
    await seed(deps, userId, TENANT_A, 'member');

    const res = await app.request(`/v1/t/${TENANT_A}/__member`, { headers });

    expect(res.status).toBe(403);
    expect(ErrorResponse.parse(await res.json()).error.code).toBe('FORBIDDEN');
    expect(handled()).toBe(0);
  });

  it('is not mounted on createApp', async () => {
    const deps = makeTestDeps();
    const app = createApp({ deps, version: 'test-1' });
    const token = deps.auth.issue(ALICE);
    const headers = { authorization: `Bearer ${token}` };
    await app.request('/v1/me', { headers });
    const user = await deps.users.getByIdentity({ provider: 'firebase', subject: 'uid-alice' });
    await accept(deps, user!.id);
    await seed(deps, user!.id, TENANT_A, 'owner');

    const res = await app.request(`/v1/t/${TENANT_A}/__member`, { headers });

    expect(res.status).toBe(404);
    expect(ErrorResponse.parse(await res.json()).error.code).toBe('NOT_FOUND');
  });
});
