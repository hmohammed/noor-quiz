import type { MembershipRepo, UserRepo } from '../ports/repos';
import type { IdentityKey } from '../users/user';

/**
 * Deletes the signed-in person's account. Memberships in every community go first,
 * then the user doc and every linked identity, so a retry still finds the user.
 * Community docs and slug reservations stay: a community can be left with no owner
 * until T022. Takes the verified identity, not a user id, so a repeat call never
 * creates a user first. T040 still anonymises answers (drop `userId`, keep scores).
 */
export async function deleteAccount(
  deps: { users: UserRepo; memberships: MembershipRepo },
  input: { identity: IdentityKey },
): Promise<{ deleted: boolean }> {
  const user = await deps.users.getByIdentity({
    provider: input.identity.provider,
    subject: input.identity.subject,
  });
  if (!user) return { deleted: false };
  await deps.memberships.deleteByUser(user.id);
  await deps.users.deleteUserAndIdentities(user.id);
  return { deleted: true };
}
