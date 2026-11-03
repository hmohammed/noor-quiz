# Merge — T013a

## git fetch origin
Exit 0.

## git rebase origin/main
Exit 0. `Current branch factory/T013a-record-consent is up to date.` No conflict.

## factory: T013a records
Commit `f3a1e0c`. Staged `docs/tasks/BOARD.md` (T013a status `done`, owner `factory`) and `factory/jobs/T013a-record-consent/` with `git add -f`. T013 stays `split`; T013b and T013c are still open.

## npm install
Not re-run. The worktree already had dependencies from the build, and the checks below ran against them.

## npx eslint . --max-warnings 0
Exit 0.

## npx prettier --check --end-of-line auto .
Exit 0. Plain `prettier --check .` fails on this Windows checkout because `core.autocrlf=true` rewrites untouched files to CRLF. The diff does not change those line endings.

## npm run typecheck
Exit 0.

## npm test
Exit 1. 840 tests passed. The only failing suite is `tooling/src/docs-commands.test.ts`, because `AGENT.md` is CRLF in this checkout. The diff does not touch `AGENT.md`.

## npm run test:emulator
Exit 0. 3 files, 118 tests passed.

## npm run test:e2e
`dev:emulators` uses POSIX env syntax that cmd.exe cannot run. Started the same servers by hand and Playwright reused them. Exit 0. 5 passed.
