import { describe, expect, it, vi } from 'vitest';
import { DomainError, type DomainErrorCode } from '../errors';
import type { Clock } from '../ports/clock';
import type { UserRepo } from '../ports/repos';
import { addDuration, instantFromIso, toIso, type Duration, type Instant } from '../time/instant';
import type { ProfilePatch } from '../users/profile';
import { identityId, type Identity, type User, type UserId } from '../users/user';
import { getOrCreateUser } from './get-or-create-user';
import { updateProfile } from './update-profile';

// Core cannot import testkit (workspace cycle), so these are small inline stand-ins
// for FakeClock and InMemoryUserRepo.
function advancingClock(start = '2026-01-01T00:00:00.000Z') {
  let now: Instant = instantFromIso(start);
  return {
    now: () => now,
    advance(d: Duration) {
      now = addDuration(now, d);
    },
  } satisfies Clock & { advance(d: Duration): void };
}

function mapRepo() {
  const users = new Map<string, User>();
  const identities = new Map<string, Identity>();
  const repo = {
    getByIdentity: vi.fn(async (key: Parameters<UserRepo['getByIdentity']>[0]) => {
      const identity = identities.get(identityId(key));
      const user = identity ? users.get(identity.userId) : undefined;
      return user ? { ...user } : null;
    }),
    createWithIdentity: vi.fn(async (user: User, identity: Identity) => {
      const existing = identities.get(identity.id);
      if (existing) return { ...users.get(existing.userId)! };
      users.set(user.id, { ...user });
      identities.set(identity.id, identity);
      return { ...user };
    }),
    getById: vi.fn(async (id: string) => {
      const user = users.get(id);
      return user ? { ...user } : null;
    }),
    updateProfile: vi.fn(async (id: UserId, patch: ProfilePatch, updatedAt: string) => {
      const user = users.get(id);
      if (!user) throw new DomainError('NOT_FOUND', { reason: 'user-not-found' });
      const next = { ...user, ...patch, updatedAt };
      users.set(id, next);
      return { ...next };
    }),
    recordConsent: vi.fn(async () => {
      throw new Error('not used here');
    }),
  } satisfies UserRepo;
  return { repo, users };
}

const ULID_A = '01ARZ3NDEKTSV4RRFFQ69G5FAV' as UserId;
const ULID_UNKNOWN = '01ARZ3NDEKTSV4RRFFQ69G5FAW' as UserId;
const AT = '2026-01-01T00:00:00.000Z';

function seeded() {
  const { repo, users } = mapRepo();
  const clock = advancingClock();
  const stored: User = {
    id: ULID_A,
    displayName: 'Alice',
    locale: null,
    timezone: null,
    consent: null,
    createdAt: AT,
    updatedAt: AT,
    schemaVersion: 1,
  };
  users.set(ULID_A, { ...stored });
  return { repo, users, clock, stored, deps: { clock, users: repo } };
}

async function expectDomainError(p: Promise<unknown>, code: DomainErrorCode) {
  const err = await p.then(
    () => expect.fail(`expected DomainError(${code})`),
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(DomainError);
  expect((err as DomainError).code).toBe(code);
  return err as DomainError;
}

describe('updateProfile', () => {
  it('writes only the given field and takes updatedAt from the clock', async () => {
    const { deps, clock, stored, users } = seeded();
    clock.advance({ hours: 5 });

    const user = await updateProfile(deps, { userId: ULID_A, displayName: '  ሀሰን ' });

    const expected: User = { ...stored, displayName: 'ሀሰን', updatedAt: toIso(clock.now()) };
    expect(user).toEqual(expected);
    expect(users.get(ULID_A)).toEqual(expected);
    expect(user.updatedAt).toBe('2026-01-01T05:00:00.000Z');
  });

  it('keeps id, createdAt, schemaVersion and untouched fields', async () => {
    const { deps, clock, stored } = seeded();
    await updateProfile(deps, { userId: ULID_A, locale: 'am' });
    clock.advance({ days: 1 });

    const user = await updateProfile(deps, { userId: ULID_A, timezone: 'europe/stockholm' });

    expect(user).toEqual({
      id: stored.id,
      displayName: 'Alice',
      locale: 'am',
      timezone: 'Europe/Stockholm',
      consent: null,
      createdAt: AT,
      updatedAt: '2026-01-02T00:00:00.000Z',
      schemaVersion: 1,
    });
  });

  it('passes only the changed keys to the repo', async () => {
    const { deps, repo } = seeded();
    await updateProfile(deps, { userId: ULID_A, locale: 'sv', timezone: 'Asia/Riyadh' });
    expect(repo.updateProfile).toHaveBeenCalledWith(
      ULID_A,
      { locale: 'sv', timezone: 'Asia/Riyadh' },
      AT,
    );
  });

  it.each([
    ['an empty patch', {}, 'empty-patch'],
    ['an emoji name', { displayName: '😀😀' }, 'invalid-display-name'],
    ['a 33-code-point name', { displayName: 'ሀ'.repeat(33) }, 'invalid-display-name'],
    ['an unsupported locale', { locale: 'fr' }, 'unsupported-locale'],
    ['an offset timezone', { timezone: '+01:00' }, 'invalid-timezone'],
    ['an unknown timezone', { timezone: 'Mars/Olympus' }, 'invalid-timezone'],
  ])('throws VALIDATION for %s and writes nothing', async (_l, patch, reason) => {
    const { deps, repo, stored, users } = seeded();

    const err = await expectDomainError(
      updateProfile(deps, { userId: ULID_A, ...(patch as object) }),
      'VALIDATION',
    );

    expect(err.details).toEqual({ reason });
    expect(repo.updateProfile).not.toHaveBeenCalled();
    expect(users.get(ULID_A)).toEqual(stored);
  });

  it('throws VALIDATION for a non-ULID user id', async () => {
    const { deps } = seeded();
    await expectDomainError(
      updateProfile(deps, { userId: 'uid-alice' as UserId, displayName: 'Åsa' }),
      'VALIDATION',
    );
  });

  it('throws NOT_FOUND for an unknown user', async () => {
    const { deps } = seeded();
    await expectDomainError(
      updateProfile(deps, { userId: ULID_UNKNOWN, displayName: 'Åsa' }),
      'NOT_FOUND',
    );
  });

  it('a later sign-in with a different token name keeps the edited name', async () => {
    const { repo } = mapRepo();
    const clock = advancingClock();
    const ids = { newId: () => ULID_A };
    const identity = {
      provider: 'firebase' as const,
      subject: 'uid-alice',
      email: 'alice@example.com',
      emailVerified: true,
      name: 'Alice Google',
    };
    const created = await getOrCreateUser({ clock, ids, users: repo }, identity);
    await updateProfile({ clock, users: repo }, { userId: created.id, displayName: 'ሀሰን' });

    const again = await getOrCreateUser(
      { clock, ids, users: repo },
      { ...identity, name: 'Someone Else' },
    );

    expect(again.displayName).toBe('ሀሰን');
  });
});
