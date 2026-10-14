VERDICT: PASS
# Code review — T004 round 1

## Findings
No must-fix findings.

- [should-do, human] apps/api/.env.example — spec asks for a comment line (build/.env.local for emulator, CI-written build/.env.<projectId> for deploy). Not in the diff. The builder cannot touch .env* files, so a human adds it. Documentation only, so not blocking.

## Acceptance tests
1. ok — apps/api/scripts/build-function.test.mjs "keeps only the runtime Firebase dependencies…", "has no workspace dependency…", throws-when-missing cases. They fail without the change because deployManifest does not exist.
2. ok — build-function.test.mjs "writes the bundle and a package.json equal to the deploy manifest", "writes no dotenv file" (builds into a temp dir).
3. ok — apps/api/src/deploy-config.test.ts (functions source/codebase/runtime, hosting public, rewrite order, REGION, .firebaserc dev alias and no default). Values match firebase/firebase.json and firebase/.firebaserc.
4. ok — ensure-env-local.test.mjs (target dir missing, default target, idempotent, silent, missing example fails).
5. not run by me — home.spec.ts is unchanged. It needs build/.env.local, which agents may not create. CI e2e on this PR covers it. Statically: playwright runs `npm run dev:emulators`, which runs ensure-env-local and then the build, so build/ has index.js, package.json and .env.local.
6. ok (static) — ci.yml defines jobs unit, emulator, e2e. Confirm on the PR.
7. ok (static) — `changes` is PR-only and uses plain shell. e2e.if is `!cancelled() && changes.result != 'failure' && (push || e2e=='true')`. Using `!cancelled()` instead of `always()` is a justified deviation.
8. ok (static) — deploy-dev runs only on push to main, with explicit success checks on all three needs (needed because `changes` is skipped on push). It has environment dev, id-token: write on this job only, a project guard, WIF auth, build, a runner-written env file, rules+indexes, functions --force, hosting, then curl/jq. Human-verified after merge.
I re-ran `vitest run apps/api` in the worktree: 50 tests pass.

## Hard rules
1. ok — core is untouched; region.ts has no imports.
2. ok — function.ts is still the only firebase-functions importer.
3. ok — firestore.rules is unchanged, and the deploy ships rules before functions and hosting.
4. ok — n/a, no data path.
5. ok — no Date.now() or new Date().
6. ok — n/a.
7. ok — n/a. No plan-name checks, and Stripe is not called.
8. ok — n/a.
9. ok — no secrets.* references and no key; WIF only. The env file holds only NOOR_ENV=dev and is not echoed. No .env* is committed. The test-run and CI logs print no env contents.
10. ok — n/a.
11. ok — n/a.

## Scope
Only deviation: package.json `dev:emulators` gets `--only auth,firestore,functions`. It is not in the spec, but it is needed so the new hosting block does not start a Hosting emulator in local dev and e2e. Small and justified; accepted.
The e2e `!cancelled()` change is also accepted.

## Correctness
- build-function.mjs: no side effects on import. The manifest is written after the build, and once at the start in watch mode. The outdir is created recursively.
- ensureEnvLocal keeps the atomic COPYFILE_EXCL behaviour.
- firebase deploy discovery resolves firebase-functions from the hoisted root node_modules, because build/ is inside the workspace. Cloud Build installs from the generated package.json. Ranges are not pinned with a lockfile; the spec accepts this.

## Tests
Meaningful assertions, temp dirs only, no sleeps and no network. The testkit is not needed for these tests.

## i18n/RTL
n/a.

## Dependencies
None added. The workflow uses only actions/* and google-github-actions/auth@v2.

## Nits (non-blocking)
- `npm run dev` runs dev:emulators (build) and dev:api (watch) concurrently, and both write build/package.json with identical content. Harmless.
- The health URL is hard-coded in ci.yml and also appears in the guard, as the spec directs.
- The spec's `always()` wording differs from `!cancelled()`. Consider noting this in the PR description.
