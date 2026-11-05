import type { TenantId } from '../communities/community';
import { DomainError } from '../errors';
import type { Season, SeasonState } from './season-rules';
import type { LocalTime } from '../time/local-date';
import type { LocalDate, TimeZone } from '../time/zoned';
import { ULID_PATTERN, type UserId } from '../users/user';

/**
 * Kind is a label. It does not set `lengthDays`. Keep this list in the same order as
 * `SEASON_KINDS` in `@noor/contracts` (core does not import contracts).
 */
export const SEASON_KINDS = ['ramadan', 'dhul_hijjah', 'muharram', 'weekly', 'custom'] as const;
export type SeasonKind = (typeof SEASON_KINDS)[number];

const KIND_SET: ReadonlySet<string> = new Set(SEASON_KINDS);

export function isSeasonKind(s: unknown): s is SeasonKind {
  return typeof s === 'string' && KIND_SET.has(s);
}

/** Our own season id: a ULID. Never a client-chosen slug. */
export type SeasonId = string & { readonly __brand: 'SeasonId' };

export const SEASON_SCHEMA_VERSION = 1 as const;

/** Brands a ULID string as a SeasonId, or throws `VALIDATION`. */
export function asSeasonId(s: string): SeasonId {
  if (typeof s !== 'string' || !ULID_PATTERN.test(s)) {
    throw new DomainError('VALIDATION', { reason: 'invalid-season-id' });
  }
  return s as SeasonId;
}

/**
 * `seasons/{seasonId}`. State is not stored; `seasonState` computes it on read.
 * `id` equals the document id. `schemaVersion` is 1 from the start.
 */
export interface CommunitySeason {
  id: SeasonId;
  tenantId: TenantId;
  name: string;
  kind: SeasonKind;
  startDate: LocalDate;
  lengthDays: number;
  timezone: TimeZone;
  opensAtLocal: LocalTime;
  closesAtLocal: LocalTime;
  createdBy: UserId;
  /** UTC ISO string from the Clock. */
  createdAt: string;
  /** UTC ISO string from the Clock. Equals `createdAt` on create. */
  updatedAt: string;
  schemaVersion: typeof SEASON_SCHEMA_VERSION;
}

/** A stored season plus the state computed from the clock. */
export interface SeasonRecord {
  season: CommunitySeason;
  state: SeasonState;
}

/** The T030 rules value `assertValidSeason` already takes. */
export function seasonRules(record: CommunitySeason): Season {
  return {
    startDate: record.startDate,
    lengthDays: record.lengthDays,
    timezone: record.timezone,
    opensAtLocal: record.opensAtLocal,
    closesAtLocal: record.closesAtLocal,
  };
}
