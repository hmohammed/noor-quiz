import { describe, expect, it, vi } from 'vitest';
import { DomainError, type DomainErrorCode } from '../errors';
import type { Clock } from '../ports/clock';
import type { IdGenerator } from '../ports/id-generator';
import type { InviteRepo, MembershipRepo } from '../ports/repos';
import { instantFromIso } from '../time/instant';
import { ULID_PATTERN, type UserId } from '../users/user';
import {
  MEMBERSHIP_SCHEMA_VERSION,
  membershipId,
  type Membership,
  type TenantId,
} from '../communities/community';
import { INVITE_SCHEMA_VERSION, type Invite } from '../communities/invite';
import type { Role } from '../communities/role';
import { createInvite } from './create-invite';

const AT = '2026-03-01T12:00:00.000Z';
const DAY_MS = 86_400_000;
const TENANT = '01ARZ3NDEKTSV4RRFFQ69G5FAV';
const USER = '01ARZ3NDEKTSV4RRFFQ69G5FAW';
const TOKEN = '01ARZ3NDEKTSV4RRFFQ69G5FB0';

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

function membership(role: Role): Membership {
  const tenantId = TENANT as TenantId;
  const userId = USER as UserId;
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

function repo(found: Membership | null) {
  const create = vi.fn(async (_tenantId: TenantId, invite: Invite) => ({ ...invite }));
  const invites = {
    create,
    getByToken: vi.fn(async () => null),
    accept: vi.fn(async () => {
      throw new Error('accept should not be called');
    }),
  } satisfies InviteRepo;
  const memberships = {
    get: vi.fn(async () => found),
    listByUser: vi.fn(async () => []),
    deleteByUser: vi.fn(async () => undefined),
    listByTenant: vi.fn(async () => []),
    updateRole: vi.fn(async () => {
      throw new Error('updateRole should not be called');
    }),
    remove: vi.fn(async () => {
      throw new Error('remove should not be called');
    }),
  } satisfies MembershipRepo;
  return { invites, memberships, create };
}

async function expectDomainError(p: Promise<unknown>, code: DomainErrorCode) {
  const err = await p.then(
    () => expect.fail(`expected DomainError(${code})`),
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(DomainError);
  expect((err as DomainError).code).toBe(code);
}

describe('createInvite', () => {
  it('stores a ULID token, uses 0, the caller, maxUses 25 and expiry 7 days after one clock read', async () => {
    const { invites, memberships, create } = repo(membership('owner'));

    const result = await createInvite(
      {
        clock: clockOnce(),
        ids: sequenceIds(TOKEN),
        memberships,
        invites,
      },
      { tenantId: TENANT, userId: USER },
    );

    expect(ULID_PATTERN.test(result.id)).toBe(true);
    expect(result).toEqual({
      id: TOKEN,
      tenantId: TENANT,
      createdBy: USER,
      expiresAt: '2026-03-08T12:00:00.000Z',
      maxUses: 25,
      uses: 0,
      createdAt: AT,
      updatedAt: AT,
      schemaVersion: INVITE_SCHEMA_VERSION,
    });
    expect(instantFromIso(result.expiresAt) - instantFromIso(AT)).toBe(7 * DAY_MS);
    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0]?.[0]).toBe(TENANT);
    expect(create.mock.calls[0]?.[1]).toEqual(result);
  });

  it.each([
    [1, 1],
    [30, 100],
  ])('stores expiresInDays %i and maxUses %i', async (expiresInDays, maxUses) => {
    const { invites, memberships } = repo(membership('admin'));
    const result = await createInvite(
      { clock: clockOnce(), ids: sequenceIds(TOKEN), memberships, invites },
      { tenantId: TENANT, userId: USER, expiresInDays, maxUses },
    );
    expect(instantFromIso(result.expiresAt) - instantFromIso(AT)).toBe(expiresInDays * DAY_MS);
    expect(result.maxUses).toBe(maxUses);
    expect(result.uses).toBe(0);
  });

  it.each([
    ['expiresInDays 0', { expiresInDays: 0 }],
    ['expiresInDays 31', { expiresInDays: 31 }],
    ['maxUses 0', { maxUses: 0 }],
    ['maxUses 101', { maxUses: 101 }],
    ['a fractional expiresInDays', { expiresInDays: 1.5 }],
    ['a fractional maxUses', { maxUses: 1.5 }],
    ['a string expiresInDays', { expiresInDays: '7' }],
    ['a caller expiresAt', { expiresAt: '2026-04-01T00:00:00.000Z' }],
    ['a caller role', { role: 'owner' }],
    ['a caller uses', { uses: 3 }],
    ['a caller tenantId', { tenantId: 'not-a-tenant' }],
    ['a non-integer string maxUses', { maxUses: '25' }],
  ])('throws VALIDATION for %s and writes nothing', async (_label, extra) => {
    const { invites, memberships, create } = repo(membership('owner'));
    await expectDomainError(
      createInvite(
        {
          clock: clockOnce(),
          ids: sequenceIds(TOKEN),
          memberships,
          invites,
        },
        { tenantId: TENANT, userId: USER, ...extra } as {
          tenantId: string;
          userId: string;
        },
      ),
      'VALIDATION',
    );
    expect(create).not.toHaveBeenCalled();
  });

  it.each(['member', 'scholar-reviewer', 'editor'] as const)(
    'throws FORBIDDEN for a %s and stores no invite',
    async (role) => {
      const { invites, memberships, create } = repo(membership(role));
      await expectDomainError(
        createInvite(
          {
            clock: { now: () => instantFromIso(AT) },
            ids: { newId: () => TOKEN },
            memberships,
            invites,
          },
          { tenantId: TENANT, userId: USER },
        ),
        'FORBIDDEN',
      );
      expect(create).not.toHaveBeenCalled();
    },
  );

  it.each(['admin', 'owner'] as const)('lets an %s create an invite', async (role) => {
    const { invites, memberships, create } = repo(membership(role));
    const result = await createInvite(
      { clock: clockOnce(), ids: sequenceIds(TOKEN), memberships, invites },
      { tenantId: TENANT, userId: USER },
    );
    expect(result.createdBy).toBe(USER);
    expect(result.tenantId).toBe(TENANT);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('throws FORBIDDEN when the user has no membership and stores no invite', async () => {
    const { invites, memberships, create } = repo(null);
    await expectDomainError(
      createInvite(
        {
          clock: { now: () => instantFromIso(AT) },
          ids: { newId: () => TOKEN },
          memberships,
          invites,
        },
        { tenantId: TENANT, userId: USER },
      ),
      'FORBIDDEN',
    );
    expect(create).not.toHaveBeenCalled();
    expect(memberships.get).toHaveBeenCalledTimes(1);
  });
});
