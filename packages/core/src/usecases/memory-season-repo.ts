import { asTenantId, type TenantId } from '../communities/community';
import { DomainError } from '../errors';
import type { SeasonRepo } from '../ports/repos';
import {
  asSeasonId,
  SEASON_SCHEMA_VERSION,
  type CommunitySeason,
  type SeasonId,
} from '../season/community-season';
import { asUserId } from '../users/user';

/**
 * In-memory `SeasonRepo` for use-case tests. Core cannot import testkit (testkit
 * depends on core). The shared fake that routes use lives in `@noor/testkit`.
 */
export class MemorySeasonRepo implements SeasonRepo {
  readonly #items: CommunitySeason[] = [];

  all(): CommunitySeason[] {
    return this.#items.map((season) => ({ ...season }));
  }

  async get(tenantId: TenantId, seasonId: SeasonId): Promise<CommunitySeason | null> {
    const found = this.#items.find(
      (season) => season.id === seasonId && season.tenantId === tenantId,
    );
    return found ? { ...found } : null;
  }

  async list(tenantId: TenantId): Promise<CommunitySeason[]> {
    return this.#items
      .filter((season) => season.tenantId === tenantId)
      .map((season) => ({ ...season }));
  }

  async create(season: CommunitySeason): Promise<CommunitySeason> {
    const id = asSeasonId(season.id);
    if (this.#items.some((item) => item.id === id)) {
      throw new DomainError('CONFLICT', { reason: 'season-exists' });
    }
    const stored = { ...season, id };
    this.#items.push(stored);
    return { ...stored };
  }

  async update(season: CommunitySeason): Promise<CommunitySeason> {
    const id = asSeasonId(season.id);
    const tenantId = asTenantId(season.tenantId);
    const index = this.#items.findIndex((item) => item.id === id && item.tenantId === tenantId);
    const stored = index < 0 ? undefined : this.#items[index];
    if (!stored) throw new DomainError('NOT_FOUND', { reason: 'season-not-found' });
    if (
      stored.createdBy !== asUserId(season.createdBy) ||
      stored.createdAt !== season.createdAt ||
      stored.schemaVersion !== season.schemaVersion
    ) {
      throw new DomainError('VALIDATION', { reason: 'immutable-field' });
    }
    const next = { ...season, id, tenantId, schemaVersion: SEASON_SCHEMA_VERSION };
    this.#items[index] = next;
    return { ...next };
  }
}
