VERDICT: PASS
# Code review — T012 round 3

Scope: round 3 only rebased onto main (T003) and resolved the eslint.config.js conflict. Reviewed `git diff main...factory/T012-rules-deny-writes` and the merged files via `git show`.

## Findings
None.

## Rebase resolution
- eslint.config.js: keeps T003's `no-restricted-syntax` block (Date.now() / new Date() ban, `packages/core/**` + `apps/api/src/routes/**`, `clockMessage`), the unchanged core `no-restricted-imports` block, and T012's `no-restricted-imports` block for `apps/web/**/*.{ts,tsx}` (`webFirestoreWrites`, six write APIs, three module paths). The globs are disjoint, so neither overrides the other. The diff vs main is purely additive (+23 lines).
- package.json: keeps T003's `dev:emulators` (ensure-env-local.mjs, build, FUNCTIONS_DISCOVERY_TIMEOUT) and workspace scripts. Adds T012's `test:emulator` and the devDependencies `@firebase/rules-unit-testing` and `firebase`. The diff vs main shows only those three additions.
- package-lock.json is in the diff vs main (devDependency additions only); build.md says `npm install` was a no-op on the merged lockfile.
- firebase/firebase.json: only the Firestore port changed, 8080 to 8180. Other ports are untouched.
- firebase/firestore.rules: comment only, still deny-all.
- apps/api/.env.example was not opened (per instruction).

## Acceptance tests
1-9. ok — firebase/rules.test.ts (unchanged by the rebase, 67/67 per build.md on port 8180)
10-14. ok — tooling/src/eslint-web-firestore-writes.test.ts (19/19), eslint-core-boundary (29/29); the web block is intact in eslint.config.js
15. ok — tooling/src/docs-commands.test.ts (build.md: npm test 190 tests pass)
I did not re-run the suites. I verified the merged config statically; build.md reports lint, typecheck, test and test:emulator all green after the rebase, and the new eslint-clock-rule test (T003) passes alongside T012's.

## Hard rules
1. ok  2. ok  3. ok (rules stay deny-all; web write imports banned)  4. ok  5. ok (T003 clock rule preserved)  6. ok  7. ok  8. ok  9. ok (demo-noor, no secrets)  10. ok  11. ok

## Scope
Within spec. The port change (8080 to 8180) came from round-1 rework.

## Nits (non-blocking)
- Dynamic imports and wrapper packages are not covered by the lint ban; this is documented as out of scope.
- The merge.md "attempt 1" entries are stale history. Nothing to do.
