import { describe, expect, it, vi } from 'vitest';
import { DomainError, type DomainErrorCode } from '../errors';
import type { Clock } from '../ports/clock';
import type { UserRepo } from '../ports/repos';
import { addDuration, instantFromIso, toIso, type Duration, type Instant } from '../time/instant';
import { CURRENT_CONSENT_VERSION, type Consent } from '../users/consent';
import type { User, UserId } from '../users/user';
import { acceptConsent } from './accept-consent';

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

const copy = (u: User): User => ({ ...u, consent: u.consent && { ...u.consent } });

function mapRepo() {
  const users = new Map<string, User>();
  const repo = {
    getByIdentity: vi.fn(async () => null),
    createWithIdentity: vi.fn(async (user: User) => user),
    getById: vi.fn(async (id: string) => {
      const user = users.get(id);
      return user ? copy(user) : null;
    }),
    updateProfile: vi.fn(async () => {
      throw new Error('not used here');
    }),
    recordConsent: vi.fn(async (id: UserId, consent: Consent, updatedAt: string) => {
      const user = users.get(id);
      if (!user) throw new DomainError('NOT_FOUND', { reason: 'user-not-found' });
      const next = { ...user, consent: { ...consent }, updatedAt };
      users.set(id, next);
      return copy(next);
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
  users.set(ULID_A, copy(stored));
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

describe('acceptConsent', () => {
  it('records the current version with acceptedAt and updatedAt from the clock', async () => {
    const { deps, clock, stored, users } = seeded();
    clock.advance({ hours: 3 });
    const now = toIso(clock.now());

    const user = await acceptConsent(deps, { userId: ULID_A, version: CURRENT_CONSENT_VERSION });

    const expected: User = {
      ...stored,
      consent: { version: CURRENT_CONSENT_VERSION, acceptedAt: now },
      updatedAt: now,
    };
    expect(user).toStrictEqual(expected);
    expect(users.get(ULID_A)).toStrictEqual(expected);
  });

  it('a second accept keeps the first acceptedAt and updatedAt and writes nothing', async () => {
    const { deps, clock, repo } = seeded();
    const first = await acceptConsent(deps, { userId: ULID_A, version: CURRENT_CONSENT_VERSION });
    clock.advance({ days: 1 });

    const again = await acceptConsent(deps, { userId: ULID_A, version: CURRENT_CONSENT_VERSION });

    expect(again).toStrictEqual(first);
    expect(again.consent?.acceptedAt).toBe(AT);
    expect(again.updatedAt).toBe(AT);
    expect(repo.recordConsent).toHaveBeenCalledTimes(1);
  });

  it('replaces an older accepted version with the current one and a new acceptedAt', async () => {
    const { deps, clock, repo } = seeded();
    await repo.recordConsent(ULID_A, { version: '2000-01-01', acceptedAt: AT }, AT);
    clock.advance({ days: 2 });
    const now = toIso(clock.now());

    const user = await acceptConsent(deps, { userId: ULID_A, version: CURRENT_CONSENT_VERSION });

    expect(user.consent).toStrictEqual({ version: CURRENT_CONSENT_VERSION, acceptedAt: now });
    expect(user.updatedAt).toBe(now);
  });

  it.each([
    ['an older version', '2000-01-01'],
    ['an empty version', ''],
  ])('throws CONFLICT for %s and changes nothing', async (_label, version) => {
    const { deps, repo, stored, users } = seeded();

    const err = await expectDomainError(acceptConsent(deps, { userId: ULID_A, version }), 'CONFLICT');

    expect(err.details).toEqual({ reason: 'outdated-consent-version' });
    expect(repo.recordConsent).not.toHaveBeenCalled();
    expect(users.get(ULID_A)).toStrictEqual(stored);
  });

  it('throws NOT_FOUND for an unknown user', async () => {
    const { deps } = seeded();
    await expectDomainError(
      acceptConsent(deps, { userId: ULID_UNKNOWN, version: CURRENT_CONSENT_VERSION }),
      'NOT_FOUND',
    );
  });

  it('throws VALIDATION for a non-ULID user id', async () => {
    const { deps, repo } = seeded();
    await expectDomainError(
      acceptConsent(deps, { userId: 'uid-alice' as UserId, version: CURRENT_CONSENT_VERSION }),
      'VALIDATION',
    );
    expect(repo.getById).not.toHaveBeenCalled();
  });
});
