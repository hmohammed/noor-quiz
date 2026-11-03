VERDICT: CHANGES
# Code review — T013c round 3

## Findings
- [must-fix] apps/web/src/features/auth/session-context.tsx:179 — After consent, `applyTimezoneDefault` starts `PATCH /v1/me` with no `AbortSignal` and does not keep that request on `pending`. `timezoneDefault` returns null while `consent.required` (`apps/web/src/features/auth/timezone-default.ts:12`), so the load-effect call never sends the PATCH for a new account. This post-consent PATCH is in flight as soon as the profile link appears. `deleteAccount` only aborts `pending` (line 191), so the PATCH can still reach `requireUser()` after DELETE and create a new user. — Store a controller on `pending` the way `updateMe` does (reuse the current one, or create one when it is missing or already aborted) and pass its signal into this `applyTimezoneDefault` call.

## Acceptance tests
1. ok — packages/testkit/src/contracts/user-repo.contract.ts "deletes the user and every identity, and leaves the other user"
2. ok — same file "deletes a user who set a profile and accepted consent, then the same subject starts over"
3. ok — same file "resolves for an unknown ULID and on an empty store, and writes nothing"
4. ok — same file "resolves when called twice, and the second call changes nothing"
5. ok — same file "rejects %j with VALIDATION and writes nothing"
6. ok — apps/api/src/adapters/firebase/user-repo.contract.test.ts "removes an orphan identities doc whose user doc is already gone"
7. ok — same file "removes corrupt user and identity docs that the converter would reject"
8. ok — same file "leaves no raw doc whose id is the user or whose userId field is the user" (unconverted `where('userId', '==', A)`)
9. ok — packages/core/src/usecases/delete-account.test.ts "deletes the linked user exactly once and reports deleted"
10. ok — same file "does nothing for an identity with no user and reports not deleted"
11. ok — same file "after delete, signing in again creates a new user with new-user values"
12. ok — same file "rejects an unsafe subject with UNAUTHENTICATED and never deletes" (`identityId` throws before `deleteUserAndIdentities`)
13. ok — apps/api/src/middleware/require-user.test.ts "sets c.var.identity to exactly { provider, subject } and never creates a user"
14. ok — same file "%s: requireUser and requireIdentity return the same 401 without verifying" and "a rejected token returns 401 with one verify call for both middlewares" (same header cases as GET /v1/me)
15. ok — apps/api/src/routes/me.test.ts "returns 204 and the same token starts over with a new user"
16. ok — same file "returns 204 twice, and the second call creates and deletes nothing"
17. ok — same file "returns 204 for a token that was never used and creates nothing"
18. ok — same file "deletes a user who has not accepted consent" and "deletes a user whose consent is an older version"
19. ok — same file "401 UNAUTHENTICATED and the seeded user is unchanged" (missing header does not call the verifier)
20. ok — same file "user A's delete removes only user A; user B is unchanged"
21. ok — same file "ignores a JSON body and still deletes only the caller"
22. ok — same file existing "returns 404 for %s /v1/me/consent" (GET and DELETE, unchanged)
23. ok — same file "204 and 401 bodies never contain the provider subject or email"
24. ok — apps/web/src/api/client.test.ts "apiClient.deleteMe"
25. ok — apps/web/src/features/profile/DeleteAccountView.test.tsx (idle, confirming, deleting, error; no raw keys; no `<form>`)
26. ok — apps/web/e2e/delete-account.spec.ts "delete my account, then the same Google account starts over". `acceptConsentViaApi` is gone on main after T013b, so consent goes through `acceptConsentOnScreen`. `consent.required === true` is still asserted on the `GET /v1/me` body, and `sub` is hashed before `expect`.
27. ok — same file "delete confirmation stays on screen in RTL and cancel sends nothing" (agrees on the consent screen first, because the profile link stays hidden until then)

## Hard rules
1. ok — `delete-account.ts` imports only core modules. The Firestore transaction stays in `FirestoreUserRepo`.
2. ok — `deleteUserAndIdentities` is on `UserRepo`, implemented by `InMemoryUserRepo` and `FirestoreUserRepo`, and covered by one contract suite. The route calls the use case.
3. ok — the web calls `DELETE /v1/me` only. `firestore.rules` is unchanged.
4. ok — `users` and `identities` stay global, documented as such in `repos.ts`. Tests 20 and 21 cover caller isolation. No new tenant-owned document.
5. ok — no `Date.now()` / `new Date()` in core or routes. The e2e emails use `Date.now()` only to stay unique.
6. ok — the deleted user comes from the verified subject. The JSON body is not read. `requireIdentity()` sets `{ provider, subject }` only.
7. ok — no plan-name checks.
8. ok — deletion is by our ULID (`asUserId`). The Firebase uid is used only through `identityId()`.
9. ok — no token or subject is logged. The e2e hashes `sub` before asserting. 204 and 401 bodies are checked against `SENTINEL_SUBJECT` and `SENTINEL_EMAIL`.
10. ok — no AI output.
11. ok — no question content.

## Nits (non-blocking)
- A PATCH the server has already accepted can still run `requireUser()` after DELETE. Abort cannot recall it.
- Nothing asserts the generation check, `updateMe`'s abort signal, or the post-consent timezone signal. Dropping the fix at `session-context.tsx:179` would not fail a test.
- `styles.css:279` — `align-self: start` stays only on `.profile-delete__start`. `.profile-delete` does not set `align-items`.
