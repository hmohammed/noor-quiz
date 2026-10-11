ESCALATE
Reason: Every gate passes, but the branch knowingly adds 21 new npm audit advisories (9 high, 2 critical total), one of which ships at runtime and one comes from a deliberate Playwright pin. A human has to accept that risk, as they did for T001.
# Decision — T002

## Checks
- Reviews (round 2): security PASS, ux PASS, ui PASS, code PASS. All four files start with `VERDICT: PASS`. The round-1 UX must-fix (`role="status"`) is fixed in a836c71 at `apps/web/src/features/home/HomePage.tsx:31`.
- Acceptance criteria → tests: 3/3, and all are in the diff.
  - AC 1 (`GET /v1/health` returns 200 with a contract-valid body via `app.request()`) → `apps/api/src/routes/health.test.ts` (4 tests) and `packages/contracts/src/health.test.ts` (5 tests).
  - AC 2 (e2e: home shows "API ok") → `apps/web/e2e/home.spec.ts`, backed by `apps/web/src/api/client.test.ts` and `apps/web/src/i18n/t.test.ts`.
  - AC 3 (README/AGENT commands match the scripts) → `tooling/src/docs-commands.test.ts`.
- Checks green (build.md, round 1 after a clean `npm ci`, and round 2):
  - lint, typecheck, test (61 tests) and test:e2e all pass, on Node 20.18.3.
  - build passed in round 1. The round-2 change is a single JSX attribute, so build was not re-run.
  - test:emulator is not relevant here: the script comes in T004, and there are no adapters or rules tests in this task.
- Definition of Done:
  - All user-facing strings go through `t()` and `en.json`.
  - `<html dir="ltr">` is set, and the CSS uses logical properties only. There is no second locale yet; that comes in T080.
  - No config vars were added, so `.env.example` did not need a change.
  - README and the AGENT.md Commands block are updated, and the E00 Notes line is added.
  - No ADR needed: Hono on Functions is already ADR 0002, and the other choices are fixed by the spec.
  - Every new dependency has a one-line reason and an exit path in build.md ("Dependencies").
- Hard rules: no violations found.
  - `firebase-functions` is imported only in `apps/api/src/function.ts`, and core is untouched.
  - `firebase/firestore.rules` is a new deny-all file, so it is not weaker.
  - Only `demo-noor` is used. There is no `.firebaserc`, no `.env*` and no secrets.
  - No `Date` in the route.
  - Nothing touches billing, prod config, DNS or `reviewStatus`.
- Escalation triggers:
  - No hard trigger fired. Task tags are `—`, the task is not human-owned, rules are not weaker, every dependency is justified, and there is no prod, live-billing or `reviewStatus` change.
  - Escalating under "you are unsure", for the items below.

## For the human (ESCALATE only)
1. **Accept or reject the new npm audit findings.** They go from 3 to 24: 13 moderate, 9 high, 2 critical. See build.md "Dependencies" (the paragraph after the table). Three groups:
   - **Shipped at runtime:** `uuid` 9.0.1 (`package-lock.json:11563`) comes in through `firebase-admin` (`apps/api/package.json:19`) → google-gax/gaxios/teeny-request. `firebase-admin` is external in the bundle, so it ships in the function's `node_modules` once T004 deploys. Security judged it unreachable from `/v1/health` (P3). Their suggested fix is to check for a firebase-admin/google-gax bump or add an `overrides` entry before the first deploy.
   - **Pinned on purpose:** `@playwright/test` is pinned to `1.51.1` (`apps/web/package.json:23`) to reuse the cached chromium-1161. That version has a high advisory: browser downloads skip TLS verification. Nothing is downloaded locally today, but the T004 CI `playwright install` path is exactly the vulnerable one. The fix is to bump to >=1.55.1 before CI installs browsers.
   - **Dev only:** the rest comes in through `firebase-tools` (`package.json:31`): basic-ftp, get-uri, re2, braces, @opentelemetry/core and uuid 8.
   - Your T001 approval covered only the vitest/tinypool findings. Decide whether to accept these and track the two fixes above in T004.
2. **Side effect outside the repo.** build.md note 4: running the repo's firebase-tools 15.33 downloaded new emulator jars into `~/.cache/firebase/emulators` and deleted the global CLI's `ui-v1.14.0`. This is harmless, but it was not asked for. No login or credentials were involved.
3. **Unverified by reviewers.** All four reviewers re-ran only lint, typecheck and unit tests. The e2e run and the manual smoke (test 11) rest on build.md alone. Ctrl-C was simulated with SIGINT, and nobody opened an interactive browser. Optionally run `npm run dev` and `npm run test:e2e` once yourself.
4. **Known follow-ups for T004 (not blocking):**
   - `onRequest` sets no explicit `invoker` and no `maxInstances` (`apps/api/src/function.ts:15`).
   - The `FUNCTIONS_DISCOVERY_TIMEOUT=60` prefix (`package.json:19`) only works in POSIX shells, not native Windows cmd.
   - The api bundle is 811 kB because of zod v4.
   - `apps/web/dist` is shared by `tsc -b` and `vite build`.

If item 1 is acceptable, this is ready to merge. The diff matches spec.md. The four deviations in build.md (discovery timeout, `src/**/*.json` include, `node:url` import, Playwright timeouts and graceful shutdown) are each explained, and the code reviewer accepted them.

---

**Approved by human** (2026-10-11T19:13:52Z) via `/factory approve T002`. The human accepts: the npm audit increase (incl. shipped uuid 9.0.1 via firebase-admin and the @playwright/test 1.51.1 pin advisory) — to be addressed in T004 before the first deploy/CI browser download; the emulator cache changes in ~/.cache/firebase/emulators. E2E is re-run independently in the merge step.
