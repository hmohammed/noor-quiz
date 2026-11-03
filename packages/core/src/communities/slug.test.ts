import { describe, expect, it } from 'vitest';
import { baseSlug, chooseSlug, slugCandidates } from './slug';

const TENANT = '01ARZ3NDEKTSV4RRFFQ69G5FAV';

describe('baseSlug', () => {
  it('slugifies a Latin name', () => {
    expect(baseSlug('Masjid Al-Noor')).toBe('masjid-al-noor');
  });

  it('maps a non-Latin name to community', () => {
    expect(baseSlug('مسجد النور')).toBe('community');
  });

  it.each(['A', '!', '---', ''])(
    'maps %j to community when fewer than 2 characters remain',
    (name) => {
      expect(baseSlug(name)).toBe('community');
    },
  );

  it('keeps at most 40 characters and trims a trailing hyphen', () => {
    expect(baseSlug('a'.repeat(50))).toBe('a'.repeat(40));
    expect(baseSlug(`${'a'.repeat(39)}-bbbb`)).toBe('a'.repeat(39));
  });
});

describe('chooseSlug', () => {
  it('prefers the base, then -2', () => {
    const base = 'masjid-al-noor';
    expect(chooseSlug(base, TENANT, new Set())).toBe(base);
    expect(chooseSlug(base, TENANT, new Set([base]))).toBe(`${base}-2`);
  });

  it('uses the lower-cased last 8 characters of the tenant id when -2…-20 are taken', () => {
    const base = 'masjid';
    const suffix = TENANT.slice(-8).toLowerCase();
    const taken = new Set(slugCandidates(base, TENANT).slice(0, -1));
    expect(taken.has(`${base}-20`)).toBe(true);
    expect(chooseSlug(base, TENANT, taken)).toBe(`${base}-${suffix}`);
  });

  it('returns null when every candidate is taken', () => {
    const base = 'masjid';
    expect(chooseSlug(base, TENANT, new Set(slugCandidates(base, TENANT)))).toBeNull();
  });

  it('lists the base, -2 through -20, then the tenant suffix', () => {
    const candidates = slugCandidates('masjid', TENANT);
    expect(candidates).toHaveLength(21);
    expect(candidates[0]).toBe('masjid');
    expect(candidates[1]).toBe('masjid-2');
    expect(candidates[19]).toBe('masjid-20');
    expect(candidates[20]).toBe(`masjid-${TENANT.slice(-8).toLowerCase()}`);
  });
});
