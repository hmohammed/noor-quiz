# Build — T011 (round 1)
Branch: factory/T011-edit-profile
Worktree: c:\Users\hassen.mohammed\Desktop\Hobby projects\noor-quiz\.claude\worktrees\T011-edit-profile

## Changes
- packages/contracts/src/me.ts — `SUPPORTED_LOCALES`, `Locale`, `TimeZoneName` (IANA pattern + `Intl`, canonical casing), `ProfileDisplayName` (NFC → trim → collapse → letters/marks words, 2–32 code points), strict `UpdateMeRequest` (non-empty), `UpdateMeRequestInput`; `MeResponse` gains required `locale` and `timezone` (valid zone or null), still strict, `displayName` keeps the lax T010 rule.
- packages/contracts/src/me.test.ts — tests 2, 7, 24 (copy of the shared table; contracts cannot depend on testkit).
- packages/core/src/users/profile.ts (+ test) — `SUPPORTED_LOCALES`, `Locale`, `isSupportedLocale`, `normaliseProfileName`, `canonicalTimeZone`, `isProfileTimeZone`, `ProfilePatch`. `Intl` + regex only.
- packages/core/src/users/user.ts — `User` gains `locale` and `timezone` (nullable); `USER_SCHEMA_VERSION` stays 1.
- packages/core/src/ports/repos.ts — `UserRepo.updateProfile(userId, patch, updatedAt)`; doc-shape JSDoc updated.
- packages/core/src/usecases/update-profile.ts (+ test) — re-validates every field, rejects empty patch, `updatedAt` from `Clock`, `details` carry a reason only.
- packages/core/src/usecases/get-or-create-user.ts (+ test) — creates users with `locale: null, timezone: null`; doc comment says sign-in never overwrites the profile.
- packages/core/src/index.ts (+ index.test) — exports the new modules.
- packages/testkit/src/in-memory-user-repo.ts (+ test) — `updateProfile` (named fields, returns a copy).
- packages/testkit/src/contracts/user-repo.contract.ts — `updateProfile` contract (test 16); `userDoc()` fixture gains the new fields.
- packages/testkit/src/profile-cases.ts (+ index export) — shared name/timezone/locale accept/reject table.
- apps/api/src/adapters/firebase/user-repo.ts — `UserDoc` reads missing `locale`/`timezone` as null; `toUserDoc` writes both; `updateProfile` in a transaction (`NOT_FOUND` if missing, `tx.update` with only patch keys + `updatedAt`).
- apps/api/src/adapters/firebase/user-repo.contract.test.ts — raw doc shape includes the new keys; test 17 (pre-T011 doc).
- apps/api/src/app-env.ts, middleware/require-user.ts (+ test) — `RequestUser` gains `locale`, `timezone` (named fields).
- apps/api/src/http/parse-json-body.ts (+ test) — JSON + contract parse → `VALIDATION` with a reason only.
- apps/api/src/routes/me.ts — `PATCH /v1/me`: `bodyLimit(4096)` → `requireUser()` → `parseJsonBody(UpdateMeRequest)` → `updateProfile` with `c.var.user.id`; GET and PATCH build `MeResponse` from four named fields.
- apps/api/src/routes/me.test.ts — tests 4, 5, 8, 9, 18–21; `LeakyUserRepo` also leaks from `updateProfile`; extra 404 test for a vanished user.
- apps/api/src/profile-parity.test.ts — test 3.
- firebase/rules.test.ts — users seed gains `locale: null, timezone: null`; rules unchanged.
- apps/web/src/api/client.ts (+ test) — `getJson` generalised to `request(method, …)`; `updateMe` (test 22).
- apps/web/src/i18n/locales.ts — `LOCALES` with endonyms and `dir`.
- apps/web/src/features/auth/session-context.tsx — `SessionProvider` / `useSession()` with the moved `/v1/me` loading (same generation/abort guards), `updateMe(patch)`, one fire-and-forget timezone default after the first `getMe`.
- apps/web/src/features/auth/timezone-default.ts (+ test) — pure `timezoneDefault(me, browserTz)` and `browserTimeZone()`.
- apps/web/src/features/auth/AuthButton.tsx — now a `useSession()` consumer; `AuthButtonView` unchanged.
- apps/web/src/features/layout/AppLayout.tsx — session provider, header with nav (Home, Profile when signed in) and `AuthButton`, `<Outlet />`.
- apps/web/src/features/home/HomePage.tsx — header removed (lives in the layout).
- apps/web/src/router.tsx — layout route with `/` and `/profile`.
- apps/web/src/features/profile/ProfilePage.tsx — container: draft of edited fields over `me`, client-validates with `UpdateMeRequest.safeParse`, sends only changed fields, maps errors to states.
- apps/web/src/features/profile/ProfileFormView.tsx (+ test) — pure view (test 23).
- apps/web/src/i18n/en.json — `nav.*` and `profile.*` keys from the spec.
- apps/web/src/styles.css — `.site-nav`, `.profile-form*`, `.profile__*`, disabled button; header `space-between`. Logical properties and existing variables only.
- apps/web/e2e/helpers/sign-in.ts, sign-in.spec.ts — emulator sign-in extracted (CDN blocking kept).
- apps/web/e2e/profile.spec.ts — tests 10 and 11.
- docs/tasks/E01-identity-privacy.md — T011 Notes for T013/T061/T080 and the missing rate limit.

## Acceptance tests → test files
1. normaliseProfileName accept/reject table → packages/core/src/users/profile.test.ts "normaliseProfileName accepts … / rejects …"
2. UpdateMeRequest same table, normalised output → packages/contracts/src/me.test.ts "UpdateMeRequest accepts displayName (…) and normalises it" / "rejects displayName (…)"
3. Parity core ↔ contracts via testkit table, same locales → apps/api/src/profile-parity.test.ts
4. PATCH ሀሰን / حسن / Åsa → 200 and later GET → apps/api/src/routes/me.test.ts "returns 200 with displayName %s and a later GET returns it"
5. PATCH '', '😀😀', 33 cp → 400, stored user (incl. updatedAt) unchanged → me.test.ts "400 VALIDATION and nothing written" (first three rows; clock is advanced before the call)
6. isProfileTimeZone / canonicalTimeZone → packages/core/src/users/profile.test.ts "canonicalTimeZone / isProfileTimeZone"
7. UpdateMeRequest timezones and locales → packages/contracts/src/me.test.ts "accepts/rejects timezone %j", "accepts/rejects locale %j"
8. PATCH Mars/Olympus, +01:00, fr → 400, nothing written → me.test.ts "400 VALIDATION and nothing written"
9. PATCH am + Africa/Addis_Ababa; europe/stockholm canonicalised → me.test.ts "sets locale and timezone together", "stores and returns a timezone in canonical casing"
10. e2e change name → header, persists after reload → apps/web/e2e/profile.spec.ts "change my name to ሀሰን and see it in the header, also after reload"
11. e2e browser timezone default, one PATCH, shown on profile → apps/web/e2e/profile.spec.ts "first sign-in sends the browser timezone once and the profile shows it"
12. timezoneDefault → apps/web/src/features/auth/timezone-default.test.ts
13. updateProfile use case → packages/core/src/usecases/update-profile.test.ts
14. sign-in never overwrites an edited name → update-profile.test.ts "a later sign-in with a different token name keeps the edited name" (also the repo contract's existing "returns the same user on a later call")
15. getOrCreateUser creates locale/timezone null → packages/core/src/usecases/get-or-create-user.test.ts "creates a user and identity …" (now `toStrictEqual`)
16. UserRepo.updateProfile contract → packages/testkit/src/contracts/user-repo.contract.ts "updateProfile" (fake + emulator)
17. pre-T011 doc reads null and updates → apps/api/src/adapters/firebase/user-repo.contract.test.ts "reads a users doc written before T011 …"
18. PATCH 401 → me.test.ts "401 UNAUTHENTICATED and nothing created or changed"
19. PATCH 400 for non-JSON, array, {}, unknown key, role, displayName null, >4 KB → me.test.ts "400 VALIDATION and nothing written" (+ "a body over 4 KB is rejected before the token is verified")
20. user A cannot change user B → me.test.ts "user A's token changes only user A; user B is unchanged"
21. GET/PATCH exactly four keys with LeakyUserRepo → me.test.ts "GET and PATCH return exactly userId, displayName, locale, timezone even if the repo leaks keys"
22. apiClient.updateMe → apps/web/src/api/client.test.ts "apiClient.updateMe"
23. ProfileFormView states → apps/web/src/features/profile/ProfileFormView.test.tsx
24. MeResponse requires locale/timezone, strict → packages/contracts/src/me.test.ts "MeResponse"
25. existing sign-in e2e and AuthButtonView tests → apps/web/e2e/sign-in.spec.ts, apps/web/src/features/auth/AuthButtonView.test.tsx (unchanged, pass)

## How I tested
| command | result |
| --- | --- |
| npm run lint | eslint pass; `prettier --check` flags only untouched files because this Windows checkout has `core.autocrlf=true` (CRLF). `prettier --check --end-of-line auto .` passes for the whole repo |
| npm run typecheck | pass |
| npm test | 49 files / 776 tests pass. `tooling/src/docs-commands.test.ts` fails in this checkout only because AGENT.md is CRLF; passes with AGENT.md in LF (file not changed) |
| npm run test:emulator | pass (3 files, 107 tests: user-repo contract + T011 legacy-doc test, auth-verifier, rules) |
| npm run test:e2e | pass, 4/4, run twice. `dev:emulators` uses POSIX `VAR=x cmd` syntax that cmd.exe can't run, so I started the same servers by hand (API build, `firebase emulators:start --only auth,firestore,functions` with `FUNCTIONS_DISCOVERY_TIMEOUT=60`, `npm run dev -w @noor/web`) and Playwright reused them |

## Commits
- e6310a6 T011: Profile rules, UpdateMeRequest contract, updateProfile use case and repo fake
- 451596e T011: PATCH /v1/me with Firestore updateProfile and route tests
- a652727 T011: Shared session, header nav and profile page in the web app
- e1d7106 T011: e2e for profile name and browser timezone default; epic notes

## Notes for reviewers
- No new dependency. `hono/body-limit` is built into hono.
- Core tests cannot import testkit (workspace cycle), so `profile.test.ts` and `update-profile.test.ts` repeat the shared cases and use a small inline advancing clock instead of `FakeClock`. The API parity test runs the real testkit table through both core and contracts.
- Timezone canonicalisation follows the runtime's `Intl`. Node 26 reports `America/Argentina/Buenos_Aires` as `America/Buenos_Aires`, so the shared table pins canonical output only for zones that are stable (`europe/stockholm` → `Europe/Stockholm`, `Africa/Addis_Ababa`). Contracts and core use the same `Intl` call, so they always agree.
- `PATCH /v1/me` runs `bodyLimit` before `requireUser`, so an oversized body is rejected without verifying a token. For a valid token, `requireUser` may still create the user (first sight) before body validation fails; the 400 tests sign in first and check that the stored user is unchanged.
- The timezone `<select>` reuses `profile.localeUnset` ("Not set") for its unset option instead of adding a key outside the spec's list.
- The profile sends the raw typed name; the server normalises it. When the client-side `UpdateMeRequest` check fails on `displayName` the view shows `invalid-name` without calling the API.
- Running the e2e servers ran the project's `ensure-env-local` scripts, which created gitignored `apps/api/build/.env.local` and `apps/web/.env.local` from `.env.example` (demo values, same as `npm run dev`). Nothing committed.
- Follow-up for a later task (noted in the epic): a rate limit on `PATCH /v1/me`.

## Round 2
- review-ux.md: the unsaved draft and status carried over to the next signed-in user → fixed in apps/web/src/features/profile/ProfilePage.tsx. The form now lives in a `ProfileEditor` keyed by `me.userId` and unmounts when the state leaves `signed-in`, so the draft and status reset. New e2e test: apps/web/e2e/profile.spec.ts "an unsaved edit never shows in the next member's form". (b30b82d)
- review-ux.md: a load failure showed the save-failure text and gave no way to retry → fixed in ProfileFormView.tsx and en.json. A new `profile.error.load` string is shown with a "Try again" button (`profile.retry`), which reloads the page. `profile.error.generic` is now used for save failures only. Covered in ProfileFormView.test.tsx "load error: …". (b30b82d)
- review-ux.md: the `unavailable` state showed "Sign in to edit your profile." → fixed in ProfilePage.tsx and ProfileFormView.tsx. `unavailable` is now its own view state with `profile.unavailable` and no sign-in action. The signed-out view now has its own "Sign in with Google" button. Covered in ProfileFormView.test.tsx "unavailable: …" and "signed-out: …". (b30b82d)
- apps/web/e2e/helpers/sign-in.ts: the helper now clicks the header's sign-in button (`getByRole('banner')`), because a signed-out `/profile` now shows a second one.
- UX nits not changed (non-blocking, out of this round's scope).
- Checks: typecheck pass. ESLint pass. `prettier --check --end-of-line auto .` pass. `npm test`: 769 tests pass. The only failure is `tooling/src/docs-commands.test.ts`, the same CRLF `AGENT.md` checkout issue as round 1 (file not changed). E2E: 5/5 pass, run with hand-started emulators and Vite as in round 1. Emulator tests not re-run because no adapter or rules changed.
