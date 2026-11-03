import { describe, expect, it, vi } from 'vitest';
import { DomainError } from '../errors';
import type { CommunityRepo, MembershipRepo } from '../ports/repos';
import type { UserId } from '../users/user';
import {
  COMMUNITY_SCHEMA_VERSION,
  membershipId,
  type Community,
  type Membership,
  type TenantId,
} from '../communities/community';
import type { Role } from '../communities/role';
import { listMyCommunities } from './list-my-communities';

const USER = '01ARZ3NDEKTSV4RRFFQ69G5FAV' as UserId;
const OTHER = '01ARZ3NDEKTSV4RRFFQ69G5FB1' as UserId;
const EARLY = '01ARZ3NDEKTSV4RRFFQ69G5FAW' as TenantId;
const LATE_A = '01ARZ3NDEKTSV4RRFFQ69G5FAV' as TenantId;
const LATE_B = '01ARZ3NDEKTSV4RRFFQ69G5FB0' as TenantId;
const MISSING = '01ARZ3NDEKTSV4RRFFQ69G5FB2' as TenantId;
const HIDDEN = '01ARZ3NDEKTSV4RRFFQ69G5FB3' as TenantId;

function community(id: TenantId, createdAt: string, createdBy: UserId = USER): Community {
  return {
    id,
    tenantId: id,
    name: `Community ${id.slice(-4)}`,
    slug: `community-${id.slice(-4).toLowerCase()}`,
    timezone: 'Europe/Stockholm',
    createdBy,
    createdAt,
    updatedAt: createdAt,
    schemaVersion: COMMUNITY_SCHEMA_VERSION,
  };
}

function membership(tenantId: TenantId, userId: UserId, role: Role): Membership {
  return {
    id: membershipId(userId, tenantId),
    tenantId,
    userId,
    role,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    schemaVersion: 1,
  };
}

function repos(rows: Membership[], docs: Community[]) {
  const byUser = new Map<string, Membership[]>();
  for (const row of rows) {
    const list = byUser.get(row.userId) ?? [];
    list.push(row);
    byUser.set(row.userId, list);
  }
  const byId = new Map(docs.map((doc) => [doc.id, doc]));
  const getByIds = vi.fn(async (ids: readonly TenantId[]) =>
    ids.flatMap((id) => {
      const doc = byId.get(id);
      return doc ? [doc] : [];
    }),
  );
  const communities = {
    getById: vi.fn(async (id: TenantId) => byId.get(id) ?? null),
    getByIds,
    createWithOwner: vi.fn(),
  } satisfies CommunityRepo;
  const memberships = {
    get: vi.fn(async () => null),
    listByUser: vi.fn(async (userId: UserId) => byUser.get(userId) ?? []),
    deleteByUser: vi.fn(async () => undefined),
  } satisfies MembershipRepo;
  return { communities, memberships, getByIds };
}

describe('listMyCommunities', () => {
  it('returns only communities the user belongs to, sorted by createdAt then tenantId, and drops a missing doc', async () => {
    const docs = [
      community(LATE_A, '2026-02-01T00:00:00.000Z'),
      community(EARLY, '2026-01-01T00:00:00.000Z'),
      community(LATE_B, '2026-02-01T00:00:00.000Z'),
      community(HIDDEN, '2026-01-01T00:00:00.000Z', OTHER),
    ];
    const rows = [
      membership(LATE_B, USER, 'editor'),
      membership(MISSING, USER, 'member'),
      membership(EARLY, USER, 'owner'),
      membership(LATE_A, USER, 'admin'),
      membership(HIDDEN, OTHER, 'owner'),
    ];
    const { communities, memberships, getByIds } = repos(rows, docs);

    const listed = await listMyCommunities({ communities, memberships }, { userId: USER });

    expect(listed.map((item) => item.community.tenantId)).toEqual([EARLY, LATE_A, LATE_B]);
    expect(listed.map((item) => item.role)).toEqual(['owner', 'admin', 'editor']);
    expect(listed.some((item) => item.community.tenantId === HIDDEN)).toBe(false);
    expect(listed.some((item) => item.community.tenantId === MISSING)).toBe(false);
    expect(getByIds).toHaveBeenCalledTimes(1);
    const requested = getByIds.mock.calls[0]?.[0] ?? [];
    expect(requested).not.toContain(HIDDEN);
    expect(requested).toContain(MISSING);
  });

  it('returns an empty list when the user has no memberships', async () => {
    const { communities, memberships } = repos([], [community(EARLY, '2026-01-01T00:00:00.000Z')]);
    await expect(
      listMyCommunities({ communities, memberships }, { userId: USER }),
    ).resolves.toEqual([]);
  });

  it('throws VALIDATION for a non-ULID user id and does not read memberships', async () => {
    const { communities, memberships } = repos([], []);
    await expect(
      listMyCommunities({ communities, memberships }, { userId: 'uid-alice' }),
    ).rejects.toBeInstanceOf(DomainError);
    expect(memberships.listByUser).not.toHaveBeenCalled();
  });
});
