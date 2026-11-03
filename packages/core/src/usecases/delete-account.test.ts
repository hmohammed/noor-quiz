import { describe, expect, it, vi } from 'vitest';
import { DomainError, type DomainErrorCode } from '../errors';
import type { Clock } from '../ports/clock';
import type { IdGenerator } from '../ports/id-generator';
import type { MembershipRepo, UserRepo } from '../ports/repos';
import { instantFromIso } from '../time/instant';
import { CURRENT_CONSENT_VERSION, type Consent } from '../users/consent';
import type { ProfilePatch } from '../users/profile';
import {
  asTenantId,
  COMMUNITY_SCHEMA_VERSION,
  COMMUNITY_SLUG_SCHEMA_VERSION,
  membershipId,
  MEMBERSHIP_SCHEMA_VERSION,
  type Community,
  type CommunitySlug,
  type Membership,
  type TenantId,
} from '../communities/community';
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
const TENANT_1 = '01ARZ3NDEKTSV4RRFFQ69G5FB0' as TenantId;
const TENANT_2 = '01ARZ3NDEKTSV4RRFFQ69G5FB1' as TenantId;
const AT = '2026-01-01T00:00:00.000Z';

function membershipsOf(rows: Membership[] = []) {
  const memberships = new Map(rows.map((row) => [row.id, { ...row }]));
  const deleteByUser = vi.fn(async (userId: UserId) => {
    for (const [key, membership] of memberships) {
      if (membership.userId === userId) memberships.delete(key);
    }
  });
  const repo = {
    get: vi.fn(async (tenantId: TenantId, userId: UserId) => {
      const row = memberships.get(membershipId(userId, tenantId));
      return row ? { ...row } : null;
    }),
    listByUser: vi.fn(async (userId: UserId) =>
      [...memberships.values()].filter((row) => row.userId === userId).map((row) => ({ ...row })),
    ),
    deleteByUser,
  } satisfies MembershipRepo;
  return { repo, memberships, deleteByUser };
}

function row(userId: UserId, tenantId: TenantId, role: Membership['role']): Membership {
  return {
    id: membershipId(userId, tenantId),
    tenantId,
    userId,
    role,
    createdAt: AT,
    updatedAt: AT,
    schemaVersion: MEMBERSHIP_SCHEMA_VERSION,
  };
}
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
  it('deletes memberships first, then the linked user exactly once, and reports deleted', async () => {
    const { repo } = mapRepo();
    const { repo: memberships, deleteByUser } = membershipsOf();
    repo.getByIdentity.mockResolvedValueOnce(copy(storedUser));

    const result = await deleteAccount({ users: repo, memberships }, { identity: ALICE });

    expect(result).toStrictEqual({ deleted: true });
    expect(deleteByUser).toHaveBeenCalledTimes(1);
    expect(deleteByUser).toHaveBeenCalledWith(ULID_A);
    expect(repo.deleteUserAndIdentities).toHaveBeenCalledTimes(1);
    expect(repo.deleteUserAndIdentities).toHaveBeenCalledWith(ULID_A);
    expect(deleteByUser.mock.invocationCallOrder[0]).toBeLessThan(
      repo.deleteUserAndIdentities.mock.invocationCallOrder[0] ?? 0,
    );
  });

  it('does nothing for an identity with no user and does not touch memberships', async () => {
    const { repo } = mapRepo();
    const { repo: memberships, deleteByUser } = membershipsOf();

    const result = await deleteAccount({ users: repo, memberships }, { identity: ALICE });

    expect(result).toStrictEqual({ deleted: false });
    expect(repo.deleteUserAndIdentities).not.toHaveBeenCalled();
    expect(deleteByUser).not.toHaveBeenCalled();
  });

  it('removes that user’s memberships, leaves community and slug docs, and leaves every other member', async () => {
    const { repo, users, identities } = mapRepo();
    const owner = row(ULID_A, TENANT_1, 'owner');
    const otherHome = row(ULID_A, TENANT_2, 'member');
    const otherMember = row(ULID_B, TENANT_1, 'member');
    const { repo: memberships, memberships: stored } = membershipsOf([
      owner,
      otherHome,
      otherMember,
    ]);
    const community: Community = {
      id: TENANT_1,
      tenantId: TENANT_1,
      name: 'Masjid Al-Noor',
      slug: 'masjid-al-noor',
      timezone: 'Europe/Stockholm',
      createdBy: ULID_A,
      createdAt: AT,
      updatedAt: AT,
      schemaVersion: COMMUNITY_SCHEMA_VERSION,
    };
    const slug: CommunitySlug = {
      id: 'masjid-al-noor',
      slug: 'masjid-al-noor',
      tenantId: TENANT_1,
      createdAt: AT,
      updatedAt: AT,
      schemaVersion: COMMUNITY_SLUG_SCHEMA_VERSION,
    };
    const communities = new Map<string, Community>([[community.id, community]]);
    const slugs = new Map<string, CommunitySlug>([[slug.id, slug]]);
    users.set(ULID_A, copy(storedUser));
    identities.set(identityId(ALICE), {
      id: identityId(ALICE),
      provider: 'firebase',
      subject: ALICE.subject,
      userId: ULID_A,
      email: null,
      emailVerified: false,
      createdAt: AT,
      schemaVersion: 1,
    });

    const result = await deleteAccount({ users: repo, memberships }, { identity: ALICE });

    expect(result).toStrictEqual({ deleted: true });
    expect(stored.has(owner.id)).toBe(false);
    expect(stored.has(otherHome.id)).toBe(false);
    expect(stored.get(otherMember.id)).toEqual(otherMember);
    expect(communities.get(TENANT_1)).toEqual(community);
    expect(slugs.get('masjid-al-noor')).toEqual(slug);
    expect(asTenantId(TENANT_1)).toBe(TENANT_1);
    expect(users.has(ULID_A)).toBe(false);
  });

  it('after delete, signing in again creates a new user with new-user values', async () => {
    const { repo, users, identities } = mapRepo();
    const { repo: memberships } = membershipsOf();
    const deps = {
      clock: fixedClock,
      ids: sequenceIds(ULID_A, ULID_B),
      users: repo,
      memberships,
    };
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

  it('rejects an unsafe subject with UNAUTHENTICATED before any delete', async () => {
    const { repo } = mapRepo();
    const { repo: memberships, deleteByUser } = membershipsOf([row(ULID_A, TENANT_1, 'owner')]);

    await expectDomainError(
      deleteAccount(
        { users: repo, memberships },
        { identity: { provider: 'firebase', subject: 'a/b' } },
      ),
      'UNAUTHENTICATED',
    );
    expect(repo.deleteUserAndIdentities).not.toHaveBeenCalled();
    expect(deleteByUser).not.toHaveBeenCalled();
  });
});
