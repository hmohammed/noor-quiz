import { DomainError } from '../errors';
import type { Clock } from '../ports/clock';
import type { UserRepo } from '../ports/repos';
import { toIso } from '../time/instant';
import { CURRENT_CONSENT_VERSION, hasCurrentConsent } from '../users/consent';
import { asUserId, type User, type UserId } from '../users/user';

/**
 * Records that the signed-in member accepted the current privacy terms. The client's
 * `version` is only compared with the server constant: an older one means the client
 * showed outdated terms (CONFLICT). Accepting again writes nothing and keeps the first
 * `acceptedAt`. Error `details` carry only a reason, never the submitted version.
 */
export async function acceptConsent(
  deps: { clock: Clock; users: UserRepo },
  input: { userId: UserId; version: string },
): Promise<User> {
  const userId = asUserId(input.userId);
  if (input.version !== CURRENT_CONSENT_VERSION) {
    throw new DomainError('CONFLICT', { reason: 'outdated-consent-version' });
  }

  const user = await deps.users.getById(userId);
  if (!user) throw new DomainError('NOT_FOUND', { reason: 'user-not-found' });
  if (hasCurrentConsent(user)) return user;

  const now = toIso(deps.clock.now());
  return deps.users.recordConsent(
    userId,
    { version: CURRENT_CONSENT_VERSION, acceptedAt: now },
    now,
  );
}
