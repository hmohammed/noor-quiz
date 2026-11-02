import type { Identity, IdentityKey, User, UserId } from '../users/user';

/**
 * Global (not tenant-owned) collections `users` and `identities`: no `tenantId`, by
 * design. A person is one user across every tenant, so AGENT.md rule 4 does not apply.
 *
 * Doc shapes:
 * - `users/{userId}` (ULID): `{ id, displayName, createdAt, updatedAt, schemaVersion: 1 }`
 * - `identities/{provider}_{subject}`: `{ id, provider, subject, userId, email,
 *   emailVerified, createdAt, schemaVersion: 1 }`. The deterministic id is what makes
 *   one identity map to exactly one user.
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
}
