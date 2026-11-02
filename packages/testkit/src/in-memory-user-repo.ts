import {
  asUserId,
  DomainError,
  identityId,
  type Identity,
  type IdentityKey,
  type ProfilePatch,
  type User,
  type UserId,
  type UserRepo,
} from '@noor/core';

/**
 * In-memory UserRepo. `createWithIdentity` checks and inserts with no `await` in
 * between, so it is atomic under `Promise.all`. Returns copies, never stored objects
 * (the docs are flat, so a shallow copy is a full copy).
 */
export class InMemoryUserRepo implements UserRepo {
  readonly #users = new Map<string, User>();
  readonly #identities = new Map<string, Identity>();

  async getByIdentity(key: IdentityKey): Promise<User | null> {
    const identity = this.#identities.get(identityId(key));
    return identity ? { ...this.#linkedUser(identity) } : null;
  }

  async createWithIdentity(user: User, identity: Identity): Promise<User> {
    const id = identityId(identity);
    asUserId(user.id);
    if (id !== identity.id || identity.userId !== user.id) {
      throw new DomainError('VALIDATION', { reason: 'identity-mismatch' });
    }
    const existing = this.#identities.get(id);
    if (existing) return { ...this.#linkedUser(existing) };
    if (this.#users.has(user.id)) {
      throw new DomainError('INTERNAL', { reason: 'user-id-collision' });
    }
    this.#users.set(user.id, { ...user });
    this.#identities.set(id, { ...identity });
    return { ...user };
  }

  async getById(userId: UserId): Promise<User | null> {
    const user = this.#users.get(asUserId(userId));
    return user ? { ...user } : null;
  }

  async updateProfile(userId: UserId, patch: ProfilePatch, updatedAt: string): Promise<User> {
    const user = this.#users.get(asUserId(userId));
    if (!user) throw new DomainError('NOT_FOUND', { reason: 'user-not-found' });
    const next: User = { ...user, updatedAt };
    if (patch.displayName !== undefined) next.displayName = patch.displayName;
    if (patch.locale !== undefined) next.locale = patch.locale;
    if (patch.timezone !== undefined) next.timezone = patch.timezone;
    this.#users.set(user.id, next);
    return { ...next };
  }

  /** Number of stored docs, for contract tests. */
  counts(): { users: number; identities: number } {
    return { users: this.#users.size, identities: this.#identities.size };
  }

  #linkedUser(identity: Identity): User {
    const user = this.#users.get(identity.userId);
    if (!user) throw new DomainError('INTERNAL', { reason: 'identity-without-user' });
    return user;
  }
}
