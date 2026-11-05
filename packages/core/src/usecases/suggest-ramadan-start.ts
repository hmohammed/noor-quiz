import { DomainError } from '../errors';
import type { Clock } from '../ports/clock';
import { nextRamadanSuggestion, type RamadanSuggestion } from '../season/hijri';
import { canonicalTimeZone } from '../users/profile';

/**
 * Advisory Hijri start for the timezone. Writes nothing: the admin confirms the
 * dates with `createSeason`. An unknown or offset timezone is `VALIDATION`.
 */
export function suggestRamadanStart(
  deps: { clock: Clock },
  input: { timezone: string },
): RamadanSuggestion {
  const timezone = canonicalTimeZone(input.timezone);
  if (timezone === null) throw new DomainError('VALIDATION', { reason: 'invalid-timezone' });
  return nextRamadanSuggestion(deps.clock.now(), timezone);
}
