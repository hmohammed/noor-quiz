import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import {
  acceptInvite,
  createInvite,
  DomainError,
  previewInvite,
  type Community,
  type Role,
} from '@noor/core';
import {
  AcceptInviteRequest,
  CommunityResponse,
  CreateInviteRequest,
  CreateInviteResponse,
  InvitePreviewResponse,
  type CommunitySummary,
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

/** Named fields only, so `createdBy`, `updatedAt` and `schemaVersion` stay server-side. */
function communitySummary(community: Community, role: Role): CommunitySummary {
  return CommunityResponse.parse({
    tenantId: community.tenantId,
    name: community.name,
    slug: community.slug,
    timezone: community.timezone,
    role,
    createdAt: community.createdAt,
  });
}

/**
 * Create an invite (admin+), preview it with no auth, and accept it.
 * The token is never logged.
 */
export function invitesRoutes(): Hono<AppEnv> {
  return new Hono<AppEnv>()
    .post(
      '/v1/t/:tenantId/invites',
      limitBody(),
      requireUser(),
      requireConsent(),
      requireMember('admin'),
      async (c) => {
        const body = await parseJsonBody(c, CreateInviteRequest);
        const invite = await createInvite(c.var.deps, {
          tenantId: c.var.membership.tenantId,
          userId: c.var.user.id,
          expiresInDays: body.expiresInDays,
          maxUses: body.maxUses,
        });
        return c.json(
          CreateInviteResponse.parse({
            token: invite.id,
            expiresAt: invite.expiresAt,
            maxUses: invite.maxUses,
          }),
          201,
        );
      },
    )
    .get('/v1/invites/:token', async (c) => {
      const preview = await previewInvite(c.var.deps, { token: c.req.param('token') });
      return c.json(InvitePreviewResponse.parse({ name: preview.name }), 200);
    })
    .post('/v1/invites/:token/accept', limitBody(), requireUser(), requireConsent(), async (c) => {
      await parseJsonBody(c, AcceptInviteRequest);
      const { community, membership, created } = await acceptInvite(c.var.deps, {
        token: c.req.param('token'),
        userId: c.var.user.id,
      });
      return c.json(communitySummary(community, membership.role), created ? 201 : 200);
    });
}
