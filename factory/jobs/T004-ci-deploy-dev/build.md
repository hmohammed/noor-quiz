# Build — T004 (round 1)
Branch: factory/T004-ci-deploy-dev
Worktree: /mnt/c/Users/hassen.mohammed/Downloads/noor-quiz/.claude/worktrees/agent-a09df9e9dfc44010c

## Changes
- apps/api/scripts/build-function.mjs — no side effects on import (`isMain`). Exports `deployManifest(pkg)` (only `firebase-functions`/`firebase-admin` with ranges from apps/api/package.json; throws if either is missing) and `buildFunction({ outdir, watch, logLevel })`. Writes `build/package.json` after the build (once at start in watch mode). Writes no dotenv. `logLevel` is an extra optional parameter so tests run silently.
- apps/api/scripts/build-function.test.mjs (new) — spec tests 1–2, building into a temp dir.
- apps/api/scripts/ensure-env-local.mjs — `ensureEnvLocal(exampleDir, targetDir = exampleDir)`, `mkdir -p` on the target. `isMain` copies `apps/api/.env.example` → `apps/api/build/.env.local`. The log line names the new path (file names only).
- apps/api/scripts/ensure-env-local.test.mjs — updated to use a non-existent `targetDir`, plus a default-target test.
- apps/api/src/region.ts (new) — `export const REGION = 'europe-west1'`, no imports. `function.ts` imports it and remains the only `firebase-functions` importer.
- apps/api/src/deploy-config.test.ts (new) — spec test 3 (firebase.json functions/hosting/rewrites, REGION, .firebaserc).
- firebase/firebase.json — functions `source: ../apps/api/build`. Adds `hosting` (public `../apps/web/dist`, ignore dotfiles, `/v1/**` → function `api`@europe-west1, then the SPA fallback). Emulator ports unchanged.
- package.json — `dev:emulators` now passes `--only auth,firestore,functions`. Without it, the new `hosting` block makes `emulators:start` also start a Hosting emulator on port 5000, which did not run before. Not in the spec; see reviewer notes.
- .github/workflows/ci.yml — `unit` (+ `npm run build`), `emulator` (Java 21, emulator cache keyed on the firebase-tools lock version), `changes` (PR only, plain-shell diff filter), `e2e` (conditional, Playwright chromium, artifacts on failure), `deploy-dev` (main push only, environment dev, WIF auth, project guard, build, runner-written `build/.env.$FIREBASE_PROJECT_ID`, rules+indexes → functions --force → hosting, then curl/jq health smoke check). Concurrency cancels only PR runs. No `secrets.*` references.
- AGENT.md — Commands block: `deploy:staging` marker → "not yet — T135 (needs T005b)". `test:emulator` had already lost its "not yet" marker on main (T012).
- docs/tasks/E00-foundation.md — T004 Notes for the next task.

## Acceptance tests → test files
1. Deploy manifest → apps/api/scripts/build-function.test.mjs "keeps only the runtime Firebase dependencies…", "has no workspace dependency, devDependencies or scripts", "throws when %s is missing", "throws when the input has no dependencies at all"
2. Build writes the manifest → apps/api/scripts/build-function.test.mjs "writes the bundle and a package.json equal to the deploy manifest", "writes no dotenv file"
3. Firebase config → apps/api/src/deploy-config.test.ts (all 5 tests)
4. ensureEnvLocal → apps/api/scripts/ensure-env-local.test.mjs "copies .env.example into the target dir as .env.local, creating the dir" (new target-missing test), "defaults the target to the example dir", "is idempotent…", "prints nothing itself", "fails loudly…"
5. Local stack e2e → apps/web/e2e/home.spec.ts (unchanged). **Not run here**; see "needs human".
6. Separate checks unit/emulator/e2e → .github/workflows/ci.yml (verify on the PR)
7. e2e conditional → .github/workflows/ci.yml `changes` + `e2e.if` (inspect; optional docs-only PR)
8. deploy-dev + smoke → .github/workflows/ci.yml `deploy-dev` (human-verified after merge)

## How I tested
| command | result |
| --- | --- |
| npm run lint | pass |
| npm run typecheck | pass |
| npm test | pass (27 files, 203 tests) |
| npm run build | pass (build/ contains index.js, index.js.map, package.json and no .env*; removed afterwards) |
| npm run test:emulator | could not run as-is: ports 8180/4400/4500/5001/9099 were held by another session's `npm run dev:emulators` from the main checkout. I did not stop it or test against it, since the rules tests clear `demo-noor` and reload rules. I ran the identical command (`firebase emulators:exec --only firestore … "vitest run --config firebase/vitest.config.ts"`) with a throwaway config on free ports (8195/9155/4410/4510), placed in gitignored `.firebase/` and deleted afterwards: pass (67 tests). Rules and the test:emulator script are unchanged. |
| functions emulator on apps/api/build | partial: on alternate ports the emulator found the new source, resolved `firebase-functions` and loaded `build/index.js`, then failed fast with `ConfigError: NOOR_ENV is required` because no `.env.local` exists (agents may not create it). This is the expected fail-fast. |
| npm run test:e2e | not run: it would create `apps/api/build/.env.local` (forbidden for agents), and the dev ports were taken by another session |

## Commits
- 482dee0 T004: build-function writes a deploy package.json into build/
- e9de41b T004: generate the emulator .env.local into apps/api/build
- 62246dd T004: functions source apps/api/build, Hosting with /v1 rewrite, shared REGION
- 7f29ee9 T004: CI emulator, e2e and deploy-dev jobs
- cf59a93 T004: update AGENT.md commands and T004 notes
- 72fcf4c T004: reword WIF comment in ci.yml

## Needs human
- `apps/api/.env.example`: the spec asks for a comment line explaining that `.env.local` is generated into `build/` for the emulator and that deployed projects get `NOOR_ENV` from the CI-written `build/.env.<projectId>`. Skipped because agents may not touch `.env*` files. Please add it by hand.
- Run `npm run test:e2e` locally (it creates `apps/api/build/.env.local`) to confirm spec test 5. CI's `e2e` job also covers it on this PR.
- An old `apps/api/.env.local` (if present) is now unused and can be deleted by hand. I did not read or touch it.
- Spec "Human steps" 1–3: push/merge and watch `deploy-dev`, post the run link and `https://noor-quiz-bec90.web.app/v1/health`; add `emulator` and `e2e` as required checks; grant missing IAM roles to `github-deploy@` if the first functions deploy fails.

## Notes for reviewers
- The worktree was created from an old commit (cc5099d, T002). I fast-forwarded the fresh job branch to `main` (76d9311) before working, so the branch is based on current `main`.
- Deviation in `e2e.if`: I used `!cancelled()` instead of the spec's `always()`. Both run e2e when `changes` is skipped on push, but `!cancelled()` also respects a cancelled run. The condition also checks `needs.changes.result != 'failure'`, as the spec requires.
- `deploy-dev.if` checks `needs.unit/emulator/e2e.result == 'success'` explicitly, together with `!cancelled()` and the push/main condition. Reason: `e2e` depends on a job that is skipped on push (`changes`), and GitHub's implicit `success()` would then skip `deploy-dev` as well.
- Deviation: `dev:emulators` gets `--only auth,firestore,functions` (see Changes) so the local stack keeps the same emulators and ports.
- The deploy `package.json` uses ranges, not a lockfile (out of scope per spec, noted in T004 Notes).
