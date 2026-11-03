import type { UserRepo } from '../ports/repos';
import type { IdentityKey } from '../users/user';

/**
 * Deletes the signed-in person's account: their user doc and every linked identity, so
 * the next sign-in starts from scratch. Takes the verified identity, not a user id, so a
 * repeat call never creates a user first. Extended by T020 (delete memberships) and
 * T040 (anonymise answers: drop `userId`, keep scores).
 */
export async function deleteAccount(
  deps: { users: UserRepo },
  input: { identity: IdentityKey },
): Promise<{ deleted: boolean }> {
  const user = await deps.users.getByIdentity({
    provider: input.identity.provider,
    subject: input.identity.subject,
  });
  if (!user) return { deleted: false };
  await deps.users.deleteUserAndIdentities(user.id);
  return { deleted: true };
}
