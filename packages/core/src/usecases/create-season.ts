import { asTenantId } from '../communities/community';
import type { Clock } from '../ports/clock';
import type { IdGenerator } from '../ports/id-generator';
import type { SeasonRepo } from '../ports/repos';
import {
  asSeasonId,
  seasonRules,
  SEASON_SCHEMA_VERSION,
  type CommunitySeason,
  type SeasonRecord,
} from '../season/community-season';
import { seasonState } from '../season/season-rules';
import { toIso } from '../time/instant';
import { asUserId } from '../users/user';
import { assertSeasonRules, fieldsFromCreate } from './season-fields';

/**
 * Stores the admin-confirmed dates. A Ramadan suggestion is never written here:
 * `startDate` and `lengthDays` are whatever the caller submits, including a season
 * that is already active or ended. The lock applies to later patches.
 */
export async function createSeason(
  deps: { clock: Clock; ids: IdGenerator; seasons: SeasonRepo },
  input: {
    tenantId: string;
    userId: string;
    name: string;
    kind: string;
    startDate: string;
    lengthDays: number;
    timezone: string;
    opensAtLocal: string;
    closesAtLocal: string;
  },
): Promise<SeasonRecord> {
  const tenantId = asTenantId(input.tenantId);
  const createdBy = asUserId(input.userId);
  const fields = fieldsFromCreate(input);
  assertSeasonRules(fields);

  const now = deps.clock.now();
  const at = toIso(now);
  const season: CommunitySeason = {
    id: asSeasonId(deps.ids.newId()),
    tenantId,
    name: fields.name,
    kind: fields.kind,
    startDate: fields.startDate,
    lengthDays: fields.lengthDays,
    timezone: fields.timezone,
    opensAtLocal: fields.opensAtLocal,
    closesAtLocal: fields.closesAtLocal,
    createdBy,
    createdAt: at,
    updatedAt: at,
    schemaVersion: SEASON_SCHEMA_VERSION,
  };
  const stored = await deps.seasons.create(season);
  return { season: stored, state: seasonState(seasonRules(stored), now) };
}
