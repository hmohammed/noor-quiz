import { describe, expect, it } from 'vitest';
import { DomainError } from '../errors';
import type { Clock } from '../ports/clock';
import { nextRamadanSuggestion } from '../season/hijri';
import { instantFromIso } from '../time/instant';
import { MemorySeasonRepo } from './memory-season-repo';
import { suggestRamadanStart } from './suggest-ramadan-start';

const AT = '2026-01-15T12:00:00.000Z';

function clock(): Clock {
  const now = instantFromIso(AT);
  return { now: () => now };
}

describe('suggestRamadanStart', () => {
  it('returns nextRamadanSuggestion for the clock and timezone and writes no season', () => {
    const seasons = new MemorySeasonRepo();
    const deps = { clock: clock(), seasons };
    const suggestion = suggestRamadanStart(deps, { timezone: 'Europe/Stockholm' });

    expect(suggestion).toEqual(nextRamadanSuggestion(deps.clock.now(), 'Europe/Stockholm'));
    expect(suggestion).toEqual(suggestRamadanStart(deps, { timezone: 'europe/stockholm' }));
    expect(seasons.all()).toEqual([]);
  });

  it.each(['Mars/Olympus', '+01:00', 'UTC+01:00'])(
    'throws VALIDATION for timezone %s and writes nothing',
    (timezone) => {
      const seasons = new MemorySeasonRepo();
      const deps = { clock: clock(), seasons };
      let error: unknown;
      try {
        suggestRamadanStart(deps, { timezone });
      } catch (caught) {
        error = caught;
      }
      expect(error).toBeInstanceOf(DomainError);
      expect((error as DomainError).code).toBe('VALIDATION');
      expect(seasons.all()).toEqual([]);
    },
  );
});
