import { describe, expect, it, vi } from 'vitest';
import {
  acceptInvite,
  asUserId,
  createCommunity,
  createInvite,
  DomainError,
  listMyCommunities,
  type DomainErrorCode,
} from '@noor/core';
import { makeTestDeps } from '@noor/testkit';

async function expectDomainError(p: Promise<unknown>, code: DomainErrorCode) {
  const err = await p.then(
    () => expect.fail(`expected DomainError(${code})`),
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(DomainError);
  expect((err as DomainError).code).toBe(code);
}

async function communityOf(deps: ReturnType<typeof makeTestDeps>, userId = deps.ids.newId()) {
  const { community, membership } = await createCommunity(deps, {
    userId,
    name: 'Masjid Al-Noor',
    timezone: 'Europe/Stockholm',
  });
  return { community, membership, userId };
}

describe('acceptInvite', () => {
  it('creates one member membership, is idempotent, and lists that one community', async () => {
    const deps = makeTestDeps();
    const { community } = await communityOf(deps);
    const invite = await createInvite(deps, {
      tenantId: community.tenantId,
      userId: community.createdBy,
    });
    const joiner = deps.ids.newId();

    const first = await acceptInvite(deps, { token: invite.id, userId: joiner });
    expect(first.created).toBe(true);
    expect(first.membership.role).toBe('member');
    expect(first.membership.userId).toBe(joiner);
    expect(first.membership.tenantId).toBe(community.tenantId);
    expect(first.community).toEqual(community);

    const second = await acceptInvite(deps, { token: invite.id, userId: joiner });
    expect(second.created).toBe(false);
    expect(second.membership).toEqual(first.membership);
    expect((await deps.invites.getByToken(invite.id))?.uses).toBe(1);

    const mine = await listMyCommunities(deps, { userId: joiner });
    expect(mine).toHaveLength(1);
    expect(mine[0]?.community.tenantId).toBe(community.tenantId);
    expect(mine[0]?.role).toBe('member');
  });

  it('keeps an existing owner as owner and does not consume a use', async () => {
    const deps = makeTestDeps();
    const { community, membership } = await communityOf(deps);
    const invite = await createInvite(deps, {
      tenantId: community.tenantId,
      userId: community.createdBy,
    });

    const result = await acceptInvite(deps, { token: invite.id, userId: membership.userId });

    expect(result.created).toBe(false);
    expect(result.membership.role).toBe('owner');
    expect(result.membership.id).toBe(membership.id);
    expect((await deps.invites.getByToken(invite.id))?.uses).toBe(0);
  });

  it('lets the member who filled the link accept again and rejects a different user', async () => {
    const deps = makeTestDeps();
    const { community } = await communityOf(deps);
    const invite = await createInvite(deps, {
      tenantId: community.tenantId,
      userId: community.createdBy,
      maxUses: 1,
    });
    const joiner = deps.ids.newId();
    const other = asUserId(deps.ids.newId());

    const joined = await acceptInvite(deps, { token: invite.id, userId: joiner });
    expect(joined.created).toBe(true);
    expect((await deps.invites.getByToken(invite.id))?.uses).toBe(1);

    const again = await acceptInvite(deps, { token: invite.id, userId: joiner });
    expect(again.created).toBe(false);
    expect(again.membership).toEqual(joined.membership);
    expect((await deps.invites.getByToken(invite.id))?.uses).toBe(1);

    await expectDomainError(acceptInvite(deps, { token: invite.id, userId: other }), 'GONE');
    expect(await deps.memberships.get(community.tenantId, other)).toBeNull();
    expect((await deps.invites.getByToken(invite.id))?.uses).toBe(1);
  });

  it('rejects a new user on an expired invite and still accepts an existing member', async () => {
    const deps = makeTestDeps();
    const { community } = await communityOf(deps);
    const invite = await createInvite(deps, {
      tenantId: community.tenantId,
      userId: community.createdBy,
      expiresInDays: 1,
    });
    const joiner = deps.ids.newId();
    const late = asUserId(deps.ids.newId());
    await acceptInvite(deps, { token: invite.id, userId: joiner });

    deps.clock.advance({ days: 1 });
    await expectDomainError(acceptInvite(deps, { token: invite.id, userId: late }), 'GONE');
    expect(await deps.memberships.get(community.tenantId, late)).toBeNull();

    const again = await acceptInvite(deps, { token: invite.id, userId: joiner });
    expect(again.created).toBe(false);
    expect(again.membership.role).toBe('member');
    expect((await deps.invites.getByToken(invite.id))?.uses).toBe(1);
  });

  it('throws NOT_FOUND for an unknown token', async () => {
    const deps = makeTestDeps();
    const userId = asUserId(deps.ids.newId());
    const before = await deps.memberships.listByUser(userId);
    await expectDomainError(
      acceptInvite(deps, { token: '01ARZ3NDEKTSV4RRFFQ69G5FB2', userId }),
      'NOT_FOUND',
    );
    expect(await deps.memberships.listByUser(userId)).toEqual(before);
  });

  it('throws VALIDATION for a malformed token and writes nothing', async () => {
    const deps = makeTestDeps();
    const accept = vi.spyOn(deps.invites, 'accept');
    const userId = asUserId(deps.ids.newId());
    await expectDomainError(acceptInvite(deps, { token: 'not-a-token', userId }), 'VALIDATION');
    expect(accept).not.toHaveBeenCalled();
    expect(await deps.memberships.listByUser(userId)).toEqual([]);
  });
});
