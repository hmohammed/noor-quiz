# Merge — T020

## Commands

1. `git fetch origin` then `git rebase origin/main` in the worktree. Result: already up to date with `df73f1d`.
2. Copied the job folder into the worktree and set T020 to `done` / `factory` in `docs/tasks/BOARD.md`. Commit `62fab8b` `factory: T020 records`.
3. Checks from the worktree:
   - `npx eslint .` — pass
   - `npx prettier --check --end-of-line auto .` — pass
   - `npm run typecheck` — pass
   - `npm test` — 1078 tests passed. `tooling/src/docs-commands.test.ts` failed to load because this Windows checkout stores `AGENT.md` as CRLF. That suite is unchanged by this branch.
   - `npm run test:emulator` — 209 passed
   - `npm run test:e2e` — 11 passed, including create a community and see it in the list
4. Push and open the pull request, then squash-merge it in this repository (AGENT.md).
