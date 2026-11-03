import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import {
  createCommunity,
  DomainError,
  listMyCommunities,
  type Community,
  type Role,
} from '@noor/core';
import {
  CommunityResponse,
  CreateCommunityRequest,
  MyCommunitiesResponse,
  type CommunitySummary,
} from '@noor/contracts';
import type { AppEnv } from '../app-env';
import { parseJsonBody } from '../http/parse-json-body';
import { requireConsent } from '../middleware/require-consent';
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

/** Create a community, and list the communities the signed-in user belongs to. */
export function communitiesRoutes(): Hono<AppEnv> {
  return new Hono<AppEnv>()
    .post('/v1/communities', limitBody(), requireUser(), requireConsent(), async (c) => {
      const body = await parseJsonBody(c, CreateCommunityRequest);
      // The user id comes from the verified token. Role and tenant id are not in the body.
      const { community, membership } = await createCommunity(c.var.deps, {
        userId: c.var.user.id,
        name: body.name,
        timezone: body.timezone,
      });
      return c.json(communitySummary(community, membership.role), 201);
    })
    .get('/v1/me/communities', requireUser(), requireConsent(), async (c) => {
      const items = await listMyCommunities(c.var.deps, { userId: c.var.user.id });
      return c.json(
        MyCommunitiesResponse.parse({
          communities: items.map(({ community, role }) => communitySummary(community, role)),
        }),
        200,
      );
    });
}
