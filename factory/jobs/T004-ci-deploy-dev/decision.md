ESCALATE
Reason: e2e (spec test 5) was never run, the .env.example DoD item was handed to a human, and both task criteria (PR checks, live dev deploy) can only be verified by a human on the PR and after merge.
# Decision — T004

## Checks
- Reviews (round 1): security PASS, code PASS
- Acceptance criteria → tests: 2/2 mapped in build.md and present in the diff. Criterion 1 maps to `.github/workflows/ci.yml` jobs `unit`/`emulator`/`e2e`. Criterion 2 maps to `deploy-dev` plus its smoke step. Neither can be executed by an agent. Spec unit tests 1–4 exist: `apps/api/scripts/build-function.test.mjs`, `apps/api/src/deploy-config.test.ts`, `apps/api/scripts/ensure-env-local.test.mjs`.
- Checks green: lint, typecheck, test (203), build. test:emulator passed only on a throwaway config with alternate ports, because another session held the default ports. **test:e2e not run.**
- Escalation triggers: no `human` tag, no billing, no `noor-prod`/DNS/prod secrets, `firestore.rules` unchanged, no new dependency, no `reviewStatus`. The decision is ESCALATE because of the "unsure" rule: the DoD is incomplete and the change adds a pipeline that deploys to a live project. Neither is a hard trigger.

## For the human (ESCALATE only)
1. **e2e not verified.** Spec test 5 (`apps/web/e2e/home.spec.ts`) was not run locally. The functions source moved to `apps/api/build` (`firebase/firebase.json:2`), and `dev:emulators` changed (`package.json:20`, unspecced `--only auth,firestore,functions`). Confirm that the `e2e` check on the PR is green before merging.
2. **Criterion 1.** Confirm the PR shows separate `unit`, `emulator` and `e2e` checks. Then add `emulator` and `e2e` as required checks in branch protection for `main`.
3. **Criterion 2 (after merge).** Watch the `deploy-dev` run (`.github/workflows/ci.yml:102-153`). Then paste the run link and `https://noor-quiz-bec90.web.app/v1/health` into the PR and the T004 Notes. If the first functions deploy fails on IAM, grant the role to `github-deploy@` and record it in the T005a Notes.
4. **DoD, `.env.example`.** The spec's comment line in `apps/api/.env.example` is missing because the builder may not touch `.env*`. Add it by hand. It is documentation only and adds no new variables.
5. **Deploy-job hardening (security P3, your call).**
   - `ci.yml:137`: `google-github-actions/auth@v2` is pinned to a mutable tag in the only job with `id-token: write`. Consider pinning it to a commit SHA.
   - `ci.yml:141`: `npm run build` runs after auth, so build tooling runs while ADC credentials are present. Consider building before the auth step.
   - `ci.yml:123`: the checkout has no `persist-credentials: false`.
   - The `changes` job echoes file names from the PR into the log (`echo "$changed"`, about line 58).
6. **`--force` on functions deploy (`ci.yml:149`).** It deletes any function in codebase `api` on `noor-quiz-bec90` that is missing from the bundle. This is intended per spec. Confirm that is acceptable for dev.
7. **Builder deviations accepted by code review:**
   - `e2e.if` uses `!cancelled()` rather than `always()` (`ci.yml:74`).
   - `deploy-dev.if` checks each result explicitly (`ci.yml:106`).

---
Approved by human (hmohammed) via `/factory approve T004` on 2026-10-14T10:25:39Z. Open items stay with the human on the PR: e2e via the PR check, the .env.example line, post-merge deploy check, required checks.
