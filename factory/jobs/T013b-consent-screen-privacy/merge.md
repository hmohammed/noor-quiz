# Merge — T013b

## git fetch origin
Exit 0.

## git rebase origin/main
Exit 0. `Current branch factory/T013b-consent-screen-privacy is up to date.` No conflict.

## factory: T013b records
Commit `0d428bd`. Staged `docs/tasks/BOARD.md` (T013b status `done`, owner `factory`) and `factory/jobs/T013b-consent-screen-privacy/` with `git add -f`. T013 stays `split`; T013c is still open.

## npm install
Not re-run. The worktree already had dependencies from the build, and the checks below ran against them.

## npx eslint . --max-warnings 0
Exit 0.

## npx prettier --check --end-of-line auto .
Exit 0. Plain `prettier --check .` fails on this Windows checkout because `core.autocrlf=true` rewrites untouched files to CRLF. The diff does not change those line endings.

## npm run typecheck
Exit 0.

## npm test
Exit 1. 874 tests passed. The only failing suite is `tooling/src/docs-commands.test.ts`, because `AGENT.md` is CRLF in this checkout. The diff does not touch `AGENT.md`.

## npm run test:emulator
Not run. No adapters or rules changed.

## npm run test:e2e
`dev:emulators` uses POSIX env syntax that cmd.exe cannot run. Started the emulators (`FUNCTIONS_DISCOVERY_TIMEOUT=60`) and `npm run dev:web` by hand from this worktree after `npm run build -w @noor/api`, then Playwright reused them. Exit 0. 8 passed.

## git push -u origin HEAD
Exit 0. New branch `factory/T013b-consent-screen-privacy`.

## gh pr create
Exit 0. https://github.com/hmohammed/noor-quiz/pull/13
