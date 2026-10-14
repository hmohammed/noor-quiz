# AGENT.md — Noor Quiz

Guide for any coding agent (and human) working in this repo. Read this first, then `docs/vision.md` for the why, then `docs/tasks/BOARD.md` for what to do next.

## What we are building

Noor Quiz is a multi-tenant community learning platform. Communities (mosques, schools, families, workplaces) run **seasons** (Ramadan is the flagship; Dhul Hijjah, Muharram, weekly Jumu'ah follow) with a daily question, leaderboards, streaks, reminders and live rounds. Individuals use it free; organisers pay via subscriptions that cover infrastructure cost.

Successor of the old `ramadan` project (`../ramadan`, read-only reference — do not copy its security model).

## Stack

| Layer | Choice |
| --- | --- |
| Language | TypeScript (strict) everywhere, Node 22 |
| Web | Vite + React + React Router, own small component set, CSS variables |
| API | Hono on Firebase Cloud Functions (2nd gen) |
| Data | Firestore (behind repositories) |
| Auth | Firebase Auth (behind `AuthVerifier`) |
| Jobs | Cloud Tasks + Cloud Scheduler (behind `Queue` / `Scheduler`) |
| Payments | Stripe (behind `PaymentProvider`) |
| AI | OpenAI / Gemini / Claude (behind `AiScorer`) |
| Validation | zod, shared in `packages/contracts` |
| Tests | Vitest (unit + adapter tests on Firebase Emulator Suite), Playwright (e2e) |
| CI/CD | GitHub Actions → Firebase projects `noor-dev`, `noor-staging`, `noor-prod` |

## Repo layout

```
apps/
  api/          Hono app, HTTP routes, middleware, adapters (firebase/, stripe/, ai/, notify/)
  web/          Vite + React app
  workers/      queue + scheduled handlers (scoring, notifications, rollups)
packages/
  core/         domain logic + port interfaces. NO I/O, NO vendor imports
  contracts/    zod schemas for every API request/response
  testkit/      fakes for every port (FakeClock, InMemoryRepos, FakeAiScorer…)
firebase/       firestore.rules, firestore.indexes.json, emulator config
docs/
  vision.md     product vision, architecture, subscription model
  decisions/    ADRs (one decision per file)
  tasks/        BOARD.md + epic files with vertically sliced tasks
factory/        /factory runtime: board.json, dashboard.html, jobs/<task>/ (spec, build, reviews, decision)
.claude/        agents and skills for this project
```

## Hard rules (do not break these)

1. **`packages/core` imports nothing vendor-specific.** No `firebase`, `firebase-admin`, `stripe`, `openai`, `hono`, no `fetch`. Only TypeScript, zod and other `core` modules. A lint rule enforces it.
2. **Every external system is a port in `core` + an adapter in `apps/*`**, plus a fake in `packages/testkit`. New vendor = new adapter, never a direct call from a route or use case.
3. **The browser never writes to Firestore.** All writes go through the API. `firestore.rules` denies all client writes; client reads are limited to public leaderboard/live docs.
4. **Tenant isolation.** Every tenant-owned document has `tenantId`; every repository method takes `tenantId` explicitly; every route resolves membership before touching data. Cross-tenant access is a P0 bug.
5. **Time comes from the `Clock` port.** No `Date.now()` / `new Date()` in core or routes. There is no client-controlled "test mode" — tests use `FakeClock`.
6. **Roles are server-side.** Tenant roles live in `memberships`; platform-admin flag lives in custom claims. Never trust a role, tenantId, score or date sent by the client.
7. **Features are gated by entitlements, never by plan name.** Use `requireFeature('x')` / `consumeQuota('y')`. Never call Stripe at request time.
8. **Our own IDs.** `userId`, `tenantId` etc. are ours (ULIDs). The Firebase uid is a linked identity, not a primary key.
9. **Secrets** only via Secret Manager / function secrets. Never commit `.env*` (except `.env.example`), never print secrets in logs or test output.
10. **AI output is untrusted.** Validate with zod, clamp scores, wrap user answers as delimited data in prompts, log prompt version with every score.
11. **Religious content needs provenance.** Every question has `sources[]` and `reviewStatus`; only `approved` questions can be scheduled into a live season. Agents may draft questions but never mark them approved.

## Architecture in one picture

```
route (apps/api) ──► use case (packages/core) ──► port interface (packages/core/ports)
   │ zod contract            pure logic                     ▲
   │ auth + tenant + entitlement middleware                 │ implemented by
   ▼                                                        │
response                                      adapter (apps/api/src/adapters/*)
```

Use cases are plain functions: `submitAnswer(deps, input)` where `deps` holds ports. Routes wire real adapters; tests wire fakes.

## Commands (root `package.json` scripts; later tasks add the ones marked "not yet")

```
npm install                 # all workspaces
npm run dev                 # emulators (demo-noor) + api bundle watch + web
npm test                    # unit tests, all workspaces
npm run test:emulator       # adapter + firestore rules tests (needs Firebase emulators)
npm run test:e2e            # Playwright against local stack
npm run lint && npm run typecheck
npm run build               # api function bundle + web
npm run deploy:staging      # CI normally does this  # not yet — T004
```

If a command does not exist yet, the task that needs it creates it.

## Conventions

- Files: `kebab-case.ts`; React components `PascalCase.tsx`; one use case per file in `core/src/usecases/`.
- Errors: core returns typed results or throws `DomainError(code)`; the API maps codes to HTTP status in one place.
- API: REST-ish JSON under `/v1/...`, every body parsed with its `contracts` schema, every response typed.
- Firestore: flat top-level collections, stable IDs, no deep subcollection dependence (must map to SQL tables).
- i18n: no hard-coded user-facing strings in components; use `t('key')`. Support RTL (Arabic) from the start — use logical CSS properties (`margin-inline-start`).
- Display names accept Unicode letters (Arabic, Ge'ez/Amharic, Latin…), 2–32 chars.
- Dates: store UTC ISO strings + an IANA timezone; compute local days in core with `Intl`.
- Dependencies: adding one needs a one-line justification in the PR and an exit path. Prefer the platform.

## Testing expectations

| Layer | What | Where |
| --- | --- | --- |
| core | Every use case and rule, with fakes; edge times via FakeClock | `packages/core/**/*.test.ts` |
| adapters | Contract tests: the same suite runs against the fake and the real adapter (emulator) | `apps/api/src/adapters/**/*.contract.test.ts` |
| rules | Firestore rules: every collection denies client writes; reads only where intended | `firebase/rules.test.ts` |
| api | Route tests with Hono's `app.request()` and fakes | `apps/api/**/*.test.ts` |
| e2e | One happy path per vertical slice once it has UI | `apps/web/e2e/*.spec.ts` |

A task is not done if it lowers coverage of `packages/core` or skips its acceptance tests.

## How to work on a task

**Automated:** run `/factory next` (or `/factory run`) and watch `factory/dashboard.html`. The `factory` skill runs the steps below with subagents (spec-writer → builder → reviewers → approver → pull request on GitHub). A human reviews and merges every PR. **By hand:**

1. Open `docs/tasks/BOARD.md`, pick the first `todo` task whose dependencies are all `done`. Use the `pick-task` skill.
2. Mark it `in-progress` with your name/session, on a branch `t###-short-name`.
3. Read the task in its epic file. Do only that scope — open a new task for anything extra.
4. Implement as a vertical slice: contract → core → adapter → route → UI (if in scope) → tests.
5. Run `npm run lint && npm run typecheck && npm test` (+ emulator / e2e if touched).
6. Ask the `code-reviewer` agent (and `security-reviewer` for auth, rules, tenant, billing, AI tasks).
7. Mark `done` in BOARD.md in the same PR. Add an ADR in `docs/decisions/` if you made an architectural choice.

## Definition of Done

A task is done when a **pull request to `main` is open on GitHub** that meets everything below. The factory's work on a task ends there. BOARD.md shows `done` once a human merges the PR, and tasks that depend on it wait for that merge.

- The PR contains the code, the tests, the job records (`factory/jobs/<id>-<slug>/`) and the task's BOARD.md row set to `done`.
- Acceptance criteria in the task all pass, with automated tests.
- Lint, typecheck, unit tests green; emulator tests green if data/rules touched.
- No hard rule broken; no new dependency without justification.
- User-facing strings go through i18n; new screens work in RTL.
- Docs updated (task status, ADR if needed, `.env.example` if config added).

## Skills and agents in this repo

Skills (`.claude/skills/`): `factory`, `pick-task`, `vertical-slice`, `port-adapter`, `api-endpoint`, `firestore-data`, `entitlements-billing`, `ai-scoring`, `question-content`, `i18n-rtl`, `deploy-release`.

Agents (`.claude/agents/`): `spec-writer`, `builder`, `code-reviewer`, `security-reviewer`, `ux-reviewer`, `ui-reviewer`, `content-reviewer`, `approver` (the factory loop), plus `test-engineer` and `architect`.

## Out of bounds for agents

- Marking religious content `approved`.
- Changing production Firebase projects, Stripe live mode, or DNS.
- Reading or printing real secrets; touching `.env` files other than `.env.example`.
- Force-pushing anything or rewriting history.
- Committing to, pushing to, or merging into `main`. Changes reach `main` only through PRs that a human merges. The factory orchestrator pushes `factory/…` branches and opens PRs; no other agent pushes.
