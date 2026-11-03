import { describe, expect, it, vi } from 'vitest';
import { DomainError, type DomainErrorCode } from '../errors';
import type { Clock } from '../ports/clock';
import type { IdGenerator } from '../ports/id-generator';
import type { CommunityRepo } from '../ports/repos';
import { instantFromIso } from '../time/instant';
import type { UserId } from '../users/user';
import { chooseSlug } from '../communities/slug';
import type { CreateWithOwnerInput } from '../communities/community';
import { createCommunity } from './create-community';

const AT = '2026-03-01T12:00:00.000Z';
const USER = '01ARZ3NDEKTSV4RRFFQ69G5FAV' as UserId;
const TENANT_1 = '01ARZ3NDEKTSV4RRFFQ69G5FAW';
const TENANT_2 = '01ARZ3NDEKTSV4RRFFQ69G5FB0';

function clockOnce(): Clock {
  let calls = 0;
  return {
    now: () => {
      calls += 1;
      if (calls > 1) throw new Error('clock read more than once');
      return instantFromIso(AT);
    },
  };
}

function sequenceIds(...ids: string[]): IdGenerator {
  let i = 0;
  return {
    newId: () => {
      const id = ids[i++];
      if (id === undefined) throw new Error('sequenceIds exhausted');
      return id;
    },
  };
}

/** Applies the real `chooseSlug`, so a second create with the same base gets `-2`. */
function slugRepo() {
  const taken = new Set<string>();
  const createWithOwner = vi.fn(async (input: CreateWithOwnerInput) => {
    const slug = chooseSlug(input.baseSlug, input.community.tenantId, taken);
    if (slug === null) throw new DomainError('CONFLICT', { reason: 'slug-exhausted' });
    taken.add(slug);
    return { community: { ...input.community, slug }, membership: { ...input.membership } };
  });
  const repo = {
    getById: vi.fn(async () => null),
    getByIds: vi.fn(async () => []),
    createWithOwner,
  } satisfies CommunityRepo;
  return { repo, createWithOwner };
}

async function expectDomainError(p: Promise<unknown>, code: DomainErrorCode) {
  const err = await p.then(
    () => expect.fail(`expected DomainError(${code})`),
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(DomainError);
  expect((err as DomainError).code).toBe(code);
}

describe('createCommunity', () => {
  it('stores the caller as owner and createdBy, a suffix-free slug, the canonical timezone and clock timestamps', async () => {
    const { repo, createWithOwner } = slugRepo();

    const result = await createCommunity(
      { clock: clockOnce(), ids: sequenceIds(TENANT_1), communities: repo },
      { userId: USER, name: '  Masjid   Al-Noor  ', timezone: 'europe/stockholm' },
    );

    expect(result.community).toMatchObject({
      id: TENANT_1,
      tenantId: TENANT_1,
      name: 'Masjid Al-Noor',
      slug: 'masjid-al-noor',
      timezone: 'Europe/Stockholm',
      createdBy: USER,
      createdAt: AT,
      updatedAt: AT,
      schemaVersion: 1,
    });
    expect(result.membership).toMatchObject({
      id: `${USER}_${TENANT_1}`,
      tenantId: TENANT_1,
      userId: USER,
      role: 'owner',
      createdAt: AT,
      updatedAt: AT,
      schemaVersion: 1,
    });
    expect(createWithOwner).toHaveBeenCalledTimes(1);
    const arg = createWithOwner.mock.calls[0]?.[0];
    expect(arg?.baseSlug).toBe('masjid-al-noor');
    expect(arg?.community).not.toHaveProperty('slug');
    expect(arg?.membership.role).toBe('owner');
  });

  it('gives a second community with the same normalised name the slug suffix -2 and its own owner membership', async () => {
    const { repo } = slugRepo();
    const deps = {
      clock: { now: () => instantFromIso(AT) },
      ids: sequenceIds(TENANT_1, TENANT_2),
      communities: repo,
    };

    const first = await createCommunity(deps, {
      userId: USER,
      name: 'Masjid Al-Noor',
      timezone: 'Europe/Stockholm',
    });
    const second = await createCommunity(deps, {
      userId: USER,
      name: '  Masjid   Al-Noor ',
      timezone: 'Europe/Stockholm',
    });

    expect(first.community.slug).toBe('masjid-al-noor');
    expect(second.community.slug).toBe('masjid-al-noor-2');
    expect(second.community.tenantId).not.toBe(first.community.tenantId);
    expect(second.membership.role).toBe('owner');
    expect(second.membership.id).toBe(`${USER}_${TENANT_2}`);
    expect(second.membership.id).not.toBe(first.membership.id);
    expect(second.membership.userId).toBe(USER);
    expect(second.community.createdBy).toBe(USER);
    expect(second.community.name).toBe('Masjid Al-Noor');
  });

  it.each([
    ['an invalid name', { userId: USER, name: 'A', timezone: 'Europe/Stockholm' }],
    ['an emoji name', { userId: USER, name: 'Masjid 😀', timezone: 'Europe/Stockholm' }],
    ['an invalid timezone', { userId: USER, name: 'Masjid Al-Noor', timezone: 'Mars/Olympus' }],
    ['an invalid user id', { userId: 'uid-alice', name: 'Masjid Al-Noor', timezone: 'UTC' }],
  ])('throws VALIDATION for %s and does not call the community repo', async (_label, input) => {
    const { repo, createWithOwner } = slugRepo();
    await expectDomainError(
      createCommunity({ clock: clockOnce(), ids: sequenceIds(TENANT_1), communities: repo }, input),
      'VALIDATION',
    );
    expect(createWithOwner).not.toHaveBeenCalled();
  });
});
