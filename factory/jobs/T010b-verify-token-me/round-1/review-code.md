VERDICT: PASS
# Code review — T010b round 1

Reviewed `git diff main...factory/T010b-verify-token-me` (5 commits, 25 files). I re-ran `npm run typecheck` (clean) and `npx vitest run` (36 files, 319 tests, all pass). I did not re-run `npm run test:emulator`; I relied on build.md for that and read the emulator test code instead.

## Findings
None. No must-fix findings.

## Acceptance tests
1. ok — `packages/testkit/src/contracts/auth-verifier.contract.ts` "resolves a valid token to the identity it was issued for" and "gives null email and name when the identity has none". It runs against the fake and the emulator.
2. ok — contract "resolves two identities to two different subjects"
3. ok — contract `it.each(['', 'garbage', 'a.b.c'])` "rejects the malformed token %j with UNAUTHENTICATED"
4. ok — contract "rejects a token after it was revoked…". The fake harness uses `reject`; the emulator harness waits 1.1 s and calls `revokeRefreshTokens`. The fake rejects revoked tokens on its own, and the adapter passes `checkRevoked=true`.
5. ok — `expectUnauthenticated` checks `isDomainError`, the code, and that neither message nor details contain the token. It skips the contains-check only for `''`, and the reason is sound.
6. ok — `fake-auth-verifier.test.ts:6` runs `runAuthVerifierContract('FakeAuthVerifier', …)`
7. ok — `fake-auth-verifier.test.ts` has tests for opaque tokens, unknown token, copy on verify, copy on issue, and `verifyCalls`.
8. ok — `auth-verifier.contract.test.ts:76` runs the contract against the emulator.
9. ok — "rejects an expired token…", with a control test "accepts a well-formed unsigned emulator token". The control shows the rejection is caused by `exp`.
10. ok — "rejects a token for a disabled user…" and "…a deleted user…". Each verifies the token first, then disables or deletes the user.
11. ok — "rejects a token for a wrong project…" (`other-project`)
12. ok — "refuses to run without FIREBASE_AUTH_EMULATOR_HOST". `requireEmulator` is also called in `beforeAll`.
13. ok — "writes nothing to the console when it rejects a token". It spies on error, warn, log and info.
14. ok — `me.test.ts:53`
15. ok — `me.test.ts:67`. It sends 2 sequential and 5 concurrent requests and checks counts of 1 user and 1 identity.
16. ok — `me.test.ts:84`, null and 1-char names.
17. ok — `me.test.ts:107–155`. It covers all 7 header cases plus an unknown token and a rejected token. Each case checks the `ErrorResponse` code.
18. ok — each header case asserts `verifyCalls === 0` and zero counts.
19. ok — `me.test.ts:97`, `bearer` and `BEARER`.
20. ok — `me.test.ts:166`. It checks the sentinel subject and email in the 200 body, and the subject and token in the 401 body.
21. ok — `packages/contracts/src/me.test.ts` "throws on an extra %s key (strict)" (uid, subject, and email)
22. ok — `me.test.ts` in contracts covers the accepted names (Åsa, Arabic, Ge'ez, 32 Ge'ez, 32 emoji) and the rejected cases (non-ULID, 1 code point, 33 code points). The fix uses `Array.from` in `.refine`, so it would fail with plain `.min/.max` on the 32-emoji case.
23. ok — `me.test.ts:184` uses `LeakyUserRepo extends InMemoryUserRepo`. The route builds the body from two named fields, and the test asserts exactly 2 keys.
24. ok — `me.test.ts:197` (POST gives 404) and `me.test.ts:209` (health is public, `verifyCalls` 0).
25. ok — `require-user.test.ts:22` uses `toStrictEqual({ id, displayName })`.
26. ok — `composition.test.ts` adds a counting `getAdminAuth` mock. It checks `built.auths === 0` on an invalid env, `FirebaseAuthVerifier` instance, and one admin app after two calls.
27. ok — `make-test-deps.test.ts` checks `FakeAuthVerifier` instance, fresh per call, overridable, and still a `Deps`.

Each test would fail without the change: the ports, fake, adapter, middleware, route and contract schema don't exist on main, so the tests can't import or pass.

## Hard rules
1. ok — `packages/core/src/ports/auth-verifier.ts` imports only `VerifiedIdentity`. `firebase-admin/auth` is imported only in `apps/api/src/adapters/firebase/`.
2. ok — `/v1/me` is read-only server-side. The web app is untouched, and there are no client Firestore writes.
3. ok — not applicable. `users` and `identities` are global by design (see the `UserRepo` JSDoc), and the spec says wrong-tenant tests don't apply.
4. ok — no `Date.now()` in core, the middleware or the route. The only non-test use is `SystemClock`. See nit 1 for the test file.
5. ok — no plan-name checks.
6. ok — `c.var.user` is `{ id, displayName }` only. No custom claims or roles are read, and the response is built from named fields and strict-parsed.
7. ok — the primary key is our ULID `userId`. The uid is used only as `subject` for `getOrCreateUser`, and never in `c.var` or a response (tests 20, 23, 25).
8. ok — the token, header and SDK messages are never logged. `details` holds only `reason` and an `auth/...` code (regex-guarded). `errors.ts` serialises only the code, and test 13 covers it.
9. ok — not applicable. No AI output is involved.
10. ok — not applicable. No content is scheduled.
11. ok — nothing sensitive in code. `demo-noor` and `fake-api-key` are emulator-only, and the emulator test refuses to run without the emulator host.

## Scope
- The 25 files match the spec's file list. The diff includes the `errors.ts` generic signature (`installErrorHandling<E extends Env>`) that build.md declares. It is type-only, with the mapping and handler untouched.
- `docs/tasks/BOARD.md` is intentionally left for the orchestrator.
- No new dependencies.

## Nits (non-blocking)
1. `auth-verifier.contract.test.ts:63` uses `Date.now()` to build the JWT claims. It is an adapter test file, and the unsigned-JWT approach requires wall-clock time. The spec accepts that, and lint passes.
2. `require-user.ts:7` The `/i` flag also applies to the token character class. It is harmless because the class already covers both cases.
3. `me.ts` in contracts: the `DisplayName` `.refine` has no error message, so a 500 from a parse failure is logged without an explanation. This is cosmetic.
4. `auth-verifier.contract.test.ts:166` The `sdkCode` assertion allows both shapes (code present or absent), so it doesn't pin the SDK code. This is acceptable because the SDK code differs by version.
