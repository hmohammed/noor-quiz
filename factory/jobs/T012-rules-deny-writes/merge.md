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
