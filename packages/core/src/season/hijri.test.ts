import { describe, expect, it } from 'vitest';
import { DomainError } from '../errors';
import { instantFromIso } from '../time/instant';
import { addDays } from '../time/local-date';
import { nextRamadanSuggestion, suggestRamadan } from './hijri';

const umalqura = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura-nu-latn', {
  timeZone: 'UTC',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
});

function hijriOf(date: string): { year: number; month: number; day: number } {
  const parts = umalqura.formatToParts(new Date(`${date}T00:00:00Z`));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { year: get('year'), month: get('month'), day: get('day') };
}

describe('suggestRamadan', () => {
  it('suggests 18 February 2026 for 1447 (Eid al-Fitr 20 March 2026)', () => {
    const s = suggestRamadan(1447);
    expect(s).toEqual({ hijriYear: 1447, startDate: '2026-02-18', lengthDays: 30 });
    expect(Object.getPrototypeOf(s)).toBe(Object.prototype);
    expect(addDays(s.startDate, s.lengthDays)).toBe('2026-03-20');
  });

  it.each(Array.from({ length: 21 }, (_, i) => 1440 + i))(
    'is Umm al-Qura 1 Ramadan for %i',
    (year) => {
      const s = suggestRamadan(year);
      expect(s.hijriYear).toBe(year);
      expect(hijriOf(s.startDate)).toEqual({ year, month: 9, day: 1 });
      expect(hijriOf(addDays(s.startDate, -1)).month).toBe(8);
      expect(hijriOf(addDays(s.startDate, s.lengthDays))).toEqual({ year, month: 10, day: 1 });
      expect([29, 30]).toContain(s.lengthDays);
    },
  );

  it.each([1447.5, 1399, 1501, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects hijri year %j with DomainError VALIDATION',
    (year) => {
      let error: unknown;
      try {
        suggestRamadan(year);
      } catch (e) {
        error = e;
      }
      expect(error).toBeInstanceOf(DomainError);
      expect((error as DomainError).code).toBe('VALIDATION');
      expect((error as DomainError).details).toEqual({ reason: 'invalid-hijri-year' });
    },
  );
});

describe('nextRamadanSuggestion', () => {
  it.each([
    ['2026-01-15T12:00:00Z', 1447],
    ['2026-02-18T12:00:00Z', 1447],
    ['2026-02-19T12:00:00Z', 1448],
  ])('at %s in Europe/Stockholm suggests %i', (iso, year) => {
    expect(nextRamadanSuggestion(instantFromIso(iso), 'Europe/Stockholm')).toEqual(
      suggestRamadan(year),
    );
  });

  it('uses the local date in the given zone', () => {
    // 22:30Z on 18 Feb is already 19 Feb in Riyadh (+03), still 18 Feb in Toronto (−05).
    const now = instantFromIso('2026-02-18T22:30:00Z');
    expect(nextRamadanSuggestion(now, 'Asia/Riyadh').hijriYear).toBe(1448);
    expect(nextRamadanSuggestion(now, 'America/Toronto').hijriYear).toBe(1447);
  });

  it('rejects an unknown zone with DomainError VALIDATION', () => {
    expect(() =>
      nextRamadanSuggestion(instantFromIso('2026-01-15T12:00:00Z'), 'Mars/Olympus_Mons'),
    ).toThrow(DomainError);
  });
});
