import {
  asInviteToken,
  asTenantId,
  asUserId,
  chooseSlug,
  COMMUNITY_SCHEMA_VERSION,
  COMMUNITY_SLUG_SCHEMA_VERSION,
  DomainError,
  instantFromIso,
  inviteUnusable,
  isRole,
  MEMBERSHIP_SCHEMA_VERSION,
  membershipId,
  slugCandidates,
  validateCreateWithOwner,
  validateNewInvite,
  type Community,
  type CommunityRepo,
  type CommunitySlug,
  type CreateWithOwnerInput,
  type Invite,
  type InviteRepo,
  type Membership,
  type MembershipRepo,
  type TenantId,
  type UserId,
} from '@noor/core';

const DELETE_BATCH = 400;

/**
 * One in-memory store behind a `CommunityRepo` and a `MembershipRepo`. The critical
 * section of `createWithOwner` does not await, so concurrent calls cannot interleave.
 * Returns copies, never stored objects.
 */
export function createInMemoryCommunityStore(): {
  communities: InMemoryCommunityRepo;
  memberships: InMemoryMembershipRepo;
  invites: InMemoryInviteRepo;
} {
  const communities = new Map<string, Community>();
  const memberships = new Map<string, Membership>();
  const slugs = new Map<string, CommunitySlug>();
  const invites = new Map<string, Invite>();
  return {
    communities: new InMemoryCommunityRepo(communities, memberships, slugs),
    memberships: new InMemoryMembershipRepo(memberships),
    invites: new InMemoryInviteRepo(invites, memberships),
  };
}

export class InMemoryCommunityRepo implements CommunityRepo {
  readonly #communities: Map<string, Community>;
  readonly #memberships: Map<string, Membership>;
  readonly #slugs: Map<string, CommunitySlug>;

  constructor(
    communities: Map<string, Community>,
    memberships: Map<string, Membership>,
    slugs: Map<string, CommunitySlug>,
  ) {
    this.#communities = communities;
    this.#memberships = memberships;
    this.#slugs = slugs;
  }

  async getById(tenantId: TenantId): Promise<Community | null> {
    const community = this.#communities.get(asTenantId(tenantId));
    return community ? { ...community } : null;
  }

  async getByIds(tenantIds: readonly TenantId[]): Promise<Community[]> {
    const seen = new Set<string>();
    const found: Community[] = [];
    for (const raw of tenantIds) {
      const id = asTenantId(raw);
      if (seen.has(id)) continue;
      seen.add(id);
      const community = this.#communities.get(id);
      if (community) found.push({ ...community });
    }
    return found;
  }

  async createWithOwner(
    input: CreateWithOwnerInput,
  ): Promise<{ community: Community; membership: Membership }> {
    validateCreateWithOwner(input);
    const { community, membership } = input;
    if (this.#communities.has(community.id)) {
      throw new DomainError('CONFLICT', { reason: 'community-exists' });
    }
    if (this.#memberships.has(membership.id)) {
      throw new DomainError('CONFLICT', { reason: 'membership-exists' });
    }
    const taken = new Set<string>();
    for (const candidate of slugCandidates(input.baseSlug, community.tenantId)) {
      if (this.#slugs.has(candidate)) taken.add(candidate);
    }
    const slug = chooseSlug(input.baseSlug, community.tenantId, taken);
    if (slug === null) throw new DomainError('CONFLICT', { reason: 'slug-exhausted' });

    const storedCommunity: Community = {
      id: community.id,
      tenantId: community.tenantId,
      name: community.name,
      slug,
      timezone: community.timezone,
      createdBy: community.createdBy,
      createdAt: community.createdAt,
      updatedAt: community.updatedAt,
      schemaVersion: COMMUNITY_SCHEMA_VERSION,
    };
    const storedMembership: Membership = {
      id: membership.id,
      tenantId: membership.tenantId,
      userId: membership.userId,
      role: 'owner',
      createdAt: membership.createdAt,
      updatedAt: membership.updatedAt,
      schemaVersion: membership.schemaVersion,
    };
    const slugDoc: CommunitySlug = {
      id: slug,
      slug,
      tenantId: community.tenantId,
      createdAt: community.createdAt,
      updatedAt: community.createdAt,
      schemaVersion: COMMUNITY_SLUG_SCHEMA_VERSION,
    };
    this.#communities.set(storedCommunity.id, storedCommunity);
    this.#memberships.set(storedMembership.id, storedMembership);
    this.#slugs.set(slug, slugDoc);
    return { community: { ...storedCommunity }, membership: { ...storedMembership } };
  }

  /** Test-only. Not part of `CommunityRepo`. */
  storedSlug(slug: string): CommunitySlug | null {
    const doc = this.#slugs.get(slug);
    return doc ? { ...doc } : null;
  }

  /** Test-only. Not part of `CommunityRepo`. */
  counts(): { communities: number; memberships: number; slugs: number } {
    return {
      communities: this.#communities.size,
      memberships: this.#memberships.size,
      slugs: this.#slugs.size,
    };
  }
}

export class InMemoryMembershipRepo implements MembershipRepo {
  readonly #memberships: Map<string, Membership>;

  constructor(memberships: Map<string, Membership>) {
    this.#memberships = memberships;
  }

  async get(tenantId: TenantId, userId: UserId): Promise<Membership | null> {
    const tid = asTenantId(tenantId);
    const uid = asUserId(userId);
    const membership = this.#memberships.get(membershipId(uid, tid));
    if (!membership || membership.tenantId !== tid || membership.userId !== uid) return null;
    return { ...membership };
  }

  async listByUser(userId: UserId): Promise<Membership[]> {
    const id = asUserId(userId);
    return [...this.#memberships.values()]
      .filter((membership) => membership.userId === id)
      .map((membership) => ({ ...membership }));
  }

  async deleteByUser(userId: UserId): Promise<void> {
    const id = asUserId(userId);
    for (;;) {
      const batch: string[] = [];
      for (const [key, membership] of this.#memberships) {
        if (membership.userId !== id) continue;
        batch.push(key);
        if (batch.length === DELETE_BATCH) break;
      }
      if (batch.length === 0) return;
      for (const key of batch) this.#memberships.delete(key);
    }
  }

  /**
   * Test-only. Inserts a membership (any role) without a community, so middleware
   * tests can require a non-owner and conflict tests can pre-occupy an id. Not part
   * of `MembershipRepo`.
   */
  async seed(membership: Membership): Promise<void> {
    const userId = asUserId(membership.userId);
    const tenantId = asTenantId(membership.tenantId);
    if (membership.id !== membershipId(userId, tenantId)) {
      throw new DomainError('VALIDATION', { reason: 'membership-id-mismatch' });
    }
    if (!isRole(membership.role)) throw new DomainError('VALIDATION', { reason: 'invalid-role' });
    this.#memberships.set(membership.id, {
      id: membership.id,
      tenantId,
      userId,
      role: membership.role,
      createdAt: membership.createdAt,
      updatedAt: membership.updatedAt,
      schemaVersion: membership.schemaVersion,
    });
  }
}

function copyInvite(invite: Invite): Invite {
  return {
    id: invite.id,
    tenantId: invite.tenantId,
    createdBy: invite.createdBy,
    expiresAt: invite.expiresAt,
    maxUses: invite.maxUses,
    uses: invite.uses,
    createdAt: invite.createdAt,
    updatedAt: invite.updatedAt,
    schemaVersion: invite.schemaVersion,
  };
}

function copyMembership(membership: Membership): Membership {
  return {
    id: membership.id,
    tenantId: membership.tenantId,
    userId: membership.userId,
    role: membership.role,
    createdAt: membership.createdAt,
    updatedAt: membership.updatedAt,
    schemaVersion: membership.schemaVersion,
  };
}

/**
 * In-memory `invites`. Shares the membership map with `InMemoryMembershipRepo`.
 * `accept` does not await between the read and the write, so two callers cannot
 * interleave, matching `createWithOwner`. Does not read the communities map.
 */
export class InMemoryInviteRepo implements InviteRepo {
  readonly #invites: Map<string, Invite>;
  readonly #memberships: Map<string, Membership>;

  constructor(invites: Map<string, Invite>, memberships: Map<string, Membership>) {
    this.#invites = invites;
    this.#memberships = memberships;
  }

  async create(tenantId: TenantId, invite: Invite): Promise<Invite> {
    validateNewInvite(tenantId, invite);
    if (this.#invites.has(invite.id)) {
      throw new DomainError('CONFLICT', { reason: 'invite-exists' });
    }
    const stored = copyInvite(invite);
    this.#invites.set(stored.id, stored);
    return copyInvite(stored);
  }

  async getByToken(token: string): Promise<Invite | null> {
    const id = asInviteToken(token);
    const invite = this.#invites.get(id);
    return invite ? copyInvite(invite) : null;
  }

  async accept(input: { token: string; userId: string; now: string }): Promise<{
    membership: Membership;
    created: boolean;
  }> {
    // No await: the read and the write stay in one turn.
    const token = asInviteToken(input.token);
    const userId = asUserId(input.userId);
    const now = instantFromIso(input.now);
    const invite = this.#invites.get(token);
    if (!invite) throw new DomainError('NOT_FOUND', { reason: 'invite-missing' });
    const existingId = membershipId(userId, invite.tenantId);
    const existing = this.#memberships.get(existingId);
    if (existing && existing.userId === userId && existing.tenantId === invite.tenantId) {
      return { membership: copyMembership(existing), created: false };
    }
    if (inviteUnusable(invite, now)) {
      throw new DomainError('GONE', { reason: 'invite-unusable' });
    }
    const membership: Membership = {
      id: existingId,
      tenantId: invite.tenantId,
      userId,
      role: 'member',
      createdAt: input.now,
      updatedAt: input.now,
      schemaVersion: MEMBERSHIP_SCHEMA_VERSION,
    };
    const updated = copyInvite(invite);
    updated.uses += 1;
    updated.updatedAt = input.now;
    this.#memberships.set(membership.id, membership);
    this.#invites.set(token, updated);
    return { membership: copyMembership(membership), created: true };
  }

  /** Test-only. Not part of `InviteRepo`. */
  count(): number {
    return this.#invites.size;
  }
}
