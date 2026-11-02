## Summary
- `GET /v1/me` checks the bearer token through the `AuthVerifier` port and returns only our user id and display name.
- A Firebase Auth adapter verifies the ID token (including revocation) on the Auth emulator. The Firebase uid is never a response field, a `c.var` field, or a log line.
- Display names are limited by Unicode code points (2–32), so a 32-emoji name does not become a 500.

## Acceptance criteria
- [x] `GET /v1/me` returns 401 without a valid token. `apps/api/src/routes/me.test.ts`, shared contract `packages/testkit/src/contracts/auth-verifier.contract.ts`, emulator cases in `apps/api/src/adapters/firebase/auth-verifier.contract.test.ts`
- [x] The Firebase uid never appears in API responses. `apps/api/src/routes/me.test.ts`, `packages/contracts/src/me.test.ts`, `apps/api/src/middleware/require-user.test.ts`

## Checks
- `npm install` — pass
- `npm run lint` — pass
- `npm run typecheck` — pass
- `npm test` — pass (39 files, 514 tests, after rebase onto main)
- `npm run test:emulator` — pass (3 files, 101 tests, Auth and Firestore emulators)
- `npm run test:e2e` — not relevant (no UI)

## Reviews
- Round 1: security PASS, code PASS
- Approver: APPROVE

## Needs a human
- Merge this pull request. T010c waits for this merge.
- No other human step. Follow-ups left for later: refuse to boot staging or prod when an emulator host variable is set, and rate limiting on authenticated routes.

Co-authored-by: Claude Opus 5.5 <noreply@anthropic.com>
