ESCALATE
Reason: Definition of Done not met. `apps/api/.env.example` is missing from the branch (a permission rule blocked the builder), so `npm run dev` / e2e break, and the builder says "Do not merge until a human adds this file".
# Decision — T003

## Checks
- Reviews (round 1): code PASS. No security reviewer was selected; the task is untagged and touches no auth, rules, tenant, billing or AI code.
- Acceptance criteria → tests: 3/3 task criteria (spec tests 1–19) map to tests listed in build.md. Every listed test file is in the diff.
- Checks green: lint, typecheck, test (24 files, 171 tests) and api build. test:emulator does not exist yet (T004); no rules or Firestore changes. **test:e2e was not run.**
- Definition of Done:
  - i18n/RTL: n/a (no UI).
  - ADR: none needed (covered by ADR 0001).
  - Docs: E00 notes updated.
  - **`.env.example`: MISSING.** Config was added (`NOOR_ENV` required), but `apps/api/.env.example` is not in the branch.
- Escalation triggers:
  - firestore.rules: unchanged.
  - Dependencies: no new third-party package. zod ^4.6.6 is already in the lockfile, and the rest are workspace packages.
  - Billing, prod config, DNS and `reviewStatus`: none.
  - Builder explicitly asks for a human step before merge.

## For the human (ESCALATE only)
1. Add `apps/api/.env.example` on the branch. The intended content is in build.md ("NEEDS HUMAN" section): `NOOR_ENV=local`, `LOG_LEVEL=info` and the comment that secrets never go there. Commit it with this branch. Without it:
   - `apps/api/scripts/ensure-env-local.mjs:16` fails with ENOENT.
   - `package.json:19` (`dev:emulators`) stops, so `npm run dev` and `npm run test:e2e` stop too.
2. After adding the file, run `npm run dev` (or `npm run test:e2e`) once. Confirm that:
   - `apps/api/.env.local` is created and stays gitignored.
   - The emulator loads it.
   - `GET /v1/health` returns 200.
   - There is no `ConfigError` at cold start.
3. Note for later deploy tasks (T004/T005b): `apps/api/src/function.ts:12` now throws at module load if `NOOR_ENV` is unset. Any deployed project (noor-dev, staging, prod) must provide `NOOR_ENV`, or the function will not start. There is no deploy workflow in the repo yet, so this does not block this merge, but the deploy wiring must handle it.
4. Optional nit from the code review: `package.json:19` has `&&FUNCTIONS_DISCOVERY_TIMEOUT=60` with no space after `&&`. It works, but restore the space.

Once 1 and 2 are done, nothing else in the diff blocks approval.

---
Approved by human (hmohammed) via `/factory approve T003` on 2026-10-14T09:42:02Z. apps/api/.env.example added by the human in b95a2c5. The npm run dev / .env.local check was not reported as done.
