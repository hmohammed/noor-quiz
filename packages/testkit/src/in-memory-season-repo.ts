import {
  asSeasonId,
  asTenantId,
  asUserId,
  DomainError,
  SEASON_SCHEMA_VERSION,
  type CommunitySeason,
  type SeasonId,
  type SeasonRepo,
  type TenantId,
} from '@noor/core';

function storedSeason(season: CommunitySeason): CommunitySeason {
  return {
    id: asSeasonId(season.id),
    tenantId: asTenantId(season.tenantId),
    name: season.name,
    kind: season.kind,
    startDate: season.startDate,
    lengthDays: season.lengthDays,
    timezone: season.timezone,
    opensAtLocal: season.opensAtLocal,
    closesAtLocal: season.closesAtLocal,
    createdBy: asUserId(season.createdBy),
    createdAt: season.createdAt,
    updatedAt: season.updatedAt,
    schemaVersion: season.schemaVersion,
  };
}

function assertSchemaVersion(season: CommunitySeason): void {
  if (season.schemaVersion !== SEASON_SCHEMA_VERSION) {
    throw new DomainError('VALIDATION', { reason: 'invalid-schema-version' });
  }
}

/**
 * In-memory `seasons`. `update` does not await between the check and the write, so
 * it is atomic on one thread. Returns copies, never stored objects.
 */
export class InMemorySeasonRepo implements SeasonRepo {
  readonly #byId = new Map<string, CommunitySeason>();

  /** Test-only. Not part of `SeasonRepo`. */
  count(): number {
    return this.#byId.size;
  }

  async get(tenantId: TenantId, seasonId: SeasonId): Promise<CommunitySeason | null> {
    const id = asSeasonId(seasonId);
    const tid = asTenantId(tenantId);
    const season = this.#byId.get(id);
    if (!season || season.tenantId !== tid) return null;
    return { ...season };
  }

  async list(tenantId: TenantId): Promise<CommunitySeason[]> {
    const tid = asTenantId(tenantId);
    const found: CommunitySeason[] = [];
    for (const season of this.#byId.values()) {
      if (season.tenantId === tid) found.push({ ...season });
    }
    return found;
  }

  async create(season: CommunitySeason): Promise<CommunitySeason> {
    const stored = storedSeason(season);
    assertSchemaVersion(stored);
    if (this.#byId.has(stored.id)) {
      throw new DomainError('CONFLICT', { reason: 'season-exists' });
    }
    this.#byId.set(stored.id, stored);
    return { ...stored };
  }

  async update(season: CommunitySeason): Promise<CommunitySeason> {
    const next = storedSeason(season);
    assertSchemaVersion(next);
    const current = this.#byId.get(next.id);
    if (!current || current.tenantId !== next.tenantId) {
      throw new DomainError('NOT_FOUND', { reason: 'season-not-found' });
    }
    if (current.createdBy !== next.createdBy || current.createdAt !== next.createdAt) {
      throw new DomainError('VALIDATION', { reason: 'immutable-field' });
    }
    const saved: CommunitySeason = {
      ...next,
      id: current.id,
      tenantId: current.tenantId,
      createdBy: current.createdBy,
      createdAt: current.createdAt,
      schemaVersion: SEASON_SCHEMA_VERSION,
    };
    this.#byId.set(saved.id, saved);
    return { ...saved };
  }
}
