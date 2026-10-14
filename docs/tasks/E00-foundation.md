# E00 · Foundation

Monorepo, local stack, clock, CI. After this epic every later task has a place to land and a way to be tested.

Status lives in [BOARD.md](BOARD.md). Task format and rules: see the top of BOARD.md.

## T001

**Monorepo skeleton with lint, typecheck and unit tests**

Phase: P1 · Depends on: — · Tags: —
Skills: `deploy-release`

**Goal.** An empty but real monorepo where `npm install && npm run lint && npm run typecheck && npm test` pass.

**Scope**

- npm workspaces: `apps/api`, `apps/web`, `apps/workers`, `packages/core`, `packages/contracts`, `packages/testkit`
- TypeScript strict base config + per-package tsconfig with project references
- ESLint + Prettier; ESLint rule `no-restricted-imports` in `packages/core` banning firebase*, stripe, openai, hono, node:http
- Vitest workspace config; one trivial test per package
- GitHub Actions workflow: install, lint, typecheck, test

**Acceptance criteria**

- [ ] `npm test` runs and passes in every package
- [ ] Adding `import 'firebase-admin'` to a file in `packages/core` makes `npm run lint` fail (verified by a lint fixture test or documented manual check in the PR)
- [ ] CI workflow runs on pull requests and is green

**Notes**

_(implementer adds notes for the next task here)_

- T001: `vite` is pinned `^6` and `vitest` `~3.2` so everything runs on local Node 20.18 (CI uses `.nvmrc` = 22). Upgrading to Vite 7 / Vitest 4 needs Node >= 20.19 locally and must raise `engines.node`. That upgrade also clears the open `npm audit` advisories in vitest/tinypool (dev-only). Workspaces are source-first (`exports: ./src/index.ts`), so no build step is needed for tests. `no-restricted-imports` does not catch dynamic `import('firebase-admin')` in core (known gap).

## T002

**Local stack: emulators, Hono health endpoint, Vite home page**

Phase: P1 · Depends on: [T001](E00-foundation.md#t001) · Tags: —
Skills: `deploy-release`, `api-endpoint`

**Goal.** `npm run dev` brings up Firebase emulators, the API and the web app; the home page shows that the API is reachable.

**Scope**

- `firebase/firebase.json` with auth, firestore, functions emulators (project `demo-noor`)
- `apps/api`: Hono app exported as a 2nd-gen HTTPS function; `GET /v1/health` → `{ status: 'ok', version }`
- `packages/contracts`: `HealthResponse` schema
- `apps/web`: Vite + React + React Router; `api/client.ts` typed from contracts; home shows 'API ok'
- Playwright set up with one e2e test

**Acceptance criteria**

- [ ] `GET /v1/health` returns 200 and a contract-valid body (route test with `app.request()`)
- [ ] e2e: home page shows 'API ok' with the local stack running
- [ ] README/AGENT commands section matches the real scripts

**Notes**

- T002: function `api` in region `europe-west1`; emulator URL `http://127.0.0.1:5001/demo-noor/europe-west1/api/<path>`. Vite proxies `/v1` → `/demo-noor/europe-west1/api/v1`. The bundle lives in `apps/api/build/` (gitignored, `main` of `@noor/api`) and is built by esbuild (`apps/api/scripts/build-function.mjs`), not `tsc`; contracts/zod/hono are bundled, firebase-functions/admin stay external. Playwright is pinned to exactly `1.51.1` (chromium revision 1161, already cached locally). T003: replace `createApp({ version })` options with the composition root. T004: add Hosting rewrites `/v1/**` → function `api`, plus the `test:emulator` and `deploy:staging` scripts (marked "not yet — T004" in AGENT.md).

## T003

**Clock port, typed config and domain errors**

Phase: P1 · Depends on: [T001](E00-foundation.md#t001) · Tags: —
Skills: `port-adapter`

**Goal.** The building blocks every use case needs: injectable time, validated config, consistent errors.

**Scope**

- `packages/core/src/ports/clock.ts` (`now(): Instant`, helpers for zoned dates via `Intl`)
- `SystemClock` adapter in api; `FakeClock` in testkit (set, advance, set timezone-agnostic instant)
- `DomainError(code, details)` in core; `apps/api/src/errors.ts` maps codes → HTTP status; error response schema in contracts
- `apps/api/src/config.ts` zod-validated env config; `.env.example`
- `apps/api/src/composition.ts` wiring deps, and a `makeTestDeps()` in testkit

**Acceptance criteria**

- [ ] FakeClock tests: advance across midnight in Europe/Stockholm and Africa/Addis_Ababa gives the expected local dates
- [ ] API returns `{ error: { code, message } }` with the mapped status for a thrown DomainError (route test)
- [ ] API fails fast at startup with a clear message when a required config var is missing (unit test)

**Notes**

_(implementer adds notes for the next task here)_

## T004

**CI: emulator tests, e2e and auto-deploy to dev**

Phase: P1 · Depends on: [T002](E00-foundation.md#t002), [T005a](E00-foundation.md#t005a) · Tags: —
Skills: `deploy-release`

**Goal.** Every PR runs the full test pyramid; merges to main deploy to the dev project (`noor-quiz-bec90`, alias `dev`).

**Scope**

- CI job running `npm run test:emulator` with the Firebase emulator
- CI job running Playwright e2e on the emulator stack for PRs touching apps/
- Deploy job to the dev project (`noor-quiz-bec90`) on push to main (rules, indexes, functions, hosting) using a deploy service account from GitHub secrets

**Acceptance criteria**

- [ ] A PR shows separate green checks for unit, emulator and e2e
- [ ] Merging to main deploys and `GET https://<dev-host>/v1/health` returns ok (link in PR)

**Notes**

_(implementer adds notes for the next task here)_

## T005

**Create Firebase projects and accounts**

Phase: P1 · Depends on: — · Tags: `human`
Skills: `deploy-release`

**Goal.** The cloud accounts exist so CI can deploy.

**Scope**

- Split into T005a (dev) and T005b (staging, prod). Original scope:
- Firebase/GCP projects `noor-dev`, `noor-staging`, `noor-prod` on Blaze plan with budget alerts
- Google sign-in enabled; authorised domains set
- Deploy service account per project; keys stored as GitHub environment secrets (dev, staging, prod)
- GitHub repo created with branch protection on main

**Acceptance criteria**

- [ ] `firebase projects:list` shows all three projects
- [ ] GitHub environments dev/staging/prod exist with required secrets

**Notes**

_(implementer adds notes for the next task here)_

## T005a

**Dev Firebase project and GitHub deploy access**

Phase: P1 · Depends on: — · Tags: `human`
Skills: `deploy-release`

**Goal.** The dev cloud project is ready so T004 can deploy to it from CI.

**Scope**

- Dev project `noor-quiz-bec90` (display name `noor-quiz`, number 1048700486127) on Blaze with a budget alert
- Firestore (Native) created; region recorded in Notes
- Google sign-in enabled; authorised domains set; Hosting site initialised; deploy APIs enabled
- Deploy service account `github-deploy@noor-quiz-bec90.iam.gserviceaccount.com` with deploy roles
- GitHub environment `dev` with deploy credentials (Workload Identity Federation preferred, or a JSON key secret)
- Branch protection on `main`

**Acceptance criteria**

- [x] `firebase projects:list` shows `noor-quiz-bec90`
- [x] GitHub environment `dev` exists with the deploy credentials
- [x] `.firebaserc` maps alias `dev` to `noor-quiz-bec90`

**Notes**

- Project `noor-quiz-bec90` (number 1048700486127), no GCP organization. Tagged `environment=Development` (project-level tag key).
- Firestore: `(default)`, Native mode, location **`eur3`**. Deploy functions to **`europe-west1`**.
- Deploy APIs enabled (Cloud Functions, Run, Build, Artifact Registry, Eventarc, Pub/Sub, Secret Manager, Cloud Tasks, Scheduler, Extensions, STS).
- Deploy service account: `github-deploy@noor-quiz-bec90.iam.gserviceaccount.com`. Project roles: firebase.viewer, firebasehosting.admin, firebaserules.admin, datastore.indexAdmin, cloudfunctions.admin, run.admin, artifactregistry.admin, secretmanager.viewer, serviceusage.serviceUsageConsumer, serviceusage.apiKeysViewer, firebaseextensions.viewer. `iam.serviceAccountUser` only on the runtime SAs (`1048700486127-compute@developer.gserviceaccount.com`, `noor-quiz-bec90@appspot.gserviceaccount.com`).
- **No service account key exists.** CI authenticates with Workload Identity Federation:
  - provider: `projects/1048700486127/locations/global/workloadIdentityPools/github/providers/noor-quiz`
  - provider condition: `assertion.repository == 'hmohammed/noor-quiz'`
  - only subject `repo:hmohammed/noor-quiz:environment:dev` may impersonate the SA, so the deploy job **must** declare `environment: dev`
  - workflow needs `permissions: id-token: write` and `google-github-actions/auth@v2` with `workload_identity_provider` + `service_account`
- GitHub environment `dev` exists and only branch `main` may deploy to it (deployment branch policy). Variables (not secrets, neither value is sensitive): `GCP_WORKLOAD_IDENTITY_PROVIDER`, `GCP_SERVICE_ACCOUNT`, `FIREBASE_PROJECT_ID=noor-quiz-bec90`.
- Branch protection on `main`: PR required (0 approvals), required check `unit`, linear history, no force-push or deletion. Admins may bypass (`enforce_admins: false`) so factory merges made locally can be pushed to `main`. When T004 adds the emulator and e2e jobs, add their check names to the required checks.
- Open: budget alert not verified (Billing → Budgets & alerts).
- `.firebaserc` lives in `firebase/` next to `firebase.json`, alias `dev` only, no `default` (so a bare `firebase deploy` cannot hit a real project).

## T005b

**Staging and prod Firebase projects**

Phase: P1 · Depends on: [T005a](E00-foundation.md#t005a) · Tags: `human`
Skills: `deploy-release`

**Goal.** Separate staging and prod projects exist before the release pipeline (T135) is built.

**Scope**

- Staging and prod Firebase/GCP projects, set up like T005a (Blaze, budget alerts, Firestore same region, Google sign-in, deploy service account)
- `environment` resource tag bound to each project: `Staging` and `Production` (as `Development` on T005a's dev project)
- GitHub environments `staging` and `prod`; `prod` has required reviewers
- `.firebaserc` aliases `staging` and `prod`; update the `noor-prod` deny rules in `.claude/settings.json` to the real prod ID

**Acceptance criteria**

- [ ] `firebase projects:list` shows the staging and prod projects
- [ ] GitHub environments staging/prod exist with required credentials

**Notes**

_(person fills in project IDs and secret names)_
