APPROVE
Reason: Security and code reviews both PASS in round 1; both acceptance criteria map to tests present in the diff; lint, typecheck, unit and emulator tests are green; no escalation triggers.
# Decision — T010b

## Checks
- Reviews (round 1): security PASS, code PASS
- Acceptance criteria → tests: 2/2
  - 401 without or with an invalid token (no header, non-Bearer, empty token, a token the fake rejects, expired token on the emulator, `ErrorResponse` code `UNAUTHENTICATED`) → `apps/api/src/routes/me.test.ts` ("401 for a missing or malformed Authorization header…" including `Basic abc`, `Bearer`, `Bearer `; "returns 401 for an unknown token…"; "returns 401 for a token the verifier rejects…"), `apps/api/src/adapters/firebase/auth-verifier.contract.test.ts` ("rejects an expired token…", wrong-project, disabled, deleted), shared contract `packages/testkit/src/contracts/auth-verifier.contract.ts` (malformed, revoked).
  - Firebase uid never appears in responses → `me.test.ts` "never puts the provider uid or email in a 200 or 401 body" (sentinel `SENTINELuid0123456789abcdef`), "returns exactly userId and displayName even if the repo returns extra keys"; `packages/contracts/src/me.test.ts` "throws on an extra %s key (strict)"; `apps/api/src/middleware/require-user.test.ts` (`c.var.user` is exactly `{ id, displayName }`).
  - All 27 spec acceptance tests are mapped in build.md and confirmed by the code reviewer.
- Checks green: lint, typecheck, test (36 files, 319 tests), test:emulator (3 files, 101 tests, auth + firestore). e2e not applicable (no UI).
- Definition of Done: no user-facing strings or UI, so i18n/RTL do not apply. No new env/config keys, so `.env.example` unchanged. No ADR needed (Firebase Auth already chosen in ADR 0002, behind the `AuthVerifier` port). BOARD.md left for the orchestrator, as instructed.
- Escalation triggers: none
  - Task tagged `sec`, not human-owned.
  - No billing, no production config (only `package.json` `test:emulator` now starts `auth,firestore` on `demo-noor`).
  - `firebase/firestore.rules` untouched.
  - No new dependency (`firebase-admin` already in `apps/api`); no lockfile change.
  - No content or `reviewStatus` touched.

## Follow-ups (non-blocking, from security review)
- P3: `createComposition` should refuse to start in staging/prod when `FIREBASE_AUTH_EMULATOR_HOST` or `FIRESTORE_EMULATOR_HOST` is set, because the admin SDK accepts unsigned tokens in emulator mode. Worth a small hardening task.
- P3: rate limiting on authenticated routes before join/submit/invite endpoints land.
