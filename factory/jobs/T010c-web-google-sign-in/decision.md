APPROVE
Reason: Round 2 all PASS, the acceptance criterion and all 10 spec tests are in the diff, lint/typecheck/unit/e2e green, firebase dependency justified with an exit path, no escalation triggers.
# Decision — T010c

## Checks
- Reviews (round 2): security PASS, ux PASS, ui PASS, code PASS (round 1 ux CHANGES fixed in 1f3da2c: `.auth__button` gets `min-block-size: 2.75rem`, `min-inline-size: 6rem`)
- Acceptance criteria → tests: 1/1 task criterion ("e2e with the auth emulator: sign in → see my name") → `apps/web/e2e/sign-in.spec.ts`, which is in the diff. All 10 spec acceptance tests map to test files in the diff (home.spec.ts is unchanged by design).
- Checks green (rounds 1 and 2): lint, typecheck, test (43 files, 542 tests), test:e2e (2/2). test:emulator does not apply (no adapter or rules change).
- Definition of Done: the six `auth.*` strings go through `t()` in `en.json` (the only locale file in apps/web). Styles use logical properties only. The display name uses `dir="auto"`. `apps/web/.env.example` was added. Notes are in `docs/tasks/E01-identity-privacy.md`. No ADR needed, because the auth boundary follows the existing ports approach.
- New dependency: `firebase@^12.19.0` in apps/web. The task and build.md justify it (Google popup and ID token refresh) and give the exit path (`apps/web/src/auth/session.ts`). `firebase-boundary.test.ts` enforces that only that file imports Firebase. The lockfile only moves already-present firebase packages from dev to prod.
- Escalation triggers: none. The task is tagged `sec` and is not human-owned. No billing. No `firebase/firestore.rules` change. No prod config or secrets: the web config is the public `demo-noor` config, and an emulator host with a non-`demo-*` project throws `AuthConfigError`. No content `reviewStatus` changes.
