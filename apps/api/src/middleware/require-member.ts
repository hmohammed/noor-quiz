import type { MiddlewareHandler } from 'hono';
import { asTenantId, DomainError, roleAtLeast, type Role } from '@noor/core';
import type { AppEnv } from '../app-env';

/**
 * Loads the membership for `:tenantId` and the authenticated user, and requires
 * `minRole`. Run after `requireUser()` and `requireConsent()`. A missing membership
 * and a role below `minRole` are both `FORBIDDEN`, so a non-member learns nothing
 * about whether the tenant exists. The role comes from the membership document,
 * never from claims, the body, or the path alone. On success sets `c.var.membership`
 * to `{ tenantId, userId, role }` from that document.
 */
export function requireMember(minRole: Role): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const tenantId = asTenantId(c.req.param('tenantId') ?? '');
    const membership = await c.var.deps.memberships.get(tenantId, c.var.user.id);
    if (!membership || !roleAtLeast(membership.role, minRole)) {
      throw new DomainError('FORBIDDEN', { reason: 'not-a-member' });
    }
    c.set('membership', {
      tenantId: membership.tenantId,
      userId: membership.userId,
      role: membership.role,
    });
    await next();
  };
}
