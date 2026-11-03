import type { Clock } from '../ports/clock';
import type { IdGenerator } from '../ports/id-generator';
import type { UserRepo } from '../ports/repos';
import { toIso } from '../time/instant';
import {
  asUserId,
  identityId,
  normaliseDisplayName,
  USER_SCHEMA_VERSION,
  type Identity,
  type IdentityKey,
  type User,
  type VerifiedIdentity,
} from '../users/user';

/**
 * Returns our user for a verified identity, creating the user and identity on first
 * sight, with `consent: null`. Later calls return the stored user unchanged: sign-in
 * never overwrites the profile the member edits with `updateProfile`, nor their consent.
 */
export async function getOrCreateUser(
  deps: { clock: Clock; ids: IdGenerator; users: UserRepo },
  input: VerifiedIdentity,
): Promise<User> {
  const key: IdentityKey = { provider: input.provider, subject: input.subject };
  const id = identityId(key);

  const existing = await deps.users.getByIdentity(key);
  if (existing) return existing;

  const now = toIso(deps.clock.now());
  const userId = asUserId(deps.ids.newId());
  const user: User = {
    id: userId,
    displayName: normaliseDisplayName(input.name),
    locale: null,
    timezone: null,
    consent: null,
    createdAt: now,
    updatedAt: now,
    schemaVersion: USER_SCHEMA_VERSION,
  };
  const identity: Identity = {
    id,
    provider: key.provider,
    subject: key.subject,
    userId,
    email: input.email,
    emailVerified: input.emailVerified,
    createdAt: now,
    schemaVersion: USER_SCHEMA_VERSION,
  };
  // Returns the existing user if a concurrent call created the identity first.
  return deps.users.createWithIdentity(user, identity);
}
