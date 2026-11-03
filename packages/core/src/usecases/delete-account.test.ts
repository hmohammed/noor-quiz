import { describe, expect, it, vi } from 'vitest';
import { DomainError, type DomainErrorCode } from '../errors';
import type { Clock } from '../ports/clock';
import type { IdGenerator } from '../ports/id-generator';
import type { UserRepo } from '../ports/repos';
import { instantFromIso } from '../time/instant';
import { CURRENT_CONSENT_VERSION, type Consent } from '../users/consent';
import type { ProfilePatch } from '../users/profile';
import {
  identityId,
  type Identity,
  type IdentityKey,
  type User,
  type UserId,
  type VerifiedIdentity,
} from '../users/user';
import { acceptConsent } from './accept-consent';
import { deleteAccount } from './delete-account';
import { getOrCreateUser } from './get-or-create-user';
import { updateProfile } from './update-profile';

// Core cannot import testkit (workspace cycle), so these are small inline stand-ins
// for FakeClock, FakeIdGenerator and InMemoryUserRepo.
const fixedClock: Clock = { now: () => instantFromIso('2026-01-01T00:00:00.000Z') };

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

const copy = (u: User): User => ({ ...u, consent: u.consent && { ...u.consent } });

function mapRepo() {
  const users = new Map<string, User>();
  const identities = new Map<string, Identity>();
  const repo = {
    getByIdentity: vi.fn(async (key: IdentityKey) => {
      const identity = identities.get(identityId(key));
      const user = identity ? users.get(identity.userId) : undefined;
      return user ? copy(user) : null;
    }),
    createWithIdentity: vi.fn(async (user: User, identity: Identity) => {
      const existing = identities.get(identity.id);
      if (existing) return copy(users.get(existing.userId)!);
      users.set(user.id, copy(user));
      identities.set(identity.id, { ...identity });
      return copy(user);
    }),
    getById: vi.fn(async (id: string) => {
      const user = users.get(id);
      return user ? copy(user) : null;
    }),
    updateProfile: vi.fn(async (id: UserId, patch: ProfilePatch, updatedAt: string) => {
      const user = users.get(id);
      if (!user) throw new DomainError('NOT_FOUND', { reason: 'user-not-found' });
      const next = { ...copy(user), ...patch, updatedAt };
      users.set(id, next);
      return copy(next);
    }),
    recordConsent: vi.fn(async (id: UserId, consent: Consent, updatedAt: string) => {
      const user = users.get(id);
      if (!user) throw new DomainError('NOT_FOUND', { reason: 'user-not-found' });
      const next = { ...copy(user), consent: { ...consent }, updatedAt };
      users.set(id, next);
      return copy(next);
    }),
    deleteUserAndIdentities: vi.fn(async (id: UserId) => {
      users.delete(id);
      for (const [key, identity] of identities) {
        if (identity.userId === id) identities.delete(key);
      }
    }),
  } satisfies UserRepo;
  return { repo, users, identities };
}

const ULID_A = '01ARZ3NDEKTSV4RRFFQ69G5FAV' as UserId;
const ULID_B = '01ARZ3NDEKTSV4RRFFQ69G5FAW' as UserId;
const AT = '2026-01-01T00:00:00.000Z';
const ALICE: IdentityKey = { provider: 'firebase', subject: 'uid-alice' };

const storedUser: User = {
  id: ULID_A,
  displayName: 'Alice',
  locale: null,
  timezone: null,
  consent: null,
  createdAt: AT,
  updatedAt: AT,
  schemaVersion: 1,
};

async function expectDomainError(p: Promise<unknown>, code: DomainErrorCode) {
  const err = await p.then(
    () => expect.fail(`expected DomainError(${code})`),
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(DomainError);
  expect((err as DomainError).code).toBe(code);
}

describe('deleteAccount', () => {
  it('deletes the linked user exactly once and reports deleted', async () => {
    const { repo } = mapRepo();
    repo.getByIdentity.mockResolvedValueOnce(copy(storedUser));

    const result = await deleteAccount({ users: repo }, { identity: ALICE });

    expect(result).toStrictEqual({ deleted: true });
    expect(repo.deleteUserAndIdentities).toHaveBeenCalledTimes(1);
    expect(repo.deleteUserAndIdentities).toHaveBeenCalledWith(ULID_A);
  });

  it('does nothing for an identity with no user and reports not deleted', async () => {
    const { repo } = mapRepo();

    const result = await deleteAccount({ users: repo }, { identity: ALICE });

    expect(result).toStrictEqual({ deleted: false });
    expect(repo.deleteUserAndIdentities).not.toHaveBeenCalled();
  });

  it('after delete, signing in again creates a new user with new-user values', async () => {
    const { repo, users, identities } = mapRepo();
    const deps = { clock: fixedClock, ids: sequenceIds(ULID_A, ULID_B), users: repo };
    const verified: VerifiedIdentity = {
      ...ALICE,
      email: 'alice@example.com',
      emailVerified: true,
      name: 'Alice',
    };

    const first = await getOrCreateUser(deps, verified);
    await acceptConsent(deps, { userId: first.id, version: CURRENT_CONSENT_VERSION });
    await updateProfile(deps, {
      userId: first.id,
      displayName: 'Åsa',
      locale: 'sv',
      timezone: 'Europe/Stockholm',
    });

    expect(await deleteAccount(deps, { identity: ALICE })).toStrictEqual({ deleted: true });
    expect(users.size).toBe(0);
    expect(identities.size).toBe(0);

    const second = await getOrCreateUser(deps, verified);
    expect(second.id).not.toBe(first.id);
    expect(second).toMatchObject({
      displayName: 'Alice',
      locale: null,
      timezone: null,
      consent: null,
    });
  });

  it('rejects an unsafe subject with UNAUTHENTICATED and never deletes', async () => {
    const { repo } = mapRepo();

    await expectDomainError(
      deleteAccount({ users: repo }, { identity: { provider: 'firebase', subject: 'a/b' } }),
      'UNAUTHENTICATED',
    );
    expect(repo.deleteUserAndIdentities).not.toHaveBeenCalled();
  });
});
