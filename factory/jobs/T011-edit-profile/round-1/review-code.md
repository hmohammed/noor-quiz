VERDICT: PASS
# Code review — T011 round 1

Reviewed `git diff main...factory/T011-edit-profile` (4 commits, 47 files) against spec.md and build.md. I read the contracts, core, testkit, API route/adapter and web session/profile code and all new tests, and re-ran `npm test` in the worktree. 768 tests pass. The only failing suite is `tooling/src/docs-commands.test.ts`, which fails because `AGENT.md` is checked out with CRLF line endings, as build.md says. The diff does not touch `AGENT.md`. I did not re-run the emulator or Playwright suites.

## Findings
No must-fix findings.

## Acceptance tests
1. ok — `packages/core/src/users/profile.test.ts` "normaliseProfileName accepts … / rejects …". It covers the full table, including decomposed Å, harakat, 32 and 33 code points, ZWJ, NUL, mark-only and a non-string. Without `normaliseProfileName` it cannot compile.
2. ok — `packages/contracts/src/me.test.ts` "UpdateMeRequest accepts displayName (…) and normalises it / rejects displayName (…)". It uses a copy of the table, because contracts cannot depend on testkit.
3. ok — `apps/api/src/profile-parity.test.ts` runs the real testkit table (`profile-cases.ts`) through core and contracts. It compares names, canonical timezones, locales and the two `SUPPORTED_LOCALES` lists.
4. ok — `apps/api/src/routes/me.test.ts` "returns 200 with displayName %s and a later GET returns it" (ሀሰን, حسن, Åsa).
5. ok — `me.test.ts` "400 VALIDATION and nothing written". It uses `''`, `😀😀` and 33 code points, advances the clock first, and `toStrictEqual`s the stored user including `updatedAt`.
6. ok — `profile.test.ts` "canonicalTimeZone / isProfileTimeZone". It covers the valid zones, the `europe/stockholm` canonicalisation and every listed rejection.
7. ok — `me.test.ts` (contracts) "accepts/rejects timezone %j", "accepts/rejects locale %j".
8. ok — `routes/me.test.ts` rows for Mars/Olympus, `+01:00` and locale `fr`, each checking nothing is written.
9. ok — `routes/me.test.ts` "sets locale and timezone together" and "stores and returns a timezone in canonical casing".
10. ok (not re-run) — `apps/web/e2e/profile.spec.ts` "change my name to ሀሰን …". It asserts the header `auth-name`, then a reload, and then the form value.
11. ok (not re-run) — `profile.spec.ts` "first sign-in sends the browser timezone once …". It uses `timezoneId: 'Africa/Addis_Ababa'`, asserts exactly one PATCH with that body, and checks the profile page shows the zone.
12. ok — `apps/web/src/features/auth/timezone-default.test.ts`.
13. ok — `packages/core/src/usecases/update-profile.test.ts`. Core cannot import testkit (workspace cycle), so it uses an inline advancing clock and map repo instead of `FakeClock`. The assertions are still meaningful.
14. ok — `update-profile.test.ts` "a later sign-in with a different token name keeps the edited name".
15. ok — `get-or-create-user.test.ts` now uses `toStrictEqual` with `locale: null, timezone: null`.
16. ok — `packages/testkit/src/contracts/user-repo.contract.ts` "updateProfile" block. It covers a partial patch, a copy, `NOT_FOUND`, `VALIDATION` and counts. The in-memory repo test and the emulator contract test both run it.
17. ok (emulator, not re-run) — `apps/api/src/adapters/firebase/user-repo.contract.test.ts` "reads a users doc written before T011 …". It also checks that the raw doc gets only `timezone` and `updatedAt` added.
18. ok — `me.test.ts` "401 UNAUTHENTICATED and nothing created or changed". It covers no header, a Basic scheme and a rejected token.
19. ok — `me.test.ts` covers non-JSON, array, `{}`, `userId`, `role`, `displayName: null` and a body over 4 KB. It also has a test that an oversized body is rejected before the token is verified.
20. ok — `me.test.ts` "user A's token changes only user A; user B is unchanged". B's doc is compared as JSON before and after.
21. ok — `me.test.ts` "GET and PATCH return exactly userId, displayName, locale, timezone even if the repo leaks keys". `LeakyUserRepo` also leaks from `updateProfile`.
22. ok — `apps/web/src/api/client.test.ts` "apiClient.updateMe". It covers the headers, the body, a 400 and a contract break.
23. ok — `ProfileFormView.test.tsx` covers the labels, `dir="auto"`, five locales with `lang`, `loading`, `signed-out`, `saving`, `saved`, `invalid-name`, `error`, escaping and no raw `profile.*` key.
24. ok — `packages/contracts/src/me.test.ts` "MeResponse" has missing-locale and missing-timezone cases plus extra-key cases.
25. ok — `AuthButtonView` is unchanged. `sign-in.spec.ts` now uses the extracted helper, which keeps the CDN blocking. I did not re-run it.

## Hard rules
1. ok — core `profile.ts` and `update-profile.ts` use only `Intl` and regex. `hono/body-limit` stays in `apps/api`.
2. ok — the new method is on the `UserRepo` port, the fake and the Firestore adapter, with one shared contract.
3. ok — the web only calls `PATCH /v1/me`. Firestore rules are unchanged, and the rules test seed only gains the two keys.
4. ok — `users` is global by design (documented in `repos.ts`). The route uses `c.var.user.id` and never a body id, and the strict body cannot carry one.
5. ok — `updatedAt` comes from `deps.clock`. The only `Date.now()` in the diff is in e2e test email addresses.
6. ok — the body is a strict object. Core re-validates every field. `MeResponse` is built from named fields.
7. ok — no plan names or entitlements are involved.
8. ok — responses carry our ULID only. No Firebase uid is stored or returned, and the leak tests cover PATCH.
9. ok — `DomainError` details carry a reason only (`parse-json-body.test.ts` asserts a sentinel never appears). Nothing logs the body or token.
10. ok — no AI output is involved.
11. ok — no content scheduling is involved.

## Scope, correctness, i18n, dependencies
- Scope: the changed files match spec.md. `parse-json-body.ts` and the e2e sign-in helper are both listed in the spec. No unrelated refactors.
- i18n/RTL: all user strings go through `t()`. Endonyms live in `locales.ts` as data with `lang` and `dir`. The name input has `dir="auto"` and the timezone select has `dir="ltr"`. The new CSS uses logical properties and existing variables only.
- Dependencies: none added. `hono/body-limit` is built in.
- Idempotency/retries: the Firestore `updateProfile` is a transaction. It returns `NOT_FOUND` for a missing doc and only writes the patched keys plus `updatedAt`.

## Nits (non-blocking)
- `apps/web/src/features/auth/session-context.tsx` (the `applyTimezoneDefault` `.then` that calls `setState({ kind: 'signed-in', me: updated })`): the fire-and-forget timezone PATCH replaces `me` with its own response. If the user saves a profile change in the few milliseconds before that response arrives, the older response could briefly overwrite the header name until the next load. The server data is correct. A cheap guard would be to apply the response only when `me` is unchanged, or to patch only `timezone` into the current state.
- `PATCH /v1/me` calls `requireUser()` before body validation, so a first-time user can be created by a request that then fails with 400. build.md already notes this, and the data is the same as a plain `GET /v1/me` would create. It is not a correctness issue.
- The timezone `<select>` reuses `profile.localeUnset` ("Not set") for its unset option. This is documented in build.md and acceptable until a dedicated key is worth adding.
- `profile-cases.ts` is duplicated by hand in the core and contracts tests. This is unavoidable given the package boundaries. The parity test in `apps/api` is what stops them drifting, so keep it.
- The rate-limit follow-up is recorded in the epic notes. Make sure it gets a BOARD task.
