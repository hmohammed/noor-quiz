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

_(implementer adds notes for the next task here)_

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

Phase: P1 · Depends on: [T002](E00-foundation.md#t002), [T005](E00-foundation.md#t005) · Tags: —
Skills: `deploy-release`

**Goal.** Every PR runs the full test pyramid; merges to main deploy to `noor-dev`.

**Scope**

- CI job running `npm run test:emulator` with the Firebase emulator
- CI job running Playwright e2e on the emulator stack for PRs touching apps/
- Deploy job to `noor-dev` on push to main (rules, indexes, functions, hosting) using a deploy service account from GitHub secrets

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

- Firebase/GCP projects `noor-dev`, `noor-staging`, `noor-prod` on Blaze plan with budget alerts
- Google sign-in enabled; authorised domains set
- Deploy service account per project; keys stored as GitHub environment secrets (dev, staging, prod)
- GitHub repo created with branch protection on main

**Acceptance criteria**

- [ ] `firebase projects:list` shows all three projects
- [ ] GitHub environments dev/staging/prod exist with required secrets

**Notes**

_(implementer adds notes for the next task here)_
