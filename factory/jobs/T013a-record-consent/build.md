# Build — T013a (round 1)
Branch: factory/T013a-record-consent
Worktree: c:\Users\hassen.mohammed\Desktop\Hobby projects\noor-quiz\.claude\worktrees\T013a-record-consent

## Changes
- packages/core/src/users/consent.ts (new) — `CURRENT_CONSENT_VERSION = '2026-11-01'`, `CONSENT_VERSION_MAX = 32`, `Consent`, `hasCurrentConsent`, `isValidConsent` (uses core `instantFromIso`, no vendor code).
- packages/core/src/users/user.ts — `User.consent: Consent | null` with JSDoc. `USER_SCHEMA_VERSION` stays 1.
- packages/core/src/errors.ts — new code `CONSENT_REQUIRED`.
- packages/core/src/ports/repos.ts — `UserRepo.recordConsent(userId, consent, updatedAt)` with JSDoc. The doc-shape comment now lists `consent`.
- packages/core/src/usecases/accept-consent.ts (new) — the steps from the spec, in its order: VALIDATION, then CONFLICT `outdated-consent-version`, then NOT_FOUND, then no write if already current, otherwise `recordConsent` with `toIso(clock.now())`.
- packages/core/src/usecases/get-or-create-user.ts — creates users with `consent: null`.
- packages/core/src/index.ts — exports consent and acceptConsent.
- packages/testkit/src/in-memory-user-repo.ts — `recordConsent` (asUserId → isValidConsent → NOT_FOUND) and a private `#copy` that also copies the nested `consent`. Every method uses it.
- packages/testkit/src/contracts/user-repo.contract.ts — `userDoc()` gains `consent: null`, plus a new `recordConsent` describe block.
- apps/api/src/adapters/firebase/user-repo.ts — `UserDoc.consent` is a strict object, nullable, default null. `toUserDoc` copies consent by name. `recordConsent` runs a transaction with `tx.update(ref, { consent, updatedAt })`.
- apps/api/src/errors.ts — maps `CONSENT_REQUIRED` to 403 with `'Consent required'`.
- apps/api/src/app-env.ts, middleware/require-user.ts — `RequestUser.consentVersion` (the version only, never `acceptedAt`).
- apps/api/src/middleware/require-consent.ts (new) — `requireConsent()`, with reason `consent-missing` or `consent-outdated`.
- apps/api/src/routes/me.ts — shared `limitBody()` and `meBody()`, built from named fields. PATCH is now `limitBody, requireUser, requireConsent`. New `POST /v1/me/consent` is `limitBody, requireUser`, then parse, then `acceptConsent`.
- packages/contracts/src/me.ts — `AcceptConsentRequest`, `MeConsent`, and `MeResponse.consent`.
- apps/web/src/features/auth/timezone-default.ts — returns null while `me.consent.required`.
- apps/web/e2e/helpers/sign-in.ts — `acceptConsentViaApi(page, meResponse)`. `profile.spec.ts` calls it in the first two tests.
- Test fixtures updated: core update-profile and get-or-create-user, testkit in-memory repo, web client.

## Acceptance tests → test files
1. hasCurrentConsent current/null/older → packages/core/src/users/consent.test.ts "is true only for the current version", "is false for %s"
2. CURRENT_CONSENT_VERSION 1–32 chars → consent.test.ts "is a non-empty string of at most 32 chars"
3. first accept records version/acceptedAt/updatedAt → packages/core/src/usecases/accept-consent.test.ts "records the current version with acceptedAt and updatedAt from the clock"
4. second accept keeps first, no recordConsent call → accept-consent.test.ts "a second accept keeps the first acceptedAt and updatedAt and writes nothing"
5. older version replaced → accept-consent.test.ts "replaces an older accepted version…"
6. non-current / '' → CONFLICT, unchanged → accept-consent.test.ts "throws CONFLICT for %s and changes nothing"
7. unknown → NOT_FOUND, non-ULID → VALIDATION → accept-consent.test.ts "throws NOT_FOUND…", "throws VALIDATION…"
8. getOrCreateUser consent null and never reset → packages/core/src/usecases/get-or-create-user.test.ts "creates a user and identity…" (toStrictEqual has consent: null), "a later sign-in returns the stored consent unchanged"
9. CONSENT_REQUIRED in DOMAIN_ERROR_CODES → packages/core/src/errors.test.ts (it.each table)
10. recordConsent writes only consent+updatedAt, B unchanged, counts → packages/testkit/src/contracts/user-repo.contract.ts "writes only consent and updatedAt and returns the stored user"
11. keeps profile fields → user-repo.contract.ts "keeps the profile fields set earlier"
12. unknown → NOT_FOUND writes nothing; non-ULID → VALIDATION → user-repo.contract.ts "throws NOT_FOUND for an unknown ULID and writes nothing", "throws VALIDATION for a non-ULID id"
13. malformed consent → VALIDATION, nothing written → user-repo.contract.ts "throws VALIDATION for %s and writes nothing"
14. returned values are copies → user-repo.contract.ts "returns copies, not the stored consent"
15. getOrCreateUser via contract gives consent null; fixture gains consent: null → user-repo.contract.ts "creates one user and one identity on the first call"
16. raw doc shape includes consent: null → apps/api/src/adapters/firebase/user-repo.contract.test.ts "stores exactly the documented doc shapes…"
17. legacy doc reads consent null; recordConsent raw doc → user-repo.contract.test.ts "reads a users doc written before T011…" and "records consent on a doc written before T013a and adds only consent and updatedAt"
18. extra key in consent / string consent → INTERNAL → user-repo.contract.test.ts "rejects a users doc with %s as INTERNAL"
19. requireConsent 403 new/older, 200 current, 401 no token → apps/api/src/middleware/require-consent.test.ts (4 tests)
20. c.var.user exact shape with consentVersion → apps/api/src/middleware/require-user.test.ts "sets c.var.user to exactly…", "sets consentVersion to the stored version and never acceptedAt"
21. CONSENT_REQUIRED → 403 'Consent required' → apps/api/src/errors.test.ts (exhaustive tables)
22. GET new user required: true → apps/api/src/routes/me.test.ts "returns 200 with our userId and the normalised displayName for a valid token"
23. POST consent 200, later GET required false, acceptedAt = clock → me.test.ts "records the current version and a later GET reports required: false"
24. second POST keeps first acceptedAt → me.test.ts "a second accept returns 200 and keeps the first acceptedAt"
25. PATCH 403 for new user, unchanged → me.test.ts "403 CONSENT_REQUIRED and nothing changed › for a new user who has not accepted"
26. PATCH 403 for older version → me.test.ts "… › for a user who accepted an older version"
27. PATCH 200 after POST consent → me.test.ts "returns 200 after POST /v1/me/consent for the same user"
28. POST consent 401 no header / rejected token → me.test.ts "POST /v1/me/consent › 401 UNAUTHENTICATED…"
29. POST consent 400 bodies → me.test.ts "POST /v1/me/consent › 400 VALIDATION and consent stays null" (8 cases)
30. >4 KB before verify → me.test.ts "… › a body over 4 KB is rejected before the token is verified"
31. 409 for well-formed non-current → me.test.ts "returns 409 CONFLICT for a well-formed version that is not current"
32. A changes only A → me.test.ts "user A's accept changes only user A; user B is unchanged"
33. leak test GET/POST/PATCH → me.test.ts "GET, POST consent and PATCH return only the contract keys even if the repo leaks keys"
34. GET/DELETE /v1/me/consent 404; POST /v1/me 404 → me.test.ts "returns 404 for %s /v1/me/consent", "returns 404 for POST /v1/me"
35. existing PATCH tests pass with consent-by-default signedIn; VanishingRepo seeds consent → me.test.ts "PATCH /v1/me" block
36. AcceptConsentRequest → packages/contracts/src/me.test.ts "AcceptConsentRequest" block
37. MeResponse consent rules → contracts me.test.ts "rejects %s" (missing consent, acceptedAt in consent, non-boolean required, missing acceptedVersion) and "accepts acceptedVersion %s"
38. timezoneDefault null while consent required → apps/web/src/features/auth/timezone-default.test.ts "returns null while consent is required…"
39. client fixtures + getMe without consent → ApiError → apps/web/src/api/client.test.ts "throws ApiError when the body has no consent block (strict contract)"
40. e2e profile/sign-in/home pass → apps/web/e2e/profile.spec.ts, helpers/sign-in.ts

## How I tested
| command | result |
| --- | --- |
| npm run lint (eslint) | pass |
| npm run lint (prettier --check) | pass with `--end-of-line auto`. Without that flag, about 20 files I did not touch fail, because the Windows worktree checkout has CRLF line endings (core.autocrlf=true). The files in git are LF. |
| npm run typecheck | pass |
| npm test | 840/840 tests pass. One suite fails: `tooling/src/docs-commands.test.ts`. Its regex expects LF, and AGENT.md is CRLF in this Windows checkout. This branch does not touch AGENT.md or tooling, so the failure is environmental and should pass on Linux CI. |
| npm run test:emulator | pass (3 files, 118 tests) |
| npm run test:e2e | pass (5/5). `dev:emulators` uses POSIX `VAR=x cmd` syntax, which fails under Windows cmd, so I started the emulators by hand with the same command and env var. Playwright then reused that server. |

## Commits
- 3933431 T013a: core consent model, CONSENT_REQUIRED code and acceptConsent use case
- d338f0d T013a: UserRepo.recordConsent in InMemoryUserRepo and FirestoreUserRepo with contract tests
- e497ac3 T013a: POST /v1/me/consent, requireConsent middleware and consent block in MeResponse
- 3d466f7 T013a: web skips the timezone default until consent; e2e accepts consent via the API

## Notes for reviewers
- No new dependencies. No changes to firestore.rules, indexes, BOARD.md or epic files.
- `me.ts` has a small `requestUserOf(user)` next to `meBody()`. It maps a `User` to the named `RequestUser` fields, so PATCH and POST never spread a user.
- `recordConsent` in both repos checks `asUserId` first, then `isValidConsent`, then existence. A malformed consent on an unknown user therefore gives VALIDATION, not NOT_FOUND.
- `LeakyUserRepo` in me.test.ts also overrides `getById`, because `acceptConsent` reads through it. The leak test advances the clock before accepting, so the stored `acceptedAt` is a distinct value. The test asserts that this value is absent from every body.
- The e2e helper reads the bearer header with `request().allHeaders()`, not `headers()`, because Playwright's `headers()` can omit security-related headers. It waits for `GET /v1/me` after `page.reload()`. In the timezone test, the PATCH waiter is registered after `signInWithEmulator` returns and before the consent helper, so it cannot miss the PATCH that follows the reload. `patches` still has to have length 1, which also shows that no PATCH fired before consent.
- The `dev:emulators` script is not Windows-compatible (`FUNCTIONS_DISCOVERY_TIMEOUT=60 firebase …`). This predates T013a and I left it alone.
