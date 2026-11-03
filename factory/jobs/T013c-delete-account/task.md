## T013c

**Delete my account**

Phase: P1 · Depends on: [T013a](E01-identity-privacy.md#t013a) · Tags: `sec`
Skills: `api-endpoint`, `firestore-data`, `vertical-slice`, `i18n-rtl`

**Goal.** A user deletes their account themselves. Their user record and every linked identity are gone, and signing in again starts from scratch.

**Scope**

- Add `UserRepo.deleteUserAndIdentities(userId): Promise<void>`. It is atomic and deletes `users/{userId}` and every `identities` doc whose `userId` matches. An unknown user is a no-op, not an error, and a non-ULID id gives `VALIDATION`. Implement it in `InMemoryUserRepo`, cover it in `runUserRepoContract`, and implement it in `FirestoreUserRepo` with a `runTransaction` that reads the `identities where userId ==` query and deletes everything. That is a single-field equality query, so it needs no composite index (say so in the PR).
- Use case `packages/core/src/usecases/delete-account.ts`: `deleteAccount(deps: { users }, { identity: IdentityKey })`. It looks the user up with `getByIdentity`. If there is no user it returns `{ deleted: false }`; otherwise it calls `deleteUserAndIdentities` and returns `{ deleted: true }`. Its JSDoc names T020 (memberships) and T040 (anonymise answers: drop `userId`, keep scores) as the tasks that extend it.
- Middleware `requireIdentity()` in `apps/api/src/middleware/require-user.ts`. It parses the bearer token the same way as `requireUser()` (share the parsing code), calls `deps.auth.verify`, and sets `c.var.identity`. It never calls `getOrCreateUser`, so a repeated DELETE does not create and then delete a fresh user.
- Route `DELETE /v1/me` uses `requireIdentity()` with no consent check and no body, and returns 204 in both cases. Do not revoke the Firebase Auth account or its tokens; that needs a port change and is a follow-up.
- Web:
  - A "Delete my account" section on the existing `/profile` page. It has a confirm step, pending and error states, and RTL-safe layout.
  - On success it signs out and navigates to `/`.
  - `apiClient.deleteMe({ idToken })` returns `void` and accepts 204 with no body.
  - Add `useSession().deleteAccount()`.
  - Put strings in `en.json` under `profile.delete.*`.
- e2e `apps/web/e2e/delete-account.spec.ts`: sign in, accept consent, set a name, delete the account, then sign in again with the same emulator account. The user sees the consent screen again, and once past it, the old name is gone.

**Acceptance criteria**

- [ ] After delete, the same Google account signing in gets a new userId and no old data. Core and route tests sign in, accept consent, set a profile, then call DELETE and `GET /v1/me` with the same fake identity. They check that the `userId` differs, `displayName`/`locale`/`timezone` are back to the new-user values, and `consent.required` is true. The `UserRepo` contract (in-memory and emulator) checks that no `users` or `identities` doc for the old id remains, and that a second user is untouched. The e2e covers the same flow.
- [ ] Deletion is idempotent. Two DELETEs in a row both return 204, and the second writes nothing and creates no user (counts stay 0). `deleteUserAndIdentities` on an unknown ULID resolves without an error in both implementations.
- [ ] `DELETE /v1/me` returns 401 without a token or with a rejected token, and works without consent.

**Notes**

Do not revoke the Firebase Auth account or its tokens here. That needs a change to the auth port and is a follow-up.

Tags: `sec`
Phase: P1
