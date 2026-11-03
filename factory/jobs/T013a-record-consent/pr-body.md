## Summary
- The API records whether a user has accepted the current privacy terms. `POST /v1/me/consent` stores the server's version and the clock time.
- `PATCH /v1/me` is the first protected endpoint. Without current consent it returns 403 `CONSENT_REQUIRED`. `GET /v1/me` reports consent status and never returns `acceptedAt`.
- The web app no longer sends the browser timezone until consent is recorded. The consent screen itself is T013b. End-to-end profile tests accept consent through the real API so they keep passing.

## Acceptance criteria
- [x] A protected endpoint without consent returns 403 `CONSENT_REQUIRED`. `apps/api/src/routes/me.test.ts`, `apps/api/src/middleware/require-consent.test.ts`
- [x] `GET /v1/me` and `POST /v1/me/consent` succeed without consent, and GET reports whether consent is still required. `apps/api/src/routes/me.test.ts`
- [x] `POST /v1/me/consent` returns 401, 400, and 409 as specified, and a second accept keeps the first `acceptedAt`. `apps/api/src/routes/me.test.ts`, `packages/core/src/usecases/accept-consent.test.ts`
- [x] The user repository contract covers `recordConsent` in memory and on the emulator, including a legacy document with no consent. `packages/testkit/src/contracts/user-repo.contract.ts`, `apps/api/src/adapters/firebase/user-repo.contract.test.ts`
- [x] `MeResponse` stays strict and does not include `acceptedAt`, a Firebase uid, or an email. `apps/api/src/routes/me.test.ts`, `packages/contracts/src/me.test.ts`

## Checks
- ESLint — pass
- `prettier --check --end-of-line auto` — pass. Plain `prettier --check` fails on this Windows checkout because of CRLF on untouched files
- `npm run typecheck` — pass
- `npm test` — 840 passed. `tooling/src/docs-commands.test.ts` fails only because `AGENT.md` is CRLF here. The diff does not touch that file
- `npm run test:emulator` — pass (118 tests)
- `npm run test:e2e` — 5 passed. Servers were started by hand because `dev:emulators` uses POSIX syntax that cmd.exe cannot run

## Reviews
- Round 1: security PASS, UX PASS, UI PASS, code PASS
- Approver: APPROVE

## Needs a human
- Merge this pull request. T013b and T013c wait until it is merged.
- Do not deploy this to real users on its own. After it merges, saving a profile returns 403 until T013b adds the consent screen.
- Follow-ups left for later: rate-limit `POST /v1/me/consent` when a shared limiter exists, and T013c should delete the consent data with the user.

Co-authored-by: Grok 4.7 <cursoragent@cursor.com>
