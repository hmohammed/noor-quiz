# Build — T013c (round 1)
Branch: factory/T013c-delete-account
Worktree: c:\Users\hassen.mohammed\Desktop\Hobby projects\noor-quiz\.claude\worktrees\T013c-delete-account

## Changes
- packages/core/src/ports/repos.ts — `UserRepo.deleteUserAndIdentities`. Unknown user is a no-op, a non-ULID throws `VALIDATION`, and the `identities where userId ==` query is documented as a single-field equality (no composite index).
- packages/core/src/usecases/delete-account.ts — `deleteAccount` looks up the verified identity and deletes that user. No user means `{ deleted: false }` and no write, so a repeat call never creates one. JSDoc names T020 and T040.
- packages/testkit/src/in-memory-user-repo.ts — atomic in-memory delete (validate, then delete with no `await` in between). `addIdentity` is test-only and not on the port: `createWithIdentity` still refuses a second identity on an existing user id, so a ULID collision cannot link two accounts.
- packages/testkit/src/contracts/user-repo.contract.ts — shared `deleteUserAndIdentities` suite. The harness `addIdentity` plants the second identity for both implementations.
- apps/api/src/adapters/firebase/user-repo.ts — `runTransaction` on unconverted refs, so a corrupt doc cannot throw `INTERNAL` and block deletion.
- apps/api/src/middleware/require-user.ts — shared `verifyBearer`. `requireIdentity()` sets `{ provider, subject }` and never calls `getOrCreateUser`. `requireUser()` behaviour is unchanged.
- apps/api/src/routes/me.ts — `DELETE /v1/me` returns 204 with an empty body. No consent check, no body parsing.
- apps/web — `apiClient.deleteMe`, `useSession().deleteAccount()` (cancels in-flight `/v1/me` first, signs out, does not call `getMe` again), and a confirm section on `/profile` outside the form. Strings are `profile.delete.*`. CSS uses logical properties; the confirm button is `--color-error` with white text.
- apps/web/e2e — `signInAgainWithEmulator` picks the existing emulator account by email. Consent still goes through `acceptConsentViaApi`.

No new dependency. `firebase/firestore.rules` and `firebase/firestore.indexes.json` are unchanged.

## Acceptance tests → test files
1. Second identity is deleted; user B remains → packages/testkit/src/contracts/user-repo.contract.ts "deletes the user and every identity, and leaves the other user"
2. Profile and consent are wiped; the same subject starts over → same file "deletes a user who set a profile and accepted consent, then the same subject starts over"
3. Unknown ULID and an empty store write nothing → same file "resolves for an unknown ULID and on an empty store, and writes nothing"
4. Second call changes nothing → same file "resolves when called twice, and the second call changes nothing"
5. Non-ULID id rejects with VALIDATION → same file "rejects %j with VALIDATION and writes nothing"
6. Orphan identity is removed → apps/api/src/adapters/firebase/user-repo.contract.test.ts "removes an orphan identities doc whose user doc is already gone"
7. Corrupt user and identity docs are removed → same file "removes corrupt user and identity docs that the converter would reject"
8. No raw doc with id A or userId A remains → same file "leaves no raw doc whose id is the user or whose userId field is the user"
9. Deletes the linked user once → packages/core/src/usecases/delete-account.test.ts "deletes the linked user exactly once and reports deleted"
10. Missing user does not delete → same file "does nothing for an identity with no user and reports not deleted"
11. Sign-in after delete starts over → same file "after delete, signing in again creates a new user with new-user values"
12. Unsafe subject is UNAUTHENTICATED → same file "rejects an unsafe subject with UNAUTHENTICATED and never deletes"
13. `c.var.identity` and no user created → apps/api/src/middleware/require-user.test.ts "sets c.var.identity to exactly { provider, subject } and never creates a user"
14. Shared header parser → same file "%s: requireUser and requireIdentity return the same 401 without verifying" and "a rejected token returns 401 with one verify call for both middlewares"
15. 204 then a new user on GET → apps/api/src/routes/me.test.ts "returns 204 and the same token starts over with a new user"
16. Two DELETEs, second writes nothing → same file "returns 204 twice, and the second call creates and deletes nothing"
17. Unused token creates nothing → same file "returns 204 for a token that was never used and creates nothing"
18. Works without consent and with an older version → same file "deletes a user who has not accepted consent" and "deletes a user whose consent is an older version"
19. 401 and the seeded user stays → same file "401 UNAUTHENTICATED and the seeded user is unchanged"
20. A cannot delete B → same file "user A's delete removes only user A; user B is unchanged"
21. JSON body is ignored → same file "ignores a JSON body and still deletes only the caller"
22. DELETE /v1/me/consent stays 404 → apps/api/src/routes/me.test.ts existing "returns 404 for %s /v1/me/consent" (unchanged, still green)
23. 204 and 401 bodies leak no subject or email → same file "204 and 401 bodies never contain the provider subject or email"
24. `deleteMe` client → apps/web/src/api/client.test.ts "apiClient.deleteMe"
25. Delete section markup → apps/web/src/features/profile/DeleteAccountView.test.tsx
26. Happy path → apps/web/e2e/delete-account.spec.ts "delete my account, then the same Google account starts over"
27. RTL confirm/cancel → same file "delete confirmation stays on screen in RTL and cancel sends nothing"

## How I tested
| command | result |
| --- | --- |
| npx eslint . --max-warnings 0 | pass |
| npx prettier --check --end-of-line auto . | pass |
| npm run typecheck (`npx tsc -b`) | pass |
| npm test (`npx vitest run`) | 882 tests passed. `tooling/src/docs-commands.test.ts` fails to load because AGENT.md is CRLF (`core.autocrlf=true`); that file was not part of this change. `npm run lint` was not used: on this checkout it flags untouched CRLF files. |
| npm run test:emulator | pass (127 tests, including the Firestore user-repo contract) |
| npm run test:e2e | pass (7 tests). Emulators were started with `$env:FUNCTIONS_DISCOVERY_TIMEOUT='60'; npx firebase emulators:start --only auth,firestore,functions --config firebase/firebase.json --project demo-noor` after building the API, plus `npm run dev:web`. `npm run dev:emulators` was not used (POSIX env syntax). Both server processes were stopped afterwards. Playwright reused those servers. |

## Commits
- 61d9331f25f137df998a0c444962fef4f7f02696 T013c: delete the signed-in account without creating a user first
- 172572d4a46a6ea403bb65fa80eee96cf9e9bedb T013c: delete user and identity docs atomically, including corrupt ones
- 162e9739a93d205bc4245baa58a5c1acc8e5b11f T013c: delete only the caller from DELETE /v1/me, with or without consent
- 5bd7443af20136fb18a9746155ac1d5a17917565 T013c: confirm account deletion on the profile page and sign out
- 5abb984e98b629fc78ec4073f0fe380e3b71888f T013c: prove the same Google account starts over after delete

## Notes for reviewers
- The `identities where userId ==` query is a single-field equality, served by Firestore's automatic single-field index. No composite index was added. Say so in the PR description.
- Firebase Auth accounts and refresh tokens are not revoked. That needs an `AuthVerifier` change and is a follow-up.
- The web client cancels in-flight `/v1/me` calls before DELETE and does not call `getMe` afterwards, so a late profile save cannot recreate the user.
- e2e accepts consent with `acceptConsentViaApi`. "Consent required again" is asserted on the `GET /v1/me` body (`consent.required === true`), not on a consent screen.
- The token `sub` in the e2e is hashed before `expect`, so a failure does not print the subject.

## Round 2
- review-ux.md: profile stays editable during delete, so a PATCH can follow DELETE and recreate the account → once confirm starts, saves are ignored and the fields and Save button are disabled (`ProfilePage.tsx`, `ProfileFormView.tsx`). `updateMe` uses the same abort controller `deleteAccount` cancels before `deleteMe`, and it returns before the PATCH if that generation has already moved (`session-context.tsx`) (d0a9a4b).
- review-code.md / review-security.md: the same in-flight `updateMe` race, listed as a nit and a P3 → fixed in that same change (d0a9a4b).
- review-ui.md: the idle delete button stretches to the column width → `align-self: start` on `.profile-delete__start` only. `.profile-delete` does not set `align-items` (351a591).
- review-ux.md nits (focus leaving Cancel while deleting, the sign-out failure copy, and a “account removed” line on home) → not changed; they were non-blocking.

## How I tested (round 2)
| command | result |
| --- | --- |
| npx eslint . --max-warnings 0 | pass |
| npx prettier --check --end-of-line auto . | pass |
| npx tsc -b | pass |
| npx vitest run | 883 tests passed. `tooling/src/docs-commands.test.ts` still fails to load because AGENT.md is CRLF. |
| npm run test:e2e | pass (7 tests). Emulators and `npm run dev:web` were started by hand and stopped afterwards. |

## Round 3
Rebased `factory/T013c-delete-account` onto `origin/main` (`39cc8ce`, T013b). Did not abort. Conflicts in `client.ts`, `client.test.ts`, `session-context.tsx`, and `styles.css` kept both the consent screen (`acceptConsent`, consent gate, `/privacy` styles) and account deletion (`deleteMe`, confirm step, abort of an in-flight profile save). `align-self: start` stayed only on `.profile-delete__start`.

`acceptConsentViaApi` is gone on main. The delete e2e now uses `acceptConsentOnScreen`. After delete and signing in again, `GET /v1/me` has a new `userId`, `consent.required === true`, and the display name is back to the token name, and the "Before you start" screen is visible before agreeing again. The RTL delete check agrees on that screen first, because the profile link is hidden until consent.

## How I tested (round 3)
| command | result |
| --- | --- |
| npx eslint . --max-warnings 0 | pass |
| npx prettier --check --end-of-line auto . | pass |
| npx tsc -b | pass |
| npx vitest run | 917 tests passed. `tooling/src/docs-commands.test.ts` still fails to load because AGENT.md is CRLF. |
| npm run test:emulator | pass (127 tests) |
| npm run test:e2e | pass (10 tests). Emulators were started with `FUNCTIONS_DISCOVERY_TIMEOUT=60` and Vite with `npm run dev:web`, then both were stopped. |

## Commits (after rebase)
- 7fae1d7 T013c: delete the signed-in account without creating a user first
- 54d6da9 T013c: delete user and identity docs atomically, including corrupt ones
- 7f75638 T013c: delete only the caller from DELETE /v1/me, with or without consent
- 97ef945 T013c: confirm account deletion on the profile page and sign out
- bd7a3dd T013c: prove the same Google account starts over after delete
- b8e5378 T013c: stop a profile save from recreating a deleted account
- 9e00063 T013c: keep the delete start button content-sized
- ba5f069a89dd4525188eecc46a5b829d8f8b494a T013c: accept consent on the screen after deleting an account

## Round 4
- rework.md / review-code.md / review-security.md: the timezone PATCH that starts after consent had no abort signal, so it could reach `requireUser()` after DELETE and create a new user → `acceptConsent` stores a controller on `pending` the way `updateMe` does and passes that signal into `applyTimezoneDefault`. The PATCH starts only when the generation has not moved (`session-context.tsx`) (4d2abef).
- Earlier non-blocking nits (focus, sign-out copy, the home line, and the missing assertion for this signal) → not changed.

## How I tested (round 4)
| command | result |
| --- | --- |
| npx eslint . --max-warnings 0 | pass |
| npx prettier --check --end-of-line auto . | pass |
| npx tsc -b | pass |
| npx vitest run | 917 tests passed. `tooling/src/docs-commands.test.ts` still fails to load because AGENT.md is CRLF. |
| npm run test:emulator | not re-run; adapters and rules were not touched |
| npm run test:e2e | pass (10 tests). Emulators were started with `FUNCTIONS_DISCOVERY_TIMEOUT=60` and Vite with `npm run dev:web`, then both were stopped. |
