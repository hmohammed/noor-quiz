const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const BASE_MAX = 40;
const SLUG_MAX = 60;

/** True for a `baseSlug` result: lowercase, hyphen-separated, 2–40 characters. */
export function isBaseSlug(s: string): boolean {
  return s.length >= 2 && s.length <= BASE_MAX && SLUG.test(s);
}

function isSlug(s: string): boolean {
  return s.length <= SLUG_MAX && SLUG.test(s);
}

/**
 * NFC, trim, lower-case, turn every run of characters outside `[a-z0-9]` into `-`,
 * trim hyphens, keep at most 40 characters, trim hyphens again. Fewer than 2
 * characters left (including a non-Latin name) becomes `community`.
 * `Masjid Al-Noor` → `masjid-al-noor`. `مسجد النور` → `community`.
 */
export function baseSlug(name: string): string {
  const slug = name
    .normalize('NFC')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, BASE_MAX)
    .replace(/^-+|-+$/g, '');
  return slug.length < 2 ? 'community' : slug;
}

/** The base, then `${base}-2` … `${base}-20`, then `${base}-${tenantId.slice(-8)}` lower-cased. */
export function slugCandidates(base: string, tenantId: string): string[] {
  const candidates = [base];
  for (let n = 2; n <= 20; n++) candidates.push(`${base}-${n}`);
  candidates.push(`${base}-${tenantId.slice(-8).toLowerCase()}`);
  return candidates;
}

/**
 * The first candidate that is a safe slug and is not in `taken`, or null when every
 * candidate is taken or unsafe. Repositories call this inside the create transaction.
 */
export function chooseSlug(
  base: string,
  tenantId: string,
  taken: ReadonlySet<string>,
): string | null {
  for (const candidate of slugCandidates(base, tenantId)) {
    if (isSlug(candidate) && !taken.has(candidate)) return candidate;
  }
  return null;
}
