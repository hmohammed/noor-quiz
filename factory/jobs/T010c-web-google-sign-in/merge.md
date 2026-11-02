# Merge — T010c

## Fetch and rebase
- `git fetch origin`, then `git rebase origin/main` on `factory/T010c-web-google-sign-in`.
- The first rebase stopped because the worktree had line-ending-only edits (`core.autocrlf=true`, blobs are LF). `git diff --ignore-cr-at-eol` was empty. Those edits were restored and not committed.
- After that, rebase reported the branch already up to date with `origin/main`. No conflicts.

## Checks
- `npm run lint` — pass, after rewriting the Windows CRLF checkout as LF. Those edits were not committed.
- `npm run typecheck` — pass.
- `npm test` — pass (43 files, 542 tests).
- `npm run test:e2e` — pass (2 tests). The emulators and Vite were started in PowerShell first, because `dev:emulators` uses shell syntax that cmd.exe cannot run. Playwright reused those servers.
- `npm run test:emulator` — not run (no adapter or rules change).
