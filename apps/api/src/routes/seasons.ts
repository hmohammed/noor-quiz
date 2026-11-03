import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import {
  createSeason,
  DomainError,
  listSeasons,
  suggestRamadanStart,
  updateSeason,
  type SeasonRecord,
} from '@noor/core';
import {
  CreateSeasonRequest,
  RamadanSuggestionResponse,
  SeasonListResponse,
  SeasonView,
  SuggestRamadanQuery,
  UpdateSeasonRequest,
  type SeasonView as SeasonViewType,
} from '@noor/contracts';
import type { AppEnv } from '../app-env';
import { parseJsonBody } from '../http/parse-json-body';
import { requireConsent } from '../middleware/require-consent';
import { requireMember } from '../middleware/require-member';
import { requireUser } from '../middleware/require-user';

const MAX_BODY_BYTES = 4096;

function limitBody() {
  return bodyLimit({
    maxSize: MAX_BODY_BYTES,
    onError: () => {
      throw new DomainError('VALIDATION', { reason: 'body-too-large' });
    },
  });
}

/** Named fields only, so `createdBy` and `schemaVersion` stay server-side. */
function seasonView(record: SeasonRecord): SeasonViewType {
  const { season, state } = record;
  return SeasonView.parse({
    id: season.id,
    tenantId: season.tenantId,
    name: season.name,
    kind: season.kind,
    startDate: season.startDate,
    lengthDays: season.lengthDays,
    timezone: season.timezone,
    opensAtLocal: season.opensAtLocal,
    closesAtLocal: season.closesAtLocal,
    state,
    createdAt: season.createdAt,
    updatedAt: season.updatedAt,
  });
}

/** Create, list and patch a community's seasons, and suggest a Ramadan start. */
export function seasonsRoutes(): Hono<AppEnv> {
  return new Hono<AppEnv>()
    .post(
      '/v1/t/:tenantId/seasons',
      limitBody(),
      requireUser(),
      requireConsent(),
      requireMember('admin'),
      async (c) => {
        const body = await parseJsonBody(c, CreateSeasonRequest);
        const record = await createSeason(c.var.deps, {
          tenantId: c.var.membership.tenantId,
          userId: c.var.membership.userId,
          ...body,
        });
        return c.json(seasonView(record), 201);
      },
    )
    .get(
      '/v1/t/:tenantId/seasons/ramadan-suggestion',
      requireUser(),
      requireConsent(),
      requireMember('admin'),
      async (c) => {
        const parsed = SuggestRamadanQuery.safeParse(c.req.query());
        if (!parsed.success) throw new DomainError('VALIDATION', { reason: 'invalid-query' });
        const suggestion = suggestRamadanStart(
          { clock: c.var.deps.clock },
          { timezone: parsed.data.timezone },
        );
        return c.json(RamadanSuggestionResponse.parse({ ...suggestion, advisory: true }), 200);
      },
    )
    .get(
      '/v1/t/:tenantId/seasons',
      requireUser(),
      requireConsent(),
      requireMember('member'),
      async (c) => {
        const records = await listSeasons(c.var.deps, { tenantId: c.var.membership.tenantId });
        return c.json(SeasonListResponse.parse({ seasons: records.map(seasonView) }), 200);
      },
    )
    .patch(
      '/v1/t/:tenantId/seasons/:seasonId',
      limitBody(),
      requireUser(),
      requireConsent(),
      requireMember('admin'),
      async (c) => {
        const body = await parseJsonBody(c, UpdateSeasonRequest);
        const record = await updateSeason(c.var.deps, {
          tenantId: c.var.membership.tenantId,
          seasonId: c.req.param('seasonId'),
          patch: body,
        });
        return c.json(seasonView(record), 200);
      },
    );
}
