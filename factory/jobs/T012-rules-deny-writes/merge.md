# Merge log — T012

## rebase
$ git -C <worktree> rebase main
Rebasing (1/3)Rebasing (2/3)Rebasing (3/3)[KSuccessfully rebased and updated refs/heads/factory/T012-rules-deny-writes.
exit=0
## npm install
  npm audit fix

To address all issues (including breaking changes), run:
  npm audit fix --force

Run `npm audit` for details.
exit=0
## npm run lint

> lint
> eslint . --max-warnings 0 && prettier --check .

Checking formatting...
All matched files use Prettier code style!
exit=0
## npm run typecheck

> typecheck
> tsc -b
exit=0
## npm test
 ✓ |tooling| src/eslint-core-boundary.test.ts (29 tests) 5380ms

 Test Files  13 passed (13)
      Tests  80 passed (80)
   Start at  11:35:54
   Duration  10.22s (transform 7.32s, setup 0ms, collect 19.58s, tests 10.84s, environment 2ms, prepare 12.06s)
exit=0
## npm run test:emulator
NOT RUN: 127.0.0.1:8080 held by Docker Desktop (com.docker.backend.exe) + wslrelay.exe. Paused.

## squash merge
NOT RUN: main has an uncommitted change to package-lock.json (human-owned), and this branch also changes package-lock.json. Paused.

# Merge attempt 2 (after round 2)
## git -C <worktree> rebase main
Rebasing (1/4)Auto-merging eslint.config.js
CONFLICT (content): Merge conflict in eslint.config.js
error: could not apply 951a41c... T012: ban Firestore write API imports in apps/web
hint: Resolve all conflicts manually, mark them as resolved with
hint: "git add/rm <conflicted_files>", then run "git rebase --continue".
hint: You can instead skip this commit: run "git rebase --skip".
hint: To abort and get back to the state before "git rebase", run "git rebase --abort".
Could not apply 951a41c... T012: ban Firestore write API imports in apps/web
exit=1
## git rebase --abort
Done; branch restored to cb1745c.

## Result: REBASE CONFLICT → back to builder (round 3)
`main` now contains T003 (2bf37d9), which also edits `eslint.config.js` (new `no-restricted-syntax` rule banning `Date.now()` / `new Date()` in core and api routes) and `package.json` / `package-lock.json` (api workspace deps, `dev:emulators` runs `ensure-env-local.mjs`).
Conflict in `eslint.config.js` when applying 951a41c "T012: ban Firestore write API imports in apps/web".
Builder: rebase onto main, keep BOTH T003's clock rule and T012's apps/web Firestore-write ban, resolve any package.json / package-lock.json conflict by regenerating the lockfile with `npm install` (do not hand-edit it), then re-run lint, typecheck, npm test and `npm run test:emulator` (port 8180).
