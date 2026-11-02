# Merge — T010b

## Fetch and rebase
- `git fetch origin` — `main` moved `63b61d9..2b58a56` (T030 merged as #4).
- `git rebase origin/main` on `factory/T010b-verify-token-me` — success, 5 commits replayed, no conflicts.
- Records commit `c87a775` `factory: T010b records`. BOARD.md sets T010b to `done` / `factory`. T010 stays `split` because T010c is still open.

## Checks
- `npm install` — pass (engine warning only: local Node is 26, `superstatic` wants 20/22/24).
- `npm run lint` — pass. The first run failed Prettier because this Windows checkout had CRLF in the worktree (`core.autocrlf=true`) while the blobs are LF. Stripping CR locally made Prettier pass. Those line-ending edits were not committed.
- `npm run typecheck` — pass.
- `npm test` — pass (39 files, 514 tests), including the T030 tests now on main.
- `npm run test:emulator` — pass (3 files, 101 tests; Auth and Firestore).
- `npm run test:e2e` — not run (no UI).

## Push and pull request
- `git push -u origin factory/T010b-verify-token-me` — new branch, no force.
- Pull request: https://github.com/hmohammed/noor-quiz/pull/5
