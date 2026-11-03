import { asTenantId } from '../communities/community';
import { DomainError } from '../errors';
import type { Clock } from '../ports/clock';
import type { SeasonRepo } from '../ports/repos';
import {
  asSeasonId,
  seasonRules,
  SEASON_SCHEMA_VERSION,
  type SeasonRecord,
} from '../season/community-season';
import { seasonState } from '../season/season-rules';
import { toIso } from '../time/instant';
import {
  assertSeasonRules,
  fieldsFromPatch,
  lockedFieldsChanged,
  type SeasonPatch,
} from './season-fields';

/**
 * Patches a season. The clock is read once. The lock is decided from the stored
 * document before the patch is applied: once day 1 has opened, only `closesAtLocal`
 * may change. Identity fields stay as stored. `updatedAt` comes from that clock read.
 */
export async function updateSeason(
  deps: { clock: Clock; seasons: SeasonRepo },
  input: { tenantId: string; seasonId: string; patch: SeasonPatch },
): Promise<SeasonRecord> {
  const tenantId = asTenantId(input.tenantId);
  const seasonId = asSeasonId(input.seasonId);
  const now = deps.clock.now();
  const stored = await deps.seasons.get(tenantId, seasonId);
  if (!stored) throw new DomainError('NOT_FOUND', { reason: 'season-not-found' });

  const started = seasonState(seasonRules(stored), now).phase !== 'upcoming';
  const fields = fieldsFromPatch(stored, input.patch);
  if (started && lockedFieldsChanged(stored, fields)) {
    throw new DomainError('CLOSED', { reason: 'season-started' });
  }
  assertSeasonRules(fields);

  const saved = await deps.seasons.update({
    id: stored.id,
    tenantId: stored.tenantId,
    name: fields.name,
    kind: fields.kind,
    startDate: fields.startDate,
    lengthDays: fields.lengthDays,
    timezone: fields.timezone,
    opensAtLocal: fields.opensAtLocal,
    closesAtLocal: fields.closesAtLocal,
    createdBy: stored.createdBy,
    createdAt: stored.createdAt,
    updatedAt: toIso(now),
    schemaVersion: SEASON_SCHEMA_VERSION,
  });
  return { season: saved, state: seasonState(seasonRules(saved), now) };
}
