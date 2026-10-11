VERDICT: PASS
# Code review — T002 round 1

Re-ran in the worktree on Node 20: `npm run lint`, `npm run typecheck` and `npm test` all pass (12 files, 61 tests). I did not run e2e or the emulators, as instructed.

## Findings
None must-fix.

## Acceptance tests
1. ok — packages/contracts/src/health.test.ts "accepts { status: "ok", version: "0.1.0" }"
2. ok — same file, `it.each` rejects down / missing / empty version / extra key. The schema is `strictObject`, so these would fail without the change.
3. ok — apps/api/src/routes/health.test.ts: 200, content-type, `HealthResponse.parse`, version `test-1`
4. ok — same file: the first request sends no auth, and a second test sends `Bearer x` and still gets 200
5. ok — same file: POST /v1/health and GET /health both return 404
6. ok — apps/web/src/api/client.test.ts: URL `{baseUrl}/v1/health` with an injected fake fetch
7. ok — same file: 500 (status checked), non-JSON, contract break, plus a fetch rejection
8. ok — apps/web/src/i18n/t.test.ts
9. ok (read only, not run) — apps/web/e2e/home.spec.ts uses the plain literal "API ok" and the real path through the Vite proxy and the emulator. playwright.config.ts waits on the function URL.
10. ok — tooling/src/docs-commands.test.ts. It reads the AGENT.md Commands block, README and the root scripts, and skips `# not yet` lines.
11, 12. Recorded in build.md. I did not re-run the manual smoke or e2e, so I cannot verify them.

## Hard rules
1. ok — packages/core is untouched. contracts imports only zod.
2. ok — `firebase-functions` is imported only in apps/api/src/function.ts. app.ts and routes/health.ts have no Firebase import. The web app does not install the Firebase SDK.
3. ok — no client Firestore access. firebase/firestore.rules is deny-all.
4. ok — no tenant data. The route is public, takes no input, and is covered by test 4.
5. ok — no Date or Date.now in the route or app. The version is a build constant.
6. ok — no client-trusted role, score or date.
7. ok — no plan-name checks, and no Stripe.
8. ok — no ids introduced.
9. ok — no secrets, no `.env*`, no `.firebaserc`. Only `demo-noor` is used.
10. ok — n/a, no AI code.
11. ok — n/a, no content scheduling.

## Deviations in build.md (four), judged
1. `FUNCTIONS_DISCOVERY_TIMEOUT=60` in `dev:emulators` — accepted. It fixes a real cold-load timeout on /mnt/c and is harmless elsewhere. The `VAR=x cmd` prefix is POSIX-only, which suits WSL, Linux and CI. See nit 1.
2. `apps/web/tsconfig.json` `include` is `["src", "src/**/*.json"]` — accepted. The `src/**/*.json` entry is redundant with `"src"`, but I confirmed `tsc -b` passes with `resolveJsonModule` and `composite`, and the change stays inside the web package.
3. `import { URL } from 'node:url'` in build-function.mjs — accepted. It is the minimal alternative to adding a `globals` package, which the spec forbids.
4. Playwright `timeout` 90s, `expect.timeout` 60s and `gracefulShutdown: SIGINT` — accepted. Each has a commented reason: slow cold worker on /mnt/c, and the orphaned Java process. Both are needed for test 12 and the "no orphans" check in test 11. They sit in the Playwright config only.

## Scope
Small additions beyond the spec, all justified and not harmful:
- A sourcemap in the function bundle (build/ is gitignored).
- An optional `{ signal }` parameter on `getHealth`, used for the unmount abort.
- An extra "network rejection" test.
- A WSL note in README.

Nothing unrelated was refactored. docs/tasks/E00-foundation.md changed only in the T002 Notes. BOARD.md was not touched. AGENT.md changed only in the Commands block.

## Correctness
- HomePage guards against state-after-unmount with an AbortController, which StrictMode exercises.
- ApiError wraps every failure path.
- The `rawBody` handling in function.ts is documented. build.md records that it was checked in `@hono/node-server`.

## Tests
- Assertions are meaningful.
- Tests use no sleeps and no real network. The fakes are injected `fetch` and `createApp`. No port is introduced, so nothing is needed from testkit.

## i18n/RTL
- Strings go through `t()`.
- `<html dir="ltr">` is set.
- styles.css uses logical properties only.

## Dependencies
- Every pin and exit path is listed in build.md, and the spec's pins are followed.
- `npm audit` went from 3 to 24 findings: transitive through firebase-tools (dev only), firebase-admin (not imported yet) and playwright <1.55.1. The Playwright pin is forced by the spec's cached-chromium constraint. Nothing is fixable without major bumps, and the builder recorded this honestly.

## Nits (non-blocking)
1. `FUNCTIONS_DISCOVERY_TIMEOUT=60` breaks on native Windows cmd. Consider `cross-env` or a Node launcher if Windows support is needed. The README could say it is POSIX-only.
2. The 811 kB api bundle comes from `export *` pulling in all of zod v4. `zod/mini` or a narrower export is an option later.
3. `apps/web/dist` is shared by `tsc -b` and `vite build`. T004 may want a separate `build.outDir`.
4. Revisit the Playwright pin (1.51.1 has a high advisory about browser download SSL) when a browser download is acceptable.
