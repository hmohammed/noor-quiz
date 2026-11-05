import { describe, expect, it } from 'vitest';
import {
  asInviteToken,
  asTenantId,
  INVITE_SCHEMA_VERSION,
  isDomainError,
  MEMBERSHIP_SCHEMA_VERSION,
  membershipId,
  type DomainErrorCode,
  type Invite,
  type InviteRepo,
  type Membership,
  type MembershipRepo,
  type TenantId,
  type UserId,
} from '@noor/core';

export interface InviteRepoHarness {
  invites: InviteRepo;
  memberships: MembershipRepo;
  seedMembership(membership: Membership): Promise<void>;
  countInvites(): Promise<number>;
}

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const AT = '2024-05-06T07:08:09.123Z';
const EXPIRES = '2026-06-01T00:00:00.000Z';
const NOW = '2026-01-15T00:00:00.000Z';
const EXPIRED_NOW = '2026-06-01T00:00:00.000Z';

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
const TENANT = ulid(7);

function newInvite(overrides: Partial<Invite> = {}): Invite {
  const id = asInviteToken(overrides.id ?? ulid(1));
  const tenantId = asTenantId(overrides.tenantId ?? TENANT);
  return {
    createdBy: USER_A,
    expiresAt: EXPIRES,
    maxUses: 25,
    uses: 0,
    createdAt: AT,
    updatedAt: AT,
    schemaVersion: INVITE_SCHEMA_VERSION,
    ...overrides,
    id,
    tenantId,
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
 * Behaviour every invite repo must have. Runs against the in-memory repo and the
 * Firestore repo on the emulator. `makeImpl` must return an empty store.
 */
export function runInviteRepoContract(
  name: string,
  makeImpl: () => Promise<InviteRepoHarness>,
): void {
  describe(`invite repo contract: ${name}`, () => {
    it('round-trips create and getByToken, and a second create is CONFLICT', async () => {
      const { invites } = await makeImpl();
      const invite = newInvite();

      const stored = await invites.create(invite.tenantId, invite);

      expect(stored).toEqual(invite);
      expect(await invites.getByToken(invite.id)).toEqual(invite);
      await expectDomainError(invites.create(invite.tenantId, invite), 'CONFLICT');
      expect(await invites.getByToken(invite.id)).toEqual(invite);
    });

    it('returns an expired invite from getByToken without treating it as missing', async () => {
      const { invites } = await makeImpl();
      const invite = newInvite({ expiresAt: '2020-01-01T00:00:00.000Z' });
      await invites.create(invite.tenantId, invite);
      expect(await invites.getByToken(invite.id)).toEqual(invite);
    });

    it('gives the last remaining use to one of two new users and GONE to the other', async () => {
      const { invites, memberships } = await makeImpl();
      const invite = newInvite({ maxUses: 1 });
      await invites.create(invite.tenantId, invite);

      const results = await Promise.allSettled([
        invites.accept({ token: invite.id, userId: USER_A, now: NOW }),
        invites.accept({ token: invite.id, userId: USER_B, now: NOW }),
      ]);
      const fulfilled = results.filter((result) => result.status === 'fulfilled');
      const rejected = results.filter((result) => result.status === 'rejected');
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      const failure = rejected[0];
      if (failure?.status !== 'rejected') throw new Error('expected a rejected accept');
      expect(isDomainError(failure.reason)).toBe(true);
      expect((failure.reason as { code: string }).code).toBe('GONE');

      const stored = await invites.getByToken(invite.id);
      expect(stored?.uses).toBe(invite.maxUses);
      const members = await Promise.all([
        memberships.get(invite.tenantId, USER_A),
        memberships.get(invite.tenantId, USER_B),
      ]);
      expect(members.filter((membership) => membership !== null)).toHaveLength(1);
      expect(members.find((membership) => membership !== null)?.role).toBe('member');
    });

    it('does not write when create is invalid', async () => {
      const { invites, countInvites } = await makeImpl();
      const invite = newInvite();
      const otherTenant = asTenantId(ulid(8));

      await expectDomainError(invites.create(otherTenant, invite), 'VALIDATION');
      await expectDomainError(
        invites.create(invite.tenantId, { ...invite, uses: 1 }),
        'VALIDATION',
      );
      await expectDomainError(
        invites.create(invite.tenantId, { ...invite, maxUses: 0 }),
        'VALIDATION',
      );
      await expectDomainError(
        invites.create(invite.tenantId, { ...invite, maxUses: 101 }),
        'VALIDATION',
      );
      await expectDomainError(invites.create('not-a-tenant' as TenantId, invite), 'VALIDATION');
      expect(await countInvites()).toBe(0);
      expect(await invites.getByToken(invite.id)).toBeNull();
    });

    it('throws VALIDATION for a malformed token before treating it as missing', async () => {
      const { invites } = await makeImpl();
      await expectDomainError(invites.getByToken('not-a-token'), 'VALIDATION');
    });

    it('returns the existing membership without a write when the link is expired or full', async () => {
      const { invites, seedMembership } = await makeImpl();
      const expired = newInvite({ expiresAt: EXPIRED_NOW });
      await invites.create(expired.tenantId, expired);
      const owner: Membership = {
        id: membershipId(USER_A, expired.tenantId),
        tenantId: expired.tenantId,
        userId: USER_A,
        role: 'owner',
        createdAt: AT,
        updatedAt: AT,
        schemaVersion: MEMBERSHIP_SCHEMA_VERSION,
      };
      await seedMembership(owner);

      const again = await invites.accept({
        token: expired.id,
        userId: USER_A,
        now: EXPIRED_NOW,
      });
      expect(again).toEqual({ membership: owner, created: false });
      expect((await invites.getByToken(expired.id))?.uses).toBe(0);

      const full = newInvite({ id: asInviteToken(ulid(2)), maxUses: 1 });
      await invites.create(full.tenantId, full);
      const taken = await invites.accept({ token: full.id, userId: USER_B, now: NOW });
      expect(taken.created).toBe(true);
      const ownerAgain = await invites.accept({ token: full.id, userId: USER_A, now: NOW });
      expect(ownerAgain.created).toBe(false);
      expect(ownerAgain.membership.role).toBe('owner');
      expect((await invites.getByToken(full.id))?.uses).toBe(1);
    });

    it('throws GONE for a new user when the invite is expired or used up, and writes nothing', async () => {
      const { invites, memberships } = await makeImpl();
      const expired = newInvite({ expiresAt: EXPIRED_NOW });
      await invites.create(expired.tenantId, expired);
      await expectDomainError(
        invites.accept({ token: expired.id, userId: USER_B, now: EXPIRED_NOW }),
        'GONE',
      );
      expect(await memberships.get(expired.tenantId, USER_B)).toBeNull();
      expect((await invites.getByToken(expired.id))?.uses).toBe(0);

      const full = newInvite({ id: asInviteToken(ulid(3)), maxUses: 1 });
      await invites.create(full.tenantId, full);
      await invites.accept({ token: full.id, userId: USER_A, now: NOW });
      await expectDomainError(invites.accept({ token: full.id, userId: USER_B, now: NOW }), 'GONE');
      expect(await memberships.get(full.tenantId, USER_B)).toBeNull();
      expect((await invites.getByToken(full.id))?.uses).toBe(1);
    });

    it('throws NOT_FOUND for an unknown token and writes nothing', async () => {
      const { invites, memberships, countInvites } = await makeImpl();
      await expectDomainError(
        invites.accept({ token: ulid(9), userId: USER_A, now: NOW }),
        'NOT_FOUND',
      );
      expect(await countInvites()).toBe(0);
      expect(await memberships.get(asTenantId(TENANT), USER_A)).toBeNull();
    });
  });
}
