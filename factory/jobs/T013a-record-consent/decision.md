APPROVE
Reason: All four round-1 reviews pass, all 5 acceptance criteria map to tests in the diff, checks are green (the only exceptions are from Windows CRLF line endings), and nothing triggers an escalation.
# Decision — T013a

## Checks
- Reviews (round 1): security PASS, ux PASS, ui PASS, code PASS. All four selected reviewers start with `VERDICT: PASS`.
- Acceptance criteria → tests: 5/5. Spec tests 1–40 map to named tests in build.md, and each test file is in `git diff main...factory/T013a-record-consent` (32 files, +1116/−85, 4 commits):
  - Protected endpoint without consent → 403 `CONSENT_REQUIRED`: `apps/api/src/routes/me.test.ts` (spec tests 25–27) and `apps/api/src/middleware/require-consent.test.ts` (spec test 19).
  - `GET /v1/me` and `POST /v1/me/consent` work without consent and report `required`: `me.test.ts` (spec tests 22–23).
  - `POST /v1/me/consent` returns 401, 400 (malformed body, extra key or oversized body) and 409, and a second accept keeps the first `acceptedAt`: `me.test.ts` (spec tests 24, 28–31) and `packages/core/src/usecases/accept-consent.test.ts` (spec test 4, using `FakeClock`).
  - The `UserRepo` contract covers `recordConsent` in memory and on the emulator, and a legacy doc reads as `consent: null`: `packages/testkit/src/contracts/user-repo.contract.ts` and `apps/api/src/adapters/firebase/user-repo.contract.test.ts` (spec tests 10–18).
  - `MeResponse` stays strict and the body has no `acceptedAt`, uid or email: the leak test in `me.test.ts` (spec test 33) and `packages/contracts/src/me.test.ts` (spec test 37).
- Checks green: lint, typecheck, test (840/840), test:emulator (118), test:e2e (5/5).
  - Prettier needed `--end-of-line auto`, and `tooling/src/docs-commands.test.ts` fails, both because this Windows checkout has CRLF line endings. The branch doesn't touch those files, and the code reviewer re-ran the suite and confirmed this. Linux CI should be green. If it isn't, the PR check will block the merge.
- Definition of Done: no user-facing strings or UI were added (the web change is a logic guard in `timezone-default.ts` plus e2e helpers), so no i18n or RTL work is needed. No new config, so no `.env.example` change. No new port or architectural choice, so no ADR. The BOARD.md row update belongs to the orchestrator's PR step.
- Escalation triggers: none.
  - Not owned by a human (BOARD.md owner column is empty; the only tag is `sec`).
  - No billing, production config, secrets or DNS changes.
  - `firebase/firestore.rules` is unchanged (still deny-all).
  - No new dependencies (no `package.json` or lockfile in the diff).
  - Nothing sets content `reviewStatus`.

## Notes for the merger (non-blocking)
- Release order: after this merges, `PATCH /v1/me` returns 403 for web users who haven't consented, and the web can't accept consent until T013b ships. A real user's profile Save would show the generic error (see the UX review on `apps/web/src/features/profile/ProfilePage.tsx:120-121`). Don't deploy T013a to real users without T013b.
- Follow-ups from the reviews: add the shared rate limiter to `POST /v1/me/consent` when it exists (`apps/api/src/routes/me.ts:63`). T013c should delete the `consent` field with the user doc. Keep `isValidConsent` and the Firestore `isoString` refinement aligned.
