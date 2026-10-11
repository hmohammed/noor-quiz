# Build — T002 (round 1)
Branch: factory/T002-local-stack
Worktree: /mnt/c/Users/hassen.mohammed/Downloads/noor-quiz/.claude/worktrees/agent-ad2a520d7a38d2ed0

## Changes
- package.json — new scripts `dev`, `dev:emulators`, `dev:api`, `dev:web`, `build`, `test:e2e`; existing scripts kept. Root devDeps `concurrently`, `firebase-tools`. **Deviation:** `dev:emulators` sets `FUNCTIONS_DISCOVERY_TIMEOUT=60` before `firebase emulators:start` (see Notes, item 1).
- package-lock.json — updated.
- tsconfig.json — reference to `apps/web/tsconfig.e2e.json`.
- eslint.config.js — ignores `**/build/**`, `**/playwright-report/**`, `**/test-results/**`; `**/*.mjs` block with inline `process`/`console` globals. Core ban unchanged.
- .prettierignore — `build`, `playwright-report`, `test-results`. .gitignore — `build/`.
- README.md — "Status: planning" line replaced by a "Local development" section (prereqs, `npm install` / `npm run dev`, URLs 5173/4000/5001, check commands, `npx playwright install chromium`, the Node 20 runtime warning, a WSL `/mnt/c` performance note).
- AGENT.md — Commands block only. New heading text, added `npm run build`, and `# not yet — T004` on the `test:emulator` and `deploy:staging` lines.
- firebase/firebase.json, firestore.rules (deny all), firestore.indexes.json — as in the spec. firebase.json stays in `firebase/`: the CLI accepted `source: ../apps/api`, so no fallback was needed. No `.firebaserc`.
- packages/contracts — `zod` dep, `src/health.ts` (`HealthResponse` strictObject), `src/health.test.ts`, re-exported from `index.ts`.
- apps/api — `version: 0.1.0`, `main: build/index.js`, deps, `build`/`build:watch` scripts; tsconfig reference to contracts; `src/app.ts` (`createApp({ version })`, no firebase import); `src/routes/health.ts` (output parsed with the contract, no Date); `src/routes/health.test.ts`; `src/function.ts` (the only firebase-functions import, `onRequest({ region: 'europe-west1' })` + `getRequestListener`); `src/build-env.d.ts`; `scripts/build-function.mjs` (esbuild JS API, `--watch` uses `context().watch()`, also writes a sourcemap). I added `import { URL } from 'node:url'` in the .mjs because the spec's globals block has no `URL`.
- apps/web — deps/scripts as in the spec; `index.html` (`lang="en" dir="ltr"`); `src/main.tsx`, `src/router.tsx`, `src/features/home/HomePage.tsx` (a single `data-testid="api-status"`; AbortController so no state is set after unmount); `src/api/client.ts` (`createApiClient`, `apiClient`, `ApiError`; every response parsed with the contract; `getHealth` also takes an optional `{ signal }`); `src/i18n/{en.json,t.ts,t.test.ts}`; `src/styles.css` (logical properties only); `vite.config.ts`; `playwright.config.ts`; `e2e/home.spec.ts`; `tsconfig.e2e.json`; `vitest.config.ts`. **Deviation:** `tsconfig.json` `include` is `["src", "src/**/*.json"]`, not `["src"]`. With `composite`, `tsc -b` fails with TS6307 on the `en.json` import unless the JSON is listed.
- tooling/src/docs-commands.test.ts — test 10.
- docs/tasks/E00-foundation.md — Notes line under T002 only.

## Acceptance tests → test files
1. HealthResponse accepts ok/0.1.0 → packages/contracts/src/health.test.ts "accepts { status: "ok", version: "0.1.0" }"
2. Rejects down / missing / empty version / extra key → same file, "rejects %s" (4 cases)
3. GET /v1/health returns 200, JSON, contract-valid, version test-1 → apps/api/src/routes/health.test.ts "returns 200 with a contract-valid JSON body and no auth or tenant"
4. No auth or tenant needed; garbage Bearer is ignored → same test as 3 + "ignores a garbage Authorization header (the route is public)"
5. POST /v1/health and GET /health give 404 → "returns 404 for POST /v1/health", "returns 404 for unversioned GET /health"
6. getHealth calls GET {baseUrl}/v1/health and parses the body → apps/web/src/api/client.test.ts "calls GET {baseUrl}/v1/health and returns the parsed body" (+ "uses a same-origin path when no baseUrl is given")
7. ApiError on 500 / non-JSON / contract break → same file, three "throws ApiError …" tests (+ a network-rejection case)
8. t('home.api.ok') and unknown-key fallback → apps/web/src/i18n/t.test.ts
9. e2e home shows API ok through the real path → apps/web/e2e/home.spec.ts
10. Docs commands check → tooling/src/docs-commands.test.ts (AGENT block + README `npm run` names exist unless marked `# not yet`; README mentions dev/test/test:e2e/lint/typecheck/build)
11. Manual smoke → see "How I tested"
12. Commands on a clean `npm ci` → see "How I tested"

## How I tested
All runs were on Node v20.18.3, after a clean `npm ci` (dist/build dirs deleted first).

| command | result |
| --- | --- |
| npm ci | pass (871 packages; the only EBADENGINE is the existing `eslint-visitor-keys@5.0.1` from T001) |
| npm run lint | pass |
| npm run typecheck | pass (also passes again after `npm run build`) |
| npm test | pass, 61 tests |
| npm run build | pass (api bundle 811 kB, web 403 kB / 126 kB gzip) |
| npm run test:e2e | pass (cold, with Playwright starting the stack: about 2 min, test 28 s; also passes against an already running `npm run dev`) |
| npm run test:emulator | not relevant (script is T004; no adapters or rules tests in this task) |

Manual smoke (test 11), using `npm run dev`:
- `curl -s http://127.0.0.1:5001/demo-noor/europe-west1/api/v1/health` → `{"status":"ok","version":"0.1.0"}`
- `curl -s http://127.0.0.1:5173/v1/health` → the same JSON, through the Vite proxy
- Browser at `http://127.0.0.1:5173/`: Playwright chromium against the running stack showed "API ok". I did not open an interactive browser.
- Emulator log: `Detected demo project ID "demo-noor"…`. No login or credential prompt. The expected node 22-vs-20 warning appears.
- Ctrl-C, simulated with SIGINT to the `npm run dev` process group: every emulator stopped. `ps` afterwards showed no java, firebase, functionsEmulatorRuntime, vite, esbuild or concurrently processes.
- Direct emulator check: `POST /v1/health` returns 404 through the emulator too.

Playwright browser: `npx playwright install --dry-run chromium` points at `~/.cache/ms-playwright/chromium-1161` and `chromium_headless_shell-1161`. Both exist, so nothing was downloaded and no `channel` override is needed.

## Dependencies (engines checked with `npm view`)
| package | pin | engines | reason / exit path |
| --- | --- | --- | --- |
| zod | ^4.6.6 | none declared | shared schemas / any validator |
| hono | ^4.13.13 | >=16.9 | HTTP layer (ADR 0002) / any Fetch-API router |
| @hono/node-server | ^1.19.17 | >=18.14.1 | Hono fetch → Node req/res for Functions / a ~30-line hand-written adapter |
| firebase-functions | ^7.4.0 | >=18 | 2nd-gen HTTPS function / Cloud Run with `serve()` |
| firebase-admin | ^13.10.0 | >=18 | required peer of firebase-functions (peers ^11–^14); not imported / goes with firebase-functions |
| esbuild | ^0.25.12 | >=18 | function bundle; `npm ls esbuild` shows one copy, deduped with Vite 6 / tsup or rollup |
| react, react-dom | ^19.3.0 | >=0.10 | UI |
| react-router | ^7.18.4 | >=20.0 | routing |
| @types/react, @types/react-dom | ^19.3.0 | — | types |
| vite (web) | ^6.4.4 | same as root | dev server + build |
| @playwright/test | 1.51.1 (exact) | >=18 | e2e. Chromium 1247 matches no release (1.63.0 → 1243, 1.64.0 → 1248), so I pinned the release for the cached 1161, which is 1.51.1 |
| concurrently | ^9.2.5 | >=18 | runs the three dev processes with clean Ctrl-C / a small Node spawn script |
| firebase-tools | ^15.33.0 | >=20.0.0 | reproducible emulator CLI / the global CLI |

`npm audit`: there were 3 findings before (vitest/tinypool/@vitest/mocker, from T001). There are 24 after (13 moderate, 9 high, 2 critical). The 21 new findings break down as follows:
- Through `firebase-tools` (dev only): chokidar/braces, proxy-agent → pac-proxy-agent → get-uri → basic-ftp, @google-cloud/pubsub → @opentelemetry/core, gaxios/universal-analytics → uuid, and re2.
- Through `firebase-admin` (runtime dep; not imported in this task): @google-cloud/firestore/storage → google-gax/retry-request/teeny-request → uuid.
- `playwright <1.55.1` (high): the browser download does not verify the SSL certificate. It does not apply here because no browser is downloaded, but it is the cost of pinning 1.51.1 for the cached chromium. Moving to Playwright ≥1.55.1 fixes it, at the cost of one browser download.

None of these can be fixed without major bumps. I did not run `npm audit fix --force`.

## Commits
- bd3b086 T002: HealthResponse contract and workspace dependencies
- d2b1bf0 T002: Hono app with GET /v1/health, 2nd-gen function wrapper and emulator config
- 547019d T002: Vite + React home page with typed API client, t() and Playwright e2e
- 79af115 T002: e2e: graceful emulator shutdown and timeouts for cold function workers
- f441db3 T002: README local development, AGENT commands block and docs-commands test
- 6aab752 T002: raise functions discovery timeout for slow filesystems

## Notes for reviewers
1. **Slow filesystem (repo on `/mnt/c` under WSL).** Requiring `node_modules/firebase-tools/lib/emulator/functionsEmulatorRuntime.js` alone takes about 25 s there. This caused three problems:
   - (a) Function discovery sometimes hit the CLI's 10 s limit ("User code failed to load… Timeout after 10000"). Fix: `FUNCTIONS_DISCOVERY_TIMEOUT=60` in `dev:emulators`. This is a deviation from the spec's exact script text. The `VAR=x cmd` prefix is POSIX-only, which is fine for WSL, Linux and CI, but would need `cross-env` or a Node launcher for native Windows cmd.
   - (b) The functions emulator runs one request per worker. React StrictMode's double effect fires two overlapping `/v1/health` requests, so the second one cold-starts a new worker (about 27 s here, about 1–2 s on a native disk). Fix: Playwright `timeout: 90_000` and `expect.timeout: 60_000`, with a comment explaining why.
   - (c) README now recommends cloning inside the WSL filesystem.
2. **Orphaned Java on Playwright teardown.** By default Playwright SIGKILLs the webServer's process group. The Firestore emulator (java) runs in its own process group and survived. Fix: `gracefulShutdown: { signal: 'SIGINT', timeout: 30_000 }` on the emulators webServer. After that, `ps` shows no orphans after `test:e2e`.
3. **rawBody check.** `@hono/node-server` 1.19.17 (`dist/listener.mjs` and `request.mjs`) uses `incoming.rawBody` when it is a Buffer, so later POST routes will get the body the Functions framework already read. POST through the emulator currently reaches Hono and returns 404 as expected.
4. **Side effects outside the repo.** Running the repo's firebase-tools 15.33 downloaded `cloud-firestore-emulator-v1.22.0.jar` and `ui-v1.15.0.zip` into `~/.cache/firebase/emulators`. The CLI also deleted the outdated `ui-v1.14.0` there, which the global 15.6 CLI used; that CLI will download it again if it is run. No login, no `.firebaserc`, no credentials, no `.env*` files.
5. **Shared dist folder.** The api bundle is 811 kB, mostly zod v4 pulled in via `export *`. That is fine for now; `zod/mini` is an option later. `apps/web/dist` is shared by `tsc -b` (composite emit) and `vite build`. `vite build` empties it, so the next `tsc -b` rebuilds the web project. It works, but T004 may want `build.outDir` or a separate tsc outDir.
6. **i18n status codes.** HomePage maps internal status codes to `t()` keys. The `api-status--<state>` class names are not user-facing.

## Round 2
- review-ux.md: [must-fix] the status `<p>` had no live-region semantics → fixed in apps/web/src/features/home/HomePage.tsx. Added `role="status"` to the same single element and kept `data-testid="api-status"` (a836c71).
- review-ux.md nits (retry/next step, `<h1>` and `<title>` via i18n, static `lang`/`dir`, developer wording) → not changed, because they are non-blocking and outside T002 scope (T080 / real screens).
- review-security.md, review-ui.md, review-code.md: PASS, nothing to change.

| command | result |
| --- | --- |
| npm run lint | pass |
| npm run typecheck | pass |
| npm test | pass, 61 tests |
| npm run test:e2e | pass (cold stack started by Playwright; no orphaned processes afterwards) |
