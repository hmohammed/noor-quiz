import type {
  Community,
  CreateWithOwnerInput,
  Membership,
  TenantId,
} from '../communities/community';
import type { Invite } from '../communities/invite';
import type { Role } from '../communities/role';
import type { Consent } from '../users/consent';
import type { ProfilePatch } from '../users/profile';
import type { CommunitySeason, SeasonId } from '../season/community-season';
import type { Identity, IdentityKey, User, UserId } from '../users/user';

/**
 * Global (not tenant-owned) collections `users` and `identities`: no `tenantId`, by
 * design. A person is one user across every tenant, so AGENT.md rule 4 does not apply.
 *
 * Doc shapes:
 * - `users/{userId}` (ULID): `{ id, displayName, locale, timezone, consent, createdAt,
 *   updatedAt, schemaVersion: 1 }`. `locale` and `timezone` are nullable and were added
 *   in T011; `consent: { version, acceptedAt } | null` was added in T013a. Readers treat
 *   a missing key as null.
 * - `identities/{provider}_{subject}`: `{ id, provider, subject, userId, email,
 *   emailVerified, createdAt, schemaVersion: 1 }`. The deterministic id is what makes
 *   one identity map to exactly one user.
 *
 * Indexes: the only query, `identities where userId ==` in `deleteUserAndIdentities`,
 * is a single-field equality served by Firestore's automatic index, so no composite
 * index is needed.
 *
 * Every implementation validates the key with `identityId()` before building a doc
 * path, so a bad subject is rejected with `UNAUTHENTICATED` even if a caller skips
 * the use case.
 */
export interface UserRepo {
  /** The user linked to this identity, or null. */
  getByIdentity(key: IdentityKey): Promise<User | null>;
  /**
   * Atomic. If `identities/{identity.id}` exists: write nothing, return its linked
   * user. Otherwise create both docs together and return `user`. Throws `VALIDATION`
   * when `identity.id` or `identity.userId` do not match.
   */
  createWithIdentity(user: User, identity: Identity): Promise<User>;
  getById(userId: UserId): Promise<User | null>;
  /**
   * Applies only the keys present in `patch` plus `updatedAt`, returns the stored user.
   * Throws NOT_FOUND for an unknown user, VALIDATION for a non-ULID id.
   */
  updateProfile(userId: UserId, patch: ProfilePatch, updatedAt: string): Promise<User>;
  /**
   * Writes only `consent` and `updatedAt`, returns the stored user. Throws NOT_FOUND for
   * an unknown user, VALIDATION for a non-ULID id or a consent that fails `isValidConsent`.
   */
  recordConsent(userId: UserId, consent: Consent, updatedAt: string): Promise<User>;
  /**
   * Atomic. Deletes `users/{userId}` and every `identities` doc whose `userId` equals it,
   * including orphan and unreadable docs. Unknown user: resolves, writes nothing.
   * Non-ULID id: throws VALIDATION.
   */
  deleteUserAndIdentities(userId: UserId): Promise<void>;
}

/**
 * Tenant-owned `communities/{tenantId}` plus the `communitySlugs/{slug}` uniqueness
 * lock. No composite index: slug reservation is a document get by id, and listing
 * sorts in the use case after the reads.
 *
 * `communities/{tenantId}`: `{ id, tenantId, name, slug, timezone, createdBy, createdAt,
 * updatedAt, schemaVersion: 1 }`. `id` equals `tenantId`.
 * `communitySlugs/{slug}`: `{ id, slug, tenantId, createdAt, updatedAt, schemaVersion: 1 }`.
 * `id` equals `slug`. On create, `updatedAt` equals `createdAt`. Timestamps are the UTC
 * ISO strings the caller passes; implementations do not read a clock.
 */
export interface CommunityRepo {
  /** The community, or null. `tenantId` is the document id. */
  getById(tenantId: TenantId): Promise<Community | null>;
  /** Communities for these ids. Missing ids are omitted. */
  getByIds(tenantIds: readonly TenantId[]): Promise<Community[]>;
  /**
   * Atomic. Checks `community.id === community.tenantId === membership.tenantId`,
   * `membership.userId === community.createdBy`, `membership.role === "owner"` and
   * `membership.id === membershipId(...)`. Any mismatch is `VALIDATION` and writes
   * nothing. Reads every slug candidate, chooses one with `chooseSlug`, then writes
   * the community, the owner membership and `communitySlugs/{slug}` together. An
   * existing community id, membership id, or no free slug is `CONFLICT` and writes
   * nothing. Returns the stored community (with the chosen slug) and membership.
   */
  createWithOwner(
    input: CreateWithOwnerInput,
  ): Promise<{ community: Community; membership: Membership }>;
}

/**
 * `memberships/{userId}_{tenantId}`: `{ id, tenantId, userId, role, createdAt, updatedAt,
 * schemaVersion: 1 }`. `get` takes `tenantId` first.
 *
 * `listByUser` and `deleteByUser` are the only methods that omit `tenantId`. They are
 * the caller's own account, not a tenant query: they still take a server-resolved
 * `userId`, never a client id. Both are single-field `userId` equality queries, served
 * by Firestore's automatic index, so no composite index is needed.
 *
 * There is no `setRole` and no public create. Membership writes are the owner row in
 * `CommunityRepo.createWithOwner`, the member row inside `InviteRepo.accept`,
 * `updateRole`, `remove`, and `deleteByUser`.
 *
 * `listByTenant`, `updateRole` and `remove` take `tenantId` first. `updateRole` and
 * `remove` keep at least one owner: a write that would leave the tenant with zero
 * owners throws `CONFLICT` (`reason: 'last-owner'`) and writes nothing. The owner
 * count is the memberships of this `tenantId` whose `role` is `owner`, read in the
 * same turn as the write. Query `tenantId` only and filter `role` in memory so
 * Firestore needs no composite index.
 */
export interface MembershipRepo {
  /** The membership for this tenant and user, or null. Does not reveal other tenants. */
  get(tenantId: TenantId, userId: UserId): Promise<Membership | null>;
  /**
   * Memberships whose `userId` is this user, in every tenant. Not tenant-scoped: the
   * caller's own list. A non-ULID id throws `VALIDATION`.
   */
  listByUser(userId: UserId): Promise<Membership[]>;
  /**
   * Deletes every membership whose `userId` is this user. Not tenant-scoped: account
   * deletion only. Does not delete `communities` or `communitySlugs`. When more than
   * 400 match, repeats until none remain. A non-ULID id throws `VALIDATION`. No
   * memberships is a success. Idempotent.
   */
  deleteByUser(userId: UserId): Promise<void>;
  /**
   * Memberships whose `tenantId` is this tenant. Copies, not the stored objects.
   * Order is not significant. A non-ULID id throws `VALIDATION` before the read.
   */
  listByTenant(tenantId: TenantId): Promise<Membership[]>;
  /**
   * Sets `role` and `updatedAt` only. A non-ULID id, a role that fails `isRole`, or
   * an `updatedAt` that fails `instantFromIso` is `VALIDATION` and writes nothing.
   * A missing doc is `NOT_FOUND` and does not create one. Demoting the sole owner is
   * `CONFLICT` (`reason: 'last-owner'`) and writes nothing. Setting `owner` on an
   * owner succeeds. The stored `updatedAt` is the caller string.
   */
  updateRole(
    tenantId: TenantId,
    userId: UserId,
    role: Role,
    updatedAt: string,
  ): Promise<Membership>;
  /**
   * Deletes that one membership. A non-ULID id is `VALIDATION` and writes nothing.
   * A missing doc is `NOT_FOUND`. Removing the sole owner is `CONFLICT`
   * (`reason: 'last-owner'`) and the doc stays. A non-owner can be removed even when
   * the tenant already has zero owners.
   */
  remove(tenantId: TenantId, userId: UserId): Promise<void>;
}

/**
 * `invites/{token}` (`token` is a ULID, `id === token`): `{ id, tenantId, createdBy,
 * expiresAt, maxUses, uses, createdAt, updatedAt, schemaVersion: 1 }`. No composite
 * index: token and membership reads are document gets.
 *
 * `create` takes `tenantId` first and it must equal `invite.tenantId`. A mismatch, a
 * bad ULID, `uses !== 0`, or a `maxUses` outside 1–100 is `VALIDATION` and writes
 * nothing. An existing token is `CONFLICT` and does not change the stored invite.
 *
 * `getByToken` omits `tenantId` because the caller does not know the tenant yet. The
 * token is the unguessable document id (the same exception class as `listByUser`).
 * Returns null when missing. Does not check expiry. A non-ULID throws `VALIDATION`
 * before the read.
 *
 * `accept` is one transaction. `now` is the UTC ISO string the use case got from
 * `Clock`. Implementations must not read a clock. Inside the transaction:
 * 1. Missing invite → `NOT_FOUND`, no write.
 * 2. Existing membership for `(invite.tenantId, userId)` → return it with
 *    `created: false` and no write, before the expiry and `maxUses` checks.
 * 3. `inviteUnusable(invite, instantFromIso(now))` → `GONE`, no write.
 * 4. Otherwise write a `member` membership and set `uses` to the value read in this
 *    transaction plus 1, and `updatedAt` to `now`. Return `created: true`.
 */
export interface InviteRepo {
  create(tenantId: TenantId, invite: Invite): Promise<Invite>;
  getByToken(token: string): Promise<Invite | null>;
  accept(input: { token: string; userId: string; now: string }): Promise<{
    membership: Membership;
    created: boolean;
  }>;
}

/**
 * `seasons/{seasonId}` (top-level, ULID id). No composite index: `list` is a
 * single-field `tenantId` equality, and the use case sorts. State is not stored.
 *
 * `{ id, tenantId, name, kind, startDate, lengthDays, timezone, opensAtLocal,
 * closesAtLocal, createdBy, createdAt, updatedAt, schemaVersion: 1 }`.
 * On create, `updatedAt` equals `createdAt`. Timestamps are the UTC ISO strings the
 * caller passes; implementations do not read a clock.
 *
 * `get` returns null when the document is missing or its `tenantId` differs.
 * `create` uses `season.id` as the document id. An existing id is `CONFLICT`.
 * A non-ULID id, a non-ULID `tenantId`, or `schemaVersion !== 1` is `VALIDATION`.
 * `update` is a transaction. A missing document or a tenant mismatch is `NOT_FOUND`.
 * A change to `createdBy`, `createdAt` or `schemaVersion` is `VALIDATION`.
 */
export interface SeasonRepo {
  get(tenantId: TenantId, seasonId: SeasonId): Promise<CommunitySeason | null>;
  /** Every season with this `tenantId`. Unsorted. */
  list(tenantId: TenantId): Promise<CommunitySeason[]>;
  create(season: CommunitySeason): Promise<CommunitySeason>;
  update(season: CommunitySeason): Promise<CommunitySeason>;
}
