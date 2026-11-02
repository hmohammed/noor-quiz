# Build — T010b (round 1)
Branch: factory/T010b-verify-token-me
Worktree: c:\Users\hassen.mohammed\Desktop\Hobby projects\noor-quiz\.claude\worktrees\T010b-verify-token-me

## Changes
- packages/contracts/src/me.ts (+ test), index.ts — `Ulid` and strict `MeResponse`. The display name is limited by code points with `.refine` (2 to 32 via `Array.from`), not `.min/.max`, so a name of 32 emoji does not cause a 500.
- packages/core/src/ports/auth-verifier.ts — `AuthVerifier` port. It reuses `VerifiedIdentity` and has no vendor types.
- packages/core/src/deps.ts, index.ts — adds `auth: AuthVerifier` to `Deps` and exports the port type.
- packages/testkit/src/fake-auth-verifier.ts (+ test) — `FakeAuthVerifier` with opaque `fake-token-<n>` tokens, `issue`/`reject`/`verifyCalls`. It copies identities when it stores them and when it returns them.
- packages/testkit/src/contracts/auth-verifier.contract.ts — `runAuthVerifierContract` and `AuthVerifierHarness`. It also exports `expectUnauthenticated(p, token)`, which checks the error is a DomainError with code UNAUTHENTICATED and that the token is not in its message or details. The adapter-only tests use it too.
- packages/testkit/src/make-test-deps.ts (+ test), index.ts — `TestDeps.auth: FakeAuthVerifier`, a fresh one per call, which tests can override.
- apps/api/src/adapters/firebase/auth.ts — `getAdminAuth()` uses the same default admin app as `getAdminFirestore()`.
- apps/api/src/adapters/firebase/auth-verifier.ts — `FirebaseAuthVerifier`. An empty token is rejected without calling the SDK. It calls `verifyIdToken(token, true)`, and any error from it becomes `UNAUTHENTICATED` with details `{ reason: 'token-rejected', sdkCode? }`. `sdkCode` is kept only if it matches `^auth/[a-z-]+$`. Nothing is logged.
- apps/api/src/adapters/firebase/auth-verifier.contract.test.ts — runs the shared contract on the Auth emulator, plus tests for expired, wrong-project, disabled-user and deleted-user tokens, the SDK-code-only details, console silence, and `requireEmulator`.
- apps/api/src/app-env.ts — `AppEnv` and `RequestUser` (`{ id, displayName }`).
- apps/api/src/middleware/require-user.ts (+ test) — `requireUser()`, built as in the spec. It uses the Bearer regex (scheme is case-insensitive) and a 4096-char cap, then calls verify and `getOrCreateUser`, then sets `c.var.user`.
- apps/api/src/routes/me.ts (+ test) — `GET /v1/me` builds `MeResponse.parse` from two named fields.
- apps/api/src/app.ts — `createApp` returns `Hono<AppEnv>`. The first middleware sets `deps`, then `meRoutes()` is mounted. Health stays public.
- apps/api/src/errors.ts — `installErrorHandling` is now generic, `<E extends Env>(app: Hono<E>)`, so it accepts the typed app. This is a type-only change; the mapping and handler are unchanged.
- apps/api/src/composition.ts (+ test) — `auth: new FirebaseAuthVerifier(getAdminAuth())`. The test's counting mock now also counts `getAdminAuth`.
- package.json — `test:emulator` now runs `--only auth,firestore`.

No new dependencies. No new config or env keys.

## Acceptance tests → test files
1. A valid token resolves to the identity, with null email and name when absent → packages/testkit/src/contracts/auth-verifier.contract.ts "resolves a valid token to the identity it was issued for", "gives null email and name when the identity has none"
2. Two identities give two subjects → same file, "resolves two identities to two different subjects"
3. `''`, `'garbage'`, `'a.b.c'` are rejected → same file, "rejects the malformed token %j with UNAUTHENTICATED"
4. A revoked token is rejected → same file, "rejects a token after it was revoked, without echoing the token"
5. Every rejection is a DomainError that does not echo the token → `expectUnauthenticated` in the same file, used by tests 3, 4, 9, 10, 11 and 13. It skips the contains-check for `''`, because every string contains the empty string.
6. Fake runs the contract → packages/testkit/src/fake-auth-verifier.test.ts `runAuthVerifierContract('FakeAuthVerifier', …)`
7. Opaque tokens, unknown token, copy semantics, verifyCalls → same file: "issues opaque tokens…", "rejects an unknown token…", "returns a copy…", "copies the identity on issue…", "counts verify() calls…"
8. Emulator contract → apps/api/src/adapters/firebase/auth-verifier.contract.test.ts `runAuthVerifierContract('FirebaseAuthVerifier (emulator)', …)`
9. Expired token → same file, "rejects an expired token with UNAUTHENTICATED". The control test "accepts a well-formed unsigned emulator token" shows the rejection really comes from `exp`.
10. Disabled and deleted user → same file, "rejects a token for a disabled user…", "rejects a token for a deleted user…"
11. Wrong project → same file, "rejects a token for a wrong project…"
12. requireEmulator → same file, "refuses to run without FIREBASE_AUTH_EMULATOR_HOST"
13. No console output → same file, "writes nothing to the console when it rejects a token"
14. 200, ULID equal to the stored user, normalised name → apps/api/src/routes/me.test.ts "returns 200 with our userId and the normalised displayName…"
15. Same userId for repeated and 5 concurrent requests, counts 1/1 → same file, "returns the same userId for repeated and concurrent requests…"
16. A null or 1-char name gives displayName null → same file, "returns displayName null when the token name is %s"
17. 401 for every header case, an unknown token and a rejected token → same file, describe "401 for a missing or malformed Authorization header…" (7 cases), "returns 401 for an unknown token…", "returns 401 for a token the verifier rejects…"
18. Header cases: verifyCalls 0 and no user created → asserted in each of the 7 header cases
19. `bearer` and `BEARER` → same file, "accepts the scheme %s (case-insensitive)"
20. No sentinel uid or email in the 200 and 401 bodies → same file, "never puts the provider uid or email in a 200 or 401 body"
21. Strict schema rejects `uid` and `subject` → packages/contracts/src/me.test.ts "throws on an extra %s key (strict)"
22. Unicode and code-point bounds → same file, "accepts a ULID with displayName %s" and "rejects %s"
23. A leaky repo still gives exactly 2 keys → apps/api/src/routes/me.test.ts "returns exactly userId and displayName even if the repo returns extra keys" (`LeakyUserRepo extends InMemoryUserRepo`)
24. POST gives 404; health is public → same file, "returns 404 for POST /v1/me", "does not make requireUser global…"
25. `c.var.user` is exactly `{ id, displayName }` → apps/api/src/middleware/require-user.test.ts "sets c.var.user to exactly { id, displayName }…"
26. Composition wiring and ConfigError before building auth → apps/api/src/composition.test.ts (counting `getAdminAuth` mock, `FirebaseAuthVerifier` instance, one admin app)
27. makeTestDeps returns a fresh FakeAuthVerifier that can be overridden → packages/testkit/src/make-test-deps.test.ts

Extra tests: a 4096-char token reaches the verifier (boundary for the length cap), and a verified subject `a/b` gives 401 with no user created (through `identityId`).

## How I tested
| command | result |
| --- | --- |
| npm run lint | pass |
| npm run typecheck | pass |
| npm test | pass (36 files, 319 tests) |
| npm run test:emulator | pass (3 files, 101 tests, auth + firestore emulators) |
| npm run test:e2e | not relevant (no UI) |

## Commits
- 601ce31 T010b: MeResponse contract (strict, ULID, 2-32 code points)
- d5b273f T010b: AuthVerifier port, FakeAuthVerifier and shared contract suite
- 4d4d3fc T010b: FirebaseAuthVerifier with Auth emulator contract, wired in composition
- 8c88ad7 T010b: requireUser middleware, AppEnv and GET /v1/me route
- eb46811 T010b: format require-user test

## Notes for reviewers
- The spec says to set the T010b row in `docs/tasks/BOARD.md` to `done`. My run instructions say never to edit BOARD.md, so I left it for the orchestrator.
- Between 4d4d3fc and 8c88ad7, `apps/api` still typechecks, because the route is only added in 8c88ad7. Only d5b273f on its own breaks `apps/api` typecheck: `Deps.auth` is added before composition wires it, and 4d4d3fc fixes that.
- The emulator harness gets ID tokens through `createCustomToken`, then the emulator REST `accounts:signInWithCustomToken`. The emulator copies the user's email, email_verified and name into the ID token, which the contract test confirms. `revoke` waits 1.1 s because revocation compares whole seconds.
- The emulator test uses `Date.now()` only to build the unsigned JWT claims. It is an adapter test file, not core or a route.
- On Windows the worktree was checked out with CRLF, so Prettier flagged every file. I re-checked out the tracked files with LF using a one-off `git -c core.autocrlf=false -c core.eol=lf`, without changing git config. No line-ending-only changes were committed (`git diff --stat main..HEAD` lists only the 25 task files).
