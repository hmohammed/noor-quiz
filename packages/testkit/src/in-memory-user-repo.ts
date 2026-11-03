import {
  asUserId,
  DomainError,
  identityId,
  isValidConsent,
  type Consent,
  type Identity,
  type IdentityKey,
  type ProfilePatch,
  type User,
  type UserId,
  type UserRepo,
} from '@noor/core';

/**
 * In-memory UserRepo. `createWithIdentity` and `deleteUserAndIdentities` read and write
 * with no `await` in between, so they are atomic under `Promise.all`. Returns copies,
 * never stored objects (`#copy` also copies the nested `consent`, the only non-flat field).
 */
export class InMemoryUserRepo implements UserRepo {
  readonly #users = new Map<string, User>();
  readonly #identities = new Map<string, Identity>();

  async getByIdentity(key: IdentityKey): Promise<User | null> {
    const identity = this.#identities.get(identityId(key));
    return identity ? this.#copy(this.#linkedUser(identity)) : null;
  }

  async createWithIdentity(user: User, identity: Identity): Promise<User> {
    const id = identityId(identity);
    asUserId(user.id);
    if (id !== identity.id || identity.userId !== user.id) {
      throw new DomainError('VALIDATION', { reason: 'identity-mismatch' });
    }
    const existing = this.#identities.get(id);
    if (existing) return this.#copy(this.#linkedUser(existing));
    if (this.#users.has(user.id)) {
      throw new DomainError('INTERNAL', { reason: 'user-id-collision' });
    }
    this.#users.set(user.id, this.#copy(user));
    this.#identities.set(id, { ...identity });
    return this.#copy(user);
  }

  async getById(userId: UserId): Promise<User | null> {
    const user = this.#users.get(asUserId(userId));
    return user ? this.#copy(user) : null;
  }

  async updateProfile(userId: UserId, patch: ProfilePatch, updatedAt: string): Promise<User> {
    const user = this.#users.get(asUserId(userId));
    if (!user) throw new DomainError('NOT_FOUND', { reason: 'user-not-found' });
    const next: User = { ...this.#copy(user), updatedAt };
    if (patch.displayName !== undefined) next.displayName = patch.displayName;
    if (patch.locale !== undefined) next.locale = patch.locale;
    if (patch.timezone !== undefined) next.timezone = patch.timezone;
    this.#users.set(user.id, next);
    return this.#copy(next);
  }

  async recordConsent(userId: UserId, consent: Consent, updatedAt: string): Promise<User> {
    const id = asUserId(userId);
    if (!isValidConsent(consent))
      throw new DomainError('VALIDATION', { reason: 'invalid-consent' });
    const user = this.#users.get(id);
    if (!user) throw new DomainError('NOT_FOUND', { reason: 'user-not-found' });
    const next: User = {
      ...this.#copy(user),
      consent: { version: consent.version, acceptedAt: consent.acceptedAt },
      updatedAt,
    };
    this.#users.set(id, next);
    return this.#copy(next);
  }

  async deleteUserAndIdentities(userId: UserId): Promise<void> {
    const id = asUserId(userId);
    this.#users.delete(id);
    for (const [key, identity] of this.#identities) {
      if (identity.userId === id) this.#identities.delete(key);
    }
  }

  /**
   * Test-only. Attaches an identity that already names a stored user, without the
   * user-id collision guard on `createWithIdentity`. Not part of `UserRepo`.
   */
  async addIdentity(identity: Identity): Promise<void> {
    const id = identityId(identity);
    const userId = asUserId(identity.userId);
    if (id !== identity.id) throw new DomainError('VALIDATION', { reason: 'identity-mismatch' });
    if (!this.#users.has(userId)) throw new DomainError('NOT_FOUND', { reason: 'user-not-found' });
    this.#identities.set(id, { ...identity, userId });
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

  #copy(user: User): User {
    return { ...user, consent: user.consent && { ...user.consent } };
  }
}
