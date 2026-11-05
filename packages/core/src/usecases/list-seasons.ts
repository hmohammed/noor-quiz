import { asTenantId } from '../communities/community';
import type { Clock } from '../ports/clock';
import type { SeasonRepo } from '../ports/repos';
import { seasonRules, type CommunitySeason, type SeasonRecord } from '../season/community-season';
import { seasonState } from '../season/season-rules';

function byNewest(a: CommunitySeason, b: CommunitySeason): number {
  if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? 1 : -1;
  if (a.id !== b.id) return a.id < b.id ? 1 : -1;
  return 0;
}

/** This tenant's seasons, newest `createdAt` first, then `id`. State comes from one clock read. */
export async function listSeasons(
  deps: { clock: Clock; seasons: SeasonRepo },
  input: { tenantId: string },
): Promise<SeasonRecord[]> {
  const tenantId = asTenantId(input.tenantId);
  const now = deps.clock.now();
  const seasons = await deps.seasons.list(tenantId);
  return seasons
    .slice()
    .sort(byNewest)
    .map((season) => ({ season, state: seasonState(seasonRules(season), now) }));
}
