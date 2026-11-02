APPROVE
Reason: All selected reviews pass, the acceptance criterion is covered by the shared contract on in-memory and emulator, all checks are green, and no escalation trigger applies.
# Decision — T010a

## Checks
- Reviews (round 1): security PASS, code PASS (no web UI touched, so no ui/ux review needed)
- Acceptance criteria → tests: 1/1. The task's single criterion (first call creates 1 user + 1 identity; repeat and 10 concurrent calls give one userId, with counts {1,1}; runs on InMemoryUserRepo and the Firestore emulator) maps to spec tests 1–4 in `packages/testkit/src/contracts/user-repo.contract.ts`, run by `packages/testkit/src/in-memory-user-repo.test.ts` and `apps/api/src/adapters/firebase/user-repo.contract.test.ts`. All three files are in the diff. Spec tests 5–27 are also mapped in build.md.
- Checks green (build.md): lint, typecheck, test (32 files, 267 tests), test:emulator (86 tests: rules 67, api-emulator 19, run 3 times). The code reviewer re-ran `npm test` independently. e2e is not relevant because there is no UI.
- Definition of Done: no user-facing strings or screens, so i18n and RTL do not apply. No new config, so `.env.example` is unchanged. No ADR needed (firebase-admin and Firestore were already decided). The BOARD.md row is left for the orchestrator to set in the PR.
- Escalation triggers: none.
  - The task is tagged `sec`, not `human`, and has no owner.
  - No billing, no `noor-prod`, no prod secrets, no DNS.
  - `firebase/firestore.rules` is untouched and stays deny-all. Only `rules.test.ts` seeds changed, to the real shapes.
  - No new dependency: the ULID is hand-written, and `firebase-admin` and `zod` were already in `apps/api`.
  - No `reviewStatus` anywhere in the diff.

## Follow-ups (non-blocking, from reviewer nits)
- Strip `\p{Cf}` bidi and zero-width characters from display names before they are shown (T010c/T011).
- Tighten the `IdentityDoc` converter to check `subject` against `SUBJECT_PATTERN`.
- Make sure account deletion (T013) also removes `identities/*`.
- Watch the emulator concurrency test for CI flakes.
