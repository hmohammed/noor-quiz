import { describe, expect, it } from 'vitest';
import {
  getOrCreateUser,
  identityId,
  isDomainError,
  isUlid,
  USER_SCHEMA_VERSION,
  type DomainErrorCode,
  type Identity,
  type User,
  type UserId,
  type UserRepo,
  type VerifiedIdentity,
} from '@noor/core';
import { FakeClock } from '../fake-clock';
import { FakeIdGenerator } from '../fake-id-generator';

export interface UserRepoHarness {
  repo: UserRepo;
  counts(): Promise<{ users: number; identities: number }>;
}

const INVALID_SUBJECTS = ['', 'a/b', '..', 'a b', 'x'.repeat(129), 'ü'];

const ULID_A = '01ARZ3NDEKTSV4RRFFQ69G5FAV' as UserId;
const ULID_B = '01ARZ3NDEKTSV4RRFFQ69G5FAW' as UserId;
const AT = '2026-01-01T00:00:00.000Z';

function verified(subject: string, name: string | null = 'Alice'): VerifiedIdentity {
  return { provider: 'firebase', subject, email: 'a@example.com', emailVerified: true, name };
}

function userDoc(id: UserId): User {
  return { id, displayName: 'Someone', createdAt: AT, updatedAt: AT, schemaVersion: 1 };
}

function identityDoc(subject: string, userId: UserId, id = `firebase_${subject}`): Identity {
  return {
    id,
    provider: 'firebase',
    subject,
    userId,
    email: null,
    emailVerified: false,
    createdAt: AT,
    schemaVersion: USER_SCHEMA_VERSION,
  };
}

async function expectDomainError(p: Promise<unknown>, code: DomainErrorCode): Promise<void> {
  const err = await p.then(
    () => expect.fail(`expected DomainError(${code})`),
    (e: unknown) => e,
  );
  expect(isDomainError(err)).toBe(true);
  expect((err as { code: string }).code).toBe(code);
}

/**
 * Behaviour every UserRepo must have. Runs against InMemoryUserRepo in testkit and
 * against FirestoreUserRepo on the emulator. `makeImpl` must return an empty store.
 */
export function runUserRepoContract(name: string, makeImpl: () => Promise<UserRepoHarness>): void {
  describe(`UserRepo contract: ${name}`, () => {
    async function setup() {
      const harness = await makeImpl();
      const clock = new FakeClock();
      const ids = new FakeIdGenerator();
      const deps = { clock, ids, users: harness.repo };
      return { ...harness, clock, deps };
    }

    it('creates one user and one identity on the first call', async () => {
      const { repo, counts, deps } = await setup();
      const user = await getOrCreateUser(deps, verified('uid-alice'));

      expect(isUlid(user.id)).toBe(true);
      expect(await counts()).toEqual({ users: 1, identities: 1 });
      expect(await repo.getById(user.id)).toEqual(user);
      expect(await repo.getByIdentity({ provider: 'firebase', subject: 'uid-alice' })).toEqual(
        user,
      );
    });

    it('returns the same user on a later call, even with a new name and time', async () => {
      const { counts, clock, deps } = await setup();
      const first = await getOrCreateUser(deps, verified('uid-alice', 'Alice'));
      clock.advance({ days: 3 });
      const again = await getOrCreateUser(deps, verified('uid-alice', 'Someone Else'));

      expect(again.id).toBe(first.id);
      expect(again.displayName).toBe(first.displayName);
      expect(again.createdAt).toBe(first.createdAt);
      expect(await counts()).toEqual({ users: 1, identities: 1 });
    });

    it('10 concurrent calls for one identity give one userId, 1 user and 1 identity', async () => {
      const { counts, deps } = await setup();
      const users = await Promise.all(
        Array.from({ length: 10 }, () => getOrCreateUser(deps, verified('uid-alice'))),
      );

      expect(new Set(users.map((u) => u.id)).size).toBe(1);
      expect(await counts()).toEqual({ users: 1, identities: 1 });
    });

    it('gives two different subjects two different users', async () => {
      const { counts, deps } = await setup();
      const a = await getOrCreateUser(deps, verified('uid-alice'));
      const b = await getOrCreateUser(deps, verified('uid-bob'));

      expect(a.id).not.toBe(b.id);
      expect(await counts()).toEqual({ users: 2, identities: 2 });
    });

    it('createWithIdentity for an existing identity returns the linked user and writes nothing', async () => {
      const { repo, counts } = await setup();
      const userA = userDoc(ULID_A);
      await repo.createWithIdentity(userA, identityDoc('uid-alice', ULID_A));

      const result = await repo.createWithIdentity(
        userDoc(ULID_B),
        identityDoc('uid-alice', ULID_B),
      );

      expect(result).toEqual(userA);
      expect(await counts()).toEqual({ users: 1, identities: 1 });
      expect(await repo.getById(ULID_B)).toBeNull();
    });

    it('returns null for an unknown identity or user id', async () => {
      const { repo } = await setup();
      expect(await repo.getByIdentity({ provider: 'firebase', subject: 'nobody' })).toBeNull();
      expect(await repo.getById(ULID_A)).toBeNull();
    });

    it.each(INVALID_SUBJECTS)(
      'rejects subject %j with UNAUTHENTICATED and writes nothing',
      async (subject) => {
        const { repo, counts } = await setup();
        await expectDomainError(
          repo.getByIdentity({ provider: 'firebase', subject }),
          'UNAUTHENTICATED',
        );
        await expectDomainError(
          repo.createWithIdentity(userDoc(ULID_A), identityDoc(subject, ULID_A)),
          'UNAUTHENTICATED',
        );
        expect(await counts()).toEqual({ users: 0, identities: 0 });
      },
    );

    it('rejects an identity whose userId does not match the user', async () => {
      const { repo, counts } = await setup();
      await expectDomainError(
        repo.createWithIdentity(userDoc(ULID_A), identityDoc('uid-alice', ULID_B)),
        'VALIDATION',
      );
      expect(await counts()).toEqual({ users: 0, identities: 0 });
    });

    it('rejects an identity whose id does not match provider and subject', async () => {
      const { repo, counts } = await setup();
      await expectDomainError(
        repo.createWithIdentity(
          userDoc(ULID_A),
          identityDoc('uid-alice', ULID_A, identityId({ provider: 'firebase', subject: 'bob' })),
        ),
        'VALIDATION',
      );
      expect(await counts()).toEqual({ users: 0, identities: 0 });
    });
  });
}
