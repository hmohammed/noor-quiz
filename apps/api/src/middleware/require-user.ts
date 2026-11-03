import type { MiddlewareHandler } from 'hono';
import { DomainError, getOrCreateUser } from '@noor/core';
import type { AppEnv } from '../app-env';

/** `Bearer <token68>` (RFC 6750); the scheme is case-insensitive. */
const BEARER = /^Bearer ([A-Za-z0-9\-._~+/]+=*)$/i;
const MAX_TOKEN_LENGTH = 4096;

/**
 * Verifies the bearer token, resolves our user and sets `c.var.user`. A missing or
 * malformed header fails before the verifier is called. Never logs the header or token.
 */
export function requireUser(): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const match = BEARER.exec(c.req.header('Authorization') ?? '');
    const token = match?.[1];
    if (!token || token.length > MAX_TOKEN_LENGTH) {
      throw new DomainError('UNAUTHENTICATED', { reason: 'bad-authorization-header' });
    }
    const deps = c.var.deps;
    const identity = await deps.auth.verify(token);
    const user = await getOrCreateUser(deps, identity);
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
