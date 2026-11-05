import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import {
  asUserId,
  changeMemberRole,
  DomainError,
  leaveCommunity,
  listMembers,
  removeMember,
} from '@noor/core';
import {
  ChangeMemberRoleRequest,
  LeaveCommunityRequest,
  MembersResponse,
  MemberView,
} from '@noor/contracts';
import type { AppEnv } from '../app-env';
import { parseJsonBody } from '../http/parse-json-body';
import { requireConsent } from '../middleware/require-consent';
import { requireMember } from '../middleware/require-member';
import { requireUser } from '../middleware/require-user';

const MAX_BODY_BYTES = 4096;

/** Rejects an oversized body with `VALIDATION` before the token is verified. */
function limitBody() {
  return bodyLimit({
    maxSize: MAX_BODY_BYTES,
    onError: () => {
      throw new DomainError('VALIDATION', { reason: 'body-too-large' });
    },
  });
}

/**
 * List members, change a role, remove someone else, and leave. The tenant id is the
 * membership loaded for this request, never a body field. No entitlement gate.
 */
export function membersRoutes(): Hono<AppEnv> {
  return new Hono<AppEnv>()
    .get(
      '/v1/t/:tenantId/members',
      requireUser(),
      requireConsent(),
      requireMember('admin'),
      async (c) => {
        const members = await listMembers(c.var.deps, {
          tenantId: c.var.membership.tenantId,
          userId: c.var.user.id,
        });
        return c.json(MembersResponse.parse({ members }), 200);
      },
    )
    .patch(
      '/v1/t/:tenantId/members/:userId',
      limitBody(),
      requireUser(),
      requireConsent(),
      requireMember('admin'),
      async (c) => {
        const body = await parseJsonBody(c, ChangeMemberRoleRequest);
        const member = await changeMemberRole(c.var.deps, {
          tenantId: c.var.membership.tenantId,
          actorUserId: c.var.user.id,
          targetUserId: asUserId(c.req.param('userId') ?? ''),
          role: body.role,
        });
        return c.json(
          MemberView.parse({
            userId: member.userId,
            displayName: member.displayName,
            role: member.role,
            createdAt: member.createdAt,
          }),
          200,
        );
      },
    )
    .delete(
      '/v1/t/:tenantId/members/:userId',
      requireUser(),
      requireConsent(),
      requireMember('admin'),
      async (c) => {
        await removeMember(c.var.deps, {
          tenantId: c.var.membership.tenantId,
          actorUserId: c.var.user.id,
          targetUserId: asUserId(c.req.param('userId') ?? ''),
        });
        return c.body(null, 204);
      },
    )
    .post(
      '/v1/t/:tenantId/leave',
      limitBody(),
      requireUser(),
      requireConsent(),
      requireMember('member'),
      async (c) => {
        await parseJsonBody(c, LeaveCommunityRequest);
        await leaveCommunity(c.var.deps, {
          tenantId: c.var.membership.tenantId,
          userId: c.var.user.id,
        });
        return c.body(null, 204);
      },
    );
}
