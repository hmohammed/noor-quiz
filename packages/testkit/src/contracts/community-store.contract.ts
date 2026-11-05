import { describe, expect, it } from 'vitest';
import {
  asTenantId,
  asUserId,
  COMMUNITY_SCHEMA_VERSION,
  COMMUNITY_SLUG_SCHEMA_VERSION,
  isDomainError,
  MEMBERSHIP_SCHEMA_VERSION,
  membershipId,
  type CommunityRepo,
  type CommunitySlug,
  type CreateWithOwnerInput,
  type DomainErrorCode,
  type Membership,
  type MembershipRepo,
  type Role,
  type TenantId,
  type UserId,
} from '@noor/core';

export interface CommunityStoreHarness {
  communities: CommunityRepo;
  memberships: MembershipRepo;
  counts(): Promise<{ communities: number; memberships: number; slugs: number }>;
  readSlug(slug: string): Promise<CommunitySlug | null>;
  /** Inserts a membership without going through `createWithOwner`. */
  seedMembership(membership: Membership): Promise<void>;
}

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const AT = '2024-05-06T07:08:09.123Z';
const NEXT = '2026-02-02T03:04:05.000Z';
const EMPTY = { communities: 0, memberships: 0, slugs: 0 };

/** A ULID whose payload is `n`. First character is `0`, so it matches `ULID_PATTERN`. */
function ulid(n: number): string {
  let rest = n;
  let body = '';
  for (let i = 0; i < 25; i++) {
    body = ALPHABET[rest % 32]! + body;
    rest = Math.floor(rest / 32);
  }
  return `0${body}`;
}

const USER_A = ulid(100) as UserId;
const USER_B = ulid(101) as UserId;
/** Two tenant ids that share a last-8, so they compete for the same fallback slug. */
const SUFFIX = 'Q69G5FAV';
const SAME_A = `0${'A'.repeat(17)}${SUFFIX}`;
const SAME_B = `1${'A'.repeat(17)}${SUFFIX}`;

function ownerInput(
  tenantId: string,
  userId: string,
  baseSlug: string,
  at = AT,
): CreateWithOwnerInput {
  const tenant = asTenantId(tenantId);
  const user = asUserId(userId);
  return {
    community: {
      id: tenant,
      tenantId: tenant,
      name: 'Masjid Al-Noor',
      timezone: 'Europe/Stockholm',
      createdBy: user,
      createdAt: at,
      updatedAt: at,
      schemaVersion: COMMUNITY_SCHEMA_VERSION,
    },
    baseSlug,
    membership: {
      id: membershipId(user, tenant),
      tenantId: tenant,
      userId: user,
      role: 'owner',
      createdAt: at,
      updatedAt: at,
      schemaVersion: MEMBERSHIP_SCHEMA_VERSION,
    },
  };
}

function memberOf(userId: UserId, tenantId: TenantId): Membership {
  return {
    id: membershipId(userId, tenantId),
    tenantId,
    userId,
    role: 'member',
    createdAt: AT,
    updatedAt: AT,
    schemaVersion: MEMBERSHIP_SCHEMA_VERSION,
  };
}

async function expectDomainError(
  p: Promise<unknown>,
  code: DomainErrorCode,
  reason?: string,
): Promise<void> {
  const err = await p.then(
    () => expect.fail(`expected DomainError(${code})`),
    (e: unknown) => e,
  );
  expect(isDomainError(err)).toBe(true);
  expect((err as { code: string }).code).toBe(code);
  if (reason !== undefined) {
    expect((err as { details?: { reason?: string } }).details?.reason).toBe(reason);
  }
}

/**
 * Behaviour every community store must have. Runs against the in-memory store and
 * against the Firestore repos on the emulator. `makeImpl` must return an empty store.
 */
export function runCommunityStoreContract(
  name: string,
  makeImpl: () => Promise<CommunityStoreHarness>,
): void {
  describe(`community store contract: ${name}`, () => {
    it('creates the owner, the community and the slug doc with the caller’s timestamps', async () => {
      const { communities, memberships, counts, readSlug } = await makeImpl();
      const input = ownerInput(ulid(1), USER_A, 'masjid-al-noor');

      const result = await communities.createWithOwner(input);

      expect(result.community).toEqual({ ...input.community, slug: 'masjid-al-noor' });
      expect(result.membership).toEqual(input.membership);
      expect(result.membership.role).toBe('owner');
      expect(result.community.createdBy).toBe(USER_A);
      expect(result.community.createdAt).toBe(AT);
      expect(result.community.updatedAt).toBe(AT);
      expect(await communities.getById(result.community.tenantId)).toEqual(result.community);
      expect(await memberships.get(result.community.tenantId, USER_A)).toEqual(result.membership);
      expect(await readSlug('masjid-al-noor')).toEqual({
        id: 'masjid-al-noor',
        slug: 'masjid-al-noor',
        tenantId: result.community.tenantId,
        createdAt: AT,
        updatedAt: AT,
        schemaVersion: COMMUNITY_SLUG_SCHEMA_VERSION,
      });
      expect(await counts()).toEqual({ communities: 1, memberships: 1, slugs: 1 });
    });

    it('gives the same base slug the suffix -2 and a separate owner membership', async () => {
      const { communities, memberships } = await makeImpl();
      const first = await communities.createWithOwner(ownerInput(ulid(1), USER_A, 'masjid'));
      const second = await communities.createWithOwner(ownerInput(ulid(2), USER_B, 'masjid'));

      expect(first.community.slug).toBe('masjid');
      expect(second.community.slug).toBe('masjid-2');
      expect(second.membership.id).not.toBe(first.membership.id);
      expect(second.membership.role).toBe('owner');
      expect(second.membership.userId).toBe(USER_B);
      expect(await memberships.get(first.community.tenantId, USER_A)).toEqual(first.membership);
      expect(await memberships.get(second.community.tenantId, USER_B)).toEqual(second.membership);
    });

    it.each([
      [
        'a non-owner role',
        (input: CreateWithOwnerInput) => {
          input.membership.role = 'member';
        },
      ],
      [
        'a different createdBy',
        (input: CreateWithOwnerInput) => {
          input.community.createdBy = USER_B;
        },
      ],
      [
        'a community id that is not the tenant id',
        (input: CreateWithOwnerInput) => {
          input.community.id = asTenantId(ulid(9));
        },
      ],
      [
        'a membership for another tenant',
        (input: CreateWithOwnerInput) => {
          input.membership.tenantId = asTenantId(ulid(9));
        },
      ],
      [
        'a membership id that does not match',
        (input: CreateWithOwnerInput) => {
          input.membership.id = membershipId(USER_A, asTenantId(ulid(9)));
        },
      ],
      [
        'an uppercase base slug',
        (input: CreateWithOwnerInput) => {
          input.baseSlug = 'Masjid';
        },
      ],
      [
        'a base slug with a slash',
        (input: CreateWithOwnerInput) => {
          input.baseSlug = 'a/b';
        },
      ],
    ])('VALIDATION for %s writes nothing', async (_label, mutate) => {
      const { communities, counts } = await makeImpl();
      const live = ownerInput(ulid(1), USER_A, 'masjid');
      mutate(live);
      await expectDomainError(communities.createWithOwner(live), 'VALIDATION');
      expect(await counts()).toEqual(EMPTY);
      expect(await communities.getById(asTenantId(ulid(1)))).toBeNull();
    });

    it('CONFLICT on an existing community id writes nothing else', async () => {
      const { communities, memberships, counts, readSlug } = await makeImpl();
      const tenant = ulid(1);
      await communities.createWithOwner(ownerInput(tenant, USER_A, 'masjid'));
      const before = await counts();

      await expectDomainError(
        communities.createWithOwner(ownerInput(tenant, USER_B, 'other-name')),
        'CONFLICT',
      );

      expect(await counts()).toEqual(before);
      expect(await memberships.get(asTenantId(tenant), USER_B)).toBeNull();
      expect(await readSlug('other-name')).toBeNull();
      expect((await communities.getById(asTenantId(tenant)))?.createdBy).toBe(USER_A);
    });

    it('CONFLICT on an existing membership id writes nothing', async () => {
      const { communities, counts, seedMembership } = await makeImpl();
      const input = ownerInput(ulid(1), USER_A, 'masjid');
      await seedMembership(input.membership);

      await expectDomainError(communities.createWithOwner(input), 'CONFLICT');

      expect(await counts()).toEqual({ communities: 0, memberships: 1, slugs: 0 });
    });

    it('CONFLICT when every slug candidate is taken, and writes nothing', async () => {
      const { communities, counts } = await makeImpl();
      for (let n = 1; n <= 20; n++) {
        const tenant = ulid(n);
        expect(tenant.slice(-8)).not.toBe(SUFFIX);
        await communities.createWithOwner(ownerInput(tenant, USER_A, 'masjid'));
      }
      const reserved = await communities.createWithOwner(ownerInput(SAME_A, USER_A, 'masjid'));
      expect(reserved.community.slug).toBe(`masjid-${SUFFIX.toLowerCase()}`);
      const before = await counts();

      await expectDomainError(
        communities.createWithOwner(ownerInput(SAME_B, USER_B, 'masjid')),
        'CONFLICT',
      );

      expect(await counts()).toEqual(before);
    });

    it('scopes listByUser and get to the user and tenant, and omits missing ids', async () => {
      const { communities, memberships } = await makeImpl();
      const tenantA = asTenantId(ulid(1));
      const tenantB = asTenantId(ulid(2));
      const a = await communities.createWithOwner(ownerInput(tenantA, USER_A, 'alpha'));
      const b = await communities.createWithOwner(ownerInput(tenantB, USER_B, 'beta'));

      expect(await memberships.listByUser(USER_A)).toEqual([a.membership]);
      expect(await memberships.listByUser(USER_B)).toEqual([b.membership]);
      expect(await memberships.get(tenantA, USER_A)).toEqual(a.membership);
      expect(await memberships.get(tenantA, USER_B)).toBeNull();
      expect(await memberships.get(tenantB, USER_A)).toBeNull();
      expect(await communities.getById(tenantA)).toEqual(a.community);
      expect(await communities.getById(asTenantId(ulid(99)))).toBeNull();
      expect(await communities.getByIds([tenantA, asTenantId(ulid(99))])).toEqual([a.community]);
      expect(await communities.getByIds([])).toEqual([]);
    });

    it('deleteByUser removes only that user, leaves communities and slugs, and is idempotent', async () => {
      const { communities, memberships, counts, readSlug, seedMembership } = await makeImpl();
      const tenant = asTenantId(ulid(1));
      const created = await communities.createWithOwner(ownerInput(tenant, USER_A, 'masjid'));
      const other = memberOf(USER_B, tenant);
      await seedMembership(other);

      await expect(memberships.deleteByUser(USER_A)).resolves.toBeUndefined();

      expect(await communities.getById(tenant)).toEqual(created.community);
      expect(await readSlug(created.community.slug)).toMatchObject({ tenantId: tenant });
      expect(await memberships.get(tenant, USER_A)).toBeNull();
      expect(await memberships.get(tenant, USER_B)).toEqual(other);
      expect(await counts()).toEqual({ communities: 1, memberships: 1, slugs: 1 });

      await expect(memberships.deleteByUser(USER_A)).resolves.toBeUndefined();
      await expect(memberships.deleteByUser(asUserId(ulid(50)))).resolves.toBeUndefined();
      expect(await counts()).toEqual({ communities: 1, memberships: 1, slugs: 1 });
      expect(await memberships.get(tenant, USER_B)).toEqual(other);
    });

    it.each(['uid-alice', ''])(
      'deleteByUser rejects %j with VALIDATION and writes nothing',
      async (id) => {
        const { communities, memberships, counts } = await makeImpl();
        await communities.createWithOwner(ownerInput(ulid(1), USER_A, 'masjid'));
        const before = await counts();

        await expectDomainError(memberships.deleteByUser(id as UserId), 'VALIDATION');

        expect(await counts()).toEqual(before);
      },
    );

    it('deleteByUser repeats until more than 400 memberships are gone', async () => {
      const harness = await makeImpl();
      const user = asUserId(ulid(7));
      for (let n = 1; n <= 401; n++) {
        await harness.seedMembership(memberOf(user, asTenantId(ulid(1_000 + n))));
      }
      await harness.communities.createWithOwner(ownerInput(ulid(3), USER_B, 'kept'));

      await harness.memberships.deleteByUser(user);

      expect(await harness.memberships.listByUser(user)).toEqual([]);
      expect(await harness.counts()).toEqual({ communities: 1, memberships: 1, slugs: 1 });
    }, 60_000);

    it.each([
      ['getById', (h: CommunityStoreHarness) => h.communities.getById('nope' as TenantId)],
      ['listByUser', (h: CommunityStoreHarness) => h.memberships.listByUser('nope' as UserId)],
      ['get', (h: CommunityStoreHarness) => h.memberships.get('nope' as TenantId, USER_A)],
    ])('%s rejects a non-ULID with VALIDATION', async (_label, call) => {
      const harness = await makeImpl();
      await expectDomainError(call(harness), 'VALIDATION');
      expect(await harness.counts()).toEqual(EMPTY);
    });

    it('listByTenant returns only that tenant, and the rows are copies', async () => {
      const { communities, memberships, seedMembership } = await makeImpl();
      const tenantA = asTenantId(ulid(1));
      const tenantB = asTenantId(ulid(2));
      await communities.createWithOwner(ownerInput(tenantA, USER_A, 'alpha'));
      await communities.createWithOwner(ownerInput(tenantB, USER_B, 'beta'));
      await seedMembership(memberOf(USER_B, tenantA));

      const listed = await memberships.listByTenant(tenantA);
      expect(listed.map((membership) => membership.userId).sort()).toEqual([USER_A, USER_B].sort());
      expect(listed.every((membership) => membership.tenantId === tenantA)).toBe(true);
      const owner = listed.find((membership) => membership.userId === USER_A);
      expect(owner?.role).toBe('owner');
      owner!.role = 'member';
      expect((await memberships.get(tenantA, USER_A))?.role).toBe('owner');
      expect(
        (await memberships.listByTenant(tenantB)).map((membership) => membership.userId),
      ).toEqual([USER_B]);
    });

    it('updateRole on a missing doc is NOT_FOUND and creates nothing', async () => {
      const { communities, memberships, counts } = await makeImpl();
      const tenant = asTenantId(ulid(1));
      await communities.createWithOwner(ownerInput(tenant, USER_A, 'masjid'));
      const before = await counts();

      await expectDomainError(memberships.updateRole(tenant, USER_B, 'editor', NEXT), 'NOT_FOUND');

      expect(await counts()).toEqual(before);
      expect(await memberships.get(tenant, USER_B)).toBeNull();
    });

    it('updateRole of the sole owner to a non-owner is CONFLICT and leaves the doc', async () => {
      const { communities, memberships } = await makeImpl();
      const tenant = asTenantId(ulid(1));
      await communities.createWithOwner(ownerInput(tenant, USER_A, 'masjid'));
      const before = await memberships.get(tenant, USER_A);

      await expectDomainError(
        memberships.updateRole(tenant, USER_A, 'admin', NEXT),
        'CONFLICT',
        'last-owner',
      );

      expect(await memberships.get(tenant, USER_A)).toEqual(before);
    });

    it('updateRole of an owner to owner succeeds and stores the caller timestamp', async () => {
      const { communities, memberships } = await makeImpl();
      const tenant = asTenantId(ulid(1));
      await communities.createWithOwner(ownerInput(tenant, USER_A, 'masjid'));

      const updated = await memberships.updateRole(tenant, USER_A, 'owner', NEXT);

      expect(updated.role).toBe('owner');
      expect(updated.updatedAt).toBe(NEXT);
      expect(updated.createdAt).toBe(AT);
      expect(updated.schemaVersion).toBe(MEMBERSHIP_SCHEMA_VERSION);
      expect(await memberships.get(tenant, USER_A)).toEqual(updated);
    });

    it('updateRole demotes one of two owners and leaves exactly one owner', async () => {
      const { communities, memberships, seedMembership } = await makeImpl();
      const tenant = asTenantId(ulid(1));
      await communities.createWithOwner(ownerInput(tenant, USER_A, 'masjid'));
      await seedMembership({ ...memberOf(USER_B, tenant), role: 'owner' });

      const updated = await memberships.updateRole(tenant, USER_B, 'admin', NEXT);

      expect(updated.role).toBe('admin');
      expect(updated.updatedAt).toBe(NEXT);
      const owners = (await memberships.listByTenant(tenant)).filter(
        (membership) => membership.role === 'owner',
      );
      expect(owners.map((membership) => membership.userId)).toEqual([USER_A]);
    });

    it('remove of the sole owner is CONFLICT and leaves the doc', async () => {
      const { communities, memberships } = await makeImpl();
      const tenant = asTenantId(ulid(1));
      const created = await communities.createWithOwner(ownerInput(tenant, USER_A, 'masjid'));

      await expectDomainError(memberships.remove(tenant, USER_A), 'CONFLICT', 'last-owner');

      expect(await memberships.get(tenant, USER_A)).toEqual(created.membership);
    });

    it('remove of one tenant leaves the same user in another tenant', async () => {
      const { communities, memberships, seedMembership } = await makeImpl();
      const tenantA = asTenantId(ulid(1));
      const tenantB = asTenantId(ulid(2));
      await communities.createWithOwner(ownerInput(tenantA, USER_A, 'alpha'));
      const other = memberOf(USER_A, tenantB);
      await seedMembership(other);

      await expect(memberships.remove(tenantB, USER_A)).resolves.toBeUndefined();

      expect(await memberships.get(tenantB, USER_A)).toBeNull();
      expect((await memberships.get(tenantA, USER_A))?.role).toBe('owner');
    });

    it('remove of a non-owner succeeds when the tenant has no owner', async () => {
      const { memberships, seedMembership } = await makeImpl();
      const tenant = asTenantId(ulid(3));
      await seedMembership(memberOf(USER_B, tenant));

      await expect(memberships.remove(tenant, USER_B)).resolves.toBeUndefined();

      expect(await memberships.get(tenant, USER_B)).toBeNull();
    });

    it('a non-ULID id, a bad role, or a bad updatedAt is VALIDATION and writes nothing', async () => {
      const { communities, memberships, counts } = await makeImpl();
      const tenant = asTenantId(ulid(1));
      await communities.createWithOwner(ownerInput(tenant, USER_A, 'masjid'));
      const before = await counts();
      const stored = await memberships.get(tenant, USER_A);

      await expectDomainError(memberships.listByTenant('nope' as TenantId), 'VALIDATION');
      await expectDomainError(
        memberships.updateRole('nope' as TenantId, USER_A, 'admin', NEXT),
        'VALIDATION',
      );
      await expectDomainError(
        memberships.updateRole(tenant, 'nope' as UserId, 'admin', NEXT),
        'VALIDATION',
      );
      await expectDomainError(
        memberships.updateRole(tenant, USER_A, 'nope' as Role, NEXT),
        'VALIDATION',
      );
      await expectDomainError(
        memberships.updateRole(tenant, USER_A, 'admin', 'yesterday'),
        'VALIDATION',
      );
      await expectDomainError(memberships.remove('nope' as TenantId, USER_A), 'VALIDATION');
      await expectDomainError(memberships.remove(tenant, 'nope' as UserId), 'VALIDATION');

      expect(await counts()).toEqual(before);
      expect(await memberships.get(tenant, USER_A)).toEqual(stored);
    });
  });
}
