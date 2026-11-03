# Merge — T011

## git fetch origin
Exit 0. origin fetched.

## git rebase origin/main
First attempt exited 1: unstaged line-ending noise (`core.autocrlf`) made rebase refuse, with an empty `git diff`. Stashed that noise, then rebase exited 0: `Current branch factory/T011-edit-profile is up to date.` Stash dropped. No conflict.

## factory: T011 records
Commit `1a824fa`. Staged `docs/tasks/BOARD.md` (T011 status `done`, owner `factory`) and `factory/jobs/T011-edit-profile/` with `git add -f`.

## npm install
Exit 0. 909 packages already up to date. Engine warning: `superstatic` wants Node 20, 22, or 24; this machine has Node 26.

## npm run lint
Exit 1. ESLint was not the failure. `prettier --check .` warns on 79 files because this Windows checkout has `core.autocrlf=true`. The same check with `--end-of-line auto` passes for the whole repo. build.md and both code reviews already recorded this. The diff does not change those line endings.

## npx eslint . --max-warnings 0
Exit 0.

## npx prettier --check --end-of-line auto .
Exit 0. All matched files use Prettier code style.

## npm run typecheck
Exit 0.

## npm test
Exit 1. 769 tests passed. The only failing suite is `tooling/src/docs-commands.test.ts`, because `AGENT.md` is CRLF in this checkout. The diff does not touch `AGENT.md`.

## npm run test:emulator
Exit 0. 3 files, 107 tests passed (user repo contract, auth verifier, Firestore rules).

## npm run test:e2e
`dev:emulators` uses POSIX `FUNCTIONS_DISCOVERY_TIMEOUT=60` syntax, which cmd.exe cannot run. Started the same servers by hand (`npm run build -w @noor/api`, Firebase emulators for auth, firestore and functions, `npm run dev:web`). Playwright reused them. Exit 0. 5 passed:

- home page shows that the API is reachable
- sign in with Google, see my name from /v1/me, then sign out
- first sign-in sends the browser timezone once and the profile shows it
- change my name to ሀሰን and see it in the header, also after reload
- an unsaved edit never shows in the next member's form

## gh pr create
Exit 0. https://github.com/hmohammed/noor-quiz/pull/10
