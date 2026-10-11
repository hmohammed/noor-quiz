# Spec — T002 Local stack: emulators, Hono health endpoint, Vite home page

Size check: about one day. It adds no port, one screen (home), one public route, no migration and no admin screen. Not split.

T001 is on main. Workspaces are source-first (`exports: ./src/index.ts`), `tsconfig.base.json` uses `moduleResolution: Bundler` and `composite`, Vitest runs `projects: ['packages/*', 'apps/*', 'tooling']`, ESLint uses the flat config with the core vendor ban, and every package has one trivial `index.ts`/`index.test.ts`. This task reuses all of that. There is no Clock, config, DomainError or composition root yet (T003), so this task must not need them.

Local machine: Node v20.18.3 (CI uses `.nvmrc` = 22), OpenJDK 25, a global `firebase` CLI, and Playwright browser caches in `~/.cache/ms-playwright` (`chromium-1161`, `chromium-1247`). **Every dependency must install and run on Node 20.18.** See "Dependency pins" below.

## Acceptance tests
1. `HealthResponse` accepts `{ status: 'ok', version: '0.1.0' }`. Layer: core (contracts). File: `packages/contracts/src/health.test.ts`
2. `HealthResponse` rejects `status: 'down'`, a missing `version`, an empty `version`, and an extra key (for example `{ status: 'ok', version: '1', env: 'x' }`). This is a strict object, so leaks fail. Layer: core (contracts). File: same as 1
3. `GET /v1/health` through `createApp({ version: 'test-1' }).request('/v1/health')` returns 200, `content-type` contains `application/json`, `HealthResponse.parse(body)` succeeds, and `body.version === 'test-1'`. Layer: api. File: `apps/api/src/routes/health.test.ts`
4. `GET /v1/health` needs no `Authorization` header and no tenant. The request in test 3 sends neither. A second case sends a garbage `Authorization: Bearer x` and still gets 200, because the route ignores it. Layer: api. File: same as 3
5. `POST /v1/health` returns 404, and unversioned `GET /health` returns 404. Layer: api. File: same as 3
6. Web API client `getHealth()` calls `GET {baseUrl}/v1/health` and returns the parsed `HealthResponse`. It uses an injected fake `fetch`. Layer: web (unit). File: `apps/web/src/api/client.test.ts`
7. `getHealth()` throws `ApiError` when the response is 500, when the body is not JSON, and when the body breaks the contract (for example `{ status: 'ok' }`). Layer: web (unit). File: same as 6
8. `t('home.api.ok')` returns `'API ok'` from `en.json`. An unknown key returns the key itself. Layer: web (unit). File: `apps/web/src/i18n/t.test.ts`
9. e2e: with the local stack running (emulators with the function, plus Vite), opening `/` shows `API ok` in `[data-testid="api-status"]`. The page must get there through the real path: browser → Vite proxy `/v1` → functions emulator → Hono. Layer: e2e. File: `apps/web/e2e/home.spec.ts`
10. Docs commands check: every `npm run <script>` in the Commands block of `AGENT.md` and in `README.md` exists in the root `package.json` `scripts`, unless its line is marked as not built yet (see Files below). Every root script that a developer uses (`dev`, `test`, `test:e2e`, `lint`, `typecheck`, `build`) appears in README. Layer: tooling. File: `tooling/src/docs-commands.test.ts`
11. Manual smoke, recorded in build.md. Run `npm run dev` and check:
    - `curl -s http://127.0.0.1:5001/demo-noor/europe-west1/api/v1/health` returns the ok JSON
    - `curl -s http://127.0.0.1:5173/v1/health` returns the same JSON through the proxy
    - the browser at `http://127.0.0.1:5173/` shows "API ok"
    - the emulator log names project `demo-noor` and asks for no login
    - Ctrl-C stops all child processes, with no orphaned Java or emulator processes (`ps` check)
12. `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` and `npm run test:e2e` all pass on a clean `npm ci`. Verified by command; the results go into build.md.

No unauthorised or wrong-tenant tests are needed. `/v1/health` is the only new route. It is deliberately public, not tenant-scoped, and returns no user or tenant data. Test 4 pins down that it is public.

How the acceptance criteria map to tests:
- AC 1 "`GET /v1/health` returns 200 and a contract-valid body (route test with `app.request()`)" → tests 1–5
- AC 2 "e2e: home page shows 'API ok' with the local stack running" → test 9 (backed up by tests 6–8 and 11)
- AC 3 "README/AGENT commands section matches the real scripts" → test 10 (+ 12)

## Files and modules to touch

### Root
- `package.json`. Add these scripts and keep the existing ones unchanged:
  - `dev`: `concurrently -k -n emu,api,web -c auto "npm:dev:emulators" "npm:dev:api" "npm:dev:web"`
  - `dev:emulators`: `npm run build -w @noor/api && firebase emulators:start --config firebase/firebase.json --project demo-noor`
  - `dev:api`: `npm run build:watch -w @noor/api` (esbuild rebuilds the function bundle; the functions emulator reloads it)
  - `dev:web`: `npm run dev -w @noor/web`
  - `build`: `npm run build -w @noor/api && npm run build -w @noor/web`
  - `test:e2e`: `npm run test:e2e -w @noor/web`
  - Root devDependencies: `concurrently`, `firebase-tools` (pins below).
  - Do **not** add `test:emulator`, `deploy:staging`, `seed:local` or `emulators:export`. They belong to later tasks (T004, the first adapter task, and the seed task).
- `package-lock.json`: updated and committed.
- `tsconfig.json`: add a reference to `apps/web/tsconfig.e2e.json`.
- `eslint.config.js`: add `**/build/**`, `**/playwright-report/**`, `**/test-results/**` to `ignores`. Add one block for `**/*.mjs` with `languageOptions.globals` `{ process: 'readonly', console: 'readonly' }`, written inline with no `globals` package. That lets the api build script lint. Leave the core ban unchanged.
- `.prettierignore`: add `build`, `playwright-report`, `test-results`.
- `.gitignore`: add `build/` (function bundle). `.firebase/`, `*-debug.log`, `playwright-report/` and `test-results/` are already there.
- `README.md`: replace the "Status: planning…" line with a "Local development" section that covers:
  - prerequisites: Node 22 (20.18 works), Java 21+ for the Firestore emulator, no Firebase account or login
  - `npm install`, then `npm run dev`
  - the URLs: web 5173, emulator UI 4000, function 5001
  - `npm test`, `npm run test:e2e`, `npm run lint`, `npm run typecheck`, `npm run build`
  - how to get the browser if it is missing (`npx playwright install chromium`)
- `AGENT.md`: in the "Commands" block only, make the list match reality. Mark commands that do not exist yet with a trailing comment of the exact form `# not yet — T004`, for example on the `npm run test:emulator` and `npm run deploy:staging` lines. Change the heading text from "(created by task T001/T002)" so it stays true. Change nothing else in AGENT.md.

### firebase/
- `firebase/firebase.json` (shape below): auth, firestore and functions emulators plus the UI, `singleProjectMode: true`, functions source `../apps/api`, codebase `api`, runtime `nodejs22`.
- `firebase/firestore.rules`: deny everything (`allow read, write: if false;`). This stops the Firestore emulator from starting with open rules. Real rules and rules tests come in a later task.
- `firebase/firestore.indexes.json`: `{ "indexes": [], "fieldOverrides": [] }`.
- No `.firebaserc`. The project comes from `--project demo-noor` in the scripts. Real aliases are T004/T005.
- Path risk: if the CLI will not accept a functions `source` outside the folder that holds firebase.json, the builder tries to fix it inside `firebase/` first. If that does not work, the builder moves firebase.json to the repo root (keeping rules and indexes in `firebase/`), updates the `--config` flag, and records the deviation in build.md.

### packages/contracts
- `package.json`: add the dependency `zod`.
- `src/health.ts`: `HealthResponse` schema and type.
- `src/health.test.ts`: tests 1–2.
- `src/index.ts`: re-export from `./health`. Keep `PACKAGE_NAME`.

### apps/api
- `package.json`:
  - add `"version": "0.1.0"` and `"main": "build/index.js"`, which the functions emulator loads
  - dependencies: `@noor/contracts: "*"`, `hono`, `@hono/node-server`, `firebase-functions`, `firebase-admin` (a required peer of firebase-functions; not imported by our code in this task)
  - devDependency: `esbuild`
  - scripts: `build`: `node scripts/build-function.mjs`, `build:watch`: `node scripts/build-function.mjs --watch`
- `tsconfig.json`: add `references: [{ "path": "../../packages/contracts" }]`.
- `src/app.ts`: `createApp(opts: { version: string }): Hono`. It mounts `healthRoutes`. It imports nothing from firebase and has no top-level side effects. Routes are added here, so tests use `app.request()` without the function wrapper.
- `src/routes/health.ts`: `healthRoutes(version)` (or a Hono sub-app) with `GET /v1/health` → `c.json(HealthResponse.parse({ status: 'ok', version }), 200)`. The output is parsed with the contract. There is no timestamp and no `Date`.
- `src/routes/health.test.ts`: tests 3–5.
- `src/function.ts`: the **only** file that imports `firebase-functions`. It does `import { onRequest } from 'firebase-functions/v2/https'` and `import { getRequestListener } from '@hono/node-server'`, then `export const api = onRequest({ region: REGION }, (req, res) => listener(req, res))` with `REGION = 'europe-west1'`. The version comes from a build-time constant `__NOOR_VERSION__`, declared in a `src/build-env.d.ts`. Check that `@hono/node-server` uses `req.rawBody` when the Functions framework has already read the body. It does not matter for GET, but later POST routes depend on it. Write down the result in build.md.
- `scripts/build-function.mjs`: uses the esbuild JS API to bundle `src/function.ts` → `build/index.js`, with `platform: 'node'`, `format: 'esm'`, `target: 'node20'`, `bundle: true`, `external: ['firebase-functions', 'firebase-admin']`, and `define: { __NOOR_VERSION__: JSON.stringify(<version read from apps/api/package.json>) }`. With `--watch` it uses `context().watch()`. Contracts, zod and hono are bundled in, so the emulator never has to load `.ts` source.
- Keep the existing `src/index.ts`/`index.test.ts`.

### apps/web
- `package.json`:
  - dependencies: `@noor/contracts: "*"`, `react`, `react-dom`, `react-router`
  - devDependencies: `vite` (^6, same as root), `@types/react`, `@types/react-dom`, `@playwright/test`
  - scripts: `dev`: `vite`, `build`: `vite build`, `preview`: `vite preview`, `test:e2e`: `playwright test`
- `tsconfig.json`: add `"jsx": "react-jsx"`, `"resolveJsonModule": true`, and `references` to contracts. `include` stays `["src"]`.
- `tsconfig.e2e.json`: composite, `rootDir: "."`, `outDir: "dist/e2e"`, `tsBuildInfoFile: "dist/e2e/tsconfig.tsbuildinfo"`, `types: ["node"]`, lib `ES2023` + `DOM`, include `["e2e", "playwright.config.ts", "vite.config.ts"]`. This makes `tsc -b` typecheck the e2e and config files.
- `vitest.config.ts`: change `include` to `['src/**/*.test.{ts,tsx}']` and keep the node environment. The e2e specs are outside `src`, so Vitest never picks them up.
- `vite.config.ts`:
  - `server: { host: '127.0.0.1', port: 5173, strictPort: true }`
  - `proxy: { '/v1': { target: 'http://127.0.0.1:5001', rewrite: (p) => '/demo-noor/europe-west1/api' + p } }`
  - `esbuild: { jsx: 'automatic' }`
  - No React plugin. The browser calls the API on its own origin, so no CORS is needed.
- `index.html`: `<html lang="en" dir="ltr">`, root div, `<script type="module" src="/src/main.tsx">`.
- `src/main.tsx`: renders `<RouterProvider router={router} />` in `StrictMode` and imports `./styles.css`.
- `src/router.tsx`: `createBrowserRouter([{ path: '/', element: <HomePage /> }])` from `react-router`.
- `src/features/home/HomePage.tsx`: calls `apiClient.getHealth()` on mount. It shows exactly one status element, `<p data-testid="api-status">`, with these states: loading → `t('home.api.checking')`, success → `t('home.api.ok')`, error → `t('home.api.unreachable')`. The effect must not set state after unmount (use an abort or ignore flag, which StrictMode exercises). Text uses no hard-coded strings.
- `src/api/client.ts`: `createApiClient({ baseUrl = '', fetch = globalThis.fetch })` returns `{ getHealth(): Promise<HealthResponse> }`, and also exports `apiClient = createApiClient()` and `class ApiError extends Error { status?: number }`. It parses every response with the contract schema.
- `src/api/client.test.ts`: tests 6–7.
- `src/i18n/en.json`: `{ "home.api.checking": "Checking API…", "home.api.ok": "API ok", "home.api.unreachable": "API unreachable" }`. Flat dotted keys.
- `src/i18n/t.ts`: a minimal `t(key: string): string` that reads en.json and falls back to the key. Add a header comment saying T080 replaces it with `useI18n()`. No locale switching.
- `src/i18n/t.test.ts`: test 8.
- `src/styles.css`: CSS variables on `:root`, a system font stack, and logical properties only (`padding-inline`, `margin-block`). No `left`/`right`.
- `playwright.config.ts` (in apps/web):
  - `testDir: 'e2e'`, `use.baseURL: 'http://127.0.0.1:5173'`, one project `chromium`
  - `webServer` is an array with `cwd` = repo root:
    - `{ command: 'npm run dev:emulators', url: 'http://127.0.0.1:5001/demo-noor/europe-west1/api/v1/health', timeout: 180_000, reuseExistingServer: !process.env.CI }`
    - `{ command: 'npm run dev:web', url: 'http://127.0.0.1:5173', reuseExistingServer: !process.env.CI }`
  - The first URL only answers once the function is loaded, so the test never races the emulator.
- `e2e/home.spec.ts`: test 9, using `await expect(page.getByTestId('api-status')).toHaveText('API ok')`. Use the plain literal here: the test asserts what users see.
- Keep the existing `src/index.ts`/`index.test.ts`.

### tooling
- `src/docs-commands.test.ts`: test 10. It reads `README.md`, the fenced Commands block of `AGENT.md`, and the root `package.json`. It extracts `npm run ([\w:-]+)` and skips lines that contain `# not yet`. Every remaining name must be a key of `scripts`. It also asserts that README mentions each of `dev`, `test`, `test:e2e`, `lint`, `typecheck`, `build`. Bare `npm test` / `npm install` count as built-ins. Find the repo root from `import.meta.url`, as the existing eslint test does.

### docs
- `docs/tasks/E00-foundation.md`: add only a Notes line under T002 for the next tasks. It should cover:
  - the region choice
  - the proxy path
  - the build dir `apps/api/build/`
  - that the function bundle is built by esbuild, not `tsc`
  - which Playwright version and chromium revision are pinned
  - that T003 should replace `createApp({ version })` options with the composition root
  - that T004 adds Hosting rewrites `/v1/**` → function `api`

## Contracts and data shapes
```ts
// packages/contracts/src/health.ts
import { z } from 'zod';
export const HealthResponse = z.strictObject({
  status: z.literal('ok'),
  version: z.string().min(1),
});
export type HealthResponse = z.infer<typeof HealthResponse>;
```

HTTP:
| route | auth | tenant | 200 body | other |
| --- | --- | --- | --- | --- |
| `GET /v1/health` | none (public) | none | `HealthResponse` | other methods/paths → Hono default 404 |

There is no DomainError mapping and no error schema. Both are T003. There are no Firestore documents.

`firebase/firebase.json`:
```json
{
  "functions": [
    { "source": "../apps/api", "codebase": "api", "runtime": "nodejs22" }
  ],
  "firestore": { "rules": "firestore.rules", "indexes": "firestore.indexes.json" },
  "emulators": {
    "singleProjectMode": true,
    "auth": { "host": "127.0.0.1", "port": 9099 },
    "firestore": { "host": "127.0.0.1", "port": 8080 },
    "functions": { "host": "127.0.0.1", "port": 5001 },
    "ui": { "enabled": true, "host": "127.0.0.1", "port": 4000 }
  }
}
```
On Node 20 the emulator warns about the `nodejs22` runtime mismatch. That is expected and harmless; note it in README.

Function URL in the emulator: `http://127.0.0.1:5001/demo-noor/europe-west1/api/<path>`. Hono sees `<path>` (`/v1/health`).

### Dependency pins (all must run on Node 20.18)
Before choosing a version, the builder runs `npm view <pkg>@<range> engines` for each package. Each one goes into build.md with a one-line reason and an exit path.

| package | where | pin | reason / exit path |
| --- | --- | --- | --- |
| zod | contracts | `^4` | shared schemas (stack choice) / any validator |
| hono | api | `^4` | HTTP layer (ADR 0002) / any Fetch-API router |
| @hono/node-server | api | `^1` | adapts Hono `fetch` to the Node req/res that Functions gives / a 30-line hand-written adapter |
| firebase-functions | api | newest major whose `engines` accepts 20.18 (expect ^6 or ^7) | 2nd-gen HTTPS function / Cloud Run with `@hono/node-server` `serve()` |
| firebase-admin | api | `^13` (whatever firebase-functions peers on) | required peer only / goes with firebase-functions |
| esbuild | api dev | same minor range Vite 6 uses (`^0.25`), so only one copy is installed (`npm ls esbuild`) | bundles the function, including source-first workspaces / tsup or rollup |
| react, react-dom | web | `^19` | UI (stack choice) |
| react-router | web | `^7` (engines >= 20.0) | routing (stack choice) |
| @types/react, @types/react-dom | web dev | `^19` | types |
| vite | web dev | `^6` (same as root; Vite 7 needs 20.19) | dev server and build |
| @playwright/test | web dev | **exact** version (no `^`) whose chromium revision is already in `~/.cache/ms-playwright` (1247 if it maps to a release, otherwise 1161) | e2e / none needed |
| concurrently | root dev | `^9` | runs emulators, api watch and web together with clean Ctrl-C / a small Node spawn script |
| firebase-tools | root dev | newest version whose `engines` accepts 20.18 | reproducible emulator CLI for CI (T004) instead of relying on the global install / global CLI |

- No `@vitejs/plugin-react`: v5 needs Node 20.19, and esbuild's automatic JSX is enough. Without Fast Refresh the page does a full reload, which is acceptable.
- The Playwright browser:
  - Check it with `npx playwright install --dry-run chromium`, which must point at an existing cache dir.
  - If the headless-shell dir for that revision is missing, set `use.channel: 'chromium'` (new headless on the full browser) rather than downloading.
  - Do not add a `postinstall` that downloads browsers.
- Record any `EBADENGINE` warnings and new `npm audit` findings in build.md, as T001 did.

## Hard rules that apply here
- **Rule 1 (core is vendor-free).** This task does not touch `packages/core`. `packages/contracts` imports only zod.
- **Rule 2 (vendors behind adapters).** `firebase-functions` is imported only in `apps/api/src/function.ts`, which is the hosting adapter. `app.ts` and the routes know nothing about Firebase, so the same app can run on Cloud Run or any Node host (ADR 0002). The web app does not install the Firebase JS SDK.
- **Rule 3 (browser never writes to Firestore).** The web app talks only to `/v1/*`. `firestore.rules` denies all reads and writes, so the emulator never runs with open rules.
- **Rule 5 (time from Clock).** The health route returns no timestamp and calls no `Date.now()`/`new Date()`. There is no "test mode": e2e runs the real stack, and unit tests inject `version` and `fetch`.
- **Rule 6 / tenant isolation (rule 4).** The route is public and returns only a constant status and the build version. It reads no client input.
- **Rule 9 (secrets).**
  - Only `demo-noor` is used. A `demo-` project needs no credentials, and the emulators refuse to reach real services.
  - The builder must not run `firebase login` or `firebase use`, and must not create a `.firebaserc` with real project IDs, a service account or any `.env*` file.
  - No config variables are added, so `.env.example` waits for T003.
  - The version is a build constant, not a secret.
- **i18n / RTL conventions.** Strings go through `t()` and `en.json`, `<html dir>` is set, and the CSS uses logical properties only. The full i18n layer and the Arabic Playwright check come with T080/T081, when a second locale exists.
- **Dependencies.** Every addition is listed with a reason and an exit path (table above). Nothing needs Node >= 20.19.

## Out of scope
- `Clock`, `config.ts`, `.env.example`, `DomainError`, `errors.ts`, error response schema, composition root, `makeTestDeps` (T003).
- Auth middleware, `requireUser`/`requireMember`, rate limiting, CORS middleware, security headers, logging/observability.
- Firestore repositories, Firestore rules tests, `@firebase/rules-unit-testing`, `test:emulator` script, seed script, emulator data export/import.
- CI jobs for emulator/e2e/build, Hosting config and `/v1/**` rewrites, deploy, `.firebaserc` aliases, real Firebase projects (T004/T005).
- The full i18n module, `useI18n`, locale picker, sv/ar/am/so files, Arabic e2e check (T080+).
- React Testing Library, jsdom, component unit tests, a component library, eslint-plugin-react(-hooks), `@vitejs/plugin-react`.
- Workers app changes, Cloud Tasks emulator shim.
- Upgrading Vite/Vitest/Node or raising `engines`.
- Editing `docs/tasks/BOARD.md`, or any part of AGENT.md other than the Commands block.
