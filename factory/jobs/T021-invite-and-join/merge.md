# Merge — T021

## Commands

1. `git fetch origin` then `git rebase origin/main` in the worktree. Result: already up to date with `f4163d7`.
2. Copied the job folder into the worktree and set T021 to `done` / `factory` in `docs/tasks/BOARD.md`. Commit `08a8fe6` `factory: T021 records`.
3. Checks from the worktree:
   - `npx eslint .` — pass
   - `npx prettier --check --end-of-line auto .` — pass
   - `npm run typecheck` — pass
   - `npm test` — 1205 tests passed. `tooling/src/docs-commands.test.ts` failed to load because this Windows checkout stores `AGENT.md` as CRLF. That suite is unchanged by this branch.
   - `npm run test:emulator` — 239 passed
   - `npm run test:e2e` — 12 passed, including user A creating an invite and user B joining
4. Push and open the pull request, then squash-merge it in this repository (AGENT.md).
