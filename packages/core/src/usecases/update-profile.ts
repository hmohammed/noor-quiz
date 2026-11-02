import { DomainError } from '../errors';
import type { Clock } from '../ports/clock';
import type { UserRepo } from '../ports/repos';
import { toIso } from '../time/instant';
import {
  canonicalTimeZone,
  isSupportedLocale,
  normaliseProfileName,
  type ProfilePatch,
} from '../users/profile';
import { asUserId, type User, type UserId } from '../users/user';

/**
 * Changes the signed-in member's own name, locale and/or timezone. Re-validates every
 * field even when the caller already parsed a contract. Error `details` carry only a
 * reason, never the submitted value.
 */
export async function updateProfile(
  deps: { clock: Clock; users: UserRepo },
  input: { userId: UserId } & ProfilePatch,
): Promise<User> {
  const userId = asUserId(input.userId);
  const patch: ProfilePatch = {};

  if (input.displayName !== undefined) {
    const name = normaliseProfileName(input.displayName);
    if (name === null) throw new DomainError('VALIDATION', { reason: 'invalid-display-name' });
    patch.displayName = name;
  }
  if (input.locale !== undefined) {
    if (!isSupportedLocale(input.locale)) {
      throw new DomainError('VALIDATION', { reason: 'unsupported-locale' });
    }
    patch.locale = input.locale;
  }
  if (input.timezone !== undefined) {
    const tz = canonicalTimeZone(input.timezone);
    if (tz === null) throw new DomainError('VALIDATION', { reason: 'invalid-timezone' });
    patch.timezone = tz;
  }
  if (Object.keys(patch).length === 0) {
    throw new DomainError('VALIDATION', { reason: 'empty-patch' });
  }

  return deps.users.updateProfile(userId, patch, toIso(deps.clock.now()));
}
