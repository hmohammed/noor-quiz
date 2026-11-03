import { isSeasonKind, type CommunitySeason, type SeasonKind } from '../season/community-season';
import { assertValidSeason, type Season } from '../season/season-rules';
import { normaliseCommunityName } from '../communities/name';
import { DomainError } from '../errors';
import type { TimeZone } from '../time/zoned';
import { canonicalTimeZone } from '../users/profile';

export interface SeasonFields {
  name: string;
  kind: SeasonKind;
  startDate: string;
  lengthDays: number;
  timezone: TimeZone;
  opensAtLocal: string;
  closesAtLocal: string;
}

export interface SeasonPatch {
  name?: string;
  kind?: string;
  startDate?: string;
  lengthDays?: number;
  timezone?: string;
  opensAtLocal?: string;
  closesAtLocal?: string;
}

function requireName(name: string): string {
  const normalised = normaliseCommunityName(name);
  if (normalised === null) throw new DomainError('VALIDATION', { reason: 'invalid-season-name' });
  return normalised;
}

function requireKind(kind: string): SeasonKind {
  if (!isSeasonKind(kind)) throw new DomainError('VALIDATION', { reason: 'invalid-kind' });
  return kind;
}

function requireZone(timezone: string): TimeZone {
  const canonical = canonicalTimeZone(timezone);
  if (canonical === null) throw new DomainError('VALIDATION', { reason: 'invalid-timezone' });
  return canonical;
}

export function rulesOf(fields: SeasonFields): Season {
  return {
    startDate: fields.startDate,
    lengthDays: fields.lengthDays,
    timezone: fields.timezone,
    opensAtLocal: fields.opensAtLocal,
    closesAtLocal: fields.closesAtLocal,
  };
}

/** Name, kind and timezone normalised. Does not call `assertValidSeason`. */
export function fieldsFromCreate(input: {
  name: string;
  kind: string;
  startDate: string;
  lengthDays: number;
  timezone: string;
  opensAtLocal: string;
  closesAtLocal: string;
}): SeasonFields {
  return {
    name: requireName(input.name),
    kind: requireKind(input.kind),
    startDate: input.startDate,
    lengthDays: input.lengthDays,
    timezone: requireZone(input.timezone),
    opensAtLocal: input.opensAtLocal,
    closesAtLocal: input.closesAtLocal,
  };
}

/**
 * Overlay `patch` on the stored season. An absent key stays as stored. Name and
 * timezone are compared after normalisation. Does not call `assertValidSeason`.
 */
export function fieldsFromPatch(stored: CommunitySeason, patch: SeasonPatch): SeasonFields {
  return {
    name: patch.name === undefined ? stored.name : requireName(patch.name),
    kind: patch.kind === undefined ? stored.kind : requireKind(patch.kind),
    startDate: patch.startDate === undefined ? stored.startDate : patch.startDate,
    lengthDays: patch.lengthDays === undefined ? stored.lengthDays : patch.lengthDays,
    timezone: patch.timezone === undefined ? stored.timezone : requireZone(patch.timezone),
    opensAtLocal: patch.opensAtLocal === undefined ? stored.opensAtLocal : patch.opensAtLocal,
    closesAtLocal: patch.closesAtLocal === undefined ? stored.closesAtLocal : patch.closesAtLocal,
  };
}

/** Locked once the season has started, when the normalised value differs. */
export function lockedFieldsChanged(stored: CommunitySeason, fields: SeasonFields): boolean {
  return (
    fields.name !== stored.name ||
    fields.kind !== stored.kind ||
    fields.startDate !== stored.startDate ||
    fields.lengthDays !== stored.lengthDays ||
    fields.timezone !== stored.timezone ||
    fields.opensAtLocal !== stored.opensAtLocal
  );
}

export function assertSeasonRules(fields: SeasonFields): void {
  assertValidSeason(rulesOf(fields));
}
