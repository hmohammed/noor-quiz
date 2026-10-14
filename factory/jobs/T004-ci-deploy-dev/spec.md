# Spec — T004 CI: emulator tests, e2e and auto-deploy to dev

Size check: one workflow file, Firebase config, two small build-script changes and their tests. No port, no screen, no migration. Fits in a day, so no split.

Infra-only task. There is no route, use case, contract or Firestore document, so the unauthorised and wrong-tenant tests do not apply. Agents never deploy and never push. Only a human can verify criterion 2 (the live deploy), after the change is merged and pushed to `main`. See "Human steps".

## Acceptance tests

1. **Deploy manifest.** `deployManifest(apiPkg)` (a pure function exported from `build-function.mjs`) returns this object: `{ name: '@noor/api-function', private: true, type: 'module', main: 'index.js', dependencies: { 'firebase-functions': <same range as apps/api/package.json>, 'firebase-admin': <same range> } }`. The result has no `@noor/*` dependency, no `devDependencies` and no `scripts`. It throws if either Firebase dependency is missing from the input. — api (unit) — `apps/api/scripts/build-function.test.mjs`
2. **Build writes the manifest.** Running the build with an injected out dir (a temp dir) writes `index.js` and a `package.json` whose content equals `deployManifest(...)`. It writes no `.env*` file. — api (unit) — `apps/api/scripts/build-function.test.mjs`
3. **Firebase config is deployable and consistent.** These tests parse `firebase/firebase.json` and `firebase/.firebaserc`:
   - functions: `source === '../apps/api/build'`, `codebase === 'api'`, `runtime === 'nodejs22'`
   - hosting: `public === '../apps/web/dist'`
   - hosting rewrites: the first rewrite is `{ source: '/v1/**', function: { functionId: 'api', region: REGION } }`. A later SPA fallback `{ source: '**', destination: '/index.html' }` exists.
   - `REGION` is imported from the new `apps/api/src/region.ts` and equals `'europe-west1'`
   - `.firebaserc` has alias `dev` → `noor-quiz-bec90` and no `default` alias

   — api (unit) — `apps/api/src/deploy-config.test.ts`
4. **The emulator env file moves with the functions source.** `ensureEnvLocal(exampleDir, targetDir)` copies `exampleDir/.env.example` to `targetDir/.env.local`. It creates `targetDir` if missing, never overwrites an existing file, prints nothing and fails on a missing example. Update the existing tests. Add one test where `targetDir` does not exist yet. — api (unit) — `apps/api/scripts/ensure-env-local.test.mjs`
5. **Local stack still works with the new functions source.** The existing `home.spec.ts` ("API ok") passes. It proves the emulator loads `apps/api/build` (manifest + `.env.local`) and that `NOOR_ENV` reaches the function. — e2e — `apps/web/e2e/home.spec.ts` (unchanged)
6. **A PR shows separate green checks `unit`, `emulator` and `e2e`** (criterion 1). Verify on this task's own PR, which touches `apps/` and therefore runs e2e. — CI — `.github/workflows/ci.yml`
7. **e2e is conditional on PRs.** On a PR that changes none of the trigger paths, the `e2e` job is *skipped*. It is not missing: GitHub treats a skipped required check as passing. On push to `main`, e2e always runs. — CI (verify by inspecting the workflow; optional human check with a docs-only PR) — `.github/workflows/ci.yml`
8. **Merge to main deploys to dev and smoke-tests it** (criterion 2). The `deploy-dev` job runs only on push to `main`, after `unit`, `emulator` and `e2e` pass. It deploys rules + indexes, then functions, then hosting. Its final step calls `GET https://noor-quiz-bec90.web.app/v1/health` with retries and fails unless the JSON has `status == "ok"`. **Human-verified after merge + push.** The human pastes the run link and the health URL into the PR/epic Notes. — CI + human — `.github/workflows/ci.yml`

## Files and modules to touch

- `.github/workflows/ci.yml`: extend it (details below). Keep the existing `unit` job id so the current required check keeps working.
- `firebase/firebase.json`:
  - functions `source` → `../apps/api/build`
  - add `hosting`: `public: "../apps/web/dist"`, `ignore: ["**/.*"]`, and the rewrites in test 3, in that order
  - leave emulator ports unchanged
- `apps/api/scripts/build-function.mjs`:
  - refactor so the module has no side effects on import (same `isMain` pattern as `ensure-env-local.mjs`)
  - export `deployManifest(pkg)` and `buildFunction({ outdir, watch })`
  - after the build (and once at the start of watch mode), write `build/package.json` = `deployManifest(apiPkg)`
  - write no other file into `build/` (in particular no dotenv)
- `apps/api/scripts/build-function.test.mjs` (new): tests 1–2. Run the build against a temp out dir, never against `apps/api/build`.
- `apps/api/src/region.ts` (new): `export const REGION = 'europe-west1';`. No imports, so tests can load it without pulling in `firebase-functions`. `function.ts` imports `REGION` from here.
- `apps/api/src/deploy-config.test.ts` (new): test 3. Read the JSON with `node:fs` relative to `import.meta.dirname`.
- `apps/api/scripts/ensure-env-local.mjs` (+ `.test.mjs`): new signature `ensureEnvLocal(exampleDir, targetDir = exampleDir)`. Create the target with `mkdir({ recursive: true })`. The `isMain` call uses `apps/api` → `apps/api/build`. Change the log line to the new path, file names only. An old `apps/api/.env.local` becomes unused. Mention it in Notes; do not delete or read it.
- `apps/api/.env.example`: add a comment line. It explains that `.env.local` is generated into `build/` for the emulator, and that deployed projects get `NOOR_ENV` from the CI-generated `build/.env.<projectId>`. No new variables.
- `AGENT.md` (Commands block only):
  - remove "not yet — T004" from `test:emulator`
  - change the `deploy:staging` marker to "not yet — T135 (needs T005b)". The staging project does not exist, so add no `deploy:staging` script.
- `docs/tasks/E00-foundation.md`, T004 Notes: the next-task notes (see end).
- Do **not** add root npm scripts that deploy (no `deploy:dev`). Deploy lives only in CI.

### ci.yml shape

- Triggers stay the same: `pull_request` and `push` to `main`. Top-level `permissions: contents: read`.
- `concurrency`: group `ci-${{ github.ref }}`, `cancel-in-progress: ${{ github.event_name == 'pull_request' }}`. A deploy on `main` is never cancelled mid-run.
- Every job uses `actions/checkout@v4` and `actions/setup-node@v4` (`node-version-file: .nvmrc`, `cache: npm`), then `npm ci`.
- **`unit`**: the existing steps (lint, typecheck, test), plus `npm run build`. A broken production bundle (api + web) then fails the PR.
- **`emulator`** (new):
  - `actions/setup-java@v4` (temurin, Java 21; current firebase-tools emulators need 21+)
  - optional `actions/cache@v4` for `~/.cache/firebase/emulators`, keyed on the `firebase-tools` version from `package-lock.json`
  - `npm run test:emulator`
- **`changes`** (new, PR only):
  - checkout with `fetch-depth: 0`
  - `git diff --name-only ${{ github.event.pull_request.base.sha }} HEAD`, filtered to the trigger paths: `apps/`, `packages/`, `firebase/`, `package.json`, `package-lock.json`, `.github/workflows/ci.yml`
  - output `e2e=true|false`
  - Why the wider paths: `apps/` is built from `packages/` and `firebase/`, so changes there can break e2e.
  - Use plain shell, not a third-party paths-filter action.
- **`e2e`** (new):
  - `needs: changes`
  - `if: always() && (github.event_name == 'push' || needs.changes.outputs.e2e == 'true')`. `changes` is skipped on push, so `always()` is needed. Also make sure the job does not run when `changes` failed: add `needs.changes.result != 'failure'`.
  - Java 21 as above
  - `npm exec -w @noor/web -- playwright install --with-deps chromium` (Playwright stays pinned at 1.51.1)
  - `npm run test:e2e` with `CI=true`. The Playwright config then starts its own emulator + Vite and does not reuse servers.
  - On failure, upload `apps/web/playwright-report` and `apps/web/test-results` with `actions/upload-artifact@v4` (GitHub artifact storage only)
- **`deploy-dev`** (new):
  - `if: github.event_name == 'push' && github.ref == 'refs/heads/main'`
  - `needs: [unit, emulator, e2e]`
  - `environment: { name: dev, url: https://noor-quiz-bec90.web.app }`
  - job-level `permissions: { contents: read, id-token: write }`
  - job-level `concurrency: { group: deploy-dev, cancel-in-progress: false }`
  - Steps:
    1. checkout, setup-node, `npm ci`
    2. guard: fail unless `vars.FIREBASE_PROJECT_ID == 'noor-quiz-bec90'`
    3. `google-github-actions/auth@v2` with `workload_identity_provider: ${{ vars.GCP_WORKLOAD_IDENTITY_PROVIDER }}` and `service_account: ${{ vars.GCP_SERVICE_ACCOUNT }}`. No key and no secrets. The action exports ADC, which firebase-tools picks up.
    4. `npm run build`
    5. write the non-secret runtime env: `printf 'NOOR_ENV=dev\n' > "apps/api/build/.env.${FIREBASE_PROJECT_ID}"`. Do not `cat` or echo it afterwards.
    6. `npx firebase deploy --config firebase/firebase.json --project "$FIREBASE_PROJECT_ID" --non-interactive --only firestore:rules,firestore:indexes`
    7. same command with `--only functions --force`. `--force` lets the CLI set the Artifact Registry cleanup policy non-interactively and remove functions deleted from codebase `api`. Add a comment saying this.
    8. same command with `--only hosting`
    9. smoke check: `curl -fsS --retry 10 --retry-delay 6 --retry-all-errors https://noor-quiz-bec90.web.app/v1/health | jq -e '.status == "ok"'`

## Contracts and data shapes

- No new zod schema. The smoke check relies on the existing `HealthResponse` (`{ status: 'ok', version }`).
- `apps/api/build/package.json` (generated, gitignored via `build/`):
  ```json
  { "name": "@noor/api-function", "private": true, "type": "module", "main": "index.js",
    "dependencies": { "firebase-functions": "<range from apps/api/package.json>", "firebase-admin": "<range>" } }
  ```
  Why: Cloud Build runs `npm install` in the functions source. The current `apps/api/package.json` lists `@noor/*` workspace packages that do not exist on npm, plus build scripts. Deploying `apps/api` as-is would fail. The esbuild bundle already contains contracts, core, zod and hono.
- Runtime config per environment comes from a Functions dotenv file. The CI runner writes `apps/api/build/.env.noor-quiz-bec90` (`NOOR_ENV=dev`) at deploy time. It is never committed and is not created by an agent. Emulator: `apps/api/build/.env.local`, generated from `.env.example`.
- GitHub `dev` environment variables (already exist, T005a): `GCP_WORKLOAD_IDENTITY_PROVIDER`, `GCP_SERVICE_ACCOUNT`, `FIREBASE_PROJECT_ID`.

## Hard rules that apply here

- **Rule 9 (secrets).** No service-account key: authentication uses WIF only, and the workflow references no `secrets.*`. Nothing prints env or credential files. The auth action's credentials file lands in the workspace root, outside `apps/api/build` and `apps/web/dist`, so neither deploy uploads it. `NOOR_ENV` is non-secret and comes from the runner-generated dotenv. No committed `.env*` file other than `.env.example`.
- **Rule 3 (browser never writes).** The deploy ships the existing deny-all `firestore.rules` before functions and hosting. Do not change `firestore.rules`.
- **Rule 2 (adapters).** `function.ts` stays the only file importing `firebase-functions`. `region.ts` has no imports.
- **Out of bounds.** Agents never run `firebase deploy` or `git push`, never touch `noor-prod`, and do not read `.env.local`. The builder verifies with lint, typecheck, `npm test`, `npm run test:emulator` and `npm run test:e2e` only.
- **Least privilege in CI.** `id-token: write` only on `deploy-dev`. Deploy only from `main` via `environment: dev`; the WIF subject is bound to it. The project-ID guard prevents a misconfigured variable from deploying elsewhere.

## Human steps (not builder work)

1. Merge and push to `main`, then watch the `deploy-dev` run. Post the run link and `https://noor-quiz-bec90.web.app/v1/health` in the PR / T004 Notes (criterion 2). If the default Hosting site is not `noor-quiz-bec90`, correct the URL in `ci.yml`.
2. In `main` branch protection, add the required checks `emulator` and `e2e` next to `unit`.
3. If the first functions deploy fails on IAM, it is likely missing a role for setting the public invoker or the cleanup policy. Grant the role to `github-deploy@` and record it in T005a Notes.

## Out of scope

- Staging and prod deploys, `deploy:staging` script, release tags (T005b / T135).
- Custom domains, Hosting cache headers, CSP, preview channels per PR.
- Function secrets, `firebase functions:secrets:set`, new config variables.
- Pinning the deployed dependency tree with a lockfile in `build/`. Ranges from `apps/api/package.json` are accepted for now; mention it in Notes.
- Changing the emulator ports, `firestore.rules`, indexes, the health route or the home page.
- Third-party actions beyond `actions/*` and `google-github-actions/auth@v2`.

## Notes for the builder to add to T004 in E00-foundation.md

- Functions source is `apps/api/build` with a generated `package.json`. The emulator `.env.local` now lives there too.
- Dev runtime env comes from the CI-written `build/.env.<projectId>`. Add new non-secret config there in `ci.yml` (and to `.env.example`).
- Check names are `unit`, `emulator` and `e2e`; `deploy-dev` runs on main only.
- Dev host: `https://noor-quiz-bec90.web.app`.
