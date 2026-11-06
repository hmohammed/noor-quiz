import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import {
  createSeason,
  DomainError,
  listSeasons,
  scheduleQuestion,
  suggestRamadanStart,
  updateSeason,
  type ScheduleEntry as StoredScheduleEntry,
  type SeasonRecord,
} from '@noor/core';
import {
  CreateSeasonRequest,
  RamadanSuggestionResponse,
  ScheduleEntry,
  ScheduleQuestionRequest,
  SeasonListResponse,
  SeasonView,
  SuggestRamadanQuery,
  UpdateSeasonRequest,
  type ScheduleEntry as ScheduleEntryBody,
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

/** Base-10 integer path segment. Rejects decimals, signs and empty strings. */
function parseDayIndex(raw: string): number {
  if (!/^\d+$/.test(raw)) {
    throw new DomainError('VALIDATION', { reason: 'invalid-day-index' });
  }
  return Number(raw);
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

function scheduleView(entry: StoredScheduleEntry): ScheduleEntryBody {
  return ScheduleEntry.parse({
    id: entry.id,
    tenantId: entry.tenantId,
    seasonId: entry.seasonId,
    questionId: entry.questionId,
    dayIndex: entry.dayIndex,
    scheduledBy: entry.scheduledBy,
    scheduledAt: entry.scheduledAt,
  });
}

/** Create, list and patch a community's seasons, suggest Ramadan, and schedule days. */
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
    )
    .put(
      '/v1/t/:tenantId/seasons/:seasonId/schedule/:dayIndex',
      limitBody(),
      requireUser(),
      requireConsent(),
      requireMember('editor'),
      async (c) => {
        const body = await parseJsonBody(c, ScheduleQuestionRequest);
        const entry = await scheduleQuestion(c.var.deps, {
          tenantId: c.var.membership.tenantId,
          seasonId: c.req.param('seasonId'),
          dayIndex: parseDayIndex(c.req.param('dayIndex')),
          questionId: body.questionId,
          userId: c.var.membership.userId,
        });
        return c.json(scheduleView(entry), 200);
      },
    );
}
