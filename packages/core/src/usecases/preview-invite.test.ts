import { describe, expect, it, vi } from 'vitest';
import { DomainError, type DomainErrorCode } from '../errors';
import type { Clock } from '../ports/clock';
import type { CommunityRepo, InviteRepo } from '../ports/repos';
import { instantFromIso } from '../time/instant';
import type { UserId } from '../users/user';
import { COMMUNITY_SCHEMA_VERSION, type Community, type TenantId } from '../communities/community';
import { INVITE_SCHEMA_VERSION, type Invite, type InviteToken } from '../communities/invite';
import { previewInvite } from './preview-invite';

const AT = '2026-03-01T12:00:00.000Z';
const LATER = '2026-03-08T12:00:00.000Z';
const TENANT = '01ARZ3NDEKTSV4RRFFQ69G5FAV' as TenantId;
const USER = '01ARZ3NDEKTSV4RRFFQ69G5FAW' as UserId;
const TOKEN = '01ARZ3NDEKTSV4RRFFQ69G5FB0';
const NAME = 'Masjid Al-Noor';

function clockAt(iso: string): Clock {
  let calls = 0;
  return {
    now: () => {
      calls += 1;
      if (calls > 1) throw new Error('clock read more than once');
      return instantFromIso(iso);
    },
  };
}

function invite(overrides: Partial<Invite> = {}): Invite {
  return {
    id: TOKEN as InviteToken,
    tenantId: TENANT,
    createdBy: USER,
    expiresAt: LATER,
    maxUses: 25,
    uses: 0,
    createdAt: AT,
    updatedAt: AT,
    schemaVersion: INVITE_SCHEMA_VERSION,
    ...overrides,
  };
}

function community(): Community {
  return {
    id: TENANT,
    tenantId: TENANT,
    name: NAME,
    slug: 'masjid-al-noor',
    timezone: 'Europe/Stockholm',
    createdBy: USER,
    createdAt: AT,
    updatedAt: AT,
    schemaVersion: COMMUNITY_SCHEMA_VERSION,
  };
}

function deps(found: Invite | null, communityDoc: Community | null = community()) {
  const getByToken = vi.fn(async () => found);
  const getById = vi.fn(async () => communityDoc);
  const invites = {
    create: vi.fn(async () => {
      throw new Error('create should not be called');
    }),
    getByToken,
    accept: vi.fn(async () => {
      throw new Error('accept should not be called');
    }),
  } satisfies InviteRepo;
  const communities = {
    getById,
    getByIds: vi.fn(async () => []),
    createWithOwner: vi.fn(async () => {
      throw new Error('createWithOwner should not be called');
    }),
  } satisfies CommunityRepo;
  return { invites, communities, getByToken, getById };
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

describe('previewInvite', () => {
  it('returns exactly the community name for a live invite', async () => {
    const { invites, communities } = deps(invite());
    const result = await previewInvite(
      { clock: clockAt(AT), invites, communities },
      { token: TOKEN },
    );
    expect(result).toEqual({ name: NAME });
    expect(Object.keys(result)).toEqual(['name']);
  });

  it('throws NOT_FOUND for an unknown token and does not return a name', async () => {
    const { invites, communities, getById } = deps(null);
    const err = await expectDomainError(
      previewInvite({ clock: clockAt(AT), invites, communities }, { token: TOKEN }),
      'NOT_FOUND',
    );
    expect(JSON.stringify(err)).not.toContain(NAME);
    expect(getById).not.toHaveBeenCalled();
  });

  it('throws GONE when expiresAt is exactly now and does not return the name', async () => {
    const { invites, communities, getById } = deps(invite({ expiresAt: AT }));
    const err = await expectDomainError(
      previewInvite({ clock: clockAt(AT), invites, communities }, { token: TOKEN }),
      'GONE',
    );
    expect(JSON.stringify(err)).not.toContain(NAME);
    expect(getById).not.toHaveBeenCalled();
  });

  it('throws GONE when uses has reached maxUses and does not return the name', async () => {
    const { invites, communities, getById } = deps(invite({ uses: 25, maxUses: 25 }));
    const err = await expectDomainError(
      previewInvite({ clock: clockAt(AT), invites, communities }, { token: TOKEN }),
      'GONE',
    );
    expect(JSON.stringify(err)).not.toContain(NAME);
    expect(getById).not.toHaveBeenCalled();
  });

  it('throws VALIDATION for a malformed token and does not read the invite repo', async () => {
    const { invites, communities, getByToken } = deps(invite());
    await expectDomainError(
      previewInvite({ clock: clockAt(AT), invites, communities }, { token: 'not-a-token' }),
      'VALIDATION',
    );
    expect(getByToken).not.toHaveBeenCalled();
  });

  it('throws NOT_FOUND when the community document is missing', async () => {
    const { invites, communities } = deps(invite(), null);
    await expectDomainError(
      previewInvite({ clock: clockAt(AT), invites, communities }, { token: TOKEN }),
      'NOT_FOUND',
    );
  });
});
