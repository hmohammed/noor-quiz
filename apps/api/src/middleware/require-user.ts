import type { Context, MiddlewareHandler } from 'hono';
import { DomainError, getOrCreateUser, type VerifiedIdentity } from '@noor/core';
import type { AppEnv } from '../app-env';

/** `Bearer <token68>` (RFC 6750); the scheme is case-insensitive. */
const BEARER = /^Bearer ([A-Za-z0-9\-._~+/]+=*)$/i;
const MAX_TOKEN_LENGTH = 4096;

/**
 * Parses the Authorization header and verifies the bearer token. A missing or
 * malformed header fails before the verifier is called. Never logs the header or token.
 * Shared by `requireUser` and `requireIdentity`.
 */
async function verifyBearer(c: Context<AppEnv>): Promise<VerifiedIdentity> {
  const match = BEARER.exec(c.req.header('Authorization') ?? '');
  const token = match?.[1];
  if (!token || token.length > MAX_TOKEN_LENGTH) {
    throw new DomainError('UNAUTHENTICATED', { reason: 'bad-authorization-header' });
  }
  return c.var.deps.auth.verify(token);
}

/**
 * Verifies the bearer token, resolves our user and sets `c.var.user`. A missing or
 * malformed header fails before the verifier is called. Never logs the header or token.
 */
export function requireUser(): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const identity = await verifyBearer(c);
    const user = await getOrCreateUser(c.var.deps, identity);
    c.set('user', {
      id: user.id,
      displayName: user.displayName,
      locale: user.locale,
      timezone: user.timezone,
      consentVersion: user.consent?.version ?? null,
    });
    await next();
  };
}

/**
 * Verifies the bearer token and sets `c.var.identity` to `{ provider, subject }` only.
 * Never calls `getOrCreateUser`, so a repeated delete cannot create a user first.
 */
export function requireIdentity(): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const identity = await verifyBearer(c);
    c.set('identity', { provider: identity.provider, subject: identity.subject });
    await next();
  };
}
