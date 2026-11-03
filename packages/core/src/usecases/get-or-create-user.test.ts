import { describe, expect, it, vi } from 'vitest';
import { DomainError } from '../errors';
import type { Clock } from '../ports/clock';
import type { IdGenerator } from '../ports/id-generator';
import type { UserRepo } from '../ports/repos';
import { instantFromIso, toIso } from '../time/instant';
import { CURRENT_CONSENT_VERSION, type Consent } from '../users/consent';
import {
  identityId,
  type Identity,
  type User,
  type UserId,
  type VerifiedIdentity,
} from '../users/user';
import { getOrCreateUser } from './get-or-create-user';

// Core cannot import testkit (workspace cycle), so these are small inline stubs.
const NOW = instantFromIso('2026-02-03T04:05:06.789Z');
const fixedClock: Clock = { now: () => NOW };

function sequenceIds(...ids: string[]): IdGenerator & { newId: ReturnType<typeof vi.fn> } {
  let i = 0;
  return {
    newId: vi.fn(() => {
      const id = ids[i++];
      if (id === undefined) throw new Error('sequenceIds exhausted');
      return id;
    }),
  };
}

function mapRepo() {
  const users = new Map<string, User>();
  const identities = new Map<string, Identity>();
  const repo = {
    getByIdentity: vi.fn(async (key: Parameters<UserRepo['getByIdentity']>[0]) => {
      const identity = identities.get(identityId(key));
      return identity ? (users.get(identity.userId) ?? null) : null;
    }),
    createWithIdentity: vi.fn(async (user: User, identity: Identity) => {
      const existing = identities.get(identity.id);
      if (existing) return users.get(existing.userId)!;
      users.set(user.id, user);
      identities.set(identity.id, identity);
      return user;
    }),
    getById: vi.fn(async (id: string) => users.get(id) ?? null),
    updateProfile: vi.fn(async () => {
      throw new Error('not used here');
    }),
    recordConsent: vi.fn(async (id: UserId, consent: Consent, updatedAt: string) => {
      const next = { ...users.get(id)!, consent, updatedAt };
      users.set(id, next);
      return next;
    }),
    deleteUserAndIdentities: vi.fn(async () => {
      throw new Error('not used here');
    }),
  } satisfies UserRepo;
  return { repo, users, identities };
}

const ULID_A = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
const ULID_B = '01ARZ3NDEKTSV4RRFFQ69G5FAW';

const input: VerifiedIdentity = {
  provider: 'firebase',
  subject: 'uid-alice',
  email: 'alice@example.com',
  emailVerified: true,
  name: '  Alice  ',
};

describe('getOrCreateUser', () => {
  it('creates a user and identity with clock timestamps and schema version 1', async () => {
    const { repo, identities } = mapRepo();
    const user = await getOrCreateUser(
      { clock: fixedClock, ids: sequenceIds(ULID_A), users: repo },
      input,
    );

    const iso = toIso(NOW);
    expect(user).toStrictEqual({
      id: ULID_A,
      displayName: 'Alice',
      locale: null,
      timezone: null,
      consent: null,
      createdAt: iso,
      updatedAt: iso,
      schemaVersion: 1,
    });
    expect(identities.get('firebase_uid-alice')).toEqual({
      id: 'firebase_uid-alice',
      provider: 'firebase',
      subject: 'uid-alice',
      userId: ULID_A,
      email: 'alice@example.com',
      emailVerified: true,
      createdAt: iso,
      schemaVersion: 1,
    });
  });

  it('returns the stored user unchanged and mints no id when the identity exists', async () => {
    const { repo } = mapRepo();
    const first = await getOrCreateUser(
      { clock: fixedClock, ids: sequenceIds(ULID_A), users: repo },
      input,
    );
    repo.createWithIdentity.mockClear();

    const ids = sequenceIds(ULID_B);
    const later: Clock = { now: () => instantFromIso('2026-05-01T00:00:00Z') };
    const again = await getOrCreateUser(
      { clock: later, ids, users: repo },
      { ...input, name: 'Someone Else', email: 'new@example.com', emailVerified: false },
    );

    expect(again).toEqual(first);
    expect(ids.newId).not.toHaveBeenCalled();
    expect(repo.createWithIdentity).not.toHaveBeenCalled();
  });

  it('a later sign-in returns the stored consent unchanged', async () => {
    const { repo } = mapRepo();
    const first = await getOrCreateUser(
      { clock: fixedClock, ids: sequenceIds(ULID_A), users: repo },
      input,
    );
    const consent = { version: CURRENT_CONSENT_VERSION, acceptedAt: toIso(NOW) };
    await repo.recordConsent(first.id, consent, toIso(NOW));

    const later: Clock = { now: () => instantFromIso('2026-05-01T00:00:00Z') };
    const again = await getOrCreateUser(
      { clock: later, ids: sequenceIds(ULID_B), users: repo },
      input,
    );

    expect(first.consent).toBeNull();
    expect(again.consent).toStrictEqual(consent);
  });

  it('returns the winner when createWithIdentity reports another user (lost race)', async () => {
    const { repo } = mapRepo();
    const winner: User = {
      id: ULID_B as User['id'],
      displayName: 'Winner',
      locale: null,
      timezone: null,
      consent: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      schemaVersion: 1,
    };
    repo.createWithIdentity.mockResolvedValueOnce(winner);

    const user = await getOrCreateUser(
      { clock: fixedClock, ids: sequenceIds(ULID_A), users: repo },
      input,
    );
    expect(user).toBe(winner);
  });

  it.each([
    ['an invalid subject', { ...input, subject: 'a/b' }, 'invalid-subject'],
    [
      'a provider other than firebase',
      { ...input, provider: 'google' } as unknown as VerifiedIdentity,
      'invalid-provider',
    ],
  ])('throws UNAUTHENTICATED for %s before any repo or id call', async (_l, bad, reason) => {
    const { repo } = mapRepo();
    const ids = sequenceIds(ULID_A);

    const err = await getOrCreateUser({ clock: fixedClock, ids, users: repo }, bad).catch(
      (e: unknown) => e,
    );

    expect(err).toBeInstanceOf(DomainError);
    expect((err as DomainError).code).toBe('UNAUTHENTICATED');
    expect((err as DomainError).details).toEqual({ reason });
    const serialised = JSON.stringify((err as DomainError).details);
    expect(serialised).not.toContain(bad.subject);
    expect(serialised).not.toContain('alice@example.com');
    expect(repo.getByIdentity).not.toHaveBeenCalled();
    expect(repo.createWithIdentity).not.toHaveBeenCalled();
    expect(ids.newId).not.toHaveBeenCalled();
  });
});
